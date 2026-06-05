import { ipcMain, shell } from 'electron'
import windowManager from '@main/core/window'
import { IPC_WINDOW, IPC_APP, IPC_SHELL } from '@shared/ipc-channels'
import { app } from 'electron'
import { APP_NAME, APP_HOMEPAGE, APP_DESCRIPTION } from '@shared/const'

const APP_LAUNCH_ID = `${Date.now()}-${process.pid}`
const APP_LAUNCHED_AT = new Date().toISOString()

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

  // 获取应用信息
  ipcMain.handle(IPC_APP.GET_INFO, () => {
    try {
      // 使用统一配置工具获取应用信息
      const result = {
        platform: process.platform,
        arch: process.arch,
        isMac: process.platform === 'darwin',
        isPackaged: app.isPackaged,
        versions: {
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node
        },
        name: app.getName(),
        version: app.getVersion(),
        productName: APP_NAME,
        homepage: APP_HOMEPAGE,
        description: APP_DESCRIPTION,
        launchId: APP_LAUNCH_ID,
        launchedAt: APP_LAUNCHED_AT
      }

      return result
    } catch (error) {
      console.error('获取应用信息失败:', error)
      return {
        platform: process.platform,
        isMac: process.platform === 'darwin'
      }
    }
  })

  // 打开外部链接
  ipcMain.handle(IPC_SHELL.OPEN_EXTERNAL, async (event, context) => {
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
      return
    }
    shell.openExternal(url)
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
