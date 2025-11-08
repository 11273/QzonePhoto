import { ipcMain, shell, BrowserWindow } from 'electron'
import windowManager from '@main/core/window'
import { IPC_WINDOW, IPC_APP, IPC_SHELL } from '@shared/ipc-channels'
import { app } from 'electron'
import { APP_NAME, APP_HOMEPAGE, APP_DESCRIPTION } from '@shared/const'
import { is } from '@electron-toolkit/utils'

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
        isMac: process.platform === 'darwin',
        name: app.getName(),
        version: app.getVersion(),
        productName: APP_NAME,
        homepage: APP_HOMEPAGE,
        description: APP_DESCRIPTION
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
  ipcMain.handle(IPC_SHELL.OPEN_EXTERNAL, (event, url) => {
    shell.openExternal(url)
  })

  // 打开 QQ 空间官网
  ipcMain.handle(IPC_WINDOW.OPEN_QZONE_WEB, async (event, { uin, p_skey }) => {
    try {
      // 创建新窗口 - 显示窗口框架但隐藏菜单栏
      const qzoneWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'QQ空间',
        frame: true, // 显示窗口框架（包括关闭按钮）
        autoHideMenuBar: true, // 隐藏菜单栏
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          allowRunningInsecureContent: false
        }
      })

      // 在加载页面之前设置 cookie
      const ses = qzoneWindow.webContents.session

      // 优化后的 cookies 配置
      const cookieConfig = {
        url: 'https://user.qzone.qq.com',
        domain: '.qq.com',
        path: '/',
        secure: true,
        httpOnly: false
      }

      const cookiesToSet = [
        { name: 'uin', value: `${uin}` },
        { name: 'p_uin', value: `${uin}` },
        { name: 'p_skey', value: p_skey }
      ]

      // 设置所有 cookies
      await Promise.all(
        cookiesToSet.map((cookie) =>
          ses.cookies.set({
            ...cookieConfig,
            ...cookie
          })
        )
      )

      // 加载 QQ 空间页面
      await qzoneWindow.loadURL(`https://user.qzone.qq.com`)

      // 打开开发者工具（可选，用于调试）
      if (is.dev) {
        qzoneWindow.webContents.openDevTools()
      }

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
