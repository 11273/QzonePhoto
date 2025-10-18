import { app } from 'electron'
import path from 'path'
import fs from 'fs-extra'
import logger from '@main/core/logger'
import { is } from '@electron-toolkit/utils'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { fileBatchControl, fileUpload, getFileChunk } from '@main/api'
import {
  calculateFileMD5,
  getFileInfo,
  readFileAsBuffer,
  getImageDimensions
} from '@main/utils/file-processor'
import windowManager from '@main/core/window'
import { IPC_UPLOAD } from '@shared/ipc-channels'

// 上传任务状态常量
export const UPLOAD_TASK_STATUS = {
  WAITING: 'waiting',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
}

// 任务优先级
const PRIORITY = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
}

// 默认配置
const DEFAULT_CONCURRENCY = 1 // 上传并发数设置为1，确保一张一张上传
const DEFAULT_CHUNK_SIZE = 16384 // 16KB
const DEFAULT_PAGE_SIZE = 50
const MAX_ACTIVE_TASKS_IN_MEMORY = 500

export class UploadService {
  constructor() {
    // 核心配置
    this.concurrency = DEFAULT_CONCURRENCY
    this.defaultChunkSize = DEFAULT_CHUNK_SIZE

    // 用户管理
    this.currentUin = null
    this.currentPSkey = null
    this.currentHostUin = null

    // 内存中的活跃任务管理
    this.activeTasks = new Map() // 存储正在上传、等待、暂停、失败的任务
    this.uploadingTasks = new Set() // 正在上传的任务ID
    this.cancelTokens = new Map() // 取消令牌

    // 更新触发器
    this.updateTrigger = null

    // LowDB数据库相关
    this.db = null
    this.dbPath = null
    this.dbInitialized = false

    // 服务管理器引用
    this.serviceManager = null

    // 性能优化配置
    this.pageSize = DEFAULT_PAGE_SIZE
    this.maxActiveTasksInMemory = MAX_ACTIVE_TASKS_IN_MEMORY

    // 异步初始化
    this.initializeAsync()
  }

  // 获取用户专用的数据库路径
  getUserDbPath(uin = null) {
    const userId = uin || this.currentUin
    const filename = userId ? `upload_${userId}.json` : 'upload_default.json'
    return path.join(app.getPath('userData'), filename)
  }

  // 设置当前用户并切换数据库
  async setCurrentUser(uin, p_skey, hostUin) {
    try {
      if (this.currentUin === uin && this.currentPSkey === p_skey) {
        if (is.dev) console.debug(`[UploadService] 用户信息未变化: ${uin}`)
        return
      }

      if (is.dev) console.debug(`[UploadService] 切换用户: ${this.currentUin} -> ${uin}`)

      // 保存当前数据库
      if (this.db && this.dbInitialized) {
        await this.saveDatabase()
      }

      // 取消所有正在进行的上传
      await this.cancelAll()

      // 清空内存数据
      this.clearMemoryData()

      // 更新用户信息
      this.currentUin = uin
      this.currentPSkey = p_skey
      this.currentHostUin = hostUin
      this.dbPath = this.getUserDbPath(uin)

      // 重新初始化数据库和数据
      this.dbInitialized = false
      await this.initializeDatabase()
      this.loadSettings()
      this.loadActiveTasks()
      this.dbInitialized = true

      // 触发全量更新
      this.triggerUpdate([])

      if (is.dev) console.debug(`[UploadService] 用户切换完成: ${uin}`)
    } catch (error) {
      logger.error('切换用户失败:', error)
      throw error
    }
  }

  // 清空内存数据
  clearMemoryData() {
    this.activeTasks.clear()
    this.uploadingTasks.clear()
    this.cancelTokens.clear()
  }

  // 异步初始化方法
  async initializeAsync() {
    this.dbPath = this.getUserDbPath()
    await this.initializeDatabase()
    this.loadSettings()
    this.loadActiveTasks()
    this.dbInitialized = true
    this.triggerUpdate([])
  }

  // 初始化LowDB数据库
  async initializeDatabase() {
    try {
      const dbDir = path.dirname(this.dbPath)
      await fs.ensureDir(dbDir)

      const adapter = new JSONFile(this.dbPath)
      this.db = new Low(adapter, {
        tasks: [],
        settings: {},
        version: '1.0.0',
        uin: this.currentUin
      })

      await this.db.read()

      this.db.data ||= { tasks: [], settings: {}, version: '1.0.0', uin: this.currentUin }
      this.db.data.tasks ||= []
      this.db.data.settings ||= {}
      this.db.data.uin = this.currentUin

      await this.db.write()

      if (is.dev) {
        const dbFilename = path.basename(this.dbPath)
        console.debug(`[UploadService] 数据库初始化完成: ${dbFilename}`)
      }
    } catch (error) {
      logger.error('初始化数据库失败:', error)
    }
  }

  // 设置更新触发器
  setUpdateTrigger(triggerFunction) {
    this.updateTrigger = triggerFunction
  }

  // 触发差量更新
  triggerUpdate(changedTaskIds = []) {
    if (typeof this.updateTrigger === 'function') {
      this.updateTrigger(changedTaskIds)
    }
  }

  /**
   * 直接推送任务进度到渲染进程（实时推送，不经过事件推送器）
   * @param {Object} task - 任务对象
   * @param {boolean} immediate - 是否立即推送，忽略节流
   */
  pushTaskProgressDirect(task, immediate = false) {
    try {
      const mainWindow = windowManager.getMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) {
        return
      }

      // 获取当前时间
      const now = Date.now()

      // 节流控制：每个任务维护自己的上次推送时间
      if (!this._lastPushTimes) {
        this._lastPushTimes = new Map()
      }

      const lastPushTime = this._lastPushTimes.get(task.id) || 0
      const timeSinceLastPush = now - lastPushTime

      // 如果不是立即推送，且距离上次推送小于200ms，则跳过
      if (!immediate && timeSinceLastPush < 200) {
        return
      }

      // 更新推送时间
      this._lastPushTimes.set(task.id, now)

      // 直接发送IPC消息
      mainWindow.webContents.send(IPC_UPLOAD.TASK_CHANGES, [task])

      // if (is.dev) {
      //   console.log(
      //     `[UploadService] 直接推送进度: ${task.filename} - ${task.progress}% - ${Math.round(task.speed / 1024)}KB/s`
      //   )
      // }
    } catch (error) {
      console.error('[UploadService] 直接推送进度失败:', error)
    }
  }

  // 加载设置
  loadSettings() {
    try {
      const savedConcurrency = this.getSetting('concurrency')
      if (savedConcurrency) {
        this.concurrency = Math.max(1, Math.min(5, parseInt(savedConcurrency)))
      }
    } catch (error) {
      logger.error('加载设置失败:', error)
    }
  }

  // 从数据库加载活跃任务到内存
  loadActiveTasks() {
    try {
      const activeTasks = this.db.data.tasks.filter((task) =>
        ['waiting', 'uploading', 'paused', 'error'].includes(task.status)
      )

      let pausedCount = 0
      activeTasks.forEach((task) => {
        // 启动时将所有上传中和等待中的任务改为暂停状态，让用户手动选择是否继续
        if (
          task.status === UPLOAD_TASK_STATUS.UPLOADING ||
          task.status === UPLOAD_TASK_STATUS.WAITING
        ) {
          task.status = UPLOAD_TASK_STATUS.PAUSED
          task.speed = 0
          // 重置上传进度，避免使用不完整的分片数据
          task.progress = 0
          task.currentOffset = 0
          task.uploaded = 0
          this.updateTaskInDB(task)
          pausedCount++
        }
        this.activeTasks.set(task.id, task)
      })

      if (is.dev) {
        console.debug(`[UploadService] 加载了 ${activeTasks.length} 个活跃任务`)
        if (pausedCount > 0) {
          console.debug(
            `[UploadService] 已将 ${pausedCount} 个任务暂停，等待用户手动继续（进度已重置）`
          )
        }
      }
    } catch (error) {
      logger.error('加载活跃任务失败:', error)
    }
  }

  // 获取/设置配置
  getSetting(key) {
    try {
      if (!this.db || !this.db.data) return null
      return this.db.data.settings[key] || null
    } catch (error) {
      logger.error(`获取设置 ${key} 失败:`, error)
      return null
    }
  }

  async setSetting(key, value) {
    try {
      if (!this.db || !this.db.data) return
      this.db.data.settings[key] = value
      await this.db.write()
    } catch (error) {
      logger.error(`设置 ${key} 失败:`, error)
    }
  }

  // 获取/设置并发数
  getConcurrency() {
    return this.concurrency
  }

  async setConcurrency(newConcurrency) {
    const validConcurrency = Math.max(1, Math.min(5, parseInt(newConcurrency)))
    this.concurrency = validConcurrency
    await this.setSetting('concurrency', validConcurrency)
    if (is.dev) console.debug(`[UploadService] 并发数已设置为 ${validConcurrency}`)
    this.processQueue()
    return validConcurrency
  }

  // 生成任务ID
  generateTaskId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 创建任务对象（简化版，移除分片信息）
  createTask(options) {
    const now = Date.now()
    return {
      id: this.generateTaskId(),
      name: options.filename || path.basename(options.filePath),
      type: 'upload',
      filePath: options.filePath,
      filename: options.filename || path.basename(options.filePath),
      albumId: options.albumId,
      albumName: options.albumName,
      picTitle: options.picTitle || '',
      picDesc: options.picDesc || '',
      picWidth: options.picWidth || 0,
      picHeight: options.picHeight || 0,
      batchId: options.batchId || null, // 批次ID（后端生成）
      sessionId: options.sessionId || null, // 会话ID（前端生成，用于分组管理）
      status: UPLOAD_TASK_STATUS.WAITING,
      progress: 0,
      uploaded: 0,
      total: options.total || 0,
      speed: 0,
      priority: options.priority || PRIORITY.NORMAL,
      create_time: now,
      update_time: now,
      complete_time: null,
      error: null,
      // 简化的上传字段（仅保留必要信息）
      session: null,
      md5: null,
      // 移除了分片相关字段：currentOffset, sliceSize
      // 失败重试时将重新整体上传，不再断点续传
      retryCount: 0, // 重试次数
      lastRetryTime: null // 最后重试时间
    }
  }

  // 添加单个上传任务
  async addTask(options) {
    // 获取图片尺寸
    if (options.filePath && typeof options.filePath === 'string') {
      try {
        // console.log(
        //   `[UploadService] 正在获取单个文件图片尺寸: ${options.filename || options.filePath}`
        // )
        const dimensions = await getImageDimensions(options.filePath)
        options.picWidth = dimensions.width
        options.picHeight = dimensions.height

        if (options.picWidth > 0 && options.picHeight > 0) {
          // console.log(
          //   `[UploadService] 单个文件图片尺寸获取成功: ${options.picWidth}x${options.picHeight}`
          // )
        } else {
          console.warn(
            `[UploadService] 单个文件图片尺寸为 0: ${options.filename || options.filePath}`
          )
        }
      } catch (error) {
        console.warn(
          `[UploadService] 获取单个文件图片尺寸失败: ${options.filename || options.filePath}`,
          error.message
        )
        options.picWidth = 0
        options.picHeight = 0
      }
    } else {
      console.warn(`[UploadService] 单个任务文件路径无效:`, options.filePath)
      options.picWidth = 0
      options.picHeight = 0
    }

    // 为单个任务生成独立的批次ID（如果没有提供）
    if (!options.batchId) {
      options.batchId = Date.now() * 1000 + Math.floor(Math.random() * 1000)
      // console.log(`[UploadService] 为单个任务生成批次ID: ${options.batchId}`)
    }

    const task = this.createTask(options)

    // 保存到数据库
    this.db.data.tasks.push(task)
    await this.db.write()

    // 添加到内存活跃任务
    this.activeTasks.set(task.id, task)

    // 触发更新
    this.triggerUpdate([task.id])

    // 处理队列
    this.processQueue()

    return task.id
  }

  // 批量添加上传任务
  async addBatchTasks(files, albumId, albumName, sessionId = null) {
    const taskIds = []
    const tasks = []

    // 为这批文件生成统一的批次ID（用于后端API）
    // 格式：时间戳(毫秒) * 1000000 + 6位随机数
    const batchId = Date.now() * 1000000 + Math.floor(Math.random() * 1000000)

    // sessionId 由前端传入，用于会话管理
    const finalSessionId = sessionId || `session_${Date.now()}`

    // console.log(
    //   `[UploadService] 批量处理 ${files.length} 个文件，批次ID: ${batchId}，会话ID: ${finalSessionId}`
    // )

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // 获取图片尺寸
      let picWidth = 0
      let picHeight = 0

      if (file.path && typeof file.path === 'string') {
        try {
          // console.log(`[UploadService] 正在获取图片尺寸 [${i + 1}/${files.length}]: ${file.name}`)
          const dimensions = await getImageDimensions(file.path)
          picWidth = dimensions.width
          picHeight = dimensions.height

          if (picWidth > 0 && picHeight > 0) {
            // console.log(`[UploadService] 图片尺寸获取成功 ${file.name}: ${picWidth}x${picHeight}`)
          } else {
            console.warn(`[UploadService] 图片尺寸为 0: ${file.name}`)
          }
        } catch (error) {
          console.warn(`[UploadService] 获取图片尺寸失败: ${file.name}`, error.message)
          // 即使尺寸获取失败，也继续处理，使用默认值 0x0
        }
      } else {
        console.warn(`[UploadService] 文件路径无效: ${file.name}`, file.path)
      }

      const task = this.createTask({
        filePath: file.path,
        filename: file.name,
        albumId,
        albumName,
        picTitle: file.title || file.name.replace(/\.[^/.]+$/, ''),
        picDesc: file.desc || '',
        picWidth,
        picHeight,
        batchId, // 使用统一的批次ID（后端API用）
        sessionId: finalSessionId, // 使用会话ID（前端分组用）
        total: file.size || 0
      })

      tasks.push(task)
      taskIds.push(task.id)
    }

    // console.log(`[UploadService] 批量任务创建完成，共 ${tasks.length} 个任务`)

    // 批量保存到数据库
    this.db.data.tasks.push(...tasks)
    await this.db.write()

    // 添加到内存
    for (const task of tasks) {
      if (this.activeTasks.size < this.maxActiveTasksInMemory) {
        this.activeTasks.set(task.id, task)
      }
    }

    // 触发更新
    this.triggerUpdate(taskIds)

    // 处理队列
    this.processQueue()

    return taskIds
  }

  // 获取任务列表（分页），支持按相册筛选
  getTasks(page = 1, pageSize = this.pageSize, status = null, albumId = null) {
    try {
      const offset = (page - 1) * pageSize
      let tasks = [...this.db.data.tasks]

      // 相册筛选
      if (albumId && albumId !== 'all') {
        tasks = tasks.filter((task) => task.albumId === albumId)
      }

      // 状态筛选
      if (status && status !== 'all') {
        tasks = tasks.filter((task) => task.status === status)
      }

      // 排序：uploading > waiting > paused > error > completed > cancelled
      tasks.sort((a, b) => {
        const statusPriority = {
          [UPLOAD_TASK_STATUS.UPLOADING]: 1,
          [UPLOAD_TASK_STATUS.WAITING]: 2,
          [UPLOAD_TASK_STATUS.PAUSED]: 3,
          [UPLOAD_TASK_STATUS.ERROR]: 4,
          [UPLOAD_TASK_STATUS.COMPLETED]: 5,
          [UPLOAD_TASK_STATUS.CANCELLED]: 6
        }

        const aPriority = statusPriority[a.status] || 7
        const bPriority = statusPriority[b.status] || 7

        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        // 同状态内排序
        if (a.status === UPLOAD_TASK_STATUS.UPLOADING || a.status === UPLOAD_TASK_STATUS.WAITING) {
          return a.create_time - b.create_time
        } else {
          return b.create_time - a.create_time
        }
      })

      const totalCount = tasks.length
      const paginatedTasks = tasks.slice(offset, offset + pageSize)

      return {
        tasks: paginatedTasks,
        pagination: {
          page,
          pageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageSize)
        }
      }
    } catch (error) {
      logger.error('获取任务列表失败:', error)
      return {
        tasks: [],
        pagination: { page: 1, pageSize, total: 0, totalPages: 0 }
      }
    }
  }

  // 获取活跃任务
  getActiveTasks() {
    return Array.from(this.activeTasks.values())
  }

  /**
   * 获取指定相册的未完成任务（等待中、上传中、暂停）
   * @param {string} albumId - 相册ID
   * @returns {Array} 未完成的任务列表
   */
  getPendingTasksByAlbum(albumId) {
    try {
      if (!albumId) return []

      const pendingTasks = this.db.data.tasks.filter(
        (task) =>
          task.albumId === albumId &&
          (task.status === UPLOAD_TASK_STATUS.WAITING ||
            task.status === UPLOAD_TASK_STATUS.UPLOADING ||
            task.status === UPLOAD_TASK_STATUS.PAUSED)
      )

      // console.log(`[UploadService] 相册 ${albumId} 有 ${pendingTasks.length} 个未完成任务`)

      return pendingTasks
    } catch (error) {
      logger.error(`获取相册 ${albumId} 未完成任务失败:`, error)
      return []
    }
  }

  /**
   * 获取指定会话的所有活跃任务（包括已完成的，但不包括已取消的）
   * @param {string} sessionId - 会话ID
   * @returns {Array} 会话的所有活跃任务列表
   */
  getTasksBySession(sessionId) {
    try {
      if (!sessionId) return []

      const tasks = this.db.data.tasks.filter(
        (task) => task.sessionId === sessionId && task.status !== UPLOAD_TASK_STATUS.CANCELLED
      )

      // console.log(`[UploadService] 会话 ${sessionId} 有 ${tasks.length} 个任务`)

      return tasks
    } catch (error) {
      logger.error(`获取会话 ${sessionId} 任务失败:`, error)
      return []
    }
  }

  // 获取所有相册列表（包含任务统计）
  getAlbumsWithStats() {
    try {
      const tasks = this.db.data.tasks
      const albumsMap = new Map()

      tasks.forEach((task) => {
        const albumId = task.albumId
        const albumName = task.albumName || '未知相册'

        if (!albumsMap.has(albumId)) {
          albumsMap.set(albumId, {
            id: albumId,
            name: albumName,
            total: 0,
            waiting: 0,
            uploading: 0,
            completed: 0,
            error: 0,
            paused: 0,
            cancelled: 0,
            active: 0
          })
        }

        const albumStats = albumsMap.get(albumId)
        albumStats.total++

        switch (task.status) {
          case UPLOAD_TASK_STATUS.WAITING:
            albumStats.waiting++
            break
          case UPLOAD_TASK_STATUS.UPLOADING:
            albumStats.uploading++
            break
          case UPLOAD_TASK_STATUS.COMPLETED:
            albumStats.completed++
            break
          case UPLOAD_TASK_STATUS.ERROR:
            albumStats.error++
            break
          case UPLOAD_TASK_STATUS.PAUSED:
            albumStats.paused++
            break
          case UPLOAD_TASK_STATUS.CANCELLED:
            albumStats.cancelled++
            break
        }
      })

      // 计算活跃任务数
      albumsMap.forEach((stats) => {
        stats.active = stats.waiting + stats.uploading + stats.paused
      })

      return Array.from(albumsMap.values()).sort((a, b) => {
        // 按活跃任务数降序，再按总任务数降序
        if (a.active !== b.active) return b.active - a.active
        return b.total - a.total
      })
    } catch (error) {
      logger.error('获取相册统计失败:', error)
      return []
    }
  }

  // 获取指定相册的任务统计
  getAlbumStats(albumId) {
    try {
      // if (is.dev) {
      //   console.log(`[UploadService] 获取相册统计 - albumId: ${albumId}`)
      //   console.log(`[UploadService] 数据库中任务总数: ${this.db.data.tasks.length}`)
      // }

      const tasks = this.db.data.tasks.filter((task) => task.albumId === albumId)

      // if (is.dev) {
      //   console.log(`[UploadService] 相册 ${albumId} 的任务数: ${tasks.length}`)
      //   if (tasks.length > 0) {
      //     console.log(
      //       `[UploadService] 相册任务详情:`,
      //       tasks.map((t) => ({
      //         id: t.id,
      //         filename: t.filename,
      //         albumId: t.albumId,
      //         status: t.status
      //       }))
      //     )
      //   }
      // }

      const stats = {
        total: tasks.length,
        waiting: 0,
        uploading: 0,
        completed: 0,
        error: 0,
        paused: 0,
        cancelled: 0,
        active: 0,
        albumId,
        albumName: tasks[0]?.albumName || '未知相册'
      }

      tasks.forEach((task) => {
        switch (task.status) {
          case UPLOAD_TASK_STATUS.WAITING:
            stats.waiting++
            break
          case UPLOAD_TASK_STATUS.UPLOADING:
            stats.uploading++
            break
          case UPLOAD_TASK_STATUS.COMPLETED:
            stats.completed++
            break
          case UPLOAD_TASK_STATUS.ERROR:
            stats.error++
            break
          case UPLOAD_TASK_STATUS.PAUSED:
            stats.paused++
            break
          case UPLOAD_TASK_STATUS.CANCELLED:
            stats.cancelled++
            break
        }
      })

      stats.active = stats.waiting + stats.uploading + stats.paused

      // if (is.dev) {
      //   console.log(`[UploadService] 相册 ${albumId} 统计结果:`, stats)
      // }

      return stats
    } catch (error) {
      logger.error(`获取相册 ${albumId} 统计失败:`, error)
      return {
        total: 0,
        waiting: 0,
        uploading: 0,
        completed: 0,
        error: 0,
        paused: 0,
        cancelled: 0,
        active: 0,
        albumId,
        albumName: '未知相册'
      }
    }
  }

  // 获取任务统计信息
  getTaskStats() {
    try {
      // 数据库未初始化时返回默认值
      if (!this.db || !this.db.data) {
        return {
          total: 0,
          waiting: 0,
          uploading: 0,
          completed: 0,
          error: 0,
          paused: 0,
          cancelled: 0,
          active: 0
        }
      }

      const tasks = this.db.data.tasks
      const stats = {
        total: tasks.length,
        waiting: 0,
        uploading: 0,
        completed: 0,
        error: 0,
        paused: 0,
        cancelled: 0,
        active: 0
      }

      tasks.forEach((task) => {
        switch (task.status) {
          case UPLOAD_TASK_STATUS.WAITING:
            stats.waiting++
            break
          case UPLOAD_TASK_STATUS.UPLOADING:
            stats.uploading++
            break
          case UPLOAD_TASK_STATUS.COMPLETED:
            stats.completed++
            break
          case UPLOAD_TASK_STATUS.ERROR:
            stats.error++
            break
          case UPLOAD_TASK_STATUS.PAUSED:
            stats.paused++
            break
          case UPLOAD_TASK_STATUS.CANCELLED:
            stats.cancelled++
            break
        }
      })

      stats.active = stats.waiting + stats.uploading + stats.paused

      return stats
    } catch (error) {
      logger.error('获取任务统计失败:', error)
      return {
        total: 0,
        waiting: 0,
        uploading: 0,
        completed: 0,
        error: 0,
        paused: 0,
        cancelled: 0,
        active: 0
      }
    }
  }

  // 更新数据库中的任务
  async updateTaskInDB(task) {
    try {
      task.update_time = Date.now()
      if (task.status === UPLOAD_TASK_STATUS.COMPLETED && !task.complete_time) {
        task.complete_time = task.update_time
      }

      const index = this.db.data.tasks.findIndex((t) => t.id === task.id)
      if (index !== -1) {
        this.db.data.tasks[index] = { ...task }
      }

      // 批量写入优化
      if (!this._writeTimeout) {
        this._writeTimeout = setTimeout(async () => {
          await this.db.write()
          this._writeTimeout = null
        }, 500)
      }
    } catch (error) {
      logger.error(`更新任务 ${task.id} 失败:`, error)
    }
  }

  // 立即保存数据库
  async saveDatabase() {
    try {
      await this.db.write()
    } catch (error) {
      logger.error('保存数据库失败:', error)
    }
  }

  // 处理上传队列
  async processQueue() {
    const availableSlots = this.concurrency - this.uploadingTasks.size
    if (availableSlots <= 0) return

    // 从内存中获取等待中的任务
    const waitingTasks = Array.from(this.activeTasks.values())
      .filter((task) => task.status === UPLOAD_TASK_STATUS.WAITING)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.create_time - b.create_time
      })
      .slice(0, availableSlots)

    // 如果内存中的等待任务不够，从数据库加载更多
    if (
      waitingTasks.length < availableSlots &&
      this.activeTasks.size < this.maxActiveTasksInMemory
    ) {
      try {
        const additionalTasks = this.db.data.tasks
          .filter(
            (task) =>
              // 只加载 waiting 状态的任务，paused 需要先调用 resume 改为 waiting
              task.status === UPLOAD_TASK_STATUS.WAITING && !this.activeTasks.has(task.id)
          )
          .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority
            return a.create_time - b.create_time
          })
          .slice(0, availableSlots - waitingTasks.length)

        additionalTasks.forEach((task) => {
          this.activeTasks.set(task.id, task)
          waitingTasks.push(task)
        })
      } catch (error) {
        logger.error('从数据库加载等待任务失败:', error)
      }
    }

    // 执行上传
    for (const task of waitingTasks) {
      if (this.uploadingTasks.size >= this.concurrency) break
      this.executeUpload(task)
    }
  }

  // 执行上传
  async executeUpload(task) {
    this.uploadingTasks.add(task.id)
    task.status = UPLOAD_TASK_STATUS.UPLOADING
    task.speed = 0
    task.progress = 0

    // 更新数据库
    await this.updateTaskInDB(task)

    // 【核心改进】立即推送上传开始状态
    this.pushTaskProgressDirect(task, true) // immediate=true 立即推送

    // 同时触发事件推送器（用于统计信息等）
    this.triggerUpdate([task.id])

    try {
      // 初始化上传（如果还没有会话）
      if (!task.session || !task.md5) {
        await this.initializeUpload(task)
      }

      // 执行分片上传
      await this.performChunkedUpload(task)

      if (task.status !== UPLOAD_TASK_STATUS.CANCELLED) {
        task.status = UPLOAD_TASK_STATUS.COMPLETED
        task.progress = 100
        task.speed = 0
        // console.log(`[UploadService] 任务上传完成: ${task.filename}`)
      }
    } catch (error) {
      if (error.cancelled) {
        // 如果任务已经是 PAUSED 状态，不要覆盖为 CANCELLED
        // pauseTask 会先设置状态为 PAUSED，然后触发取消操作
        if (task.status !== UPLOAD_TASK_STATUS.PAUSED) {
          task.status = UPLOAD_TASK_STATUS.CANCELLED
          // console.log(`[UploadService] 任务已取消: ${task.filename}`)
        } else {
          // console.log(`[UploadService] 任务已暂停: ${task.filename}`)
        }
      } else {
        task.status = UPLOAD_TASK_STATUS.ERROR
        task.error = error.message
        console.error(`[UploadService] 任务上传失败: ${task.filename}`, error.message)
        // 失败的任务保留在内存中，以便用户查看和重试
      }
      task.speed = 0
    } finally {
      this.uploadingTasks.delete(task.id)
      this.cancelTokens.delete(task.id)

      // 先更新数据库
      await this.updateTaskInDB(task)

      // 【核心改进】立即推送任务状态变化（完成/失败/取消）
      this.pushTaskProgressDirect(task, true) // immediate=true 立即推送

      // 同时触发事件推送器（用于统计信息等）
      this.triggerUpdate([task.id])

      // 最后才从 activeTasks 中移除完成或取消的任务
      // 注意：暂停的任务(PAUSED)需要保留在内存中，以便用户恢复上传
      if (
        task.status === UPLOAD_TASK_STATUS.COMPLETED ||
        task.status === UPLOAD_TASK_STATUS.CANCELLED
      ) {
        // 延迟删除，确保推送完成后再删除
        setTimeout(() => {
          this.activeTasks.delete(task.id)
          // console.log(`[UploadService] 任务已从内存清除: ${task.filename}`)
        }, 1000)
      } else if (task.status === UPLOAD_TASK_STATUS.PAUSED) {
        // console.log(`[UploadService] 暂停的任务保留在内存中: ${task.filename}`)
      }

      // 继续处理队列
      setTimeout(() => this.processQueue(), 100)
    }
  }

  // 初始化上传（简化版）
  async initializeUpload(task) {
    try {
      // 验证必要参数
      if (!this.currentUin || !this.currentPSkey) {
        throw new Error('用户认证信息不完整')
      }

      if (!task.filePath) {
        throw new Error('文件路径为空')
      }

      // 检查文件是否存在
      const fileInfo = await getFileInfo(task.filePath)
      if (!fileInfo) {
        throw new Error('文件不存在或无法访问')
      }

      // 获取文件信息和MD5
      if (!task.md5) {
        task.md5 = await calculateFileMD5(task.filePath)
        if (!task.md5) {
          throw new Error('无法计算文件MD5')
        }
        task.total = fileInfo.fileSize
      }

      // 计算批次信息
      const batchTasks = this.db.data.tasks.filter((t) => t.batchId === task.batchId)
      const completedInBatch = batchTasks.filter(
        (t) => t.status === UPLOAD_TASK_STATUS.COMPLETED
      ).length
      const failedInBatch = batchTasks.filter((t) => t.status === UPLOAD_TASK_STATUS.ERROR).length
      const currentIndex =
        batchTasks.findIndex((t) => t.id === task.id) + 1 + completedInBatch + failedInBatch

      const mutliPicInfo = {
        iBatUploadNum: batchTasks.length,
        iCurUpload: currentIndex,
        iSuccNum: completedInBatch,
        iFailNum: failedInBatch
      }

      console.log(`[UploadService] 批次信息: ${JSON.stringify(mutliPicInfo)} - ${task.filename}`)

      // 调用初始化API
      const result = await fileBatchControl(
        this.currentUin,
        this.currentPSkey,
        this.currentHostUin,
        task.md5,
        task.total,
        task.albumId,
        task.albumName,
        task.filename,
        task.picTitle,
        task.picDesc,
        task.picWidth,
        task.picHeight,
        task.batchId, // 传递任务的批次ID
        mutliPicInfo // 传递批次信息
      )

      if (!result) {
        throw new Error('API调用返回空结果')
      }

      if (result.ret !== 0) {
        throw new Error(`初始化上传失败: ${result.msg || `错误代码: ${result.ret}`}`)
      }

      if (!result.data) {
        throw new Error('API返回数据为空')
      }

      // 保存会话信息（简化版）
      task.session = result.data.session
      if (!task.session) {
        throw new Error('未获取到上传会话')
      }

      return result.data
    } catch (error) {
      // 增强错误处理，提供更友好的错误信息
      let errorMessage = error.message
      if (error.message.includes('ENOENT') || error.message.includes('文件不存在')) {
        errorMessage = '文件已被移动或删除，无法上传'
      } else if (error.message.includes('权限') || error.message.includes('EACCES')) {
        errorMessage = '没有访问文件的权限'
      } else if (error.message.includes('网络') || error.message.includes('timeout')) {
        errorMessage = '网络连接失败，请检查网络'
      }

      logger.error('初始化上传失败:', error)
      throw new Error(errorMessage)
    }
  }

  // 执行上传（简化版，整体上传不支持断点续传）
  async performChunkedUpload(task) {
    // 验证文件路径
    if (!task.filePath) {
      throw new Error('文件路径为空')
    }

    let fileBuffer
    try {
      fileBuffer = await readFileAsBuffer(task.filePath)
      if (!fileBuffer) {
        throw new Error('文件已被移动或删除，无法读取')
      }
    } catch {
      throw new Error('文件已被移动或删除，无法读取')
    }

    let lastTime = Date.now()
    let lastBytes = 0

    // 设置取消令牌
    const cancelToken = { cancelled: false }
    this.cancelTokens.set(task.id, cancelToken)

    let currentOffset = 0
    const sliceSize = this.defaultChunkSize

    while (currentOffset < task.total && !cancelToken.cancelled) {
      const chunkData = getFileChunk(fileBuffer, currentOffset, sliceSize)
      if (!chunkData) {
        throw new Error('无法获取文件分片数据')
      }

      const end = Math.min(currentOffset + sliceSize, task.total)
      const seq = Math.floor(currentOffset / sliceSize)

      try {
        // 调用上传API
        const result = await fileUpload(
          this.currentHostUin,
          this.currentPSkey,
          this.currentHostUin,
          task.session,
          currentOffset,
          chunkData,
          end,
          seq,
          '',
          sliceSize
        )

        if (!result) {
          throw new Error('上传API返回空结果')
        }

        if (result.ret !== 0) {
          throw new Error(`上传分片失败: ${result.msg || `错误代码: ${result.ret}`}`)
        }

        if (!result.data) {
          throw new Error('上传API返回数据为空')
        }

        // 更新进度
        currentOffset = end
        task.uploaded = end
        const now = Date.now()

        // 更新进度和速度
        if (task.total > 0) {
          const newProgress = Math.round((task.uploaded / task.total) * 100)

          // 计算速度（每500ms计算一次）
          const shouldUpdateSpeed = now - lastTime >= 500
          if (shouldUpdateSpeed) {
            const timeDiff = (now - lastTime) / 1000
            const bytesDiff = task.uploaded - lastBytes
            task.speed = Math.round(bytesDiff / timeDiff)
            lastTime = now
            lastBytes = task.uploaded
          }

          // 更新进度
          const progressChanged = newProgress !== task.progress
          if (progressChanged) {
            task.progress = newProgress

            // 定期更新数据库（每10%更新一次，减少I/O）
            if (newProgress % 10 === 0) {
              this.updateTaskInDB(task)
            }
          }

          // 【核心改进】直接推送进度到渲染进程，不再依赖事件推送器的定时器
          // 进度变化或速度更新时立即推送（内置200ms节流）
          if (progressChanged || shouldUpdateSpeed) {
            this.pushTaskProgressDirect(task)
          }
        }

        // 检查是否完成
        if (result.data.flag === 1) {
          task.progress = 100
          task.uploaded = task.total
          break
        }
      } catch (error) {
        // 对网络错误进行友好处理
        let errorMessage = error.message
        if (error.message.includes('timeout') || error.message.includes('网络')) {
          errorMessage = '网络超时，请重试'
        } else if (error.message.includes('401') || error.message.includes('认证')) {
          errorMessage = '登录已过期，请重新登录'
        }
        throw new Error(errorMessage)
      }
    }

    if (cancelToken.cancelled) {
      throw { cancelled: true, message: '上传已取消' }
    }
  }

  // 任务操作方法
  async pauseTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task && [UPLOAD_TASK_STATUS.UPLOADING, UPLOAD_TASK_STATUS.WAITING].includes(task.status)) {
      if (task.status === UPLOAD_TASK_STATUS.UPLOADING) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancelled = true
        }
      }

      // 暂停任务：重置上传进度，下次继续时从头开始
      task.status = UPLOAD_TASK_STATUS.PAUSED
      task.speed = 0
      task.progress = 0
      task.currentOffset = 0
      task.uploaded = 0
      // 清空会话信息，确保继续时重新初始化
      task.session = null
      task.md5 = null

      // 清理上传状态
      this.uploadingTasks.delete(taskId)
      this.cancelTokens.delete(taskId)

      this.activeTasks.set(taskId, task)
      await this.updateTaskInDB(task)
      this.triggerUpdate([taskId])

      logger.info(`[UploadService] 任务 ${taskId} 已暂停，进度已重置，会话已清空`)
    }
  }

  async resumeTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task && task.status === UPLOAD_TASK_STATUS.PAUSED) {
      // 继续任务：确保从头开始上传
      task.status = UPLOAD_TASK_STATUS.WAITING
      task.speed = 0
      task.progress = 0
      task.currentOffset = 0
      task.uploaded = 0
      task.error = null
      // 清空会话信息，确保重新初始化
      task.session = null
      task.md5 = null

      this.activeTasks.set(taskId, task)
      await this.updateTaskInDB(task)
      this.triggerUpdate([taskId])
      this.processQueue()

      logger.info(`[UploadService] 任务 ${taskId} 已继续，将从头开始上传`)
    }
  }

  async retryTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (
      task &&
      (task.status === UPLOAD_TASK_STATUS.ERROR || task.status === UPLOAD_TASK_STATUS.CANCELLED)
    ) {
      // 重置任务状态（简化版，移除分片信息）
      task.status = UPLOAD_TASK_STATUS.WAITING
      task.uploaded = 0
      task.progress = 0
      task.error = null
      task.speed = 0
      task.session = null // 重新初始化
      task.md5 = null // 重新计算MD5
      task.retryCount = (task.retryCount || 0) + 1
      task.lastRetryTime = Date.now()

      this.activeTasks.set(taskId, task)
      await this.updateTaskInDB(task)
      this.triggerUpdate([taskId])
      this.processQueue()
    }
  }

  // 批量重试失败任务
  async retryAllFailed(albumId = null) {
    const changedTaskIds = []
    let tasks = this.db.data.tasks.filter((task) => task.status === UPLOAD_TASK_STATUS.ERROR)

    // 如果指定了相册，只重试该相册的失败任务
    if (albumId && albumId !== 'all') {
      tasks = tasks.filter((task) => task.albumId === albumId)
    }

    for (const task of tasks) {
      // 重置任务状态
      task.status = UPLOAD_TASK_STATUS.WAITING
      task.uploaded = 0
      task.progress = 0
      task.error = null
      task.speed = 0
      task.session = null
      task.md5 = null
      task.retryCount = (task.retryCount || 0) + 1
      task.lastRetryTime = Date.now()

      this.activeTasks.set(task.id, task)
      await this.updateTaskInDB(task)
      changedTaskIds.push(task.id)
    }

    if (changedTaskIds.length > 0) {
      await this.saveDatabase()
      this.triggerUpdate(changedTaskIds)
      this.processQueue()
    }

    return changedTaskIds.length
  }

  // 清理完成的任务
  async clearCompletedTasks(albumId = null) {
    let tasksToRemove = this.db.data.tasks.filter(
      (task) => task.status === UPLOAD_TASK_STATUS.COMPLETED
    )

    // 如果指定了相册，只清理该相册的完成任务
    if (albumId && albumId !== 'all') {
      tasksToRemove = tasksToRemove.filter((task) => task.albumId === albumId)
    }

    const removedTaskIds = tasksToRemove.map((task) => task.id)

    // 从数据库中移除
    this.db.data.tasks = this.db.data.tasks.filter((task) => !removedTaskIds.includes(task.id))

    // 从内存中移除
    removedTaskIds.forEach((taskId) => {
      this.activeTasks.delete(taskId)
    })

    await this.saveDatabase()
    // 推送删除事件，包含原始任务的 albumId 信息
    this.triggerUpdate(
      tasksToRemove.map((task) => ({
        id: task.id,
        albumId: task.albumId,
        filename: task.filename,
        deleted: true
      }))
    )

    logger.info(
      `[UploadService] 已清理 ${removedTaskIds.length} 个完成任务${albumId ? ` (相册: ${albumId})` : ''}`
    )
    return removedTaskIds.length
  }

  // 清理取消的任务
  async clearCancelledTasks(albumId = null) {
    let tasksToRemove = this.db.data.tasks.filter(
      (task) => task.status === UPLOAD_TASK_STATUS.CANCELLED
    )

    // 如果指定了相册，只清理该相册的取消任务
    if (albumId && albumId !== 'all') {
      tasksToRemove = tasksToRemove.filter((task) => task.albumId === albumId)
    }

    const removedTaskIds = tasksToRemove.map((task) => task.id)

    // 从数据库中移除
    this.db.data.tasks = this.db.data.tasks.filter((task) => !removedTaskIds.includes(task.id))

    // 从内存中移除
    removedTaskIds.forEach((taskId) => {
      this.activeTasks.delete(taskId)
    })

    await this.saveDatabase()
    // 推送删除事件，包含原始任务的 albumId 信息
    this.triggerUpdate(
      tasksToRemove.map((task) => ({
        id: task.id,
        albumId: task.albumId,
        filename: task.filename,
        deleted: true
      }))
    )

    logger.info(
      `[UploadService] 已清理 ${removedTaskIds.length} 个取消任务${albumId ? ` (相册: ${albumId})` : ''}`
    )
    return removedTaskIds.length
  }

  async deleteTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task) {
      // 取消正在上传的任务
      if (task.status === UPLOAD_TASK_STATUS.UPLOADING) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancelled = true
        }
      }

      // 从内存和数据库中删除
      this.activeTasks.delete(taskId)
      this.uploadingTasks.delete(taskId)
      this.cancelTokens.delete(taskId)

      const index = this.db.data.tasks.findIndex((t) => t.id === taskId)
      if (index !== -1) {
        this.db.data.tasks.splice(index, 1)
        await this.db.write()
      }

      // 触发更新，通知前端任务已删除，包含原始任务的 albumId 信息
      this.triggerUpdate([
        {
          id: taskId,
          albumId: task.albumId,
          filename: task.filename,
          deleted: true
        }
      ])

      logger.info(`[UploadService] 删除任务: ${taskId} (${task.filename})`)
    }
  }

  // 批量操作
  async cancelAll() {
    const changedTaskIds = []

    for (const [taskId, task] of this.activeTasks) {
      if ([UPLOAD_TASK_STATUS.WAITING, UPLOAD_TASK_STATUS.UPLOADING].includes(task.status)) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancelled = true
        }
        task.status = UPLOAD_TASK_STATUS.PAUSED
        task.speed = 0
        await this.updateTaskInDB(task)
        changedTaskIds.push(taskId)
      }
    }

    this.uploadingTasks.clear()
    this.cancelTokens.clear()
    await this.saveDatabase()
    this.triggerUpdate(changedTaskIds)
  }

  // 取消特定相册或会话的任务
  async cancelTasksByAlbum(albumId, sessionId = null) {
    const changedTaskIds = []

    for (const [taskId, task] of this.activeTasks) {
      // 匹配相册ID或会话ID
      const matchAlbum = albumId && task.albumId === albumId
      const matchSession = sessionId && task.sessionId === sessionId

      if (
        (matchAlbum || matchSession) &&
        [UPLOAD_TASK_STATUS.WAITING, UPLOAD_TASK_STATUS.UPLOADING].includes(task.status)
      ) {
        // 取消正在上传的任务
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancelled = true
        }

        // 标记为已取消
        task.status = UPLOAD_TASK_STATUS.CANCELLED
        task.speed = 0
        this.uploadingTasks.delete(taskId)
        this.cancelTokens.delete(taskId)

        await this.updateTaskInDB(task)
        changedTaskIds.push(taskId)
      }
    }

    await this.saveDatabase()
    this.triggerUpdate(changedTaskIds)

    logger.info(
      `[UploadService] 取消了 ${changedTaskIds.length} 个任务 (相册: ${albumId}, 会话: ${sessionId})`
    )
    return changedTaskIds.length
  }

  // 删除特定会话的所有任务
  async deleteTasksBySession(sessionId) {
    if (!sessionId) {
      logger.warn('[UploadService] deleteTasksBySession: sessionId 为空')
      return 0
    }

    try {
      // 从内存中获取需要删除的任务
      const tasksToDelete = Array.from(this.activeTasks.values()).filter(
        (task) => task.sessionId === sessionId
      )

      // 同时从数据库中获取所有相关任务
      const dbTasksToDelete = this.db.data.tasks.filter((task) => task.sessionId === sessionId)

      // 合并所有任务（包含完整信息）
      const allTasksMap = new Map()
      tasksToDelete.forEach((task) => allTasksMap.set(task.id, task))
      dbTasksToDelete.forEach((task) => {
        if (!allTasksMap.has(task.id)) {
          allTasksMap.set(task.id, task)
        }
      })
      const allTasks = Array.from(allTasksMap.values())

      // 删除每个任务
      for (const task of allTasks) {
        // 如果任务正在上传，先取消
        if (task.status === UPLOAD_TASK_STATUS.UPLOADING) {
          const cancelToken = this.cancelTokens.get(task.id)
          if (cancelToken) {
            cancelToken.cancelled = true
          }
        }

        // 从内存中删除
        this.activeTasks.delete(task.id)
        this.uploadingTasks.delete(task.id)
        this.cancelTokens.delete(task.id)

        // 从数据库中删除
        const index = this.db.data.tasks.findIndex((t) => t.id === task.id)
        if (index !== -1) {
          this.db.data.tasks.splice(index, 1)
        }
      }

      // 保存数据库
      await this.saveDatabase()

      // 触发更新（通知前端任务已删除），包含原始任务的 albumId 信息
      this.triggerUpdate(
        allTasks.map((task) => ({
          id: task.id,
          albumId: task.albumId,
          filename: task.filename,
          deleted: true
        }))
      )

      logger.info(`[UploadService] 删除了 ${allTasks.length} 个任务 (会话: ${sessionId})`)
      return allTasks.length
    } catch (error) {
      logger.error(`删除会话 ${sessionId} 的任务失败:`, error)
      return 0
    }
  }

  // 暂停所有任务
  async pauseAll() {
    const changedTaskIds = []

    for (const [taskId, task] of this.activeTasks) {
      if ([UPLOAD_TASK_STATUS.WAITING, UPLOAD_TASK_STATUS.UPLOADING].includes(task.status)) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancelled = true
        }

        // 暂停任务：重置上传进度，下次继续时从头开始
        task.status = UPLOAD_TASK_STATUS.PAUSED
        task.speed = 0
        task.progress = 0
        task.currentOffset = 0
        task.uploaded = 0
        // 清空会话信息，确保继续时重新初始化
        task.session = null
        task.md5 = null

        await this.updateTaskInDB(task)
        changedTaskIds.push(taskId)
      }
    }

    this.uploadingTasks.clear()
    this.cancelTokens.clear()
    await this.saveDatabase()
    this.triggerUpdate(changedTaskIds)

    logger.info(`[UploadService] 暂停了 ${changedTaskIds.length} 个任务，进度已重置，会话已清空`)
    return changedTaskIds.length
  }

  // 继续所有暂停的任务
  async resumeAll() {
    const changedTaskIds = []
    const pausedTasks = this.db.data.tasks.filter(
      (task) => task.status === UPLOAD_TASK_STATUS.PAUSED
    )

    for (const task of pausedTasks) {
      // 继续任务：确保从头开始上传
      task.status = UPLOAD_TASK_STATUS.WAITING
      task.speed = 0
      task.progress = 0
      task.currentOffset = 0
      task.uploaded = 0
      task.error = null
      // 清空会话信息，确保重新初始化
      task.session = null
      task.md5 = null

      this.activeTasks.set(task.id, task)
      await this.updateTaskInDB(task)
      changedTaskIds.push(task.id)
    }

    await this.saveDatabase()
    this.triggerUpdate(changedTaskIds)
    this.processQueue()

    logger.info(`[UploadService] 继续了 ${changedTaskIds.length} 个任务，将从头开始上传`)
  }

  async clearTasks() {
    // 收集所有任务信息（包括 albumId 等），用于推送删除事件
    const allTasks = [
      ...Array.from(this.activeTasks.values()),
      ...this.db.data.tasks.filter((dbTask) => !this.activeTasks.has(dbTask.id))
    ]

    await this.cancelAll()

    this.db.data.tasks = []
    await this.db.write()

    this.activeTasks.clear()
    this.uploadingTasks.clear()
    this.cancelTokens.clear()

    // 推送删除事件，包含原始任务的 albumId 信息
    this.triggerUpdate(
      allTasks.map((task) => ({
        id: task.id,
        albumId: task.albumId,
        filename: task.filename,
        deleted: true
      }))
    )

    logger.info(`[UploadService] 已清空所有任务，共 ${allTasks.length} 个`)
  }

  // 获取单个任务（从数据库）
  getTaskFromDB(taskId) {
    try {
      return this.db.data.tasks.find((task) => task.id === taskId) || null
    } catch (error) {
      logger.error(`获取任务 ${taskId} 失败:`, error)
      return null
    }
  }

  // 设置服务管理器引用
  setServiceManager(serviceManager) {
    this.serviceManager = serviceManager
  }

  // 清空所有任务（与clearTasks功能相同，保留以兼容旧代码）
  async clearAllTasks() {
    try {
      // 收集所有任务信息（包括 albumId 等），用于推送删除事件
      const allTasks = [
        ...Array.from(this.activeTasks.values()),
        ...this.db.data.tasks.filter((dbTask) => !this.activeTasks.has(dbTask.id))
      ]
      const totalCount = allTasks.length

      await this.cancelAll()

      this.db.data.tasks = []
      await this.db.write()

      this.activeTasks.clear()
      this.uploadingTasks.clear()
      this.cancelTokens.clear()

      // 推送删除事件，包含原始任务的 albumId 信息
      this.triggerUpdate(
        allTasks.map((task) => ({
          id: task.id,
          albumId: task.albumId,
          filename: task.filename,
          deleted: true
        }))
      )

      logger.info(`[UploadService] 已清空所有任务，共 ${totalCount} 个`)
      return { count: totalCount }
    } catch (error) {
      logger.error('清空所有任务失败:', error)
      return { count: 0 }
    }
  }

  // 清理资源
  async destroy() {
    await this.cancelAll()
    this.updateTrigger = null

    if (this._writeTimeout) {
      clearTimeout(this._writeTimeout)
      await this.saveDatabase()
    }
  }
}
