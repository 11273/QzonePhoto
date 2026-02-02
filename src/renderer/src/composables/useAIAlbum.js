import { ref, onMounted, onUnmounted } from 'vue'

/**
 * useAIAlbum: AI 相册管理的 Composition API
 */
export function useAIAlbum() {
  const isScanning = ref(false)
  const scanProgress = ref({
    current: 0,
    total: 0,
    filePath: ''
  })

  /**
   * 开始扫描
   * @param {string[]} paths
   */
  const startScan = async (paths) => {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      console.warn('[AI Album] startScan called with empty or invalid paths', paths)
      return false
    }
    isScanning.value = true
    const success = await window.QzoneAPI.ai.startScan(paths)
    if (!success) {
      isScanning.value = false
    }
    return success
  }

  /**
   * 停止扫描
   */
  const stopScan = async () => {
    await window.QzoneAPI.ai.stopScan()
    isScanning.value = false
  }

  /**
   * 以文搜图
   * @param {string} text
   * @param {number} limit
   */
  const searchByText = async (text, limit = 50) => {
    return await window.QzoneAPI.ai.searchByText(text, limit)
  }

  /**
   * 获取人脸聚类列表
   */
  const getFaceGroups = async () => {
    return await window.QzoneAPI.ai.getFaceGroups()
  }

  /**
   * 根据人脸 ID 获取照片
   */
  const getPhotosByFace = async (faceId) => {
    return await window.QzoneAPI.ai.getPhotosByFace(faceId)
  }

  /**
   * 检查模型是否存在
   */
  const checkModels = async () => {
    try {
      const api = window.QzoneAPI?.ai?.checkModels
      if (typeof api !== 'function') {
        console.warn('[AI Album] checkModels API not available yet.')
        return { exists: false, error: 'API_NOT_READY' }
      }
      const res = await api()
      if (!res) {
        console.error('[AI Album] checkModels returned null/undefined.')
        return { exists: false, error: 'NO_RESPONSE' }
      }
      return res.data || res
    } catch (err) {
      console.error('[AI Album] checkModels error:', err)
      return { exists: false, error: err.message }
    }
  }

  /**
   * 获取回忆数据
   */
  const getMemories = async () => {
    return await window.QzoneAPI.ai.getMemories()
  }

  /**
   * 获取 AI Worker 详细状态 (诊断用)
   */
  const getWorkerInfo = async () => {
    const api = window.QzoneAPI?.ai?.checkStatus
    if (typeof api !== 'function') return null
    return await api()
  }

  // 监听扫描进度
  const handleProgress = (progress) => {
    scanProgress.value = progress
    if (progress.current === progress.total) {
      isScanning.value = false
    }
  }

  onMounted(async () => {
    window.QzoneAPI.ai.onScanProgress(handleProgress)
  })

  onUnmounted(() => {
    window.QzoneAPI.ai.removeScanProgress()
  })

  return {
    isScanning,
    scanProgress,
    startScan,
    stopScan,
    searchByText,
    getFaceGroups,
    getPhotosByFace,
    getMemories,
    checkModels,
    getWorkerInfo
  }
}
