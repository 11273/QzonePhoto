import { BrowserWindow, app, ipcMain } from 'electron'
import path, { join } from 'path'
import logger from '@main/core/logger'
import { IPC_AI } from '@shared/ipc-channels'
import { AiActionTypes, AI_IPC_CHANNEL, AiTargets } from '@shared/ai-ipc-channels'
import { getDirectorySize } from '../utils/file-processor'
import { initDatabase, getTable } from '@main/core/database'
import { syncFolders, indexSingleFile } from '@main/core/scanner'
import { Pipeline } from '@main/core/pipeline'
import { ModelManager } from '@main/core/ai/model-manager'
import { WorkerWindowManager } from '@main/core/ai/window-manager'
import { ModelDownloader } from '@main/ai/model-downloader'
import { Clusterer } from '@main/core/ai/clusterer'
import chokidar from 'chokidar'
import { AI_EXTENSIONS } from '@shared/const'

/**
 * AI 子系统全局状态枚举
 * @enum {string}
 */
export const AI_SYSTEM_STATUS = {
  STOPPED: 'STOPPED', // 未启动 / 模型缺失
  MODEL_MISSING: 'MODEL_MISSING', // 明确模型缺失
  DOWNLOADING: 'DOWNLOADING', // 正在下载模型
  INITIALIZING: 'INITIALIZING', // Worker 正在加载模型
  READY: 'READY', // 就绪，可接受任务
  SCANNING: 'SCANNING', // 正在扫描入库
  ANALYZING: 'ANALYZING', // 正在分析处理
  ERROR: 'ERROR' // 出错
}

/** 默认搜索结果数量限制 */
const DEFAULT_SEARCH_LIMIT = 50
/** 默认回忆结果数量限制 */
const DEFAULT_MEMORY_LIMIT = 10

/**
 * AI 服务
 * 负责 AI 子系统生命周期管理、隐形窗口调度、向量存储及 IPC 通信
 */
export class AIService {
  /**
   * @param {import('./main/download').DownloadService} downloadService
   */
  constructor(downloadService) {
    /** @type {import('./main/download').DownloadService} */
    this.downloadService = downloadService

    /** @type {boolean} 是否正在扫描 */
    this.isScanning = false
    /** @type {string} 引擎状态 */
    this.status = 'STOPPED'
    /** @type {boolean} 是否正在初始化中 */
    this.isInitializing = false

    /** @type {Object | null} 向量表 */
    this.table = null

    /** @type {WorkerWindowManager} 窗口管理器 */
    this.windowManager = new WorkerWindowManager(this)

    /** @type {number} 最近一次分析耗时 (ms) */
    this.lastAnalyzeTime = 0

    /** @type {import('chokidar').FSWatcher | null} 目录监听器 */
    this.watcher = null
    /** @type {string[]} 正在监听的目录列表 */
    this.watchingPaths = []

    // 初始化 IPC 路由
    this._setupIpcRouter()

    // 注册下载完成钩子
    this._registerDownloadHook()
  }

  /**
   * 获取数据库存储占用大小
   * @returns {Promise<{ data: number }>}
   */
  async getStorageSize() {
    try {
      const dbPath = path.join(app.getPath('userData'), 'ai-db')
      const size = await getDirectorySize(dbPath)
      return { data: size }
    } catch (err) {
      logger.error('[AIService] 获取存储大小失败:', err)
      return { data: 0 }
    }
  }

  /* --------------------------------------------------
   * IPC 处理器注册
   * -------------------------------------------------- */

  /* --------------------------------------------------
   * 生命周期管理
   * -------------------------------------------------- */

  /**
   * 初始化服务（核心入口）
   */
  async init() {
    logger.info('[AIService] ========== 初始化服务 ==========')

    // 步骤 1：初始化数据库
    await this._initDatabase()

    // 步骤 2：检查模型完整性
    const integrityResult = await ModelManager.checkModelIntegrity()
    logger.info(`[AIService] 模型完整性检查: ${integrityResult.complete ? '✅ 完整' : '❌ 缺失'}`)

    if (!integrityResult.complete) {
      // ========== 分支 A：模型缺失 ==========
      logger.info('[AIService] 分支 A: 模型缺失，不启动 Worker')
      this._updateStatus(AI_SYSTEM_STATUS.MODEL_MISSING, integrityResult.reason || '模型文件不完整')
      return
    }

    // ========== 分支 B：模型存在 ==========
    logger.info('[AIService] 分支 B: 模型存在，启动 Worker + 静默扫描')

    // 并行执行：启动 Worker 预热 + 静默扫描入库
    this.initWorker().catch((err) => {
      logger.error('[AIService] Worker 初始化失败:', err)
      this._updateStatus(AI_SYSTEM_STATUS.ERROR, err.message)
    })

    // 静默同步移至前端 Page Enter 触发
  }

  /**
   * 初始化 Worker 环境
   */
  async initWorker() {
    if (this.isInitializing) {
      logger.info('[AIService] initWorker: 已经在初始化中，跳过重复调用')
      return { data: false, message: 'Already initializing' }
    }

    this.isInitializing = true
    logger.info('[AIService] initWorker: 检查环境并启动...')

    try {
      // 1. 检查物理文件完整性
      const integrity = await ModelManager.checkModelIntegrity()
      if (!integrity.complete) {
        logger.info(`[AIService] 模型缺失或不完整: ${integrity.reason}，启动下载流...`)
        await this._downloadModelsInternal()
        // 下载完成后继续，不再递归调用，避免被 isInitializing 锁住
      }

      // 2. 环境配置与模型路径获取
      await ModelManager.ensureClipConfigs()
      const { data: status } = await ModelManager.checkModels()

      // 3. 状态管理
      logger.info('[AIService] initWorker: 设置状态为 STARTING...')
      this._updateStatus('STARTING')
      await this.windowManager.ensureWindow()

      // 4. 等待 Worker 响应并加载模型
      logger.info('[AIService] initWorker: 检查健康状态...')
      // 增加重试次数，确保窗口彻底就绪
      const info = await this.checkWorkerHealth({ timeout: 60000, retry: 20 })
      if (!info || !info.data) {
        throw new Error('AI 引擎响应超时 (窗口未就绪)')
      }

      logger.info('[AIService] initWorker: 引擎已连接，发送初始化指令...')
      const initResult = await this.windowManager.invoke(AiActionTypes.INIT, {
        clipPath: status.clipPath
      })

      logger.info('[AIService] initWorker: 初始化指令执行成功')
      this._updateStatus('READY')
      this.isInitializing = false

      // 实时获取数据库大小
      const dbSize = await getDirectorySize(join(app.getPath('userData'), 'ai-db')).catch(() => 0)

      return {
        data: {
          ...initResult,
          storageUsed: dbSize
        }
      }
    } catch (err) {
      logger.error('[AIService] Worker 启动异常:', err)
      this._updateStatus('ERROR', `AI 引擎加载失败: ${err.message}`)
      this.isInitializing = false
      return { data: false, error: err.message }
    }
  }

  /**
   * 内部下载逻辑
   * @private
   */
  async _downloadModelsInternal() {
    this._updateStatus(AI_SYSTEM_STATUS.DOWNLOADING)

    const downloader = new ModelDownloader({
      onProgress: (prog) => {
        const payload = {
          isDownloading: true,
          ...prog
        }
        this._broadcastToRenderer(IPC_AI.SCAN_PROGRESS, payload)
        this._broadcastToRenderer(IPC_AI.DOWNLOAD_PROGRESS, payload)
      }
    })

    try {
      await downloader.start()
      logger.info('[AIService] 模型下载完成')
      return true
    } catch (err) {
      logger.error('[AIService] 模型下载失败:', err)
      throw err // 抛出错误由 initWorker 捕获
    }
  }

  /**
   * 初始化数据库
   * @private
   */
  async _initDatabase() {
    try {
      await initDatabase()
      this.table = getTable()
      logger.info('[AIService] 数据库已连接')
    } catch (err) {
      logger.error('[AIService] 数据库初始化失败:', err)
      throw err
    }
  }

  /* --------------------------------------------------
   * Worker 回调接口
   * -------------------------------------------------- */

  onWorkerReady() {
    // Worker 窗口加载完成
    // 增加锁检查，避免已经在 init 中的流程被打断
    if (this.isInitializing) {
      logger.info('[AIService] onWorkerReady: 已经在初始化中，忽略窗口就绪事件')
      return
    }

    this.checkModels().then(({ data: status }) => {
      if (status.exists) {
        logger.warn('[AIService] 检测到窗口刷新/就绪，尝试恢复初始化...')
        this.initWorker()
      }
    })
  }

  onWorkerRestarting() {
    this._updateStatus('ERROR', '正在自动恢复...')
  }

  onFatalError(msg) {
    this._updateStatus('FATAL_ERROR', msg)
  }

  /* --------------------------------------------------
   * 业务逻辑
   * -------------------------------------------------- */

  async restart() {
    this.windowManager.resetRetryCount()
    return this.initWorker()
  }

  async checkModels() {
    return ModelManager.checkModels()
  }

  /**
   * 检查 Worker 健康状态
   */
  async checkWorkerHealth(options = {}) {
    let retries = options.retry || 1
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    while (retries > 0) {
      if (this.windowManager.isReady) {
        try {
          const status = await this.windowManager.invoke(
            AiActionTypes.GET_STATUS,
            {},
            options.timeout || 5000
          )
          const userDataPath = app.getPath('userData')
          const dbPath = join(userDataPath, 'ai-db')
          const size = await getDirectorySize(dbPath).catch(() => 0)

          return {
            data: {
              ...status,
              storageUsed: size
            }
          }
        } catch {
          logger.warn(`[AIService] Health Check Invoke Failed, retries left: ${retries - 1}`)
        }
      } else {
        logger.debug(`[AIService] Window Manager not ready yet, retries left: ${retries - 1}`)
      }

      retries--
      if (retries > 0) await delay(1000)
    }

    return { data: false }
  }

  /* --------------------------------------------------
   * 实时同步与监听
   * -------------------------------------------------- */

  /**
   * 注册下载完成钩子 (由 DownloadService 触发)
   * @private
   */
  _registerDownloadHook() {
    if (this.downloadService && typeof this.downloadService.setOnDownloadComplete === 'function') {
      this.downloadService.setOnDownloadComplete((task, filePath) => {
        this._onDownloadComplete(task, filePath)
      })
      logger.info('[AIService] 已成功挂载下载完成钩子')
    }
  }

  /**
   * 下载完成时的回调
   * @param {Object} task 任务对象
   * @param {string} filePath 文件绝对路径
   */
  async _onDownloadComplete(task, filePath) {
    if (!filePath) return

    // 获取后缀名
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const isSupported = AI_EXTENSIONS.SCAN_TARGETS.includes(ext)
    if (!isSupported) return

    logger.info(`[AIService] [HOOK] 检测到新下载完成文件: ${filePath}`)
    try {
      // 立即入库进行点名
      const res = await indexSingleFile(filePath, task.directory)
      if (res.success && (res.type === 'new' || res.type === 'modified')) {
        // 如果是新文件或变更文件，刷新待处理计数
        this._broadcastToRenderer(IPC_AI.STATUS_CHANGE, {
          status: this.status,
          msg: `发现新文件: ${path.basename(filePath)}`
        })
      }
    } catch (err) {
      logger.error('[AIService] 执行钩子索引失败:', err)
    }
  }

  /**
   * 设置动态监听路径 (由渲染进程同步)
   * @param {string[]} paths 需实时监听的目录列表
   */
  async setWatchPaths(paths) {
    if (!Array.isArray(paths)) return

    const normalizedPaths = paths.filter((p) => !!p)
    logger.info(`[AIService] 同步动态监听路径, 总数: ${normalizedPaths.length}`)

    // 如果路径没变，跳过
    if (
      normalizedPaths.length === this.watchingPaths.length &&
      normalizedPaths.every((p) => this.watchingPaths.includes(p))
    ) {
      return
    }

    this.watchingPaths = [...normalizedPaths]
    await this._updateWatcher()
  }

  /**
   * 更新 Chokidar 监听器
   * @private
   */
  async _updateWatcher() {
    // 1. 关闭旧监听
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      logger.debug('[AIService] 已关闭旧文件监听器')
    }

    if (this.watchingPaths.length === 0) return

    // 2. 启动新监听
    logger.info(`[AIService] 启动新文件监听, 目标: ${JSON.stringify(this.watchingPaths)}`)

    this.watcher = chokidar.watch(this.watchingPaths, {
      ignored: /(^|[/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: true, // 初始扫描不触发事件 (由 startBackgroundScan 负责)
      followSymlinks: true
    })

    this.watcher
      .on('add', (filePath) => this._handleFileEvent('add', filePath))
      .on('change', (filePath) => this._handleFileEvent('change', filePath))
      .on('error', (error) => logger.error(`[AIService] Watcher Error: ${error}`))
  }

  /**
   * 处理文件系统变动事件
   * @private
   */
  async _handleFileEvent(event, filePath) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const isSupported = AI_EXTENSIONS.SCAN_TARGETS.includes(ext)
    if (!isSupported) return

    logger.debug(`[AIService] [WATCHER] 检测到 [${event}]: ${filePath}`)
    try {
      const res = await indexSingleFile(filePath)
      if (res.success && (res.type === 'new' || res.type === 'modified')) {
        // 有效变动，提示渲染进程
        this._broadcastToRenderer(IPC_AI.STATUS_CHANGE, {
          status: this.status,
          msg: `动态发现: ${path.basename(filePath)}`
        })
      }
    } catch (err) {
      logger.error(`[AIService] 处理动态文件事件失败: ${filePath}`, err)
    }
  }

  /**
   * 启动后台同步扫描
   * @param {string[]} paths 明确的扫描路径列表
   */
  async startBackgroundScan(paths) {
    if (this.isScanning) {
      logger.info('[AIService] 已有扫描任务正在进行，跳过请求')
      return { data: false, message: 'Scan already in progress' }
    }

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      logger.warn(
        `[AIService] 收到空的扫描路径请求，中止扫描。Type: ${typeof paths}, Value: ${JSON.stringify(paths)}`
      )
      return { data: false, message: 'No scan paths provided' }
    }

    const foldersToSync = paths
    logger.info(`[AIService] 启动库同步, 目标路径: ${JSON.stringify(foldersToSync)}`)
    this.isScanning = true
    this._updateStatus(AI_SYSTEM_STATUS.SCANNING, '正在同步本地文件...')

    try {
      const stats = await syncFolders(foldersToSync)

      this.isScanning = false
      if (this.status === AI_SYSTEM_STATUS.SCANNING) {
        this._updateStatus(AI_SYSTEM_STATUS.READY)
      }
      return { data: true, ...stats }
    } catch (err) {
      logger.error('[AIService] 同备库失败:', err)
      this.isScanning = false
      this._updateStatus(AI_SYSTEM_STATUS.READY)
      return { data: false, error: err.message }
    }
  }

  /**
   * DIFF 扫描 (UI 触发)
   */
  async triggerDiffScan(paths) {
    return this.startBackgroundScan(paths)
  }

  /**
   * 广播进度到所有可见窗口
   * @param {Object} data 进度数据
   */
  broadcastProgress(data) {
    this._broadcastToRenderer(IPC_AI.SCAN_PROGRESS, data)
  }

  /**
   * 启动全局分析流程
   */
  async startGlobalAnalysis() {
    if (this.isScanning) return
    logger.info('[AIService] 🚀 启动全局分析流程')

    this._updateStatus(AI_SYSTEM_STATUS.ANALYZING)
    this.isScanning = true

    try {
      const aiInvoker = (action, payload) => this.windowManager.invoke(action, payload)

      // 使用广播机制通知进度，不再绑定单一窗口
      await Pipeline.start(null, aiInvoker, {
        onProgress: (data) => this.broadcastProgress(data)
      })

      logger.info('[AIService] 全局分析任务结束')
      this._updateStatus(AI_SYSTEM_STATUS.READY)
      this.isScanning = false
      return { data: true }
    } catch (err) {
      logger.error('[AIService] 全局分析失败:', err)
      this._updateStatus(AI_SYSTEM_STATUS.READY)
      this.isScanning = false
      return { data: false, error: err.message }
    }
  }

  async stopScan() {
    logger.info('[AIService] 停止活动')
    this.isScanning = false
    Pipeline.shouldStop = true // 触发流水线停止
    this._updateStatus(AI_SYSTEM_STATUS.READY)
    return { data: true }
  }

  async deletePhoto(path) {
    if (!this.table) return { data: false }
    try {
      const escapedPath = path.replace(/'/g, "\\'")
      await this.table.delete(`path = '${escapedPath}'`)
      return { data: true }
    } catch (err) {
      logger.error(`[AIService] 删除失败: ${path}`, err)
      return { data: false }
    }
  }

  async getPendingCount() {
    if (!this.table) return { data: 0 }
    try {
      const pending = await this.table.query().where("status = 'pending'").toArray()
      return { data: pending.length }
    } catch {
      return { data: 0 }
    }
  }

  async searchByText(text, limit) {
    if (!this.table) return { data: [] }
    try {
      // 通过 WindowManager 调用 Worker 分析
      const vector = await this.windowManager.invoke(AiActionTypes.ANALYZE_TEXT, { text })
      const results = await this.table
        .vectorSearch(vector)
        .column('sceneVector')
        .limit(limit || DEFAULT_SEARCH_LIMIT)
        .toArray()
      return {
        data: results.map((r) => ({ path: r.path, score: r._distance, captureDate: r.captureDate }))
      }
    } catch (err) {
      logger.error('[AIService] 搜图失败:', err)
      return { data: [] }
    }
  }

  /**
   * 触发人物聚类整理
   * @returns {Promise<{ success: boolean, count: number }>}
   */
  async clusterFaces() {
    if (!this.table) return { success: false, msg: '数据库未初始化' }

    try {
      // 1. 获取所有已分析且有人脸的照片
      const allPhotos = await this.table.query().where("status = 'done'").toArray()
      logger.info(`[AIService] 聚类开始: 总计 ${allPhotos.length} 张已处理照片`)

      // 2. 执行聚类 (收紧阈值以提升人物聚合精度)
      // 这里的 0.28 相当于要求 1 - 0.28 = 0.72 的相似度
      const clusters = Clusterer.cluster(allPhotos, 0.3)
      logger.info(`[AIService] 聚类完成: 发现 ${clusters.length} 个潜在人物分组`)

      // 3. 更新数据库 (持久化 groupId)
      logger.info(`[AIService] 正在持久化 ${clusters.length} 个分组信息到数据库...`)

      // 【关键修复】为了确保“重新整理”是全量清空的，我们先在内存中把所有人的 groupId 抹掉
      const updateMap = new Map()

      // 先初始化所有已分析照片的 faces 状态 (抹除旧的 groupId)
      for (const photo of allPhotos) {
        let faces = []
        try {
          faces = typeof photo.faces === 'string' ? JSON.parse(photo.faces) : photo.faces
        } catch {
          continue
        }
        if (!Array.isArray(faces)) continue

        // 抹除
        faces.forEach((f) => {
          delete f.groupId
        })
        updateMap.set(photo.path, faces)
      }

      // 再填入新的聚类结果
      for (const cluster of clusters) {
        for (const member of cluster.members) {
          const faces = updateMap.get(member.path)
          if (faces && faces[member.index]) {
            faces[member.index].groupId = cluster.id
          }
        }
      }

      // 3. 执行持久化 (采用 Bulk Re-insertion 策略解决 LanceDB Update 缓慢问题)
      this._updateStatus(AI_SYSTEM_STATUS.ANALYZING, '正在应用人物整理结果...')
      logger.info(`[AIService] 正在准备全量更新 ${allPhotos.length} 条记录...`)

      const updatedPhotos = allPhotos.map((photo) => {
        const newFaces = updateMap.get(photo.path)
        // 【关键修复】深度清洗数据对象，只提取 Schema 定义的字段，防止 Arrow 内部元数据（如 vector.isValid）干扰
        return {
          id: photo.id,
          path: photo.path,
          folder: photo.folder,
          status: photo.status,
          // 强制将 vector 转为普通数组
          vector: Array.from(photo.vector),
          faces: newFaces
            ? JSON.stringify(newFaces)
            : typeof photo.faces === 'string'
              ? photo.faces
              : JSON.stringify(photo.faces || []),
          timestamp: photo.timestamp,
          mtime: photo.mtime,
          width: photo.width,
          height: photo.height,
          thumbnail: photo.thumbnail
        }
      })

      // 第一步：清空旧的已处理数据 (注意只删除已经加载到内存进行重整的这部分 status = 'done')
      logger.info('[AIService] 正在清空旧的分析记录...')
      await this.table.delete("status = 'done'")

      // 第二步：批量插入新数据
      logger.info(`[AIService] 正在批量插入 ${updatedPhotos.length} 条新记录...`)

      // 分批插入防止单次写入压力过大
      const BATCH_SIZE = 500
      for (let i = 0; i < updatedPhotos.length; i += BATCH_SIZE) {
        const chunk = updatedPhotos.slice(i, i + BATCH_SIZE)
        await this.table.add(chunk)
        logger.info(
          `[AIService] 批量插入进度: ${Math.min(i + BATCH_SIZE, updatedPhotos.length)} / ${updatedPhotos.length}`
        )
      }

      logger.info('[AIService] 数据库持久化成功')
      this._updateStatus(AI_SYSTEM_STATUS.READY, '人物整理完成')
      return { success: true, count: clusters.length }
    } catch (err) {
      logger.error('[AIService] 人物聚类失败:', err)
      this._updateStatus(AI_SYSTEM_STATUS.READY, '人物整理失败')
      return { success: false, msg: err.message }
    }
  }

  async getFaceGroups() {
    if (!this.table) return { data: [] }
    try {
      const photos = await this.table.query().where("status = 'done'").toArray()
      logger.info(`[AIService] 获取人物墙: 读取到 ${photos.length} 张已处理照片`)
      const groups = new Map()

      for (const photo of photos) {
        let faces = []
        try {
          faces = typeof photo.faces === 'string' ? JSON.parse(photo.faces) : photo.faces
        } catch {
          continue
        }
        if (!Array.isArray(faces)) continue

        for (const face of faces) {
          if (face.groupId) {
            if (!groups.has(face.groupId)) {
              groups.set(face.groupId, {
                id: face.groupId,
                name: '未命名人物',
                coverPath: photo.path,
                coverWidth: photo.width || 0,
                coverHeight: photo.height || 0,
                faceBox: face.box,
                faceThumbnail: face.thumbnail, // 提取人脸特写缩略图
                count: 0,
                gender: face.gender,
                age: Math.round(face.age || 0)
              })
            }
            const g = groups.get(face.groupId)
            g.count++
          }
        }
      }

      logger.info(`[AIService] 人物墙计算完成: 共 ${groups.size} 个有效分组`)

      // 如果一个分组都没有，但库里有照片，尝试自动触发一次静默整理
      if (groups.size === 0 && photos.length > 0) {
        logger.info('[AIService] 检测到人物数据为空，尝试后台静默整理...')
        setTimeout(() => this.clusterFaces(), 1000)
      }

      // 排序：出现频率最高的前 20 个
      const sortedGroups = Array.from(groups.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 200)

      return { data: sortedGroups }
    } catch (err) {
      logger.error('[AIService] 获取人物墙失败:', err)
      return { data: [] }
    }
  }

  async getPhotosByFace(groupId) {
    if (!this.table) return { data: [] }
    try {
      const results = await this.table.query().where("status = 'done'").toArray()
      const filtered = results
        .filter((r) => {
          let faces = []
          try {
            faces = typeof r.faces === 'string' ? JSON.parse(r.faces) : r.faces
          } catch {
            return false
          }
          return Array.isArray(faces) && faces.some((f) => f.groupId === groupId)
        })
        .map((r) => {
          const faces = typeof r.faces === 'string' ? JSON.parse(r.faces) : r.faces
          const targetFace = faces.find((f) => f.groupId === groupId)
          return {
            path: r.path,
            status: r.status,
            thumbnail: r.thumbnail,
            faceThumbnail: targetFace ? targetFace.thumbnail : null,
            timestamp: r.timestamp
          }
        })
      return { data: filtered }
    } catch (err) {
      logger.error('[AIService] 获取人物详情失败:', err)
      return { data: [] }
    }
  }

  async getMemories() {
    if (!this.table) return { data: [] }
    const results = await this.table
      .query()
      .limit(DEFAULT_MEMORY_LIMIT * 5)
      .toArray()

    const sorted = results
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, DEFAULT_MEMORY_LIMIT)

    return {
      data: sorted.map((r) => ({
        path: r.path,
        captureDate: r.captureDate,
        status: r.status,
        tags: r.tags,
        thumbnail: r.thumbnail,
        faces: r.faces,
        timestamp: r.timestamp
      }))
    }
  }

  // 辅助：状态更新广播
  _updateStatus(newStatus, msg = '') {
    logger.info(`[AIService] Update Status: ${this.status} -> ${newStatus} (Msg: ${msg})`)
    this.status = newStatus
    this._broadcastToRenderer(IPC_AI.STATUS_CHANGE, { status: newStatus, msg })
  }

  _broadcastToRenderer(channel, payload) {
    BrowserWindow.getAllWindows().forEach((win) => {
      // 排除 Worker 窗口
      if (!win.isDestroyed() && (!this.windowManager.window || win !== this.windowManager.window)) {
        win.webContents.send(channel, payload)
      }
    })
  }

  /**
   * 启动防止休眠
   */
  async startBlockSleep() {
    const { powerSaveBlocker } = require('electron')
    if (this.sleepBlockerId === undefined) {
      this.sleepBlockerId = powerSaveBlocker.start('prevent-app-suspension')
      logger.info(`[AIService] 已启动睡眠锁定 (ID: ${this.sleepBlockerId})`)
    }
    return { data: true }
  }

  /**
   * 停止防止休眠
   */
  async stopBlockSleep() {
    const { powerSaveBlocker } = require('electron')
    if (this.sleepBlockerId !== undefined) {
      powerSaveBlocker.stop(this.sleepBlockerId)
      logger.info(`[AIService] 已解除睡眠锁定 (ID: ${this.sleepBlockerId})`)
      this.sleepBlockerId = undefined
    }
    return { data: true }
  }

  getServiceStatus() {
    return { data: { status: this.status } }
  }

  // 辅助：处理来自 Worker/Pipeline 的消息路由 (接管原 _startRouter)
  // 注意：我们需要确保 Worker 也可以发消息给 Main。
  // WindowManager 已经处理了 invoke 的响应。
  // 如果 Worker 主动发消息，可以在 WindowManager 的 listener 中扩展。
  // 目前 WindowManager 仅处理了 crashed 等。
  // 我们需要在 WindowManager 中监听 ipc-message?
  // 或者保留 ipcMain.on(AI_IPC_CHANNEL) ?
  // Worker 发消息是通过 ipcRenderer.send(AI_IPC_CHANNEL, ...) 到 Main
  // 所以必须保留 ipcMain 监听。
  // 由于 AIService 是单例，我们可以在 constructor 中启动监听。

  _setupIpcRouter() {
    // 监听 AI_IPC_CHANNEL
    ipcMain.on(AI_IPC_CHANNEL, async (event, envelope) => {
      const { id, type, target, source, payload, error } = envelope
      logger.info(`[AIService] IPC Receive: ${type} from ${source} to ${target} (ID: ${id})`)

      // 1. 发给 Main
      if (target === AiTargets.MAIN) {
        // A. 响应请求 (invoke result) -> WindowManager 处理
        if (this.windowManager.resolveRequest(id, error, payload)) {
          logger.info(`[AIService] IPC Resolved Request: ${id}`)
          return
        }
        // ... (rest of the code)
        if (type === IPC_AI.CLUSTER_FACES) {
          return await this.clusterFaces()
        }
        if (type === IPC_AI.GET_FACE_GROUPS) {
          return await this.getFaceGroups()
        }
        if (type === IPC_AI.GET_PHOTOS_BY_FACE) {
          return await this.getPhotosByFace(payload.faceId || payload.groupId)
        }

        // B. 主动请求 (Worker -> Main)
        // 目前只有 PING, ERROR
        if (type === AiActionTypes.PING) {
          // 回复 PONG
          this.windowManager.send({
            id,
            type: AiActionTypes.RESULT,
            target: source,
            source: AiTargets.MAIN,
            payload: 'PONG',
            isResponse: true
          })
        } else if (type === AiActionTypes.ERROR) {
          logger.error('[AIService] Worker Error:', payload)
        }
        return
      }

      // 2. 发给 Renderer
      if (target === AiTargets.RENDERER) {
        this._broadcastToRenderer(AI_IPC_CHANNEL, envelope)
        return
      }

      // 3. 发给 Worker
      if (target === AiTargets.WORKER) {
        this.windowManager.send(envelope)
      }
    })
  }
}
