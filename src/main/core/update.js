import { autoUpdater, CancellationToken } from 'electron-updater'
import { EventEmitter } from 'events'
import { IPC_UPDATE } from '@shared/ipc-channels'
import logger from '@main/core/logger'
import { app } from 'electron'

export class AutoUpdateManager extends EventEmitter {
  constructor() {
    super()

    // 配置
    this.config = {
      autoDownload: false,
      allowPreRelease: false,
      github: {
        owner: '11273',
        repo: 'QzonePhoto'
      }
    }

    // 状态
    this.downloadProgress = null
    this.currentWindow = null
    this.lastUpdateInfo = null
    this.isInitialized = false
    this.isDownloading = false
    this.isCheckingForUpdate = false
    this.lastProgressTime = 0
    this.progressThrottle = 100
    this.downloadCancellationToken = null
  }

  /**
   * 获取系统架构信息
   */
  getSystemArchitecture() {
    const arch = process.arch
    const platform = process.platform

    // 转换为更新服务器识别的格式
    const archMap = {
      x64: 'x64',
      ia32: 'x86',
      arm64: 'arm64',
      arm: 'armv7l'
    }

    return {
      arch: archMap[arch] || arch,
      platform,
      // 生成架构标识符，用于匹配更新文件
      identifier: `${platform}-${archMap[arch] || arch}`
    }
  }

  /**
   * 初始化自动更新
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('AutoUpdateManager 已经初始化')
      return
    }

    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        private: false
      })

      // 配置更新器
      autoUpdater.autoDownload = this.config.autoDownload
      autoUpdater.allowPrerelease = this.config.allowPreRelease
      autoUpdater.autoInstallOnAppQuit = false
      autoUpdater.logger = logger
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.disableDifferentialDownload = true

      // 设置架构相关的更新通道
      const sysArch = this.getSystemArchitecture()
      logger.info(`[更新] 系统架构: ${sysArch.identifier}`)

      // 绑定事件
      this.bindEvents()

      this.isInitialized = true
      logger.info('AutoUpdateManager 初始化成功')
    } catch (error) {
      logger.error('[更新] 初始化失败:', error)
      throw new Error('更新服务初始化失败')
    }
  }

  /**
   * 绑定事件监听
   */
  bindEvents() {
    autoUpdater.removeAllListeners()

    // 检查更新中
    autoUpdater.on('checking-for-update', () => {
      logger.info('[更新] 正在检查更新...')
      this.isCheckingForUpdate = true
      this.sendToRenderer(IPC_UPDATE.CHECKING)
    })

    // 发现更新 - 添加架构验证
    autoUpdater.on('update-available', (info) => {
      logger.info(`[更新] 发现新版本: ${info.version}`)
      this.isCheckingForUpdate = false

      // 验证更新文件是否匹配当前架构
      if (!this.isUpdateCompatible(info)) {
        logger.warn('[更新] 更新版本架构不兼容，忽略此更新')
        this.sendToRenderer(IPC_UPDATE.NOT_AVAILABLE, {
          ...this.formatUpdateInfo(info),
          incompatible: true,
          reason: '架构不兼容'
        })
        return
      }

      this.lastUpdateInfo = this.formatUpdateInfo(info)
      this.sendToRenderer(IPC_UPDATE.AVAILABLE, this.lastUpdateInfo)
    })

    // 没有更新
    autoUpdater.on('update-not-available', (info) => {
      logger.info(`[更新] 当前已是最新版本: ${info.version}`)
      this.isCheckingForUpdate = false
      this.sendToRenderer(IPC_UPDATE.NOT_AVAILABLE, this.formatUpdateInfo(info))
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      const now = Date.now()
      if (now - this.lastProgressTime < this.progressThrottle) {
        return
      }

      this.lastProgressTime = now
      this.downloadProgress = progress

      const formattedProgress = this.formatProgress(progress)
      if (formattedProgress.total > 0) {
        this.sendToRenderer(IPC_UPDATE.DOWNLOAD_PROGRESS, formattedProgress)
      }
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('[更新] 更新下载完成，等待用户确认安装')
      this.isDownloading = false
      this.downloadProgress = null
      this.sendToRenderer(IPC_UPDATE.DOWNLOADED, this.formatUpdateInfo(info))
    })

    // 错误处理
    autoUpdater.on('error', (error) => {
      // 详细错误信息只记录到日志
      logger.error('[更新] 错误详情:', error)

      this.isDownloading = false
      this.isCheckingForUpdate = false
      this.downloadProgress = null

      // 发送给用户的错误信息
      const errorInfo = this.parseError(error)
      this.sendToRenderer(IPC_UPDATE.ERROR, errorInfo)
    })
  }

  /**
   * 检查更新是否与当前系统架构兼容
   */
  isUpdateCompatible(updateInfo) {
    if (!updateInfo || !updateInfo.files || updateInfo.files.length === 0) {
      return false
    }

    const sysArch = this.getSystemArchitecture()
    const platform = process.platform

    // 查找匹配当前架构的更新文件
    const compatibleFile = updateInfo.files.find((file) => {
      const fileName = file.url.toLowerCase()

      // Windows 架构匹配规则
      if (platform === 'win32') {
        if (sysArch.arch === 'x64' && fileName.includes('x64')) return true
        if (sysArch.arch === 'x86' && !fileName.includes('x64') && !fileName.includes('arm'))
          return true
        if (sysArch.arch === 'arm64' && fileName.includes('arm64')) return true
      }

      // macOS 架构匹配规则
      if (platform === 'darwin') {
        if (sysArch.arch === 'x64' && fileName.includes('x64')) return true
        if (sysArch.arch === 'arm64' && fileName.includes('arm64')) return true
        // Universal 包支持所有架构
        if (fileName.includes('universal')) return true
      }

      // Linux 架构匹配规则
      if (platform === 'linux') {
        if (sysArch.arch === 'x64' && fileName.includes('x86_64')) return true
        if (sysArch.arch === 'arm64' && fileName.includes('arm64')) return true
        if (sysArch.arch === 'armv7l' && fileName.includes('armv7l')) return true
      }

      return false
    })

    if (!compatibleFile) {
      logger.warn(`[更新] 未找到适合 ${sysArch.identifier} 架构的更新文件`)
    }

    return !!compatibleFile
  }

  /**
   * 解析错误信息 - 优化版本
   */
  parseError(error) {
    const errorMessage = error?.message || ''
    const errorCode = error?.code || ''

    // 记录原始错误到日志
    logger.error('[更新] 原始错误信息:', {
      message: errorMessage,
      code: errorCode,
      stack: error?.stack
    })

    // 错误类型映射
    const errorMap = {
      // GitHub Release 相关错误
      'Unable to find latest version': {
        message: '暂无可用更新',
        detail: '请稍后再试或访问官网下载最新版本',
        canRetry: true,
        errorType: 'NO_RELEASE'
      },
      'HttpError: 406': {
        message: '更新服务暂时不可用',
        detail: '请稍后再试',
        canRetry: true,
        errorType: 'SERVICE_ERROR'
      },
      'HttpError: 404': {
        message: '更新资源未找到',
        detail: '请访问官网下载最新版本',
        canRetry: false,
        errorType: 'NOT_FOUND'
      },
      'HttpError: 403': {
        message: '更新服务访问受限',
        detail: '请检查网络设置或稍后再试',
        canRetry: true,
        errorType: 'ACCESS_DENIED'
      },

      // 网络错误
      'ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENETUNREACH': {
        message: '网络连接失败',
        detail: '请检查网络连接后重试',
        canRetry: true,
        errorType: 'NETWORK_ERROR'
      },
      'timeout|Timeout': {
        message: '连接超时',
        detail: '请检查网络连接或稍后再试',
        canRetry: true,
        errorType: 'TIMEOUT'
      },

      // 文件系统错误
      'EACCES|EPERM': {
        message: '权限不足',
        detail: '请以管理员身份运行程序',
        canRetry: false,
        errorType: 'PERMISSION_ERROR'
      },
      ENOSPC: {
        message: '磁盘空间不足',
        detail: '请清理磁盘空间后重试',
        canRetry: true,
        errorType: 'DISK_FULL'
      },

      // 更新包错误
      'Could not locate update bundle': {
        message: '更新包损坏',
        detail: '请访问官网下载最新版本',
        canRetry: false,
        errorType: 'CORRUPTED_UPDATE'
      },
      'signature|verification': {
        message: '更新包验证失败',
        detail: '请访问官网下载最新版本',
        canRetry: false,
        errorType: 'VERIFICATION_ERROR'
      },

      // 取消操作
      'cancelled|aborted': {
        message: '操作已取消',
        detail: '',
        canRetry: true,
        errorType: 'CANCELLED'
      }
    }

    // 匹配错误类型
    for (const [pattern, errorInfo] of Object.entries(errorMap)) {
      if (new RegExp(pattern, 'i').test(errorMessage) || new RegExp(pattern, 'i').test(errorCode)) {
        return {
          ...errorInfo,
          timestamp: new Date().toISOString()
        }
      }
    }

    // 默认错误信息
    return {
      message: '更新失败',
      detail: '请稍后再试或访问官网下载最新版本',
      canRetry: true,
      errorType: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 检查更新 - 优化错误处理
   */
  async checkForUpdates() {
    if (!this.isInitialized) {
      this.initialize()
    }

    if (this.isCheckingForUpdate) {
      logger.warn('[更新] 正在检查更新中，忽略重复请求')
      return null
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo) {
        return this.formatUpdateInfo(result.updateInfo)
      }
      return null
    } catch (error) {
      this.isCheckingForUpdate = false

      // 解析错误并返回友好信息
      const errorInfo = this.parseError(error)
      throw new Error(errorInfo.message)
    }
  }

  /**
   * 下载更新 - 优化错误处理
   */
  async downloadUpdate() {
    if (!this.isInitialized) {
      this.initialize()
    }

    if (this.isDownloading) {
      logger.warn('[更新] 正在下载中，忽略重复请求')
      return { success: false, message: '正在下载中，请勿重复操作' }
    }

    try {
      this.isDownloading = true
      this.downloadProgress = null
      this.downloadCancellationToken = new CancellationToken()

      logger.info('[更新] 开始下载更新...')
      await autoUpdater.downloadUpdate(this.downloadCancellationToken)

      logger.info('[更新] 下载更新完成')
      return { success: true }
    } catch (error) {
      this.isDownloading = false
      this.downloadProgress = null

      const errorInfo = this.parseError(error)

      if (errorInfo.errorType === 'CANCELLED') {
        logger.info('[更新] 下载已被用户取消')
        return { success: false, cancelled: true }
      }

      throw new Error(errorInfo.message)
    } finally {
      this.downloadCancellationToken = null
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload() {
    try {
      if (!this.isDownloading) {
        logger.warn('[更新] 没有正在进行的下载任务')
        return { success: false, message: '没有正在进行的下载任务' }
      }

      if (this.downloadCancellationToken) {
        this.downloadCancellationToken.cancel()
      }

      this.isDownloading = false
      this.downloadProgress = null

      logger.info('[更新] 下载已取消')
      return { success: true }
    } catch (error) {
      logger.error('[更新] 取消下载失败:', error)
      throw new Error('取消下载失败')
    }
  }

  /**
   * 退出并安装更新
   */
  async quitAndInstall() {
    if (!this.isInitialized) {
      this.initialize()
    }

    logger.info('[更新] 用户确认安装更新，准备退出并安装...')

    try {
      setImmediate(() => {
        if (process.platform === 'win32') {
          autoUpdater.quitAndInstall(false, true)
        } else {
          autoUpdater.quitAndInstall()
        }
      })

      return { success: true }
    } catch (error) {
      logger.error('[更新] 安装更新失败:', error)
      throw new Error('安装更新失败，请手动安装')
    }
  }

  /**
   * 格式化更新信息
   */
  formatUpdateInfo(info) {
    if (!info) {
      return {
        version: '',
        releaseDate: null,
        releaseNotes: '',
        files: [],
        architecture: this.getSystemArchitecture(),
        currentVersion: app.getVersion()
      }
    }

    return {
      version: info.version || '',
      releaseDate: info.releaseDate || null,
      releaseNotes: info.releaseNotes || '',
      files: (info.files || []).map((f) => ({
        url: f.url || '',
        size: f.size || 0
      })),
      architecture: this.getSystemArchitecture(),
      currentVersion: app.getVersion()
    }
  }

  /**
   * 格式化下载进度
   */
  formatProgress(progress) {
    const transferred = Math.max(0, progress.transferred || 0)
    const total = Math.max(0, progress.total || 0)
    const bytesPerSecond = Math.max(0, progress.bytesPerSecond || 0)
    const actualPercent = total > 0 ? (transferred / total) * 100 : 0

    return {
      percent: Math.round(actualPercent * 100) / 100,
      transferred: transferred,
      total: total,
      bytesPerSecond: bytesPerSecond,
      downloaded: Math.round((transferred / 1024 / 1024) * 100) / 100,
      speed: Math.round(bytesPerSecond / 1024),
      transferredFormatted: this.formatFileSize(transferred),
      totalFormatted: this.formatFileSize(total),
      speedFormatted: this.formatFileSize(bytesPerSecond) + '/s'
    }
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 其他方法保持不变...
   */
  getDownloadStatus() {
    return {
      isDownloading: this.isDownloading,
      isCheckingForUpdate: this.isCheckingForUpdate,
      progress: this.getDownloadProgress()
    }
  }

  getDownloadProgress() {
    if (!this.downloadProgress) {
      return null
    }
    return this.formatProgress(this.downloadProgress)
  }

  setAssociatedWindow(window) {
    this.currentWindow = window
    if (!this.isInitialized) {
      this.initialize()
    }
  }

  sendToRenderer(channel, data) {
    if (this.currentWindow && !this.currentWindow.isDestroyed()) {
      this.currentWindow.webContents.send(channel, data)
    }
    this.emit(channel, data)
  }

  destroy() {
    if (this.isInitialized) {
      autoUpdater.removeAllListeners()
      this.isInitialized = false
      this.isDownloading = false
      this.isCheckingForUpdate = false
      this.downloadProgress = null
      logger.info('AutoUpdateManager 已销毁')
    }
  }
}
