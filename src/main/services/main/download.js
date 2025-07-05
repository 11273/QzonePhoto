import { app, dialog, shell } from 'electron'
import axios from 'axios'
import path from 'path'
import fs from 'fs'
import logger from '@main/core/logger'
import { is } from '@electron-toolkit/utils'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { APP_NAME } from '@shared/const'
// 直接定义必要的默认配置，避免使用外部常量系统
const DEFAULT_CONCURRENCY = 3
const DEFAULT_PAGE_SIZE = 50
const DEFAULT_REPLACE_EXISTING = false
const MAX_ACTIVE_TASKS_IN_MEMORY = 1000
const DEFAULT_DOWNLOAD_FOLDER = APP_NAME

// 任务状态常量
export const TASK_STATUS = {
  WAITING: 'waiting',
  DOWNLOADING: 'downloading',
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

export class DownloadService {
  constructor() {
    // 核心配置
    this.concurrency = DEFAULT_CONCURRENCY
    this.downloadPath = path.join(app.getPath('pictures'), DEFAULT_DOWNLOAD_FOLDER)

    // 用户管理
    this.currentUin = null // 当前登录用户的UIN

    // 内存中的活跃任务管理
    this.activeTasks = new Map() // 只存储正在下载、等待、暂停的任务
    this.downloadingTasks = new Set() // 正在下载的任务ID
    this.cancelTokens = new Map() // 取消令牌

    // 更新触发器
    this.updateTrigger = null

    // 性能优化配置
    this.pageSize = DEFAULT_PAGE_SIZE // 分页大小
    this.maxActiveTasksInMemory = MAX_ACTIVE_TASKS_IN_MEMORY // 内存中最大活跃任务数

    // LowDB数据库相关
    this.db = null
    this.dbPath = null // 动态设置，基于用户ID
    this.dbInitialized = false // 添加初始化标志

    // 异步初始化（使用默认数据库）
    this.initializeAsync()
  }

  // 获取用户专用的数据库路径
  getUserDbPath(uin = null) {
    const userId = uin || this.currentUin
    const filename = userId ? `download_${userId}.json` : 'download_default.json'
    return path.join(app.getPath('userData'), filename)
  }

  // 设置当前用户并切换数据库
  async setCurrentUser(uin) {
    try {
      // 如果用户ID没有变化，直接返回
      if (this.currentUin === uin) {
        if (is.dev) console.debug(`[DownloadService] 用户ID未变化: ${uin}`)
        return
      }

      if (is.dev) console.debug(`[DownloadService] 切换用户: ${this.currentUin} -> ${uin}`)

      // 保存当前数据库
      if (this.db && this.dbInitialized) {
        await this.saveDatabase()
      }

      // 取消所有正在进行的下载
      await this.cancelAll()

      // 清空内存数据
      this.clearMemoryData()

      // 更新用户ID和数据库路径
      this.currentUin = uin
      this.dbPath = this.getUserDbPath(uin)

      // 重新初始化数据库和数据
      this.dbInitialized = false
      await this.initializeDatabase()
      await this.initializeDownloadPath()
      this.loadSettings()
      this.loadActiveTasks()
      this.dbInitialized = true

      // 触发全量更新
      this.triggerUpdate([])

      if (is.dev) console.debug(`[DownloadService] 用户切换完成: ${uin}`)
    } catch (error) {
      logger.error('切换用户失败:', error)
      throw error
    }
  }

  // 清空内存数据
  clearMemoryData() {
    this.activeTasks.clear()
    this.downloadingTasks.clear()
    this.cancelTokens.clear()
  }

  // 获取当前用户ID
  getCurrentUser() {
    return this.currentUin
  }

  // 异步初始化方法
  async initializeAsync() {
    // 使用默认数据库路径初始化
    this.dbPath = this.getUserDbPath()

    await this.initializeDatabase()
    await this.initializeDownloadPath()
    this.loadSettings()
    this.loadActiveTasks()
    this.dbInitialized = true

    // 初始化完成后，触发一次更新推送
    this.triggerUpdate([])
  }

  // 初始化LowDB数据库
  async initializeDatabase() {
    try {
      // 确保数据库目录存在
      const dbDir = path.dirname(this.dbPath)
      await fs.promises.mkdir(dbDir, { recursive: true })

      // 初始化数据库
      const adapter = new JSONFile(this.dbPath)
      this.db = new Low(adapter, {
        tasks: [],
        settings: {},
        version: '1.0.0',
        uin: this.currentUin // 记录数据库归属的用户ID
      })

      // 读取数据库
      await this.db.read()

      // 确保数据结构完整
      this.db.data ||= { tasks: [], settings: {}, version: '1.0.0', uin: this.currentUin }
      this.db.data.tasks ||= []
      this.db.data.settings ||= {}
      this.db.data.uin = this.currentUin // 更新用户ID

      // 写入默认数据
      await this.db.write()

      if (is.dev) {
        const dbFilename = path.basename(this.dbPath)
        console.debug(`[DownloadService] LowDB数据库初始化完成: ${dbFilename}`)
      }
    } catch (error) {
      logger.error('初始化数据库失败:', error)
    }
  }

  // 设置主窗口引用
  // eslint-disable-next-line no-unused-vars
  setMainWindow(window) {
    if (is.dev) console.debug('[DownloadService] 主窗口引用已设置')
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

  async initializeDownloadPath() {
    try {
      const savedPath = this.getSetting('downloadPath')
      if (savedPath && savedPath !== this.downloadPath) {
        this.downloadPath = savedPath
      }
      await fs.promises.mkdir(this.downloadPath, { recursive: true })
    } catch (error) {
      logger.error('创建下载目录失败:', error)
    }
  }

  // 加载设置
  loadSettings() {
    try {
      const savedConcurrency = this.getSetting('concurrency')
      if (savedConcurrency) {
        this.concurrency = Math.max(1, Math.min(10, parseInt(savedConcurrency)))
      }
    } catch (error) {
      logger.error('加载设置失败:', error)
    }
  }

  // 从数据库加载活跃任务到内存
  loadActiveTasks() {
    try {
      const activeTasks = this.db.data.tasks.filter((task) =>
        ['waiting', 'downloading', 'paused'].includes(task.status)
      )

      activeTasks.forEach((task) => {
        // 重置下载中的任务状态
        if (task.status === TASK_STATUS.DOWNLOADING) {
          task.status = TASK_STATUS.WAITING
          task.speed = 0
          this.updateTaskInDB(task)
        }
        this.activeTasks.set(task.id, task)
      })

      if (is.dev) console.debug(`[DownloadService] 加载了 ${activeTasks.length} 个活跃任务`)
    } catch (error) {
      logger.error('加载活跃任务失败:', error)
    }
  }

  // 获取/设置配置
  getSetting(key) {
    try {
      if (!this.db || !this.db.data) {
        return null
      }
      return this.db.data.settings[key] || null
    } catch (error) {
      logger.error(`获取设置 ${key} 失败:`, error)
      return null
    }
  }

  async setSetting(key, value) {
    try {
      if (!this.db || !this.db.data) {
        return
      }
      this.db.data.settings[key] = value
      await this.db.write()
    } catch (error) {
      logger.error(`设置 ${key} 失败:`, error)
    }
  }

  // 获取默认下载路径
  getDefaultPath() {
    return this.downloadPath
  }

  // 设置默认下载路径
  async setDefaultPath(newPath) {
    this.downloadPath = newPath
    await this.setSetting('downloadPath', newPath)
    return newPath
  }

  // 获取/设置并发数
  getConcurrency() {
    return this.concurrency
  }

  async setConcurrency(newConcurrency) {
    const validConcurrency = Math.max(1, Math.min(10, parseInt(newConcurrency)))
    this.concurrency = validConcurrency
    await this.setSetting('concurrency', validConcurrency)
    if (is.dev) console.debug(`[DownloadService] 并发数已设置为 ${validConcurrency}`)
    this.processQueue()
    return validConcurrency
  }

  // 获取/设置文件替换选项
  getReplaceExistingSetting() {
    const setting = this.getSetting('replaceExisting')
    return setting !== null ? setting : DEFAULT_REPLACE_EXISTING
  }

  async setReplaceExistingSetting(replaceExisting) {
    const boolValue = Boolean(replaceExisting)
    await this.setSetting('replaceExisting', boolValue)
    if (is.dev)
      console.debug(`[DownloadService] 文件替换设置已更新为 ${boolValue ? '替换' : '跳过'}`)
    return boolValue
  }

  // 生成任务ID
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 创建任务对象
  createTask(options) {
    const now = Date.now()
    return {
      id: this.generateTaskId(),
      name: options.filename || path.basename(options.url),
      type: options.type || 'image',
      url: options.url,
      filename: options.filename,
      directory: options.directory || this.downloadPath,
      status: TASK_STATUS.WAITING,
      progress: 0,
      downloaded: 0,
      total: options.total || 0,
      speed: 0,
      priority: options.priority || PRIORITY.NORMAL,
      create_time: now,
      update_time: now,
      complete_time: null,
      error: null,
      thumbnail_url: options.thumbnailUrl || options.url,
      album_id: options.albumId,
      album_name: options.albumName
    }
  }

  // 添加单个任务
  async addTask(options) {
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

  // 批量添加相册任务 - 优化大批量操作
  async addAlbumTasks(albumData) {
    const { album, photos, uin } = albumData

    const albumDir = path.join(
      this.downloadPath,
      this.sanitizeFilename(uin || 'unknown'),
      this.sanitizeFilename(album.name || '未命名相册')
    )

    const taskIds = []
    const batchSize = 1000 // 分批处理，避免内存占用过大

    // 分批处理照片
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize)
      const batchIds = await this.processBatch(batch, albumDir, album)
      taskIds.push(...batchIds)

      // 触发批量更新
      this.triggerUpdate(batchIds)

      // 给UI一些时间响应
      if (i + batchSize < photos.length) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    // 保存数据库
    await this.db.write()

    // 处理队列
    this.processQueue()

    return taskIds
  }

  // 处理单批次任务
  async processBatch(photos, albumDir, album) {
    const tasks = []
    const taskIds = []

    // 创建任务对象
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      const filename = this.generatePhotoFilename(photo)
      const task = this.createTask({
        url: photo.raw || photo.url || photo.pre,
        filename,
        directory: albumDir,
        total: photo.size || 0,
        type: photo.is_video ? 'video' : 'image',
        thumbnailUrl: photo.pre || photo.url,
        albumId: album.id || album.name,
        albumName: album.name,
        priority: PRIORITY.NORMAL
      })
      tasks.push(task)
      taskIds.push(task.id)
    }

    // 批量添加到数据库
    this.db.data.tasks.push(...tasks)

    // 添加到内存（检查内存限制）
    for (const task of tasks) {
      if (this.activeTasks.size < this.maxActiveTasksInMemory) {
        this.activeTasks.set(task.id, task)
      }
    }

    return taskIds
  }

  // 获取任务列表（分页）- 数据库分页优化版本
  getTasks(page = 1, pageSize = this.pageSize, status = null) {
    try {
      const offset = (page - 1) * pageSize

      let tasks = [...this.db.data.tasks] // 创建副本避免修改原数据

      // 状态筛选
      if (status && status !== 'all') {
        tasks = tasks.filter((task) => task.status === status)
      }

      // 按状态优先级排序：downloading > waiting > paused > error > completed > cancelled
      tasks.sort((a, b) => {
        const statusPriority = {
          [TASK_STATUS.DOWNLOADING]: 1,
          [TASK_STATUS.WAITING]: 2,
          [TASK_STATUS.PAUSED]: 3,
          [TASK_STATUS.ERROR]: 4,
          [TASK_STATUS.COMPLETED]: 5,
          [TASK_STATUS.CANCELLED]: 6
        }

        const aPriority = statusPriority[a.status] || 7
        const bPriority = statusPriority[b.status] || 7

        // 如果状态优先级不同，按优先级排序
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        // 同状态内的排序逻辑
        if (a.status === TASK_STATUS.DOWNLOADING || a.status === TASK_STATUS.WAITING) {
          // 下载中和等待中：按创建时间正序（先创建的先下载）
          return a.create_time - b.create_time
        } else {
          // 其他状态：按创建时间倒序（最新的在前，便于查看）
          return b.create_time - a.create_time
        }
      })

      const totalCount = tasks.length
      const paginatedTasks = tasks.slice(offset, offset + pageSize)

      // 调试信息：显示分页任务的状态分布
      if (is.dev && paginatedTasks.length > 0) {
        const statusCounts = {}
        paginatedTasks.forEach((task) => {
          statusCounts[task.status] = (statusCounts[task.status] || 0) + 1
        })
        // console.debug(`[DownloadService] 第${page}页任务状态分布:`, statusCounts)

        // 显示前几个任务的排序信息
        // const topTasks = paginatedTasks.slice(0, 5).map((task) => ({
        //   name: task.name.substring(0, 20) + '...',
        //   status: task.status,
        //   create_time: new Date(task.create_time).toLocaleTimeString()
        // }))
        // console.debug(`[DownloadService] 前5个任务排序:`, topTasks)
      }

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

  // 获取活跃任务（用于推送）
  getActiveTasks() {
    return Array.from(this.activeTasks.values())
  }

  // 获取任务统计信息
  getTaskStats() {
    try {
      const tasks = this.db.data.tasks
      const stats = {
        total: tasks.length,
        waiting: 0,
        downloading: 0,
        completed: 0,
        error: 0,
        paused: 0,
        cancelled: 0,
        active: 0
      }

      tasks.forEach((task) => {
        switch (task.status) {
          case TASK_STATUS.WAITING:
            stats.waiting++
            break
          case TASK_STATUS.DOWNLOADING:
            stats.downloading++
            break
          case TASK_STATUS.COMPLETED:
            stats.completed++
            break
          case TASK_STATUS.ERROR:
            stats.error++
            break
          case TASK_STATUS.PAUSED:
            stats.paused++
            break
          case TASK_STATUS.CANCELLED:
            stats.cancelled++
            break
        }
      })

      stats.active = stats.waiting + stats.downloading + stats.paused

      return stats
    } catch (error) {
      logger.error('获取任务统计失败:', error)
      return {
        total: 0,
        waiting: 0,
        downloading: 0,
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
      if (task.status === TASK_STATUS.COMPLETED && !task.complete_time) {
        task.complete_time = task.update_time
      }

      // 找到并更新数据库中的任务
      const index = this.db.data.tasks.findIndex((t) => t.id === task.id)
      if (index !== -1) {
        this.db.data.tasks[index] = { ...task }
      }

      // 批量写入优化：避免频繁写入
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

  // 处理下载队列 - 优化版本
  async processQueue() {
    const availableSlots = this.concurrency - this.downloadingTasks.size
    if (availableSlots <= 0) return

    // 从内存中获取等待中的任务
    const waitingTasks = Array.from(this.activeTasks.values())
      .filter((task) => task.status === TASK_STATUS.WAITING)
      .sort((a, b) => {
        // 按优先级和创建时间排序
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
          .filter((task) => task.status === TASK_STATUS.WAITING && !this.activeTasks.has(task.id))
          .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority
            return a.create_time - b.create_time
          })
          .slice(0, availableSlots - waitingTasks.length)

        // 添加到内存
        additionalTasks.forEach((task) => {
          this.activeTasks.set(task.id, task)
          waitingTasks.push(task)
        })
      } catch (error) {
        logger.error('从数据库加载等待任务失败:', error)
      }
    }

    // 执行下载
    for (const task of waitingTasks) {
      if (this.downloadingTasks.size >= this.concurrency) break
      this.executeDownload(task)
    }
  }

  // 执行下载 - 优化版本
  async executeDownload(task) {
    this.downloadingTasks.add(task.id)
    task.status = TASK_STATUS.DOWNLOADING
    task.speed = 0

    // 更新数据库和触发推送
    await this.updateTaskInDB(task)
    this.triggerUpdate([task.id])

    try {
      await fs.promises.mkdir(task.directory, { recursive: true })
      const filePath = path.join(task.directory, task.filename)

      // 检查文件是否已存在
      const fileExists = await fs.promises
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      if (fileExists) {
        const replaceExisting = this.getReplaceExistingSetting()
        if (!replaceExisting) {
          // 设置为不替换，跳过下载
          task.status = TASK_STATUS.COMPLETED
          task.progress = 100
          task.speed = 0
          task.downloaded = task.total || 0

          if (is.dev) {
            console.debug(`[DownloadService] 文件已存在，跳过下载: ${task.filename}`)
          }

          // 完成的任务从内存中移除
          this.activeTasks.delete(task.id)
          await this.updateTaskInDB(task)
          this.triggerUpdate([task.id])
          return
        } else {
          // 设置为替换，删除现有文件
          await fs.promises.unlink(filePath).catch(() => {})
          if (is.dev) {
            console.debug(`[DownloadService] 文件已存在，将被替换: ${task.filename}`)
          }
        }
      }

      const cancelToken = axios.CancelToken.source()
      this.cancelTokens.set(task.id, cancelToken)

      await this.downloadFile(task, filePath, cancelToken)

      if (task.status !== TASK_STATUS.CANCELLED) {
        task.status = TASK_STATUS.COMPLETED
        task.progress = 100
        task.speed = 0

        // 完成的任务从内存中移除（节省内存）
        this.activeTasks.delete(task.id)
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        task.status = TASK_STATUS.CANCELLED
      } else {
        task.status = TASK_STATUS.ERROR
        task.error = error.message
      }
      task.speed = 0
    } finally {
      this.downloadingTasks.delete(task.id)
      this.cancelTokens.delete(task.id)

      // 更新数据库
      await this.updateTaskInDB(task)
      this.triggerUpdate([task.id])

      // 继续处理队列
      setTimeout(() => this.processQueue(), 100)
    }
  }

  // 下载文件 - 保持原有逻辑
  async downloadFile(task, filePath, cancelToken) {
    const writer = fs.createWriteStream(filePath)
    let lastTime = Date.now()
    let lastBytes = 0
    let lastProgressUpdate = Date.now()

    try {
      const response = await axios({
        method: 'get',
        url: task.url,
        responseType: 'stream',
        cancelToken: cancelToken.token,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const totalBytes = parseInt(response.headers['content-length'], 10) || 0
      if (totalBytes > 0) {
        task.total = totalBytes
      }

      response.data.on('data', (chunk) => {
        task.downloaded += chunk.length
        const now = Date.now()

        // 计算速度
        if (now - lastTime >= 500) {
          const timeDiff = (now - lastTime) / 1000
          const bytesDiff = task.downloaded - lastBytes
          task.speed = Math.round(bytesDiff / timeDiff)
          lastTime = now
          lastBytes = task.downloaded

          // 调试信息：显示速度计算
          if (is.dev && task.speed > 0) {
            console.debug(
              `[DownloadService] 任务 ${task.name} 速度: ${task.speed} B/s (${Math.round(task.speed / 1024)} KB/s)`
            )
          }

          // 速度更新时立即推送
          this.triggerUpdate([task.id])
        }

        // 更新进度
        if (task.total > 0 && now - lastProgressUpdate >= 200) {
          const newProgress = Math.round((task.downloaded / task.total) * 100)
          if (newProgress !== task.progress) {
            task.progress = newProgress
            lastProgressUpdate = now

            // 定期更新数据库（减少频率）
            if (newProgress % 5 === 0) {
              this.updateTaskInDB(task)
            }

            this.triggerUpdate([task.id])
          }
        }
      })

      response.data.pipe(writer)

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
        response.data.on('error', reject)
      })
    } catch (error) {
      await fs.promises.unlink(filePath).catch(() => {})
      throw error
    }
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

  // 任务操作方法
  async pauseTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task && [TASK_STATUS.DOWNLOADING, TASK_STATUS.WAITING].includes(task.status)) {
      if (task.status === TASK_STATUS.DOWNLOADING) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancel('任务已暂停')
        }
      }
      task.status = TASK_STATUS.PAUSED
      task.speed = 0

      // 确保在内存中
      this.activeTasks.set(taskId, task)
      await this.updateTaskInDB(task)
      this.triggerUpdate([taskId])
    }
  }

  async resumeTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task && task.status === TASK_STATUS.PAUSED) {
      // 检查是否为"假暂停"的已完成任务（在替换模式下不应该重新下载）
      if (task.progress === 100 && task.downloaded > 0) {
        const filePath = path.join(task.directory, task.filename)
        const fileExists = await fs.promises
          .access(filePath)
          .then(() => true)
          .catch(() => false)

        if (fileExists) {
          // 文件存在且任务已完成，直接标记为完成，不重新下载
          task.status = TASK_STATUS.COMPLETED
          task.speed = 0
          task.error = null

          // 从内存中移除，避免重复处理
          this.activeTasks.delete(task.id)
          await this.updateTaskInDB(task)
          this.triggerUpdate([taskId])
          return
        }
      }

      // 对于真正需要重新下载的任务
      task.status = TASK_STATUS.WAITING
      task.downloaded = 0
      task.progress = 0
      task.speed = 0

      this.activeTasks.set(taskId, task)
      await this.updateTaskInDB(task)
      this.triggerUpdate([taskId])
      this.processQueue()
    }
  }

  async resumeAll() {
    const changedTaskIds = []

    // 从数据库获取所有暂停的任务
    const pausedTasks = this.db.data.tasks.filter((task) => task.status === TASK_STATUS.PAUSED)

    for (const task of pausedTasks) {
      // 检查是否为"假暂停"的已完成任务（在替换模式下不应该重新下载）
      if (task.progress === 100 && task.downloaded > 0) {
        const filePath = path.join(task.directory, task.filename)
        const fileExists = await fs.promises
          .access(filePath)
          .then(() => true)
          .catch(() => false)

        if (fileExists) {
          // 文件存在且任务已完成，直接标记为完成，不重新下载
          task.status = TASK_STATUS.COMPLETED
          task.speed = 0
          task.error = null

          // 从内存中移除，避免重复处理
          this.activeTasks.delete(task.id)
          await this.updateTaskInDB(task)
          changedTaskIds.push(task.id)
          continue
        }
      }

      // 对于真正需要重新下载的任务
      task.status = TASK_STATUS.WAITING
      task.downloaded = 0
      task.progress = 0
      task.speed = 0
      task.error = null

      // 确保在内存中
      this.activeTasks.set(task.id, task)
      await this.updateTaskInDB(task)
      changedTaskIds.push(task.id)
    }

    await this.saveDatabase()
    this.triggerUpdate(changedTaskIds)

    // 开始处理队列
    this.processQueue()
  }

  async retryTask(taskId) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task && (task.status === TASK_STATUS.ERROR || task.status === TASK_STATUS.CANCELLED)) {
      task.status = TASK_STATUS.WAITING
      task.downloaded = 0
      task.progress = 0
      task.error = null
      task.speed = 0

      this.activeTasks.set(taskId, task)
      await this.updateTaskInDB(task)
      this.triggerUpdate([taskId])
      this.processQueue()
    }
  }

  async deleteTask(taskId, deleteFile = false) {
    const task = this.activeTasks.get(taskId) || this.getTaskFromDB(taskId)
    if (task) {
      // 取消正在下载的任务
      if (task.status === TASK_STATUS.DOWNLOADING) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancel('任务已删除')
        }
      }

      // 删除文件
      if (deleteFile && task.status === TASK_STATUS.COMPLETED) {
        const filePath = path.join(task.directory, task.filename)
        fs.promises.unlink(filePath).catch(() => {})
      }

      // 从内存和数据库中删除
      this.activeTasks.delete(taskId)
      this.downloadingTasks.delete(taskId)
      this.cancelTokens.delete(taskId)

      // 从数据库中删除
      const index = this.db.data.tasks.findIndex((t) => t.id === taskId)
      if (index !== -1) {
        this.db.data.tasks.splice(index, 1)
        await this.db.write()
      }

      this.triggerUpdate([taskId])
    }
  }

  // 批量操作
  async cancelAll() {
    const changedTaskIds = []

    for (const [taskId, task] of this.activeTasks) {
      if ([TASK_STATUS.WAITING, TASK_STATUS.DOWNLOADING].includes(task.status)) {
        const cancelToken = this.cancelTokens.get(taskId)
        if (cancelToken) {
          cancelToken.cancel('批量暂停')
        }
        task.status = TASK_STATUS.PAUSED
        task.speed = 0
        await this.updateTaskInDB(task)
        changedTaskIds.push(taskId)
      }
    }

    this.downloadingTasks.clear()
    this.cancelTokens.clear()
    await this.saveDatabase()
    this.triggerUpdate(changedTaskIds)
  }

  async clearTasks() {
    // 先记录需要清空的任务ID（用于事件推送）
    const allTaskIds = Array.from(this.activeTasks.keys())
    const dbTaskIds = this.db.data.tasks.map((task) => task.id)
    const allIds = [...new Set([...allTaskIds, ...dbTaskIds])]

    // 取消所有活跃任务
    await this.cancelAll()

    // 清空数据库
    this.db.data.tasks = []
    await this.db.write()

    // 清空内存
    this.activeTasks.clear()
    this.downloadingTasks.clear()
    this.cancelTokens.clear()

    // 触发事件推送，传递所有被删除的任务ID
    this.triggerUpdate(allIds.map((id) => ({ id, deleted: true })))
  }

  // 选择下载目录
  async selectDirectory() {
    try {
      const defaultPath =
        typeof this.downloadPath === 'string' ? this.downloadPath : app.getPath('downloads')
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: defaultPath
      })

      if (!result.canceled && result.filePaths.length > 0) {
        this.downloadPath = result.filePaths[0]
        await this.setSetting('downloadPath', this.downloadPath)
        return this.downloadPath
      }
      return null
    } catch (error) {
      logger.error('选择目录失败:', error)
      return null
    }
  }

  // 打开文件夹
  async openFolder(folderPath) {
    try {
      let targetPath = folderPath || this.downloadPath
      if (typeof targetPath !== 'string') {
        targetPath = app.getPath('downloads')
      }
      await fs.promises.mkdir(targetPath, { recursive: true })
      return shell.openPath(targetPath)
    } catch (error) {
      logger.error('打开文件夹失败:', error)
      try {
        const fallbackPath = app.getPath('downloads')
        return shell.openPath(fallbackPath)
      } catch (fallbackError) {
        logger.error('打开默认下载目录也失败:', fallbackError)
        throw fallbackError
      }
    }
  }

  // 工具方法
  sanitizeFilename(filename) {
    if (typeof filename !== 'string') {
      filename = String(filename || 'unnamed')
    }
    return (
      filename
        .replace(/[<>:"/\\|?*]/g, '_')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f\x80-\x9f]/g, '')
        .replace(/^\.+/, '')
        .replace(/\.+$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 255) || 'unnamed'
    )
  }

  generatePhotoFilename(photo) {
    // 获取真正的唯一标识符 - lloc 是最可靠的唯一标识符
    const uniqueId = photo.lloc || photo.id || Date.now()

    // 获取拍摄时间或修改时间 - 避免使用本地时间
    let dateStr = ''
    let timeStr = ''

    // 优先使用 exif 中的原始拍摄时间
    if (photo.exif && photo.exif.originalTime) {
      const originalTime = photo.exif.originalTime.replace(/:/g, '-')
      const date = new Date(originalTime)
      if (!isNaN(date.getTime())) {
        dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
        timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '')
      }
    }

    // 如果没有 exif 时间，使用 modifytime（Unix 时间戳）
    if (!dateStr && photo.modifytime) {
      const timestamp = photo.modifytime * 1000 // Unix 时间戳转毫秒
      const date = new Date(timestamp)
      if (!isNaN(date.getTime())) {
        dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
        timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '')
      }
    }

    // 如果还没有时间，使用 rawshoottime 或 shoottime
    if (!dateStr) {
      const shootTime = photo.rawshoottime || photo.shoottime
      if (shootTime) {
        const date = new Date(shootTime)
        if (!isNaN(date.getTime())) {
          dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
          timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '')
        }
      }
    }

    // 最后兜底：使用照片名称中的日期信息
    if (!dateStr && photo.name && photo.name.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateStr = photo.name.replace(/-/g, '')
      timeStr = '000000' // 默认时间
    }

    // 文件扩展名
    const extension = photo.is_video ? '.mp4' : '.jpg'

    // 基础文件名
    const baseName = photo.name || `photo_${uniqueId}`

    // 生成文件名格式：日期_时间_唯一ID_名称.扩展名
    // 使用 lloc 的后8位作为短标识符（保持可读性）
    const shortId = this.sanitizeFilename(uniqueId)

    return `${dateStr}_${timeStr}_${this.sanitizeFilename(baseName)}_${shortId}${extension}`
  }

  // 清理资源
  async destroy() {
    await this.cancelAll()
    this.updateTrigger = null

    // 确保所有数据已保存
    if (this._writeTimeout) {
      clearTimeout(this._writeTimeout)
      await this.saveDatabase()
    }
  }
}
