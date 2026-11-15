/**
 * 视频元数据提取服务（主进程）
 * 使用隐藏的 BrowserWindow 和 HTML5 Video API，抓真实视频帧做封面
 */

import { BrowserWindow } from 'electron'
import { pathToFileURL } from 'url'

/**
 * 获取视频元数据（时长 + 封面）
 * @param {string} videoPath 视频文件路径
 * @param {AbortSignal} [signal] 上传暂停时终止封面提取
 * @returns {Promise<{duration: number, cover: string}>} cover 为 base64 data URL
 */
export async function getVideoMetadata(videoPath, signal) {
  return new Promise((resolve, reject) => {
    let win = null
    let settled = false
    let checkInterval
    let timeout
    const finish = (fn) => {
      if (settled) return
      settled = true
      clearInterval(checkInterval)
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      try {
        if (win && !win.isDestroyed()) win.close()
      } catch {
        // ignore close errors
      }
      fn()
    }
    const abort = () =>
      finish(() => reject(Object.assign(new Error('上传已取消'), { cancelled: true })))
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })

    try {
      win = new BrowserWindow({
        show: false,
        width: 1280,
        height: 720,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // 允许加载本地文件
          backgroundThrottling: false
        }
      })

      // 渲染进程崩溃保护：不让大视频解码失败连带主进程死
      win.webContents.on('render-process-gone', (_e, details) => {
        finish(() =>
          reject(new Error(`视频解码进程崩溃: ${details.reason} (exit ${details.exitCode})`))
        )
      })

      // file:// URL 需要正确 encode 中文/空格/括号
      const fileUrl = pathToFileURL(videoPath).href

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin:0">
          <video id="video" preload="metadata" crossorigin="anonymous"></video>
          <canvas id="canvas" style="display:none"></canvas>
          <script>
            const video = document.getElementById('video');
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');

            video.onloadedmetadata = () => {
              window.videoDuration = video.duration * 1000;
              video.currentTime = Math.min(1, video.duration - 0.1);
            };

            video.onseeked = () => {
              try {
                const maxWidth = 1280;
                let width = video.videoWidth;
                let height = video.videoHeight;
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(video, 0, 0, width, height);
                window.videoCover = canvas.toDataURL('image/jpeg', 0.9);
              } catch (error) {
                window.videoError = error.message;
              }
            };

            video.onerror = () => {
              window.videoError = (video.error && video.error.message) || '视频加载失败';
            };

            video.src = ${JSON.stringify(fileUrl)};
          </script>
        </body>
        </html>
      `

      win
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        .catch((error) => finish(() => reject(error)))

      // 轮询检查结果
      checkInterval = setInterval(async () => {
        if (settled) return
        try {
          if (!win || win.isDestroyed()) {
            clearInterval(checkInterval)
            finish(() => reject(new Error('窗口已销毁')))
            return
          }
          const state = await win.webContents.executeJavaScript(
            '({d: window.videoDuration||0, c: window.videoCover||"", e: window.videoError||""})'
          )
          if (state.e) {
            clearInterval(checkInterval)
            finish(() => reject(new Error(state.e)))
            return
          }
          if (state.d && state.c) {
            clearInterval(checkInterval)
            finish(() => resolve({ duration: Math.round(state.d), cover: state.c }))
          }
        } catch (err) {
          clearInterval(checkInterval)
          finish(() => reject(err))
        }
      }, 200)

      // 超时处理（30 秒 — 大视频解码慢）
      timeout = setTimeout(() => {
        clearInterval(checkInterval)
        finish(() => reject(new Error('获取视频元数据超时')))
      }, 30000)
    } catch (error) {
      finish(() => reject(error))
    }
  })
}
