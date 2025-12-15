/**
 * 渲染进程视频处理工具（通过 IPC 调用主进程）
 * 用于提取视频时长和封面
 */

/**
 * 获取视频完整元数据（时长 + 封面）
 * 通过 IPC 调用主进程提取
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<{duration: number, cover: string}>}
 */
export async function getVideoMetadata(videoPath) {
  try {
    // 通过 IPC 调用主进程
    const metadata = await window.QzoneAPI.getVideoMetadata({ filePath: videoPath })

    if (!metadata) {
      console.warn('[video-helper] 主进程返回空元数据')
      return {
        duration: 0,
        cover: null
      }
    }

    console.log('[video-helper] 视频元数据获取成功:', {
      duration: metadata.duration,
      hasCover: !!metadata.cover
    })

    return {
      duration: metadata.duration || 0,
      cover: metadata.cover || null
    }
  } catch (error) {
    console.error('[video-helper] 获取视频元数据失败:', error)
    return {
      duration: 0,
      cover: null
    }
  }
}
