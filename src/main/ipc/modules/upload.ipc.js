// eslint-disable-next-line no-unused-vars
import { UploadService } from '@main/services/main/upload'
import { ServiceNames } from '@main/services/service-manager'
import { IPC_UPLOAD } from '@shared/ipc-channels'
import { uploadEventPusher } from '@main/services/upload-event-pusher'

export function createUploadHandlers(service) {
  /** @type {UploadService} */
  const uploadService = service.get(ServiceNames.UPLOAD)

  // 初始化推送管理器，但不立即启动
  // 等待用户登录后通过 setCurrentUser 启动
  uploadEventPusher.setUploadService(uploadService)

  return {
    // 添加单个上传任务
    [IPC_UPLOAD.ADD_TASK]: async (event, context) => {
      return uploadService.addTask(context.payload)
    },

    // 批量添加上传任务
    [IPC_UPLOAD.ADD_BATCH_TASKS]: async (event, context) => {
      const { files, albumId, albumName, sessionId } = context.payload
      return uploadService.addBatchTasks(files, albumId, albumName, sessionId)
    },

    // 获取任务列表（分页），支持按相册筛选
    [IPC_UPLOAD.GET_TASKS]: async (event, context) => {
      const { page = 1, pageSize = 50, status = null, albumId = null } = context?.payload || {}
      return uploadService.getTasks(page, pageSize, status, albumId)
    },

    // 获取活跃任务
    [IPC_UPLOAD.GET_ACTIVE_TASKS]: async () => {
      return uploadService.getActiveTasks()
    },

    // 获取任务统计
    [IPC_UPLOAD.GET_STATS]: async () => {
      return uploadService.getTaskStats()
    },

    // 获取所有相册及其统计信息
    [IPC_UPLOAD.GET_ALBUMS_WITH_STATS]: async () => {
      return uploadService.getAlbumsWithStats()
    },

    // 获取指定相册的统计信息
    [IPC_UPLOAD.GET_ALBUM_STATS]: async (event, context) => {
      const albumId = context.payload
      console.log('[IPC Upload] GET_ALBUM_STATS 接收到请求 - albumId:', albumId)
      console.log('[IPC Upload] context:', context)
      const result = uploadService.getAlbumStats(albumId)
      console.log('[IPC Upload] GET_ALBUM_STATS 返回结果:', result)
      return result
    },

    // 获取指定相册的未完成任务
    [IPC_UPLOAD.GET_PENDING_TASKS_BY_ALBUM]: async (event, context) => {
      const albumId = context.payload
      return uploadService.getPendingTasksByAlbum(albumId)
    },

    // 获取指定会话的所有任务
    [IPC_UPLOAD.GET_TASKS_BY_SESSION]: async (event, context) => {
      const sessionId = context.payload
      return uploadService.getTasksBySession(sessionId)
    },

    // 暂停任务
    [IPC_UPLOAD.PAUSE_TASK]: async (event, context) => {
      uploadService.pauseTask(context.payload)
      return { success: true }
    },

    // 继续任务
    [IPC_UPLOAD.RESUME_TASK]: async (event, context) => {
      uploadService.resumeTask(context.payload)
      return { success: true }
    },

    // 重试任务
    [IPC_UPLOAD.RETRY_TASK]: async (event, context) => {
      uploadService.retryTask(context.payload)
      return { success: true }
    },

    // 删除任务
    [IPC_UPLOAD.DELETE_TASK]: async (event, context) => {
      uploadService.deleteTask(context.payload)
      return { success: true }
    },

    // 取消所有任务
    [IPC_UPLOAD.CANCEL_ALL]: async () => {
      await uploadService.cancelAll()
      return { success: true }
    },

    // 取消特定相册或会话的任务
    [IPC_UPLOAD.CANCEL_TASKS_BY_ALBUM]: async (event, context) => {
      const { albumId, sessionId } = context?.payload || {}
      const count = await uploadService.cancelTasksByAlbum(albumId, sessionId)
      return { success: true, count }
    },

    // 删除特定会话的所有任务
    [IPC_UPLOAD.DELETE_TASKS_BY_SESSION]: async (event, context) => {
      const sessionId = context?.payload
      const count = await uploadService.deleteTasksBySession(sessionId)
      return { success: true, count }
    },

    // 暂停所有任务
    [IPC_UPLOAD.PAUSE_ALL]: async () => {
      const count = await uploadService.pauseAll()
      return { success: true, count }
    },

    // 恢复所有任务
    [IPC_UPLOAD.RESUME_ALL]: async () => {
      await uploadService.resumeAll()
      return { success: true }
    },

    // 清空任务列表
    [IPC_UPLOAD.CLEAR_TASKS]: async () => {
      await uploadService.clearTasks()
      return { success: true }
    },

    // 批量重试失败任务
    [IPC_UPLOAD.RETRY_ALL_FAILED]: async (event, context) => {
      const albumId = context?.payload || null
      const count = await uploadService.retryAllFailed(albumId)
      return { success: true, count }
    },

    // 清理完成的任务
    [IPC_UPLOAD.CLEAR_COMPLETED]: async (event, context) => {
      const albumId = context?.payload || null
      const count = await uploadService.clearCompletedTasks(albumId)
      return { success: true, count }
    },

    // 清理取消的任务
    [IPC_UPLOAD.CLEAR_CANCELLED]: async (event, context) => {
      const albumId = context?.payload || null
      const count = await uploadService.clearCancelledTasks(albumId)
      return { success: true, count }
    },

    // 清空所有任务
    [IPC_UPLOAD.CLEAR_TASKS]: async () => {
      const result = await uploadService.clearAllTasks()
      return { success: true, count: result.count }
    },

    // 获取并发数
    [IPC_UPLOAD.GET_CONCURRENCY]: async () => {
      return uploadService.getConcurrency()
    },

    // 设置并发数
    [IPC_UPLOAD.SET_CONCURRENCY]: async (event, context) => {
      return uploadService.setConcurrency(context.payload)
    },

    // 设置上传管理器打开状态
    [IPC_UPLOAD.SET_MANAGER_OPEN]: async (event, context) => {
      const isOpen = context.payload
      uploadEventPusher.setManagerOpen(isOpen)
      return { success: true }
    },

    // 请求分页任务列表
    [IPC_UPLOAD.REQUEST_TASKS_PAGE]: async (event, context) => {
      const params = context.payload || {}
      uploadEventPusher.pushTasksPage(params)
      return { success: true }
    },

    // 设置当前用户
    [IPC_UPLOAD.SET_CURRENT_USER]: async (event, context) => {
      const { uin, p_skey, hostUin } = context.payload || {}

      // 处理登出（清除用户）
      if (!uin || !p_skey) {
        console.log('[IPC Upload] 用户登出，停止推送器')
        await uploadService.setCurrentUser(null, null, null)
        uploadEventPusher.stopPush()
        return { success: true, uin: null }
      }

      // 处理登录/切换用户
      if (hostUin) {
        console.log('[IPC Upload] 设置当前用户:', uin)
        await uploadService.setCurrentUser(uin, p_skey, hostUin)

        // 启动推送器（如果还没启动）
        if (!uploadEventPusher.isActive) {
          console.log('[IPC Upload] 启动推送器')
          uploadEventPusher.startPush()
        } else {
          // 已启动则触发立即推送，更新数据
          uploadEventPusher.pushImmediate()
        }

        return { success: true, uin }
      }

      return { success: false, error: '用户信息不完整' }
    }
  }
}
