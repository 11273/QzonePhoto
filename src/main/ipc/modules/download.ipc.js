// eslint-disable-next-line no-unused-vars
import { DownloadService } from '@main/services/main/download'
import { ServiceNames } from '@main/services/service-manager'
import { IPC_DOWNLOAD } from '@shared/ipc-channels'
import { downloadEventPusher } from '@main/services/download-event-pusher'

export function createDownloadHandlers(service) {
  /** @type {DownloadService} */
  const downloadService = service.get(ServiceNames.DOWNLOAD)

  // 初始化推送管理器
  downloadEventPusher.setDownloadService(downloadService)
  downloadEventPusher.startPush()

  return {
    // 添加单个下载任务
    [IPC_DOWNLOAD.ADD_TASK]: async (event, context) => {
      return downloadService.addTask(context.payload)
    },

    // 添加相册下载任务
    [IPC_DOWNLOAD.ADD_ALBUM]: async (event, context) => {
      return await downloadService.addAlbumTasks(context.payload)
    },

    // 获取任务列表（分页）
    [IPC_DOWNLOAD.GET_TASKS]: async (event, context) => {
      const { page = 1, pageSize = 50, status = null } = context?.payload || {}
      return downloadService.getTasks(page, pageSize, status)
    },

    // 获取活跃任务
    [IPC_DOWNLOAD.GET_ACTIVE_TASKS]: async () => {
      return downloadService.getActiveTasks()
    },

    // 获取任务统计
    [IPC_DOWNLOAD.GET_STATS]: async () => {
      return downloadService.getTaskStats()
    },

    // 暂停任务
    [IPC_DOWNLOAD.PAUSE_TASK]: async (event, context) => {
      downloadService.pauseTask(context.payload)
      return { success: true }
    },

    // 继续任务
    [IPC_DOWNLOAD.RESUME_TASK]: async (event, context) => {
      downloadService.resumeTask(context.payload)
      return { success: true }
    },

    // 重试任务
    [IPC_DOWNLOAD.RETRY_TASK]: async (event, context) => {
      downloadService.retryTask(context.payload)
      return { success: true }
    },

    // 删除任务
    [IPC_DOWNLOAD.DELETE_TASK]: async (event, context) => {
      const { taskId, deleteFile = false } = context.payload
      downloadService.deleteTask(taskId, deleteFile)
      return { success: true }
    },

    // 取消所有任务
    [IPC_DOWNLOAD.CANCEL_ALL]: async () => {
      downloadService.cancelAll()
      return { success: true }
    },

    // 恢复所有任务
    [IPC_DOWNLOAD.RESUME_ALL]: async () => {
      downloadService.resumeAll()
      return { success: true }
    },

    // 清空任务列表
    [IPC_DOWNLOAD.CLEAR_TASKS]: async () => {
      downloadService.clearTasks()
      return { success: true }
    },

    // 选择下载目录
    [IPC_DOWNLOAD.SELECT_DIRECTORY]: async () => {
      return downloadService.selectDirectory()
    },

    // 打开下载文件夹
    [IPC_DOWNLOAD.OPEN_FOLDER]: async (event, context) => {
      const folderPath = context?.payload?.folderPath
      return downloadService.openFolder(folderPath)
    },

    // 获取默认下载路径
    [IPC_DOWNLOAD.GET_DEFAULT_PATH]: async () => {
      return downloadService.getDefaultPath()
    },

    // 设置默认下载路径
    [IPC_DOWNLOAD.SET_DEFAULT_PATH]: async (event, context) => {
      return downloadService.setDefaultPath(context.payload)
    },

    // 获取并发数
    [IPC_DOWNLOAD.GET_CONCURRENCY]: async () => {
      return downloadService.getConcurrency()
    },

    // 设置并发数
    [IPC_DOWNLOAD.SET_CONCURRENCY]: async (event, context) => {
      return downloadService.setConcurrency(context.payload)
    },

    // 获取文件替换设置
    [IPC_DOWNLOAD.GET_REPLACE_EXISTING]: async () => {
      return downloadService.getReplaceExistingSetting()
    },

    // 设置文件替换选项
    [IPC_DOWNLOAD.SET_REPLACE_EXISTING]: async (event, context) => {
      return downloadService.setReplaceExistingSetting(context.payload)
    },

    // 设置下载管理器打开状态
    [IPC_DOWNLOAD.SET_MANAGER_OPEN]: async (event, context) => {
      const isOpen = context?.payload?.isOpen || false
      downloadEventPusher.setDownloadManagerOpen(isOpen)
      return { success: true }
    },

    // 请求分页任务列表
    [IPC_DOWNLOAD.REQUEST_TASKS_PAGE]: async (event, context) => {
      const { page = 1, pageSize = 50, status = null } = context?.payload || {}
      return await downloadEventPusher.requestTasksPage(page, pageSize, status)
    },

    // 设置当前用户
    [IPC_DOWNLOAD.SET_CURRENT_USER]: async (event, context) => {
      const { uin } = context?.payload || {}
      await downloadService.setCurrentUser(uin)
      return { success: true }
    }
  }
}
