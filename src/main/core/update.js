import { autoUpdater, CancellationToken } from 'electron-updater'
import { EventEmitter } from 'events'
import { IPC_UPDATE } from '@shared/ipc-channels'
import logger from '@main/core/logger'
import { app } from 'electron'
import path from 'path'
import fs from 'fs-extra'

export class AutoUpdateManager extends EventEmitter {
  constructor() {
    super()

    // 配置
    this.config = {
      autoDownload: false,
      allowPreRelease: false,
      allowDowngrade: false,
      github: {
        owner: '11273',
        repo: 'QzonePhoto'
      }
    }

    // 状态
    this.state = {
      downloadProgress: null,
      currentWindow: null,
      lastUpdateInfo: null,
      isInitialized: false,
      isDownloading: false,
      isCheckingForUpdate: false,
      downloadCancellationToken: null
    }

    // 性能优化
    this.performance = {
      lastProgressTime: 0,
      progressThrottle: 100
    }

    // 架构信息
    this.architecture = this.detectArchitecture()
  }

  /**
   * 检测系统架构信息
   */
  detectArchitecture() {
    const arch = process.arch
    const platform = process.platform

    // 标准化架构映射
    const archMap = {
      x64: 'x64',
      x86_64: 'x64',
      amd64: 'x64',
      ia32: 'x86',
      x86: 'x86',
      arm64: 'arm64',
      aarch64: 'arm64',
      arm: 'armv7l',
      armv7l: 'armv7l'
    }

    const normalizedArch = archMap[arch] || arch

    return {
      arch: normalizedArch,
      platform,
      identifier: `${platform}-${normalizedArch}`,
      raw: {
        arch: process.arch,
        platform: process.platform,
        version: process.versions
      }
    }
  }

  /**
   * 初始化自动更新
   */
  async initialize() {
    if (this.state.isInitialized) {
      logger.warn('[更新] AutoUpdateManager 已经初始化')
      return
    }

    try {
      // 配置更新源
      this.configureUpdater()

      // 绑定事件
      this.bindEvents()

      // 设置缓存目录
      await this.setupCacheDirectory()

      this.state.isInitialized = true
      logger.info('[更新] AutoUpdateManager 初始化成功', {
        architecture: this.architecture,
        version: app.getVersion()
      })
    } catch (error) {
      logger.error('[更新] 初始化失败:', error)
      throw new Error(`更新服务初始化失败: ${error.message}`)
    }
  }

  /**
   * 配置更新器
   */
  configureUpdater() {
    // 基础配置
    autoUpdater.autoDownload = this.config.autoDownload
    autoUpdater.allowPrerelease = this.config.allowPreRelease
    autoUpdater.allowDowngrade = this.config.allowDowngrade
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = logger

    // 设置更新源
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: this.config.github.owner,
      repo: this.config.github.repo,
      private: false,
      releaseType: this.config.allowPreRelease ? 'prerelease' : 'release'
    })

    // 强制关闭差异下载
    autoUpdater.disableDifferentialDownload = true

    // 开发环境配置
    autoUpdater.forceDevUpdateConfig = false

    // 自定义请求头，包含架构信息
    autoUpdater.requestHeaders = {
      'User-Agent': `${app.getName()}/${app.getVersion()} (${this.architecture.identifier})`
    }
  }

  /**
   * 设置缓存目录
   */
  async setupCacheDirectory() {
    const cacheDir = path.join(app.getPath('userData'), 'updater-cache')
    await fs.ensureDir(cacheDir)

    // 清理旧的缓存文件
    const files = await fs.readdir(cacheDir)
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const file of files) {
      const filePath = path.join(cacheDir, file)
      const stats = await fs.stat(filePath)
      if (stats.mtime.getTime() < oneWeekAgo) {
        await fs.remove(filePath)
      }
    }
  }

  /**
   * 绑定事件监听
   */
  bindEvents() {
    // 清除所有旧的监听器
    autoUpdater.removeAllListeners()

    // 检查更新中
    autoUpdater.on('checking-for-update', () => {
      logger.info('[更新] 正在检查更新...')
      this.state.isCheckingForUpdate = true
      this.sendToRenderer(IPC_UPDATE.CHECKING)
    })

    // 发现更新
    autoUpdater.on('update-available', (info) => {
      logger.info('[更新] 发现新版本:', info.version)
      this.state.isCheckingForUpdate = false

      // 验证架构兼容性
      const compatibleAsset = this.findCompatibleAsset(info)
      if (!compatibleAsset) {
        logger.warn('[更新] 未找到兼容的更新包')
        this.sendToRenderer(IPC_UPDATE.NOT_AVAILABLE, {
          ...this.formatUpdateInfo(info),
          incompatible: true,
          reason: 'architecture_mismatch'
        })
        return
      }

      // 设置正确的下载URL
      if (compatibleAsset.url) {
        info.files = [
          {
            url: compatibleAsset.url,
            size: compatibleAsset.size,
            sha512: compatibleAsset.sha512
          }
        ]
      }

      this.state.lastUpdateInfo = this.formatUpdateInfo(info)
      this.sendToRenderer(IPC_UPDATE.AVAILABLE, this.state.lastUpdateInfo)
    })

    // 没有更新
    autoUpdater.on('update-not-available', (info) => {
      logger.info('[更新] 当前已是最新版本')
      this.state.isCheckingForUpdate = false
      this.sendToRenderer(IPC_UPDATE.NOT_AVAILABLE, this.formatUpdateInfo(info))
    })

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      this.handleDownloadProgress(progress)
    })

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      logger.info('[更新] 更新下载完成')
      this.state.isDownloading = false
      this.state.downloadProgress = null
      this.sendToRenderer(IPC_UPDATE.DOWNLOADED, this.formatUpdateInfo(info))
    })

    // 错误处理
    autoUpdater.on('error', (error) => {
      this.handleError(error)
    })

    // 差异下载开始
    autoUpdater.on('differential-download-started', () => {
      logger.info('[更新] 开始差异下载')
    })

    // 差异下载失败，回退到完整下载
    autoUpdater.on('differential-download-failed', () => {
      logger.warn('[更新] 差异下载失败，切换到完整下载')
    })
  }

  /**
   * 查找兼容的更新资源
   */
  findCompatibleAsset(updateInfo) {
    if (!updateInfo?.files?.length) {
      return null
    }

    const { platform, arch } = this.architecture

    // 定义文件名匹配规则
    const matchers = {
      win32: {
        x64: [/x64|win64/i, /\.exe$/i],
        x86: [/x86|ia32|win32/i, /\.exe$/i, (name) => !name.includes('x64')],
        arm64: [/arm64/i, /\.exe$/i]
      },
      darwin: {
        x64: [/x64|intel/i, /\.dmg$|\.zip$/i],
        arm64: [/arm64|apple.?silicon|m1/i, /\.dmg$|\.zip$/i],
        universal: [/universal/i, /\.dmg$|\.zip$/i]
      },
      linux: {
        x64: [/x86_64|amd64|x64/i, /\.AppImage$|\.deb$|\.rpm$/i],
        x86: [/i386|i686|x86/i, /\.AppImage$|\.deb$|\.rpm$/i],
        arm64: [/aarch64|arm64/i, /\.AppImage$|\.deb$|\.rpm$/i],
        armv7l: [/armv7|armhf/i, /\.AppImage$|\.deb$|\.rpm$/i]
      }
    }

    // 获取当前平台的匹配规则
    const platformMatchers = matchers[platform]
    if (!platformMatchers) {
      logger.warn(`[更新] 不支持的平台: ${platform}`)
      return null
    }

    // 优先级排序：精确架构 > universal > 默认
    const priorityOrder = [arch]
    if (platform === 'darwin') {
      priorityOrder.push('universal')
    }

    // 查找最佳匹配
    for (const targetArch of priorityOrder) {
      const archMatchers = platformMatchers[targetArch]
      if (!archMatchers) continue

      const matchedFile = updateInfo.files.find((file) => {
        const fileName = file.url.toLowerCase()
        return archMatchers.every((matcher) => {
          if (typeof matcher === 'function') {
            return matcher(fileName)
          }
          return matcher.test(fileName)
        })
      })

      if (matchedFile) {
        logger.info(`[更新] 找到兼容的更新包: ${matchedFile.url}`)
        return matchedFile
      }
    }

    // 如果没有找到精确匹配，尝试通用匹配
    const fallbackFile = updateInfo.files.find((file) => {
      const fileName = file.url.toLowerCase()
      const ext = path.extname(fileName)

      // 基于扩展名的平台匹配
      const platformExtensions = {
        win32: ['.exe'],
        darwin: ['.dmg', '.zip'],
        linux: ['.AppImage', '.deb', '.rpm', '.tar.gz']
      }

      return platformExtensions[platform]?.includes(ext)
    })

    if (fallbackFile) {
      logger.warn(`[更新] 使用通用更新包: ${fallbackFile.url}`)
    }

    return fallbackFile
  }

  /**
   * 处理下载进度
   */
  handleDownloadProgress(progress) {
    const now = Date.now()

    // 节流处理
    if (now - this.performance.lastProgressTime < this.performance.progressThrottle) {
      return
    }

    this.performance.lastProgressTime = now
    this.state.downloadProgress = progress

    const formattedProgress = this.formatProgress(progress)

    // 只有在有效进度时才发送
    if (formattedProgress.total > 0 && formattedProgress.percent >= 0) {
      this.sendToRenderer(IPC_UPDATE.DOWNLOAD_PROGRESS, formattedProgress)

      // 每10%记录一次日志
      const percentInt = Math.floor(formattedProgress.percent)
      if (percentInt % 10 === 0 && percentInt !== this._lastLoggedPercent) {
        this._lastLoggedPercent = percentInt
        logger.info(`[更新] 下载进度: ${percentInt}% (${formattedProgress.speedFormatted})`)
      }
    }
  }

  /**
   * 处理错误
   */
  handleError(error) {
    logger.error('[更新] 错误详情:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    })

    this.state.isDownloading = false
    this.state.isCheckingForUpdate = false
    this.state.downloadProgress = null

    const errorInfo = this.parseError(error)
    this.sendToRenderer(IPC_UPDATE.ERROR, errorInfo)
  }

  /**
   * 解析错误信息
   */
  parseError(error) {
    const errorMessage = error?.message || ''
    const errorCode = error?.code || ''

    // 错误类型映射
    const errorPatterns = [
      // Release 相关
      {
        pattern: /Unable to find latest version|No release found/i,
        info: {
          message: '暂无可用更新',
          detail: '当前已是最新版本',
          canRetry: false,
          errorType: 'NO_RELEASE'
        }
      },
      // HTTP 错误
      {
        pattern: /HttpError:\s*4\d{2}/i,
        info: {
          message: '更新服务访问失败',
          detail: '请检查网络连接或稍后再试',
          canRetry: true,
          errorType: 'HTTP_ERROR'
        }
      },
      // 网络错误
      {
        pattern: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENETUNREACH/i,
        info: {
          message: '网络连接失败',
          detail: '请检查网络连接后重试',
          canRetry: true,
          errorType: 'NETWORK_ERROR'
        }
      },
      // 权限错误
      {
        pattern: /EACCES|EPERM|Permission denied/i,
        info: {
          message: '权限不足',
          detail: '请以管理员身份运行程序',
          canRetry: false,
          errorType: 'PERMISSION_ERROR'
        }
      },
      // 空间不足
      {
        pattern: /ENOSPC|No space/i,
        info: {
          message: '磁盘空间不足',
          detail: '请清理磁盘空间后重试',
          canRetry: true,
          errorType: 'DISK_FULL'
        }
      },
      // 签名验证
      {
        pattern: /signature|verification|checksum/i,
        info: {
          message: '更新包验证失败',
          detail: '更新包可能已损坏，请重试',
          canRetry: true,
          errorType: 'VERIFICATION_ERROR'
        }
      },
      // 取消操作
      {
        pattern: /cancelled|aborted|CancellationError/i,
        info: {
          message: '下载已取消',
          detail: '',
          canRetry: true,
          errorType: 'CANCELLED'
        }
      }
    ]

    // 匹配错误类型
    for (const { pattern, info } of errorPatterns) {
      if (pattern.test(errorMessage) || pattern.test(errorCode)) {
        return {
          ...info,
          timestamp: new Date().toISOString(),
          originalError: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }
      }
    }

    // 默认错误
    return {
      message: '更新失败',
      detail: '请稍后再试或访问官网下载',
      canRetry: true,
      errorType: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 检查更新
   */
  async checkForUpdates() {
    if (!this.state.isInitialized) {
      await this.initialize()
    }

    if (this.state.isCheckingForUpdate) {
      logger.warn('[更新] 正在检查更新中，忽略重复请求')
      return null
    }

    try {
      logger.info('[更新] 开始检查更新', {
        currentVersion: app.getVersion(),
        architecture: this.architecture.identifier
      })

      const result = await autoUpdater.checkForUpdates()

      if (result?.updateInfo) {
        return this.formatUpdateInfo(result.updateInfo)
      }

      return null
    } catch (error) {
      this.state.isCheckingForUpdate = false
      const errorInfo = this.parseError(error)
      throw new Error(errorInfo.message)
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate() {
    if (!this.state.isInitialized) {
      await this.initialize()
    }

    if (this.state.isDownloading) {
      logger.warn('[更新] 正在下载中，忽略重复请求')
      return {
        success: false,
        message: '正在下载中，请勿重复操作',
        isDownloading: true
      }
    }

    try {
      this.state.isDownloading = true
      this.state.downloadProgress = null
      this.state.downloadCancellationToken = new CancellationToken()

      logger.info('[更新] 开始下载更新...')

      // 启用差异下载
      autoUpdater.disableDifferentialDownload = false

      await autoUpdater.downloadUpdate(this.state.downloadCancellationToken)

      logger.info('[更新] 下载完成')
      return { success: true }
    } catch (error) {
      this.state.isDownloading = false
      this.state.downloadProgress = null

      const errorInfo = this.parseError(error)

      if (errorInfo.errorType === 'CANCELLED') {
        return {
          success: false,
          cancelled: true,
          message: '下载已取消'
        }
      }

      throw new Error(errorInfo.message)
    } finally {
      this.state.downloadCancellationToken = null
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload() {
    try {
      if (!this.state.isDownloading) {
        return {
          success: false,
          message: '没有正在进行的下载任务'
        }
      }

      if (this.state.downloadCancellationToken) {
        this.state.downloadCancellationToken.cancel()
      }

      this.state.isDownloading = false
      this.state.downloadProgress = null

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
    if (!this.state.isInitialized) {
      await this.initialize()
    }

    logger.info('[更新] 准备安装更新...')

    try {
      // 延迟执行，确保渲染进程有时间保存数据
      setTimeout(() => {
        if (process.platform === 'win32') {
          // Windows 需要特殊处理
          autoUpdater.quitAndInstall(false, true)
        } else {
          autoUpdater.quitAndInstall()
        }
      }, 100)

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
        architecture: this.architecture,
        currentVersion: app.getVersion(),
        updateSize: 0
      }
    }

    // 计算更新包大小
    const updateSize = info.files?.reduce((total, file) => total + (file.size || 0), 0) || 0

    return {
      version: info.version || '',
      releaseDate: info.releaseDate || null,
      releaseNotes: this.parseReleaseNotes(info.releaseNotes),
      files: (info.files || []).map((f) => ({
        url: f.url || '',
        size: f.size || 0,
        sha512: f.sha512 || ''
      })),
      architecture: this.architecture,
      currentVersion: app.getVersion(),
      updateSize,
      updateSizeFormatted: this.formatFileSize(updateSize)
    }
  }

  /**
   * 解析发布说明
   */
  parseReleaseNotes(notes) {
    if (!notes) return ''

    // 如果是数组，合并为字符串
    if (Array.isArray(notes)) {
      return notes.map((note) => note.note || note).join('\n')
    }

    // 如果是对象，提取内容
    if (typeof notes === 'object') {
      return notes.note || notes.notes || ''
    }

    return String(notes)
  }

  /**
   * 格式化下载进度
   */
  formatProgress(progress) {
    const transferred = Math.max(0, progress.transferred || 0)
    const total = Math.max(0, progress.total || 0)
    const bytesPerSecond = Math.max(0, progress.bytesPerSecond || 0)
    const percent = total > 0 ? (transferred / total) * 100 : 0

    // 计算剩余时间
    const remainingBytes = total - transferred
    const remainingSeconds = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0
    const remainingTime = this.formatTime(remainingSeconds)

    return {
      percent: Math.round(percent * 100) / 100,
      transferred,
      total,
      bytesPerSecond,
      downloaded: Math.round((transferred / 1024 / 1024) * 100) / 100,
      speed: Math.round(bytesPerSecond / 1024),
      transferredFormatted: this.formatFileSize(transferred),
      totalFormatted: this.formatFileSize(total),
      speedFormatted: this.formatFileSize(bytesPerSecond) + '/s',
      remainingTime
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
   * 格式化时间
   */
  formatTime(seconds) {
    if (seconds <= 0 || !isFinite(seconds)) return '计算中...'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`
    } else {
      return `${secs}秒`
    }
  }

  /**
   * 获取下载状态
   */
  getDownloadStatus() {
    return {
      isDownloading: this.state.isDownloading,
      isCheckingForUpdate: this.state.isCheckingForUpdate,
      progress: this.getDownloadProgress(),
      lastUpdateInfo: this.state.lastUpdateInfo
    }
  }

  /**
   * 获取下载进度
   */
  getDownloadProgress() {
    if (!this.state.downloadProgress) {
      return null
    }
    return this.formatProgress(this.state.downloadProgress)
  }

  /**
   * 设置关联窗口
   */
  setAssociatedWindow(window) {
    this.state.currentWindow = window
    if (!this.state.isInitialized) {
      this.initialize()
    }
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel, data) {
    if (this.state.currentWindow && !this.state.currentWindow.isDestroyed()) {
      this.state.currentWindow.webContents.send(channel, data)
    }
    this.emit(channel, data)
  }

  /**
   * 销毁更新管理器
   */
  destroy() {
    if (this.state.isInitialized) {
      // 取消正在进行的下载
      if (this.state.isDownloading && this.state.downloadCancellationToken) {
        this.state.downloadCancellationToken.cancel()
      }

      // 清理事件监听
      autoUpdater.removeAllListeners()
      this.removeAllListeners()

      // 重置状态
      this.state = {
        downloadProgress: null,
        currentWindow: null,
        lastUpdateInfo: null,
        isInitialized: false,
        isDownloading: false,
        isCheckingForUpdate: false,
        downloadCancellationToken: null
      }

      logger.info('[更新] AutoUpdateManager 已销毁')
    }
  }
}

// 导出单例
export default new AutoUpdateManager()
