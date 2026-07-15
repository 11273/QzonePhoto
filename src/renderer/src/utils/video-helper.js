/**
 * 渲染进程视频处理工具
 * 时长直接在 renderer 用 HTMLVideoElement 读（支持 fMP4）；
 * 封面仍走主进程 IPC（BrowserWindow 抓帧）。
 */

/**
 * 用 HTMLVideoElement.duration 读视频时长
 *
 * 必须在 renderer 而非主进程做 —— Chromium 的 HTML5 video 解析器
 * 支持 fragmented MP4、各种容器，比手写 mvhd 解析靠谱得多。
 * （fMP4 的 mvhd duration 是 0，时长散落在每个 moof，手写很难拿到）
 *
 * @param {string} filePath 本地视频文件绝对路径
 * @returns {Promise<number>} 毫秒，失败返回 0
 */
export function readVideoDurationFromRenderer(filePath) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    let settled = false
    const finish = (ms) => {
      if (settled) return
      settled = true
      // 释放资源
      try {
        video.removeAttribute('src')
        video.load()
      } catch {
        // ignore
      }
      resolve(ms)
    }
    video.onloadedmetadata = () => {
      const d = video.duration
      if (!isFinite(d) || d <= 0) {
        finish(0)
      } else {
        finish(Math.round(d * 1000))
      }
    }
    video.onerror = () => finish(0)
    // 安全超时
    setTimeout(() => finish(0), 15000)
    // 主进程签发短时 qzone-local token；renderer 永远不直接拼接本地路径。
    window.QzoneAPI.getVideoPreview({ filePath })
      .then((result) => {
        if (!result?.dataUrl) return finish(0)
        video.src = result.dataUrl
      })
      .catch(() => finish(0))
  })
}

/**
 * 获取视频完整元数据（时长 + 封面）
 *  - 时长：renderer 内直接读，准确
 *  - 封面：主进程 BrowserWindow 抓帧（保留原链路）
 * @param {string} videoPath
 * @returns {Promise<{duration: number, cover: string}>}
 */
export async function getVideoMetadata(videoPath) {
  // 并行：本地读时长 + 主进程提元数据（拿封面）
  const [localDuration, mainResult] = await Promise.all([
    readVideoDurationFromRenderer(videoPath),
    window.QzoneAPI.getVideoMetadata({ filePath: videoPath }).catch((e) => {
      console.warn('[video-helper] 主进程元数据提取失败:', e?.message || e)
      return null
    })
  ])

  // 时长优先用 renderer 读到的（HTMLVideoElement 准确，支持 fMP4）
  // 主进程兜底（避免 renderer 读不到的边角格式）
  const duration = localDuration > 0 ? localDuration : mainResult?.duration || 0
  const cover = mainResult?.cover || null

  console.log('[video-helper] 视频元数据:', {
    duration,
    durationSource: localDuration > 0 ? 'renderer-HTMLVideo' : 'main-process',
    hasCover: !!cover
  })

  return { duration, cover }
}
