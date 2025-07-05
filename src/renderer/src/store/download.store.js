import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useDownloadStore = defineStore('download', () => {
  // 下载管理器显示状态
  const showDownloadManager = ref(false)

  // 任务列表状态
  const tasks = ref([])

  // 相册下载状态管理 - 新增
  const albumDownloadStates = ref(new Map())
  // 正在获取照片的相册（用于批量下载时的状态）
  const fetchingAlbums = ref(new Set())
  // 全局取消标志，用于协调批量下载和单个下载的取消操作
  const globalCancelFlags = ref(new Map())

  // 计算属性：获取指定相册的下载状态
  const getAlbumDownloadState = computed(() => {
    return (albumId) => {
      const state = albumDownloadStates.value.get(albumId)
      if (!state) {
        return {
          isDownloading: false,
          progress: 0,
          status: 'idle',
          downloadedCount: 0,
          totalCount: 0,
          error: null
        }
      }
      return state
    }
  })

  // 计算属性：检查相册是否正在下载
  const isAlbumDownloading = computed(() => {
    return (albumId) => {
      const state = albumDownloadStates.value.get(albumId)
      return state?.isDownloading || false
    }
  })

  // 计算属性：检查相册是否正在获取照片
  const isAlbumFetching = computed(() => {
    return (albumId) => {
      // 双重检查：既检查fetchingAlbums，也检查状态
      return (
        fetchingAlbums.value.has(albumId) ||
        albumDownloadStates.value.get(albumId)?.status === 'fetching'
      )
    }
  })

  // 更新相册下载状态
  const updateAlbumDownloadState = (albumId, state) => {
    albumDownloadStates.value.set(albumId, {
      ...albumDownloadStates.value.get(albumId),
      ...state
    })
  }

  // 开始相册获取
  const startAlbumFetch = (albumId, totalPhotos) => {
    // 同时设置获取标志
    fetchingAlbums.value.add(albumId)

    updateAlbumDownloadState(albumId, {
      isDownloading: false,
      isFetching: true,
      progress: 0,
      status: 'fetching',
      fetchedCount: 0,
      totalPhotos: totalPhotos,
      downloadedCount: 0,
      totalCount: 0,
      error: null
    })
  }

  // 更新获取进度
  const updateFetchProgress = (albumId, fetchedCount) => {
    const currentState = albumDownloadStates.value.get(albumId)
    if (!currentState || !currentState.totalPhotos) {
      return // 如果没有初始状态，不更新
    }

    const progress =
      currentState.totalPhotos > 0 ? Math.round((fetchedCount / currentState.totalPhotos) * 100) : 0
    updateAlbumDownloadState(albumId, {
      fetchedCount,
      progress
    })
  }

  // 完成获取，开始下载
  const completeFetch = (albumId, totalCount) => {
    updateAlbumDownloadState(albumId, {
      isFetching: false,
      isDownloading: true,
      status: 'downloading',
      progress: 0,
      totalCount: totalCount,
      downloadedCount: 0
    })
    // 同时清理获取状态
    fetchingAlbums.value.delete(albumId)
  }

  // 开始相册下载
  const startAlbumDownload = (albumId, totalCount) => {
    updateAlbumDownloadState(albumId, {
      isDownloading: true,
      progress: 0,
      status: 'downloading',
      downloadedCount: 0,
      totalCount: totalCount,
      error: null
    })
  }

  // 更新相册下载进度
  const updateAlbumProgress = (albumId, downloadedCount, totalCount) => {
    const progress = totalCount > 0 ? Math.round((downloadedCount / totalCount) * 100) : 0
    updateAlbumDownloadState(albumId, {
      progress,
      downloadedCount,
      totalCount
    })
  }

  // 完成相册下载
  const completeAlbumDownload = (albumId) => {
    updateAlbumDownloadState(albumId, {
      isDownloading: false,
      status: 'completed',
      progress: 100
    })
  }

  // 相册下载出错
  const errorAlbumDownload = (albumId, error) => {
    updateAlbumDownloadState(albumId, {
      isDownloading: false,
      status: 'error',
      error: error
    })
  }

  // 清除相册下载状态
  const clearAlbumDownloadState = (albumId) => {
    albumDownloadStates.value.delete(albumId)
  }

  // 设置相册正在获取照片
  const setAlbumFetching = (albumId, isFetching) => {
    if (isFetching) {
      fetchingAlbums.value.add(albumId)
    } else {
      fetchingAlbums.value.delete(albumId)
    }
  }

  // 根据任务列表更新相册下载状态
  const syncAlbumStatesFromTasks = () => {
    // 清理已完成或不存在的相册状态
    const activeAlbumIds = new Set()

    tasks.value.forEach((task) => {
      if (task.albumId && ['waiting', 'downloading', 'paused'].includes(task.status)) {
        activeAlbumIds.add(task.albumId)
      }
    })

    // 遍历当前的相册状态，移除不再活跃的
    Array.from(albumDownloadStates.value.keys()).forEach((albumId) => {
      if (!activeAlbumIds.has(albumId)) {
        const state = albumDownloadStates.value.get(albumId)
        if (state?.status !== 'fetching') {
          clearAlbumDownloadState(albumId)
        }
      }
    })

    // 更新活跃相册的状态
    tasks.value.forEach((task) => {
      if (task.albumId) {
        const albumTasks = tasks.value.filter((t) => t.albumId === task.albumId)
        const downloadedCount = albumTasks.filter((t) => t.status === 'completed').length
        const totalCount = albumTasks.length
        const isDownloading = albumTasks.some((t) => ['waiting', 'downloading'].includes(t.status))
        const progress = totalCount > 0 ? Math.round((downloadedCount / totalCount) * 100) : 0

        updateAlbumDownloadState(task.albumId, {
          isDownloading,
          progress,
          status: isDownloading ? 'downloading' : 'idle',
          downloadedCount,
          totalCount
        })
      }
    })
  }

  // 手动刷新任务列表
  const loadTasks = async (page = 1, pageSize = 50, status = null) => {
    try {
      const result = await window.QzoneAPI.download.getTasks({ page, pageSize, status })
      // 新的API返回 { tasks: [], pagination: {} } 格式
      if (result && result.tasks) {
        tasks.value = result.tasks
        syncAlbumStatesFromTasks() // 同步相册状态
        return result
      } else {
        // 兼容旧格式
        tasks.value = result || []
        syncAlbumStatesFromTasks() // 同步相册状态
        return {
          tasks: tasks.value,
          pagination: { page: 1, pageSize, total: tasks.value.length, totalPages: 1 }
        }
      }
    } catch (error) {
      console.error('加载任务失败:', error)
      tasks.value = []
      return { tasks: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } }
    }
  }

  // 更新任务列表
  const updateTasks = (newTasks) => {
    const oldCount = tasks.value.length
    tasks.value = newTasks || []
    console.log('[DownloadStore] 任务更新:', {
      oldCount,
      newCount: tasks.value.length,
      activeCount: tasks.value.filter((t) =>
        ['waiting', 'downloading', 'paused'].includes(t.status)
      ).length
    })
    syncAlbumStatesFromTasks() // 同步相册状态
  }

  // 显示下载管理器
  const showManager = () => {
    showDownloadManager.value = true
  }

  // 隐藏下载管理器
  const hideManager = () => {
    showDownloadManager.value = false
  }

  // 取消相册获取/下载
  const cancelAlbumDownload = (albumId) => {
    // 清除获取状态
    fetchingAlbums.value.delete(albumId)

    // 更新相册状态为取消
    updateAlbumDownloadState(albumId, {
      isDownloading: false,
      isFetching: false,
      status: 'cancelled',
      error: '用户取消'
    })
  }

  // 取消所有正在获取的相册
  const cancelAllFetching = () => {
    // 取消所有正在获取的相册
    Array.from(fetchingAlbums.value).forEach((albumId) => {
      cancelAlbumDownload(albumId)
    })
    fetchingAlbums.value.clear()
  }

  // 重置相册状态为空闲
  const resetAlbumState = (albumId) => {
    clearAlbumDownloadState(albumId)
    fetchingAlbums.value.delete(albumId)
  }

  // 设置全局取消标志
  const setGlobalCancelFlag = (albumId, cancelled = true) => {
    if (cancelled) {
      globalCancelFlags.value.set(albumId, true)
    } else {
      globalCancelFlags.value.delete(albumId)
    }
  }

  // 检查全局取消标志
  const isGloballyCancelled = (albumId) => {
    return globalCancelFlags.value.get(albumId) === true
  }

  // 清理全局取消标志
  const clearGlobalCancelFlag = (albumId) => {
    globalCancelFlags.value.delete(albumId)
  }

  return {
    // 状态
    showDownloadManager,
    tasks,
    albumDownloadStates,
    fetchingAlbums,

    // 计算属性
    getAlbumDownloadState,
    isAlbumDownloading,
    isAlbumFetching,

    // 操作方法
    loadTasks,
    updateTasks,
    showManager,
    hideManager,

    // 相册下载状态管理方法
    startAlbumFetch,
    updateFetchProgress,
    completeFetch,
    startAlbumDownload,
    updateAlbumProgress,
    completeAlbumDownload,
    errorAlbumDownload,
    clearAlbumDownloadState,
    setAlbumFetching,
    syncAlbumStatesFromTasks,

    // 取消方法
    cancelAlbumDownload,
    cancelAllFetching,

    // 重置方法
    resetAlbumState,

    // 全局取消标志方法
    setGlobalCancelFlag,
    isGloballyCancelled,
    clearGlobalCancelFlag
  }
})
