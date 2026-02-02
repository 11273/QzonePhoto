import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import logger from '@main/core/logger'
import { AI_IPC_CHANNEL, AiTargets } from '@shared/ai-ipc-channels'

/** 熔断策略配置 */
const CRASH_CONFIG = {
  threshold: 3,
  resetMs: 60000
}

/** 默认超时配置 (ms) */
const TIMEOUT = {
  init: 60000
}

/**
 * AI Worker 窗口管理器
 * 负责隐形渲染进程的生命周期维护、崩溃恢复与通信代理
 */
export class WorkerWindowManager {
  constructor(serviceContext) {
    /** @type {BrowserWindow | null} 隐形渲染进程实例 */
    this.window = null
    /** @type {number} 崩溃计数 */
    this.retryCount = 0
    /** @type {number} 上次崩溃时间 */
    this.lastCrashTime = 0
    /** @type {Map<string, {resolve: Function, reject: Function, timer: number}>} 请求回调映射 */
    this.pendingRequests = new Map()

    // 注入 Service 上下文用于回调 (如 onCrash)
    this.service = serviceContext
  }

  /**
   * 确保隐形窗口存在
   */
  async ensureWindow() {
    if (this.window && !this.window.isDestroyed()) return

    if (this.window) {
      try {
        this.window.destroy()
      } catch {
        // Ignore
      }
      this.window = null
    }

    const url =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? `${process.env['ELECTRON_RENDERER_URL']}/ai.html`
        : `file://${join(__dirname, '../renderer/ai.html')}`

    // 修正: 构建后的 __dirname 通常指向 out/main
    // 所以应该使用 ../preload/ai.js
    const preloadPath = join(__dirname, '../preload/ai.js')

    this.window = new BrowserWindow({
      show: false,
      title: 'QzonePhoto AI Worker',
      webPreferences: {
        offscreen: false,
        backgroundThrottling: false,
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        preload: preloadPath,
        webSecurity: false
      }
    })

    if (is.dev) {
      this.window.webContents.openDevTools()
    }

    this._setupListeners()
    await this.window.webContents.loadURL(url)
  }

  _setupListeners() {
    if (!this.window) return

    // 监听加载完成
    this.window.webContents.on('did-finish-load', () => {
      logger.info('[WorkerManager] Worker 窗口加载/刷新完成')
      // 通知 Service 窗口已就绪/刷新
      if (this.service && this.service.onWorkerReady) {
        this.service.onWorkerReady()
      }
    })

    // 监控崩溃
    this.window.webContents.on('crashed', () => this.handleCrash())
    this.window.webContents.on('render-process-gone', (_, details) => {
      logger.error(`[WorkerManager] 渲染进程丢失: ${details.reason}`)
      this.handleCrash()
    })

    this.window.on('closed', () => {
      this.window = null
    })
  }

  /**
   * 销毁窗口
   */
  destroy() {
    if (this.window) {
      try {
        this.window.destroy()
      } catch {
        /* ignore */
      }
      this.window = null
    }
  }

  /**
   * 崩溃处理与熔断
   */
  handleCrash() {
    const now = Date.now()
    this.retryCount = now - this.lastCrashTime < CRASH_CONFIG.resetMs ? this.retryCount + 1 : 1
    this.lastCrashTime = now

    logger.warn(`[WorkerManager] 进程崩溃! 重试: ${this.retryCount}`)

    if (this.retryCount > CRASH_CONFIG.threshold) {
      logger.error('[WorkerManager] 触发熔断')
      if (this.service && this.service.onFatalError) {
        this.service.onFatalError('引擎连续崩溃，请手动重启')
      }
    } else {
      if (this.service && this.service.onWorkerRestarting) {
        this.service.onWorkerRestarting()
      }
      setTimeout(() => this.service.initWorker(), 1000)
    }
  }

  /**
   * 发送 RPC 请求给 Worker
   * @param {string} type 动作类型
   * @param {any} [payload={}] 载荷
   * @param {number} [timeout] 超时时间
   * @returns {Promise<any>}
   */
  async invoke(type, payload = {}, timeout = TIMEOUT.init) {
    if (!this.window || this.window.isDestroyed()) {
      throw new Error('Worker window not ready')
    }

    const id = Math.random().toString(36).substring(7)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Worker Timeout: ${type}`))
        }
      }, timeout)

      this.pendingRequests.set(id, { resolve, reject, timer })
      this.window.webContents.send(AI_IPC_CHANNEL, {
        id,
        type,
        target: AiTargets.WORKER,
        source: AiTargets.MAIN,
        payload
      })
    })
  }

  /**
   * 发送无需响应的消息
   */
  send(envelope) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(AI_IPC_CHANNEL, envelope)
    }
  }

  /**
   * 处理响应回调
   */
  resolveRequest(id, error, payload) {
    if (this.pendingRequests.has(id)) {
      const { resolve, reject, timer } = this.pendingRequests.get(id)
      clearTimeout(timer)
      this.pendingRequests.delete(id)
      error ? reject(new Error(error)) : resolve(payload)
      return true
    }
    return false
  }

  get isReady() {
    return this.window && !this.window.isDestroyed() && !this.window.webContents.isLoading()
  }

  resetRetryCount() {
    this.retryCount = 0
  }
}
