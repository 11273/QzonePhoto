import { app } from 'electron'
import { ApplicationBootstrapper } from '@main/app-bootstrapper'
import { optimizer, electronApp, platform, is } from '@electron-toolkit/utils'
import logger from '@main/core/logger'
import { APP_ID } from '@shared/const'

// 安全警告处理
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = is.dev

// 退出状态管理
let isQuitting = false
let cleanupTimeout = null

// 应用初始化
const bootstrapper = new ApplicationBootstrapper()

// 准备就绪流程
app.whenReady().then(async () => {
  try {
    // 从配置文件读取应用标识符，与 electron-builder.yml 中的 appId 保持一致
    const bundleId = APP_ID
    electronApp.setAppUserModelId(bundleId)
    logger.info(`[应用] 设置应用标识符: ${bundleId}`)

    // 开发环境功能
    if (is.dev) {
      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })
    }

    // 启动应用
    await bootstrapper.bootstrap()
  } catch (error) {
    logger.error('应用初始化失败:', error)
    app.exit(1)
  }
})

// 生命周期管理
app.on('window-all-closed', async () => {
  // 避免重复处理
  if (isQuitting) return

  // 在 macOS 上，应用会保持活跃状态，直到用户明确退出
  if (!platform.isMacOS) {
    isQuitting = true
    try {
      await bootstrapper.shutdown()
    } finally {
      app.quit()
    }
  }
})

// macOS 激活事件处理
app.on('activate', async () => {
  // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，重新创建窗口
  try {
    const { BrowserWindow } = require('electron')
    const visibleWindows = BrowserWindow.getAllWindows().filter((win) => win.isVisible())
    if (visibleWindows.length === 0) {
      await bootstrapper.bootstrap()
    }
  } catch (error) {
    logger.error('重新激活应用失败:', error)
  }
})

// 处理应用退出前的清理工作
app.on('before-quit', async (event) => {
  // 避免重复处理
  if (isQuitting) {
    return
  }

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

    // 设置超时保护（5秒）
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
  // logger.info('[应用] 应用即将退出')
})
