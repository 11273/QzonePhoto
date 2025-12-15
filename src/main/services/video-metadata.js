/**
 * 视频元数据提取服务（主进程）
 * 使用隐藏的 BrowserWindow 和 HTML5 Video API
 */

import { BrowserWindow } from 'electron'

/**
 * 获取视频元数据（时长 + 封面）
 * @param {string} videoPath 视频文件路径
 * @returns {Promise<{duration: number, cover: string}>}
 */
export async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    let win = null

    try {
      // 创建隐藏的窗口用于视频处理
      win = new BrowserWindow({
        show: false,
        width: 1920,
        height: 1080,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // 允许加载本地文件
          offscreen: true // 使用离屏渲染，更高效
        }
      })

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
              // 获取时长
              window.videoDuration = video.duration * 1000;
              
              // 设置到第1秒提取封面
              video.currentTime = Math.min(1, video.duration - 0.1);
            };
            
            video.onseeked = () => {
              try {
                // 计算缩放后的尺寸（最大宽度 1280px）
                const maxWidth = 1280;
                let width = video.videoWidth;
                let height = video.videoHeight;
                
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
                
                // 设置 canvas 尺寸
                canvas.width = width;
                canvas.height = height;
                
                // 绘制视频帧
                ctx.drawImage(video, 0, 0, width, height);
                
                // 导出为 base64
                window.videoCover = canvas.toDataURL('image/jpeg', 0.9);
              } catch (error) {
                window.videoError = error.message;
              }
            };
            
            video.onerror = () => {
              window.videoError = video.error?.message || '视频加载失败';
            };
            
            // 加载视频
            video.src = 'file://${videoPath.replace(/\\/g, '/')}';
          </script>
        </body>
        </html>
      `

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      // 轮询检查结果
      const checkInterval = setInterval(async () => {
        try {
          if (win && !win.isDestroyed()) {
            const duration = await win.webContents.executeJavaScript('window.videoDuration')
            const cover = await win.webContents.executeJavaScript('window.videoCover')
            const error = await win.webContents.executeJavaScript('window.videoError')

            if (error) {
              clearInterval(checkInterval)
              if (win && !win.isDestroyed()) win.close()
              reject(new Error(error))
              return
            }

            if (duration && cover) {
              clearInterval(checkInterval)
              if (win && !win.isDestroyed()) win.close()
              resolve({
                duration: Math.round(duration),
                cover: cover
              })
            }
          } else {
            clearInterval(checkInterval)
            reject(new Error('窗口已销毁'))
          }
        } catch (err) {
          clearInterval(checkInterval)
          if (win && !win.isDestroyed()) win.close()
          reject(err)
        }
      }, 100)

      // 超时处理（15秒）
      setTimeout(() => {
        clearInterval(checkInterval)
        if (win && !win.isDestroyed()) {
          win.close()
        }
        reject(new Error('获取视频元数据超时'))
      }, 15000)
    } catch (error) {
      if (win && !win.isDestroyed()) {
        win.close()
      }
      reject(error)
    }
  })
}
