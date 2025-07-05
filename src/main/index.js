import { app } from 'electron'
import { ApplicationBootstrapper } from '@main/app-bootstrapper'
import { optimizer, electronApp, platform, is } from '@electron-toolkit/utils'
import logger from '@main/core/logger'
import { APP_ID } from '@shared/const'

// 安全警告处理
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = is.dev

// 全局错误处理
process.on('unhandledRejection', (reason) => {
  logger.error('未处理的拒绝:', reason)
  logger.error('上下文:', reason?.stack || reason?.toString())
})

process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error)
  // 在开发环境中，让应用继续运行以便调试
  if (!is.dev) {
    app.exit(1)
  }
})

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
  // 在 macOS 上，应用会保持活跃状态，直到用户明确退出
  if (!platform.isMacOS) {
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
  event.preventDefault()
  try {
    await bootstrapper.shutdown()
  } catch (error) {
    logger.error('应用关闭清理失败:', error)
  } finally {
    app.exit(0)
  }
})
