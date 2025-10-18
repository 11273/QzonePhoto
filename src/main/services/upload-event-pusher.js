import { IPC_UPLOAD } from '@shared/ipc-channels'
import windowManager from '@main/core/window'
import { is } from '@electron-toolkit/utils'

/**
 * 上传事件推送管理器
 * 负责将上传任务状态变化推送到渲染进程
 * 基于下载事件推送器实现，支持差量推送、分页和大量任务处理
 *
 * 节流功能说明：
 * - 活跃任务数量推送：100ms节流，保证UI快速响应
 * - 统计信息推送：500ms节流，减少重复推送
 * - 活跃任务列表推送：300ms节流，平衡性能与实时性
 * - 详细状态推送：200ms节流，用于首页状态显示
 * - 立即推送：100ms节流，确保重要变化及时响应
 * - 变化任务推送：200ms节流，避免任务变化推送过于频繁
 */
export class UploadEventPusher {
  constructor() {
    this.isActive = false
    this.pushTimer = null
    this.uploadService = null

    // 推送优化相关
    this.lastActiveTasksSnapshot = null // 缓存活跃任务快照
    this.lastStatsSnapshot = null // 缓存统计信息快照
    this.hasActiveUploads = false // 是否有活跃的上传任务
    this.changedTaskIds = new Set() // 变化的任务ID集合

    // 推送频率控制
    this.normalInterval = 2000 // 正常情况下的推送间隔
    this.activeInterval = 200 // 有活跃上传时的推送间隔
    this.batchSize = 20 // 每次推送的最大任务数

    // 前端状态跟踪
    this.uploadManagerOpen = false // 上传管理器是否打开

    // 日志优化
    this.pushCount = 0 // 推送计数器
    this.logInterval = 10 // 每10次推送输出一次日志

    // 新增：活跃任务数量快照
    this.lastActiveCountSnapshot = null

    // 新增：详细状态快照
    this.lastDetailedStatusSnapshot = null

    // 节流器存储
    this.throttlers = new Map()

    // 初始化节流方法
    this.initThrottledMethods()
  }

  /**
   * 创建节流函数（立即执行，然后在delay时间内忽略后续调用）
   * @param {Function} func - 需要节流的函数
   * @param {number} delay - 节流延迟时间（毫秒）
   * @param {string} key - 节流器的唯一标识
   * @returns {Function} 节流后的函数
   */
  throttle(func, delay, key) {
    return (...args) => {
      if (!this.throttlers.has(key)) {
        // 立即执行
        func.apply(this, args)
        // 设置节流期
        const timer = setTimeout(() => {
          this.throttlers.delete(key)
        }, delay)
        this.throttlers.set(key, timer)
      }
    }
  }

  /**
   * 初始化节流方法
   */
  initThrottledMethods() {
    // 活跃任务数量推送 - 100ms 节流
    this.throttledPushActiveCount = this.throttle(
      this.pushActiveCount.bind(this),
      100,
      'activeCount'
    )

    // 统计信息推送 - 500ms 节流
    this.throttledPushStats = this.throttle(this.pushStats.bind(this), 500, 'stats')

    // 活跃任务列表推送 - 300ms 节流
    this.throttledPushActiveTasks = this.throttle(
      this.pushActiveTasks.bind(this),
      300,
      'activeTasks'
    )

    // 详细状态推送 - 200ms 节流
    this.throttledPushDetailedStatus = this.throttle(
      this.pushDetailedStatus.bind(this),
      200,
      'detailedStatus'
    )

    // 立即推送 - 100ms 节流
    this.throttledPushImmediate = this.throttle(this.pushImmediate.bind(this), 100, 'immediate')

    // 变化任务推送 - 200ms 节流
    this.throttledPushChangedTasks = this.throttle(
      this.pushChangedTasks.bind(this),
      200,
      'changedTasks'
    )
  }

  /**
   * 设置上传服务实例
   * @param {UploadService} uploadService 上传服务实例
   */
  setUploadService(uploadService) {
    this.uploadService = uploadService
    if (is.dev) console.debug('[UploadEventPusher] 上传服务实例已设置')
  }

  /**
   * 开始推送
   */
  startPush() {
    if (this.isActive) {
      if (is.dev) console.debug('[UploadEventPusher] 推送已经在运行中')
      return
    }

    this.isActive = true
    // 立即推送一次，确保首页能及时获取初始状态
    this.pushImmediate()
    this.schedulePush()
    if (is.dev) console.debug('[UploadEventPusher] 上传事件推送已启动')
  }

  /**
   * 停止推送
   */
  stopPush() {
    this.isActive = false
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }

    // 清理所有节流器
    this.throttlers.forEach((timer) => {
      if (timer) clearTimeout(timer)
    })
    this.throttlers.clear()

    if (is.dev) console.debug('[UploadEventPusher] 上传事件推送已停止')
  }

  /**
   * 调度下一次推送
   */
  schedulePush() {
    if (!this.isActive || !this.uploadService) return

    // 根据是否有活跃上传动态调整推送间隔
    const interval = this.hasActiveUploads ? this.activeInterval : this.normalInterval

    this.pushTimer = setTimeout(() => {
      this.executePush()
      this.schedulePush() // 递归调度下一次推送
    }, interval)
  }

  /**
   * 执行推送逻辑
   */
  executePush() {
    try {
      // 增加推送计数器
      this.pushCount++

      // 检查是否有活跃上传任务
      const activeTasks = this.uploadService.getActiveTasks()
      const activeUploadsExist = activeTasks.some((task) => task.status === 'uploading')

      // 更新活跃上传状态
      if (this.hasActiveUploads !== activeUploadsExist) {
        this.hasActiveUploads = activeUploadsExist
        if (is.dev && this.pushCount % this.logInterval === 0) {
          console.debug(`[UploadEventPusher] 活跃上传状态变化: ${activeUploadsExist}`)
        }
      }

      // 定时推送统计信息（减少频率）
      if (this.pushCount % 5 === 0) {
        this.throttledPushStats()
      }

      // 推送活跃任务（如果有变化或有活跃上传）
      if (this.hasActiveUploads || this.pushCount % 3 === 0) {
        this.throttledPushActiveTasks()
      }

      // 推送活跃任务数量（高频率）
      this.throttledPushActiveCount()

      // 推送详细状态（用于首页显示，每次都推送以确保及时更新）
      this.throttledPushDetailedStatus()

      // 推送变化的任务（如果有）
      if (this.changedTaskIds.size > 0) {
        this.throttledPushChangedTasks()
      }
    } catch (error) {
      console.error('[UploadEventPusher] 推送执行失败:', error)
    }
  }

  /**
   * 立即触发推送（外部调用）
   * @param {Array} changedTaskIds - 变化的任务ID列表
   */
  triggerPush(changedTaskIds = []) {
    if (!this.isActive || !this.uploadService) return

    // 添加变化的任务ID
    changedTaskIds.forEach((id) => {
      if (typeof id === 'object' && id.id) {
        this.changedTaskIds.add(id)
      } else {
        this.changedTaskIds.add(id)
      }
    })

    // 立即推送
    this.throttledPushImmediate()
  }

  /**
   * 立即推送（强制推送，不进行快照比较）
   */
  pushImmediate() {
    // 清空快照，强制推送
    this.lastActiveCountSnapshot = null
    this.lastDetailedStatusSnapshot = null
    this.lastStatsSnapshot = null
    this.lastActiveTasksSnapshot = null

    // 直接调用推送方法，不使用节流
    this.pushStats()
    this.pushActiveTasks()
    this.pushActiveCount()
    this.pushDetailedStatus()

    if (this.changedTaskIds.size > 0) {
      this.pushChangedTasks()
    }

    if (is.dev) {
      console.debug('[UploadEventPusher] 立即推送完成（强制）')
    }
  }

  /**
   * 推送统计信息
   */
  pushStats() {
    try {
      const stats = this.uploadService.getTaskStats()

      // 检查是否有变化
      if (!this.hasStatsChanged(stats)) return

      this.lastStatsSnapshot = stats
      this.sendToRenderer(IPC_UPLOAD.STATS_UPDATE, stats)

      if (is.dev && this.pushCount % this.logInterval === 0) {
        console.debug('[UploadEventPusher] 推送统计信息:', stats)
      }
    } catch (error) {
      console.error('[UploadEventPusher] 推送统计信息失败:', error)
    }
  }

  /**
   * 推送活跃任务列表
   */
  pushActiveTasks() {
    try {
      const activeTasks = this.uploadService.getActiveTasks()

      // 检查是否有变化
      if (!this.hasActiveTasksChanged(activeTasks)) return

      this.lastActiveTasksSnapshot = JSON.stringify(
        activeTasks.map((task) => ({
          id: task.id,
          status: task.status,
          progress: task.progress,
          speed: task.speed
        }))
      )

      this.sendToRenderer(IPC_UPLOAD.ACTIVE_TASKS_UPDATE, activeTasks)

      if (is.dev && this.pushCount % this.logInterval === 0) {
        console.debug(`[UploadEventPusher] 推送活跃任务: ${activeTasks.length} 个任务`)
      }
    } catch (error) {
      console.error('[UploadEventPusher] 推送活跃任务失败:', error)
    }
  }

  /**
   * 推送活跃任务数量
   */
  pushActiveCount() {
    try {
      const stats = this.uploadService.getTaskStats()
      const activeCount = stats.active

      // 检查是否有变化
      if (this.lastActiveCountSnapshot === activeCount) return

      this.lastActiveCountSnapshot = activeCount
      this.sendToRenderer(IPC_UPLOAD.ACTIVE_COUNT_UPDATE, activeCount)

      if (is.dev && this.pushCount % this.logInterval === 0) {
        console.debug(`[UploadEventPusher] 推送活跃任务数量: ${activeCount}`)
      }
    } catch (error) {
      console.error('[UploadEventPusher] 推送活跃任务数量失败:', error)
    }
  }

  /**
   * 推送详细状态（用于首页显示）
   */
  pushDetailedStatus() {
    try {
      if (!this.uploadService) return

      const stats = this.uploadService.getTaskStats()
      const activeTasks = this.uploadService.getActiveTasks()
      const uploadingTasks = activeTasks.filter((task) => task.status === 'uploading')
      const failedTasks = activeTasks.filter((task) => task.status === 'error')

      const detailedStatus = {
        uploading: stats.uploading,
        waiting: stats.waiting,
        paused: stats.paused,
        total: stats.uploading + stats.waiting + stats.paused, // 活跃任务总数
        // 简化状态判断：有活跃任务(上传中+等待中)就是active，否则根据暂停任务判断
        primaryStatus:
          stats.uploading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle',
        currentSpeed: uploadingTasks.reduce((sum, task) => sum + (task.speed || 0), 0),
        failedTasks: failedTasks.map((task) => ({
          id: task.id,
          filename: task.filename,
          picTitle: task.picTitle,
          filePath: task.filePath,
          total: task.total,
          type: task.type || 'image/jpeg',
          error: task.error,
          status: task.status
        }))
      }

      const statusKey = JSON.stringify({
        uploading: detailedStatus.uploading,
        waiting: detailedStatus.waiting,
        paused: detailedStatus.paused,
        total: detailedStatus.total,
        primaryStatus: detailedStatus.primaryStatus,
        currentSpeed: detailedStatus.currentSpeed > 0 ? 1 : 0, // 只关心有无速度，不关心具体值
        failedTaskIds: failedTasks.map((t) => t.id).sort() // 记录失败任务ID，避免重复推送相同失败任务
      })

      if (this.lastDetailedStatusSnapshot === statusKey) {
        // 即使快照相同，如果有速度变化，也要推送（用于实时速度显示）
        if (detailedStatus.currentSpeed > 0) {
          this.sendToRenderer(IPC_UPLOAD.DETAILED_STATUS_UPDATE, detailedStatus)
        }
        return
      }

      this.lastDetailedStatusSnapshot = statusKey
      this.sendToRenderer(IPC_UPLOAD.DETAILED_STATUS_UPDATE, detailedStatus)

      if (is.dev && this.pushCount % this.logInterval === 0) {
        console.debug('[UploadEventPusher] 推送详细状态:', detailedStatus)
      }
    } catch (error) {
      console.error('[UploadEventPusher] 推送详细状态失败:', error)
    }
  }

  /**
   * 推送变化的任务
   */
  pushChangedTasks() {
    try {
      if (this.changedTaskIds.size === 0) return

      const changedTasksArray = Array.from(this.changedTaskIds)
      const tasksToSend = []

      for (const taskId of changedTasksArray) {
        if (typeof taskId === 'object' && taskId.deleted) {
          tasksToSend.push(taskId)
        } else {
          // 优先从内存中的 activeTasks 获取最新状态，这样能获取到实时的进度
          // 因为数据库只在进度是10的倍数时才更新，会导致进度显示滞后
          const task =
            this.uploadService.activeTasks?.get(taskId) || this.uploadService.getTaskFromDB(taskId)
          if (task) {
            tasksToSend.push(task)
            if (is.dev && task.status === 'uploading') {
              console.debug(
                `[UploadEventPusher] 推送任务进度: ${task.filename} - ${task.progress}%`
              )
            }
          } else {
            console.warn(`[UploadEventPusher] 找不到任务: ${taskId}`)
          }
        }
      }

      if (tasksToSend.length > 0) {
        this.sendToRenderer(IPC_UPLOAD.TASK_CHANGES, tasksToSend)

        if (is.dev && this.pushCount % this.logInterval === 0) {
          console.debug(`[UploadEventPusher] 推送变化任务: ${tasksToSend.length} 个任务`)
        }
      }

      // 清空变化的任务ID集合
      this.changedTaskIds.clear()
    } catch (error) {
      console.error('[UploadEventPusher] 推送变化任务失败:', error)
    }
  }

  /**
   * 推送分页任务列表（响应前端请求）
   * @param {Object} params - 分页参数
   */
  pushTasksPage(params) {
    try {
      const { page = 1, pageSize = 50, status = null } = params
      const pageData = this.uploadService.getTasks(page, pageSize, status)

      this.sendToRenderer(IPC_UPLOAD.TASKS_PAGE, pageData)

      if (is.dev) {
        console.debug(
          `[UploadEventPusher] 推送分页任务: 第${page}页, ${pageData.tasks.length} 个任务`
        )
      }
    } catch (error) {
      console.error('[UploadEventPusher] 推送分页任务失败:', error)
    }
  }

  /**
   * 检查统计信息是否有变化
   */
  hasStatsChanged(stats) {
    if (!this.lastStatsSnapshot) return true

    const currentSnapshot = JSON.stringify(stats)
    return this.lastStatsSnapshot !== currentSnapshot
  }

  /**
   * 检查活跃任务是否有变化
   */
  hasActiveTasksChanged(activeTasks) {
    if (!this.lastActiveTasksSnapshot) return true

    const currentSnapshot = JSON.stringify(
      activeTasks.map((task) => ({
        id: task.id,
        status: task.status,
        progress: task.progress,
        speed: task.speed
      }))
    )

    return this.lastActiveTasksSnapshot !== currentSnapshot
  }

  /**
   * 设置上传管理器打开状态
   * @param {boolean} isOpen 是否打开
   */
  setManagerOpen(isOpen) {
    this.uploadManagerOpen = isOpen
    if (is.dev) console.debug(`[UploadEventPusher] 上传管理器状态: ${isOpen ? '打开' : '关闭'}`)

    if (isOpen) {
      // 管理器打开时，立即推送一次完整数据
      this.pushImmediate()
    }
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel, data) {
    try {
      const mainWindow = windowManager.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data)
      }
    } catch (error) {
      console.error(`[UploadEventPusher] 发送消息到渲染进程失败 (${channel}):`, error)
    }
  }

  /**
   * 获取推送状态信息
   */
  getStatus() {
    return {
      isActive: this.isActive,
      hasActiveUploads: this.hasActiveUploads,
      uploadManagerOpen: this.uploadManagerOpen,
      pushCount: this.pushCount,
      throttlersCount: this.throttlers.size,
      changedTasksCount: this.changedTaskIds.size
    }
  }

  /**
   * 销毁推送器
   */
  destroy() {
    this.stopPush()
    this.uploadService = null
    this.lastActiveTasksSnapshot = null
    this.lastStatsSnapshot = null
    this.lastActiveCountSnapshot = null
    this.lastDetailedStatusSnapshot = null
    this.changedTaskIds.clear()

    if (is.dev) console.debug('[UploadEventPusher] 推送器已销毁')
  }
}

// 创建单例实例
export const uploadEventPusher = new UploadEventPusher()
