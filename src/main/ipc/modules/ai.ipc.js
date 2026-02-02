import { ServiceNames } from '@main/services/service-manager'
import { IPC_AI } from '@shared/ipc-channels'

/**
 * 创建 AI 模块 IPC 处理器
 * @param {import('@main/services/service-manager').ServiceManager} services
 */
export function createAiHandlers(services) {
  const aiService = services.get(ServiceNames.AI)
  console.log('[IPC] 正在初始化 AI 模块处理器...')

  const handlers = {
    // 状态与初始化
    [IPC_AI.CHECK_MODELS]: async () => {
      return aiService.checkModels()
    },
    [IPC_AI.INIT_ENGINE]: async () => {
      return aiService.initWorker()
    },
    [IPC_AI.CHECK_STATUS]: async () => {
      return aiService.checkWorkerHealth()
    },
    [IPC_AI.RESTART]: async () => {
      return aiService.restart()
    },
    [IPC_AI.GET_SERVICE_STATUS]: async () => {
      return aiService.getServiceStatus()
    },

    // 睡眠控制
    ['ai:startBlockSleep']: async () => {
      return aiService.startBlockSleep()
    },
    ['ai:stopBlockSleep']: async () => {
      return aiService.stopBlockSleep()
    },

    // 扫描控制
    [IPC_AI.SCAN_START]: async (_, { payload }) => {
      return aiService.startBackgroundScan(payload?.paths)
    },
    [IPC_AI.START_BACKGROUND_SCAN]: async (_, { payload }) => {
      return aiService.startBackgroundScan(payload?.paths)
    },
    [IPC_AI.SET_WATCH_PATHS]: async (_, { payload }) => {
      return aiService.setWatchPaths(payload?.paths)
    },
    [IPC_AI.START_GLOBAL_ANALYSIS]: async () => {
      return aiService.startGlobalAnalysis()
    },
    [IPC_AI.SCAN_STOP]: async () => {
      return aiService.stopScan()
    },
    [IPC_AI.CLUSTER_FACES]: async () => {
      return aiService.clusterFaces()
    },
    [IPC_AI.DELETE_PHOTO]: async (_, { payload }) => {
      return aiService.deletePhoto(payload?.path)
    },
    [IPC_AI.GET_PENDING_COUNT]: async () => {
      return aiService.getPendingCount()
    },
    [IPC_AI.GET_STORAGE_SIZE]: async () => {
      return aiService.getStorageSize()
    },

    // 数据库查询与业务
    [IPC_AI.SEARCH_BY_TEXT]: async (_, { payload }) => {
      return aiService.searchByText(payload?.text, payload?.limit)
    },
    [IPC_AI.GET_FACE_GROUPS]: async () => {
      return aiService.getFaceGroups()
    },
    [IPC_AI.GET_PHOTOS_BY_FACE]: async (_, { payload }) => {
      return aiService.getPhotosByFace(payload?.faceId)
    },
    [IPC_AI.GET_MEMORIES]: async () => {
      return aiService.getMemories()
    }
  }

  const keys = Object.keys(handlers)
  console.log(`[IPC] AI 模块处理器初始化完成，共 ${keys.length} 个通道:`, keys)
  return handlers
}
