import { app, protocol } from 'electron'

// 注册特权协议 (必须在 app.ready 之前)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'qzone-local',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])
import { ApplicationBootstrapper } from '@main/app-bootstrapper'
import { optimizer, electronApp, platform, is } from '@electron-toolkit/utils'
import logger from '@main/core/logger'
import { APP_ID } from '@shared/const'
import { registerAiModelsProtocol } from '@main/protocols/ai-models'
import { registerLocalResourceProtocol } from '@main/protocols/local-resource'

/* --------------------------------------------------
 * 环境配置
 * -------------------------------------------------- */

// 仅在开发环境禁用安全警告
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = is.dev

// 启用 WebGPU 支持
app.commandLine.appendSwitch('enable-unsafe-webgpu')
app.commandLine.appendSwitch('enable-features', 'WebGPU')

/* --------------------------------------------------
 * 状态管理
 * -------------------------------------------------- */

/** @type {boolean} 标记应用是否正在执行退出流程 */
let isQuitting = false

/** @type {NodeJS.Timeout | null} 退出清理超时定时器 */
let cleanupTimeout = null

/** @type {ApplicationBootstrapper} 应用启动引导程序实例 */
const bootstrapper = new ApplicationBootstrapper()

/* --------------------------------------------------
 * 生命周期事件
 * -------------------------------------------------- */

// 准备就绪流程
app.whenReady().then(async () => {
  try {
    // 从配置文件读取应用标识符，与 electron-builder.yml 中的 appId 保持一致
    const bundleId = APP_ID
    electronApp.setAppUserModelId(bundleId)
    logger.info(`[应用] 设置应用标识符: ${bundleId}`)

    // 开发环境功能: 快捷键优化
    if (is.dev) {
      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })
    }

    // 注册 AI 模型协议处理器 (解决 transformers.js 加载限制)
    registerAiModelsProtocol()
    // 注册本地资源协议 (解决图片展示限制)
    registerLocalResourceProtocol()

    // 启动应用主体业务
    // AI 子系统初始化由 AIService.init() 统一管理，包括：
    // - 数据库初始化
    // - 模型完整性检查
    // - 根据模型状态决定是否启动 Worker 和静默扫描
    await bootstrapper.bootstrap()
  } catch (error) {
    logger.error('应用初始化失败:', error)
    app.exit(1)
  }
})

// 所有窗口关闭事件
app.on('window-all-closed', async () => {
  // 避免重复处理
  if (isQuitting) return

  // 在 macOS 上，应用通常保持活跃状态，直到用户明确退出 (Cmd+Q)
  if (!platform.isMacOS) {
    isQuitting = true
    try {
      await bootstrapper.shutdown()
    } finally {
      app.quit()
    }
  }
})

// macOS 激活事件处理 (点击 Dock 图标)
app.on('activate', async () => {
  try {
    const { BrowserWindow } = require('electron')
    const visibleWindows = BrowserWindow.getAllWindows().filter((win) => win.isVisible())

    // 如果没有可见窗口，则重新启动应用逻辑 (通常会创建主窗口)
    if (visibleWindows.length === 0) {
      await bootstrapper.bootstrap()
    }
  } catch (error) {
    logger.error('重新激活应用失败:', error)
  }
})

// 应用退出前的清理工作
app.on('before-quit', async (event) => {
  // 避免重复处理
  if (isQuitting) return

  // 开发环境下允许快速退出（热更新需要）
  if (is.dev) {
    logger.info('[应用] 开发环境退出，跳过清理流程')
    isQuitting = true
    return
  }

  // 生产环境执行完整清理流程
  event.preventDefault()
  isQuitting = true

  try {
    logger.info('[应用] 开始退出清理...')

    // 设置超时保护（5秒），防止清理逻辑卡死导致无法退出
    cleanupTimeout = setTimeout(() => {
      logger.warn('[应用] 清理超时，强制退出')
      app.exit(0)
    }, 5000)

    await bootstrapper.shutdown()
    logger.info('[应用] 清理完成')
  } catch (error) {
    logger.error('[应用] 清理失败:', error)
  } finally {
    // 清除超时定时器
    if (cleanupTimeout) {
      clearTimeout(cleanupTimeout)
      cleanupTimeout = null
    }
    app.exit(0)
  }
})

// 最后的退出保障
app.on('will-quit', () => {
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout)
    cleanupTimeout = null
  }
})
