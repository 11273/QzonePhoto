import { app, protocol, session } from 'electron'
import fs from 'fs'
import { Readable } from 'stream'
import { ApplicationBootstrapper } from '@main/app-bootstrapper'
import { optimizer, electronApp, platform, is } from '@electron-toolkit/utils'
import logger from '@main/core/logger'
import { resolveLocalMedia } from '@main/utils/local-media-registry'
import { APP_ID } from '@shared/const'

// 开发环境远程调试端口
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9224')
}

// 注册自定义协议（必须在 app ready 前）：让 renderer 安全地用 <video> 加载本地文件
// 用于 fMP4 等容器需要 HTML5 video 解析时长 —— file:// 被 Chromium 拒绝，用这个绕过
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'qzone-local',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

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
    // 注册 qzone-local:// → 本地文件，用 fs.createReadStream 流式响应，无内存占用
    // 格式约定：qzone-local://local/<token>
    // 支持 Range 请求（HTML5 video 加载视频时会发 Range）
    // 主窗口用 partition: 'persist:qzone'，必须在该 session 上注册（partition session 不继承 default）
    const qzoneSession = session.fromPartition('persist:qzone')
    const handleProtocol = async (req) => {
      const u = new URL(req.url)
      const token = u.pathname.replace(/^\//, '')
      const filePath = resolveLocalMedia(token)
      if (!filePath) {
        return new Response('Not found', { status: 404 })
      }
      try {
        const stat = await fs.promises.stat(filePath)
        const range = req.headers.get('range')
        let start = 0
        let end = stat.size - 1
        let status = 200
        if (range) {
          const m = /bytes=(\d+)-(\d*)/.exec(range)
          if (m) {
            start = parseInt(m[1], 10)
            end = m[2] ? parseInt(m[2], 10) : stat.size - 1
            status = 206
          }
        }
        const stream = fs.createReadStream(filePath, { start, end })
        const webStream = Readable.toWeb(stream)
        const headers = {
          'Content-Length': String(end - start + 1),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes'
        }
        if (status === 206) {
          headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
        }
        return new Response(webStream, { status, headers })
      } catch (e) {
        logger.error('[qzone-local] 读取失败:', e?.message || e)
        return new Response(String(e), { status: 500 })
      }
    }
    // 同时在 default session 和 主窗口 partition session 上注册
    protocol.handle('qzone-local', handleProtocol)
    qzoneSession.protocol.handle('qzone-local', handleProtocol)

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
