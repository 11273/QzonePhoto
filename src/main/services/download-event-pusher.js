import { IPC_DOWNLOAD } from '@shared/ipc-channels'
import windowManager from '@main/core/window'
import { is } from '@electron-toolkit/utils'

/**
 * 下载事件推送管理器
 * 负责将下载任务状态变化推送到渲染进程
 * 优化版本：支持差量推送、分页和大量任务处理，内置节流功能
 *
 * 节流功能说明：
 * - 活跃任务数量推送：100ms节流，保证UI快速响应
 * - 统计信息推送：500ms节流，减少重复推送
 * - 活跃任务列表推送：300ms节流，平衡性能与实时性
 * - 详细状态推送：200ms节流，用于首页状态显示
 * - 立即推送：100ms节流，确保重要变化及时响应
 * - 变化任务推送：200ms节流，避免任务变化推送过于频繁
 */
export class DownloadEventPusher {
  constructor() {
    this.isActive = false
    this.pushTimer = null
    this.downloadService = null

    // 推送优化相关
    this.lastActiveTasksSnapshot = null // 缓存活跃任务快照
    this.lastStatsSnapshot = null // 缓存统计信息快照
    this.hasActiveDownloads = false // 是否有活跃的下载任务
    this.changedTaskIds = new Set() // 变化的任务ID集合

    // 推送频率控制
    this.normalInterval = 2000 // 正常情况下的推送间隔
    this.activeInterval = 200 // 有活跃下载时的推送间隔
    this.batchSize = 20 // 每次推送的最大任务数

    // 前端状态跟踪
    this.downloadManagerOpen = false // 下载管理器是否打开

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
   * 创建节流函数
   * @param {Function} func - 需要节流的函数
   * @param {number} delay - 节流延迟时间（毫秒）
   * @param {string} key - 节流器的唯一标识
   * @returns {Function} 节流后的函数
   */
  throttle(func, delay, key) {
    let timeoutId
    let lastExecTime = 0
    let lastArgs = null

    return (...args) => {
      const currentTime = Date.now()
      lastArgs = args

      // 如果距离上次执行时间超过delay，立即执行
      if (currentTime - lastExecTime >= delay) {
        lastExecTime = currentTime
        func.apply(this, args)
        return
      }

      // 清除之前的定时器
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.throttlers.delete(key)
      }

      // 计算剩余等待时间
      const remainingTime = delay - (currentTime - lastExecTime)

      // 设置新的定时器，确保在delay时间后执行最后一次调用
      timeoutId = setTimeout(
        () => {
          lastExecTime = Date.now()
          func.apply(this, lastArgs)
          timeoutId = null
          this.throttlers.delete(key)
        },
        Math.max(remainingTime, 10) // 至少10ms延迟
      )

      // 存储定时器ID，用于清理
      this.throttlers.set(key, timeoutId)
    }
  }

  /**
   * 初始化节流方法
   */
  initThrottledMethods() {
    // 为各种推送方法创建节流版本
    this.throttledPushActiveCountUpdate = this.throttle(
      this._pushActiveCountUpdate.bind(this),
      100, // 100ms节流
      'activeCount'
    )

    this.throttledPushStatsUpdate = this.throttle(
      this._pushStatsUpdate.bind(this),
      500, // 500ms节流
      'stats'
    )

    this.throttledPushActiveTasksUpdate = this.throttle(
      this._pushActiveTasksUpdate.bind(this),
      300, // 300ms节流
      'activeTasks'
    )

    this.throttledPushDetailedStatusUpdate = this.throttle(
      this._pushDetailedStatusUpdate.bind(this),
      200, // 200ms节流
      'detailedStatus'
    )

    this.throttledTriggerImmediatePush = this.throttle(
      this._triggerImmediatePush.bind(this),
      100, // 100ms节流，保证及时响应
      'immediatePush'
    )

    this.throttledPushChangedTasks = this.throttle(
      this._pushChangedTasks.bind(this),
      200, // 200ms节流，避免变化任务推送过于频繁
      'changedTasks'
    )
  }

  /**
   * 清理所有节流器
   */
  clearThrottlers() {
    this.throttlers.forEach((timeoutId) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    })
    this.throttlers.clear()
  }

  /**
   * 重置特定节流器
   * @param {string} key - 节流器标识
   */
  resetThrottler(key) {
    const timeoutId = this.throttlers.get(key)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.throttlers.delete(key)
    }
  }

  /**
   * 获取节流器状态（用于调试）
   */
  getThrottleStatus() {
    const status = {}
    this.throttlers.forEach((timeoutId, key) => {
      status[key] = {
        hasActiveTimeout: !!timeoutId,
        timeoutId: timeoutId
      }
    })
    return status
  }

  // 设置下载服务引用
  setDownloadService(downloadService) {
    this.downloadService = downloadService

    // 设置下载服务的更新触发器
    this.downloadService.setUpdateTrigger((changedTaskIds = []) => {
      this.markTasksChanged(changedTaskIds)
    })
  }

  // 标记任务已变化
  markTasksChanged(taskIds) {
    if (Array.isArray(taskIds)) {
      taskIds.forEach((id) => this.changedTaskIds.add(id))
    } else if (taskIds) {
      this.changedTaskIds.add(taskIds)
    }

    // 任务变化时始终立即推送活跃任务数量
    if (this.changedTaskIds.size > 0) {
      this.throttledTriggerImmediatePush()
    }
  }

  // 启动推送
  startPush() {
    if (this.isActive || !this.downloadService) return

    this.isActive = true
    this.scheduleNextPush()

    if (is.dev) console.debug('[DownloadEventPusher] 推送已启动')
  }

  // 调度下次推送
  scheduleNextPush() {
    if (!this.isActive) return

    const interval = this.hasActiveDownloads ? this.activeInterval : this.normalInterval
    this.pushTimer = setTimeout(() => {
      this.checkAndPushUpdates()
      this.scheduleNextPush()
    }, interval)
  }

  // 停止推送
  stopPush() {
    if (!this.isActive) return

    this.isActive = false
    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }

    if (is.dev) console.debug('[DownloadEventPusher] 推送已停止')
  }

  // 检查并推送更新
  checkAndPushUpdates() {
    if (!this.downloadService) return

    try {
      const mainWindow = windowManager.getMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) return

      // 始终推送活跃任务数量和详细状态（用于首页下载管理按钮显示）
      this.throttledPushActiveCountUpdate(mainWindow)
      this.throttledPushDetailedStatusUpdate(mainWindow)

      // 只有在下载管理器打开时才推送详细更新
      if (this.downloadManagerOpen) {
        // 推送统计信息（轻量级，总是推送）
        this.throttledPushStatsUpdate(mainWindow)

        // 推送活跃任务更新（差量推送）
        this.throttledPushActiveTasksUpdate(mainWindow)

        // 如果有特定的变化任务，推送详细信息
        if (this.changedTaskIds.size > 0) {
          this.throttledPushChangedTasks(mainWindow)
        }
      }
    } catch (error) {
      if (is.dev) console.error('[DownloadEventPusher] 推送更新失败:', error)
    }
  }

  // 推送活跃任务数量更新（始终推送，不受弹窗状态影响） - 内部方法
  _pushActiveCountUpdate(mainWindow) {
    // 检查下载服务和数据库是否就绪
    if (!this.downloadService || !this.downloadService.dbInitialized) {
      return
    }

    const currentStats = this.downloadService.getTaskStats()
    const activeCount = currentStats.downloading + currentStats.waiting + currentStats.paused
    const countSnapshot = `active:${activeCount}`

    // 检查活跃任务数量是否变化
    if (countSnapshot !== this.lastActiveCountSnapshot) {
      // if (is.dev) console.debug('[DownloadEventPusher] 推送活跃任务数量:', activeCount)
      mainWindow.webContents.send(IPC_DOWNLOAD.ACTIVE_COUNT_UPDATE, activeCount)
      this.lastActiveCountSnapshot = countSnapshot
    }
  }

  // 推送统计信息更新 - 内部方法
  _pushStatsUpdate(mainWindow) {
    // 检查下载服务和数据库是否就绪
    if (!this.downloadService || !this.downloadService.dbInitialized) {
      return
    }

    const currentStats = this.downloadService.getTaskStats()
    const statsSnapshot = this.generateStatsSnapshot(currentStats)

    // 检查统计信息是否变化
    if (statsSnapshot !== this.lastStatsSnapshot) {
      // if (is.dev) console.debug('[DownloadEventPusher] 推送统计信息:', currentStats)
      mainWindow.webContents.send(IPC_DOWNLOAD.STATS_UPDATE, currentStats)

      this.lastStatsSnapshot = statsSnapshot

      // 更新活跃下载状态
      this.hasActiveDownloads = currentStats.downloading > 0
    }
  }

  // 推送活跃任务更新 - 内部方法
  _pushActiveTasksUpdate(mainWindow) {
    // 检查下载服务和数据库是否就绪
    if (!this.downloadService || !this.downloadService.dbInitialized) {
      return
    }

    const activeTasks = this.downloadService.getActiveTasks()
    const activeSnapshot = this.generateActiveTasksSnapshot(activeTasks)

    // 只有活跃任务快照变化时才推送
    if (activeSnapshot !== this.lastActiveTasksSnapshot) {
      // 限制推送的任务数量，优先推送正在下载的任务
      const tasksToSend = this.prioritizeAndLimitTasks(activeTasks)

      // if (is.dev) console.debug('[DownloadEventPusher] 推送活跃任务:', tasksToSend.length, '个任务')
      mainWindow.webContents.send(IPC_DOWNLOAD.ACTIVE_TASKS_UPDATE, tasksToSend)
      this.lastActiveTasksSnapshot = activeSnapshot
    }
  }

  // 推送变化的任务 - 内部方法
  _pushChangedTasks(mainWindow) {
    if (this.changedTaskIds.size === 0) return

    const changedTasksArray = Array.from(this.changedTaskIds)

    // 分批处理变化的任务
    const batches = this.chunkArray(changedTasksArray, this.batchSize)

    batches.forEach((batch, index) => {
      setTimeout(() => {
        try {
          const tasksData = batch
            .map((taskId) => {
              // 尝试从活跃任务中获取，如果没有则从数据库获取
              const task = this.downloadService.activeTasks?.get(taskId)
              return task || { id: taskId, deleted: true } // 标记已删除的任务
            })
            .filter(Boolean)

          if (tasksData.length > 0) {
            mainWindow.webContents.send(IPC_DOWNLOAD.TASK_CHANGES, tasksData)
          }
        } catch (error) {
          if (is.dev) console.error('[DownloadEventPusher] 推送变化任务失败:', error)
        }
      }, index * 50) // 错开推送时间，避免阻塞
    })

    // 清空变化集合
    this.changedTaskIds.clear()
  }

  // 优先排序并限制任务数量
  prioritizeAndLimitTasks(tasks) {
    // 按状态优先级排序：downloading > waiting > paused > error > completed > cancelled
    const prioritized = tasks.sort((a, b) => {
      const statusPriority = {
        downloading: 1,
        waiting: 2,
        paused: 3,
        error: 4,
        completed: 5,
        cancelled: 6
      }

      const aPriority = statusPriority[a.status] || 7
      const bPriority = statusPriority[b.status] || 7

      // 如果状态优先级不同，按优先级排序
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }

      // 同状态内的排序逻辑
      if (a.status === 'downloading' || a.status === 'waiting') {
        // 下载中和等待中：按创建时间正序（先创建的先下载）
        return a.create_time - b.create_time
      } else {
        // 其他状态：按创建时间倒序（最新的在前，便于查看）
        return b.create_time - a.create_time
      }
    })

    // 限制数量，但确保所有正在下载的任务都包含
    const downloading = prioritized.filter((task) => task.status === 'downloading')
    const others = prioritized.filter((task) => task.status !== 'downloading')

    const maxOthers = Math.max(0, this.batchSize - downloading.length)
    return [...downloading, ...others.slice(0, maxOthers)]
  }

  // 生成统计信息快照
  generateStatsSnapshot(stats) {
    return `${stats.total}:${stats.waiting}:${stats.downloading}:${stats.completed}:${stats.error}:${stats.paused}:${stats.cancelled}`
  }

  // 生成活跃任务快照
  generateActiveTasksSnapshot(tasks) {
    return tasks
      .map((task) => `${task.id}:${task.status}:${task.progress}:${task.speed || 0}`)
      .sort() // 排序确保一致性
      .join('|')
  }

  // 立即推送（用于重要状态变化） - 内部方法
  _triggerImmediatePush() {
    // 检查下载服务和数据库是否就绪
    if (!this.downloadService || !this.downloadService.dbInitialized) {
      return
    }

    try {
      const mainWindow = windowManager.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 始终推送活跃任务数量和详细状态
        this._pushActiveCountUpdate(mainWindow)
        this._pushDetailedStatusUpdate(mainWindow)

        // 只有在下载管理器打开时才推送详细信息
        if (this.downloadManagerOpen) {
          // 推送统计信息
          const stats = this.downloadService.getTaskStats()
          mainWindow.webContents.send(IPC_DOWNLOAD.STATS_UPDATE, stats)

          // 推送活跃任务
          const activeTasks = this.downloadService.getActiveTasks()
          const tasksToSend = this.prioritizeAndLimitTasks(activeTasks)
          mainWindow.webContents.send(IPC_DOWNLOAD.ACTIVE_TASKS_UPDATE, tasksToSend)

          // 如果有变化的任务，也推送
          if (this.changedTaskIds.size > 0) {
            this._pushChangedTasks(mainWindow)
          }

          // 更新快照
          this.lastStatsSnapshot = this.generateStatsSnapshot(stats)
          this.lastActiveTasksSnapshot = this.generateActiveTasksSnapshot(activeTasks)
          this.hasActiveDownloads = stats.downloading > 0

          // 优化日志输出频率
          this.pushCount++
          // if (is.dev && this.pushCount % this.logInterval === 0) {
          //   console.debug(
          //     `[DownloadEventPusher] 立即推送完成，任务数: ${activeTasks.length} (第${this.pushCount}次推送)`
          //   )
          // }
        }
      }
    } catch (error) {
      if (is.dev) console.error('[DownloadEventPusher] 立即推送失败:', error)
    }
  }

  // 推送分页任务列表（响应前端请求）
  async pushTasksPage(mainWindow, page = 1, pageSize = 50, status = null) {
    try {
      // 检查下载服务和数据库是否就绪
      if (!this.downloadService || !this.downloadService.dbInitialized) {
        return { tasks: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } }
      }

      const result = this.downloadService.getTasks(page, pageSize, status)
      mainWindow.webContents.send(IPC_DOWNLOAD.TASKS_PAGE, result)
      return result
    } catch (error) {
      if (is.dev) console.error('[DownloadEventPusher] 推送分页任务失败:', error)
      return { tasks: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } }
    }
  }

  // 请求分页任务列表（供IPC调用）
  async requestTasksPage(page = 1, pageSize = 50, status = null) {
    try {
      // 检查下载服务和数据库是否就绪
      if (!this.downloadService || !this.downloadService.dbInitialized) {
        return { tasks: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } }
      }

      const mainWindow = windowManager.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        return await this.pushTasksPage(mainWindow, page, pageSize, status)
      }
      return { tasks: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } }
    } catch (error) {
      if (is.dev) console.error('[DownloadEventPusher] 请求分页任务失败:', error)
      return { tasks: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } }
    }
  }

  // 工具方法：数组分块
  chunkArray(array, chunkSize) {
    const chunks = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  // 设置下载管理器打开状态
  setDownloadManagerOpen(isOpen) {
    this.downloadManagerOpen = isOpen
    if (is.dev) console.debug(`[DownloadEventPusher] 下载管理器状态: ${isOpen ? '打开' : '关闭'}`)

    // 无论打开还是关闭，都立即推送一次活跃任务数量
    this.throttledTriggerImmediatePush()

    if (isOpen) {
      if (is.dev) console.debug('[DownloadEventPusher] 管理器打开，开始详细推送')
    } else {
      if (is.dev)
        console.debug('[DownloadEventPusher] 管理器关闭，停止详细推送，但保持活跃任务数量推送')
    }
  }

  // 获取推送器状态
  getStatus() {
    return {
      isActive: this.isActive,
      hasActiveDownloads: this.hasActiveDownloads,
      changedTasksCount: this.changedTaskIds.size,
      downloadManagerOpen: this.downloadManagerOpen,
      lastActiveTasksCount: this.lastActiveTasksSnapshot
        ? this.lastActiveTasksSnapshot.split('|').length
        : 0,
      activeThrottlers: this.throttlers.size,
      throttleDetails: this.getThrottleStatus()
    }
  }

  // 销毁推送器
  destroy() {
    this.stopPush()
    this.clearThrottlers()
    this.downloadService = null
    this.lastActiveTasksSnapshot = null
    this.lastStatsSnapshot = null
    this.lastActiveCountSnapshot = null
    this.lastDetailedStatusSnapshot = null
    this.changedTaskIds.clear()

    if (is.dev) console.debug('[DownloadEventPusher] 推送器已销毁')
  }

  // 推送详细状态更新（始终推送，用于首页显示） - 内部方法
  _pushDetailedStatusUpdate(mainWindow) {
    // 检查下载服务和数据库是否就绪
    if (!this.downloadService || !this.downloadService.dbInitialized) {
      return
    }

    const currentStats = this.downloadService.getTaskStats()
    const detailedSnapshot = this.generateDetailedStatusSnapshot(currentStats)

    // 检查详细状态是否变化
    if (detailedSnapshot !== this.lastDetailedStatusSnapshot) {
      // 构建详细状态信息
      const detailedStatus = {
        downloading: currentStats.downloading,
        waiting: currentStats.waiting,
        paused: currentStats.paused,
        total: currentStats.downloading + currentStats.waiting + currentStats.paused,
        // 简化状态判断：有活跃任务(下载中+等待中)就是active，否则根据暂停任务判断
        primaryStatus:
          currentStats.downloading + currentStats.waiting > 0
            ? 'active'
            : currentStats.paused > 0
              ? 'paused'
              : 'idle'
      }

      // if (is.dev) console.debug('[DownloadEventPusher] 推送详细状态:', detailedStatus)
      mainWindow.webContents.send(IPC_DOWNLOAD.DETAILED_STATUS_UPDATE, detailedStatus)
      this.lastDetailedStatusSnapshot = detailedSnapshot
    }
  }

  // 生成详细状态快照
  generateDetailedStatusSnapshot(stats) {
    return `${stats.total}:${stats.waiting}:${stats.downloading}:${stats.completed}:${stats.error}:${stats.paused}:${stats.cancelled}`
  }

  // 公共方法包装器 - 使用节流版本
  pushActiveCountUpdate(mainWindow) {
    this.throttledPushActiveCountUpdate(mainWindow)
  }

  pushStatsUpdate(mainWindow) {
    this.throttledPushStatsUpdate(mainWindow)
  }

  pushActiveTasksUpdate(mainWindow) {
    this.throttledPushActiveTasksUpdate(mainWindow)
  }

  pushDetailedStatusUpdate(mainWindow) {
    this.throttledPushDetailedStatusUpdate(mainWindow)
  }

  triggerImmediatePush() {
    this.throttledTriggerImmediatePush()
  }

  pushChangedTasks(mainWindow) {
    this.throttledPushChangedTasks(mainWindow)
  }
}

// 创建并导出全局推送器实例
export const downloadEventPusher = new DownloadEventPusher()
