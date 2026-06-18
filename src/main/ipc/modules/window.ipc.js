import { ipcMain, shell } from 'electron'
import windowManager from '@main/core/window'
import { IPC_WINDOW, IPC_APP, IPC_SHELL } from '@shared/ipc-channels'
import { getAppApiConfig } from '@main/config/app-api'

const isQzoneWebUrl = (value) => {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const host = url.hostname.toLowerCase()
    return (
      host === 'user.qzone.qq.com' ||
      host === 'i.qq.com' ||
      host === 'qzone.qq.com' ||
      host.endsWith('.qzone.qq.com') ||
      host === 'qzs.qq.com' ||
      host.endsWith('.qzs.qq.com')
    )
  } catch {
    return false
  }
}

// 注册窗口控制相关的IPC处理器
export function registerWindowControl() {
  // 最小化窗口
  ipcMain.handle(IPC_WINDOW.MINIMIZE, () => {
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  // 最大化/还原窗口
  ipcMain.handle(IPC_WINDOW.MAXIMIZE, () => {
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
        return false
      } else {
        mainWindow.maximize()
        return true
      }
    }
    return false
  })

  // 关闭窗口
  ipcMain.handle(IPC_WINDOW.CLOSE, () => {
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow) {
      mainWindow.close()
    }
  })

  // 获取窗口状态
  ipcMain.handle(IPC_WINDOW.IS_MAXIMIZED, () => {
    const mainWindow = windowManager.getMainWindow()
    return mainWindow ? mainWindow.isMaximized() : false
  })

  ipcMain.handle(IPC_APP.GET_API_CONFIG, async (event, context = {}) => {
    try {
      return await getAppApiConfig({
        forceRefresh: Boolean(context?.forceRefresh)
      })
    } catch (error) {
      console.error('获取动态 API 配置失败:', error)
      return {
        apiBaseUrl: '',
        fallbackBaseUrls: [],
        version: '',
        ttlSeconds: 86400,
        fetchedAt: new Date().toISOString(),
        remoteConfigUrl: '',
        source: 'error'
      }
    }
  })

  // 打开外部链接
  ipcMain.handle(IPC_SHELL.OPEN_EXTERNAL, async (event, context) => {
    const openUrl = async () => {
      const url = typeof context === 'string' ? context : context?.payload
      const headers = typeof context === 'string' ? null : context?.headers
      if (headers?.uin || headers?.p_skey) {
        windowManager.setQzoneAuth(headers)
      }
      if (isQzoneWebUrl(url)) {
        await windowManager.openQzoneWeb({
          url,
          uin: headers?.uin,
          p_skey: headers?.p_skey,
          cookies: headers?.cookies
        })
        return { success: true, target: 'qzone' }
      }
      await shell.openExternal(url)
      return { success: true, target: 'external' }
    }

    if (typeof context === 'string') {
      return openUrl()
    }

    return withIpcData(openUrl)
  })

  ipcMain.handle(IPC_WINDOW.SET_QZONE_AUTH, async (event, auth = {}) => {
    windowManager.setQzoneAuth(auth)
    return { success: true }
  })

  // 打开 QQ 空间官网
  ipcMain.handle(IPC_WINDOW.OPEN_QZONE_WEB, async (event, context = {}) => {
    try {
      const payload = context?.payload || context || {}
      const headers = context?.headers || {}
      const auth = {
        uin: payload.uin || headers.uin,
        p_skey: payload.p_skey || headers.p_skey,
        cookies: payload.cookies || headers.cookies
      }
      if (auth.uin || auth.p_skey || auth.cookies) {
        windowManager.setQzoneAuth(auth)
      }
      await windowManager.openQzoneWeb({
        url: payload.url,
        uin: auth.uin,
        p_skey: auth.p_skey,
        cookies: auth.cookies,
        targetUin: payload.targetUin
      })
      return { success: true }
    } catch (error) {
      console.error('打开 QQ 空间官网失败:', error)
      return { success: false, error: error.message }
    }
  })
}

async function withIpcData(fn) {
  try {
    return {
      code: 0,
      message: 'success',
      data: (await fn()) ?? null
    }
  } catch (error) {
    const message = error?.message || '请求处理失败'
    const code = error?.code || 500
    return {
      code,
      message,
      data: null,
      error: {
        code,
        message
      }
    }
  }
}

// 设置窗口事件监听器
export function setupWindowEventListeners() {
  setTimeout(() => {
    const mainWindow = windowManager.getMainWindow()
    if (mainWindow) {
      mainWindow.on('maximize', () => {
        mainWindow.webContents.send(IPC_WINDOW.MAXIMIZED, true)
      })

      mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send(IPC_WINDOW.MAXIMIZED, false)
      })
    }
  }, 1000) // 延迟确保窗口创建完成
}
