import { is } from '@electron-toolkit/utils'
import { BrowserWindow, screen, session, shell } from 'electron'
import path, { join } from 'path'

export class WindowManager {
  static #instance = null

  constructor() {
    if (WindowManager.#instance) {
      return WindowManager.#instance
    }

    WindowManager.#instance = this

    this.windows = new Map() // 窗口池 {id: BrowserWindow}
    this.mainWindowId = null
    this.services = null // 服务管理器引用
  }

  // 设置服务管理器引用
  setServices(services) {
    this.services = services
  }

  // 获取主窗口
  getMainWindow() {
    if (this.mainWindowId) {
      return this.windows.get(this.mainWindowId)
    }
    return null
  }

  // 创建主窗口
  async createMainWindow() {
    // 获取显示器信息
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()

    // 开发环境优先使用第二块屏幕（如果存在）
    const targetDisplay = is.dev && displays[1] ? displays[1] : primaryDisplay

    // 窗口配置
    const width = 1080
    const height = 750
    const x = targetDisplay.bounds.x + (targetDisplay.bounds.width - width) / 2
    const y = targetDisplay.bounds.y + (is.dev ? 50 : (targetDisplay.bounds.height - height) / 2)

    // 解析preload路径
    const preloadPath = is.dev
      ? path.join(__dirname, '../preload/index.js')
      : path.join(process.resourcesPath, 'app.asar.unpacked/out/preload/index.js')

    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      minWidth: 900,
      minHeight: 650,
      show: false,
      frame: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      autoHideMenuBar: true,
      webPreferences: {
        devTools: is.dev,
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    })

    this._registerWindow(win, 'main')

    // 开发环境自动打开开发者工具
    if (is.dev) {
      win.webContents.openDevTools()
    }

    win.on('ready-to-show', () => {
      win.show()
      this._bindServicesToWindow(win)
    })

    // 处理外部链接
    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // 防止页面导航到外部链接
    win.webContents.on('will-navigate', (event, url) => {
      // 只允许加载应用内的URL
      if (
        !url.startsWith('file://') &&
        !url.startsWith(process.env['ELECTRON_RENDERER_URL'] || '')
      ) {
        event.preventDefault()
        shell.openExternal(url)
      }
    })

    const filter = { urls: ['*://*.qq.com/*', '*://*.qpic.cn/*', '*://*/*'] }

    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, cb) => {
      // 根据 URL 设置对应的 referer
      let referer = details.url // 默认设置为请求的 URL 本身
      // 提取域名
      try {
        const url = new URL(details.url)
        referer = url.origin // 设置为请求的源（协议+域名）
      } catch (e) {
        console.error('URL 解析失败:', details.url, e)
      }
      details.requestHeaders['referer'] = referer
      cb({ requestHeaders: details.requestHeaders })
    })

    // 加载页面
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return win
  }

  // 创建通用窗口
  createWindow(type, options = {}) {
    // 获取预设配置
    const preset = this._getWindowPreset(type)

    // 如果没有指定位置，则居中显示
    if (!options.x && !options.y) {
      const primaryDisplay = screen.getPrimaryDisplay()
      const windowWidth = options.width || preset.width || 800
      const windowHeight = options.height || preset.height || 600

      options.x = primaryDisplay.bounds.x + (primaryDisplay.bounds.width - windowWidth) / 2
      options.y = primaryDisplay.bounds.y + (primaryDisplay.bounds.height - windowHeight) / 2
    }

    const win = new BrowserWindow({
      ...preset,
      ...options
    })

    this._registerWindow(win, type)
    return win
  }

  // 绑定服务到窗口
  _bindServicesToWindow(window) {
    if (!this.services) return

    try {
      // 获取需要窗口引用的服务并设置窗口
      const servicesToBind = this._getServicesNeedingWindow()

      servicesToBind.forEach(({ serviceName, service }) => {
        if (service && typeof service.setAssociatedWindow === 'function') {
          service.setAssociatedWindow(window)
          // 只在开发环境输出调试信息
          if (is.dev) {
            console.debug(`[WindowManager] 已绑定 ${serviceName.description} 服务到主窗口`)
          }
        }
      })
    } catch (error) {
      // 只在开发环境输出错误信息
      if (is.dev) {
        console.error('[WindowManager] 绑定服务到窗口失败:', error)
      }
    }
  }

  // 获取需要窗口引用的服务列表
  _getServicesNeedingWindow() {
    if (!this.services || !this.services.instances) return []

    const servicesNeedingWindow = []

    // 遍历ServiceManager中的instances Map，找到有setAssociatedWindow方法的服务
    for (const [serviceName, service] of this.services.instances) {
      if (service && typeof service.setAssociatedWindow === 'function') {
        servicesNeedingWindow.push({ serviceName, service })
      }
    }

    return servicesNeedingWindow
  }

  // 窗口事件管理
  _registerWindow(win, type) {
    const id = win.id
    this.windows.set(id, win)

    if (type === 'main') {
      this.mainWindowId = id
    }

    win.on('closed', () => {
      this.windows.delete(id)
      if (this.mainWindowId === id) this.mainWindowId = null
    })

    win.webContents.on('did-finish-load', () => {})
  }

  // 获取窗口预设配置
  _getWindowPreset(type) {
    const presets = {
      dialog: {
        width: 600,
        height: 400,
        modal: true,
        autoHideMenuBar: true,
        frame: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden'
      },
      settings: {
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        autoHideMenuBar: true,
        frame: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden'
      }
    }
    return presets[type] || {}
  }

  // 销毁所有窗口
  async destroyAllWindows() {
    // eslint-disable-next-line no-unused-vars
    for (const [id, win] of this.windows) {
      if (!win.isDestroyed()) win.destroy()
    }
    this.windows.clear()
  }

  // 获取单例实例
  static getInstance() {
    if (!WindowManager.#instance) {
      WindowManager.#instance = new WindowManager()
    }
    return WindowManager.#instance
  }
}

/** @type {WindowManager} 初始化单例 */
const windowManager = WindowManager.getInstance()

export default windowManager
