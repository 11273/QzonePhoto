import { is } from '@electron-toolkit/utils'
import { BrowserWindow, screen, session, shell } from 'electron'
import path, { join } from 'path'
import { pathToFileURL } from 'url'
import { ServiceNames } from '@main/services/service-manager'
import logger from '@main/core/logger'

const QZONE_PARTITION = 'persist:qzone'
const QZONE_COOKIE_URLS = [
  'https://user.qzone.qq.com',
  'https://qzone.qq.com',
  'https://i.qq.com',
  'https://qzs.qq.com'
]

const rawQqUin = (uin) =>
  String(uin || '')
    .replace(/^o/, '')
    .trim()
const qqCookieUin = (uin) => {
  const raw = rawQqUin(uin)
  return raw ? `o${raw}` : ''
}

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

const normalizeQzoneWebUrl = (value) => {
  try {
    const url = new URL(value)
    if (url.protocol === 'http:') url.protocol = 'https:'
    return url.toString()
  } catch {
    return value
  }
}

const isSafeExternalUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

const openSafeExternal = (value) => {
  if (!isSafeExternalUrl(value)) return
  void shell.openExternal(value)
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const startupFailureHtml = ({ recoveryUrl, reason }) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>企鹅相册 · 启动恢复</title>
    <style>
      :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 32px; color: #f2f0f2; background: radial-gradient(circle at 75% 20%, #361e1e 0, transparent 34%), #111014; }
      main { width: min(420px, 100%); padding: 28px; border: 1px solid #403b43; border-radius: 20px; background: rgba(28, 26, 31, .94); box-shadow: 0 24px 70px rgba(0, 0, 0, .38); }
      h1 { margin: 0 0 10px; font-size: 20px; font-weight: 680; }
      p { margin: 0; color: #aaa4ae; font-size: 13px; line-height: 1.65; }
      .reason { margin-top: 12px; color: #d2cdd4; }
      a { min-height: 38px; margin-top: 22px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; border: 1px solid #78534c; border-radius: 10px; color: #fff; background: #b43730; font-size: 13px; font-weight: 650; text-decoration: none; }
      a:hover { background: #c44038; }
      a:focus-visible { outline: 2px solid #e4bd68; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main role="alert" aria-live="assertive">
      <h1>企鹅相册暂时无法启动</h1>
      <p>应用数据不会受到影响。请重新加载；如果仍然失败，可保留诊断日志后再关闭应用。</p>
      <p class="reason">${escapeHtml(reason)}</p>
      <a href="${escapeHtml(recoveryUrl)}">重新加载</a>
    </main>
  </body>
</html>`

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
    this.qzoneAuth = {
      uin: '',
      p_skey: '',
      cookies: {}
    }
  }

  // 设置服务管理器引用
  setServices(services) {
    this.services = services
  }

  setQzoneAuth(auth = {}) {
    if (auth.clear) {
      this.qzoneAuth = {
        uin: '',
        p_skey: '',
        cookies: {}
      }
      session
        .fromPartition(QZONE_PARTITION)
        .clearStorageData({ storages: ['cookies'] })
        .catch((error) => {
          if (is.dev) console.warn('[WindowManager] 清理 QQ 空间 cookie 失败:', error)
        })
      return
    }

    const nextUin = auth.uin ? rawQqUin(auth.uin) : ''
    const nextPSkey = auth.p_skey ? String(auth.p_skey).trim() : ''
    const nextCookies =
      auth.cookies && typeof auth.cookies === 'object' && !Array.isArray(auth.cookies)
        ? Object.fromEntries(
            Object.entries(auth.cookies)
              .filter(([, value]) => value)
              .map(([key, value]) => [key, String(value)])
          )
        : {}

    if (!nextUin && !nextPSkey && !Object.keys(nextCookies).length) return

    this.qzoneAuth = {
      uin: nextUin || this.qzoneAuth.uin,
      p_skey: nextPSkey || this.qzoneAuth.p_skey,
      cookies: {
        ...this.qzoneAuth.cookies,
        ...nextCookies
      }
    }
  }

  async _readQzoneCookieMap(ses = session.fromPartition(QZONE_PARTITION)) {
    const cookieLists = await Promise.all(
      QZONE_COOKIE_URLS.map((url) => ses.cookies.get({ url }).catch(() => []))
    )
    return Object.fromEntries(
      cookieLists
        .flat()
        .filter((cookie) => cookie?.name && cookie?.value)
        .map((cookie) => [cookie.name, String(cookie.value)])
    )
  }

  async _writeQzoneCookies(ses, cookieValues = {}) {
    const cookiesToSet = Object.entries(cookieValues)
      .filter(([, value]) => value)
      .map(([name, value]) => ({ name, value: String(value) }))

    await Promise.all(
      QZONE_COOKIE_URLS.flatMap((url) =>
        cookiesToSet.map((cookie) =>
          ses.cookies
            .set({
              url,
              domain: '.qq.com',
              path: '/',
              secure: true,
              httpOnly: false,
              ...cookie
            })
            .catch((error) => {
              if (is.dev) {
                console.warn(`[WindowManager] 写入 QQ 空间 cookie ${cookie.name} 失败:`, error)
              }
            })
        )
      )
    )
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
    const rendererFile = join(__dirname, '../renderer/index.html')
    const recoveryUrl =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? process.env['ELECTRON_RENDERER_URL']
        : pathToFileURL(rendererFile).toString()

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
        webSecurity: true,
        partition: QZONE_PARTITION
      }
    })

    this._registerWindow(win, 'main')

    let showingStartupFailure = false
    const showStartupFailure = async (reason) => {
      if (showingStartupFailure || win.isDestroyed()) return
      showingStartupFailure = true
      const html = startupFailureHtml({ recoveryUrl, reason })
      try {
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        if (!win.isVisible()) win.show()
      } catch (error) {
        logger.error('[WindowManager] 启动恢复页面加载失败', error)
      }
    }

    // 保留渲染进程关键错误。页面资源均来自本地，不应因为网络或抓包代理而加载失败；
    // 一旦出现问题，日志会给出真实原因，避免只留下空白窗口。
    win.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return
        logger.error(
          `[WindowManager] 主界面加载失败 (${errorCode}): ${errorDescription} (${validatedURL || 'unknown'})`
        )
        if (errorCode !== -3) {
          void showStartupFailure('主界面组件未能载入，请重新加载。')
        }
      }
    )
    win.webContents.on('render-process-gone', (_event, details) => {
      logger.error(`[WindowManager] 主界面渲染进程已退出: ${details?.reason || 'unknown'}`)
      void showStartupFailure('界面进程意外退出，请重新加载。')
    })
    win.webContents.on('preload-error', (_event, preloadPath, error) => {
      logger.error(`[WindowManager] 预加载脚本异常: ${preloadPath}`, error)
      void showStartupFailure('应用组件加载失败，请重新加载。')
    })
    win.webContents.on('console-message', (details) => {
      // Electron 43 起只使用 details 参数；只收集 warning/error，避免普通日志污染本地诊断文件。
      if (!['warning', 'error'].includes(details?.level)) return
      logger.warn(
        `[Renderer] ${details.sourceId || 'unknown'}:${details.lineNumber || 0} ${String(details.message || '').slice(0, 1200)}`
      )
    })

    win.on('ready-to-show', () => {
      win.show()
      this._bindServicesToWindow(win)

      // 开发环境自动打开开发者工具
      if (is.dev) {
        try {
          win.webContents.openDevTools()
          // console.log('[WindowManager] 开发者工具已打开')
        } catch (error) {
          console.error('[WindowManager] 打开开发者工具失败:', error)
        }
      }
    })

    // 页面加载完成后再次尝试打开开发者工具（备选方案）
    win.webContents.on('did-finish-load', () => {
      if (is.dev && !win.webContents.isDevToolsOpened()) {
        try {
          win.webContents.openDevTools()
          // console.log('[WindowManager] 开发者工具已打开（备选方案）')
        } catch (error) {
          console.error('[WindowManager] 打开开发者工具失败（备选方案）:', error)
        }
      }
    })

    // 处理外部链接
    win.webContents.setWindowOpenHandler((details) => {
      if (isQzoneWebUrl(details.url)) {
        this.openQzoneWeb({ url: details.url })
        return { action: 'deny' }
      }
      openSafeExternal(details.url)
      return { action: 'deny' }
    })

    // 防止页面导航到外部链接
    win.webContents.on('will-navigate', (event, url) => {
      if (url === recoveryUrl) {
        showingStartupFailure = false
        return
      }
      // 只允许加载应用内的URL
      if (
        !url.startsWith('file://') &&
        !url.startsWith(process.env['ELECTRON_RENDERER_URL'] || '')
      ) {
        event.preventDefault()
        if (isQzoneWebUrl(url)) {
          this.openQzoneWeb({ url })
          return
        }
        openSafeExternal(url)
      }
    })

    const filter = { urls: ['*://*.qq.com/*', '*://*.qpic.cn/*', '*://*/*'] }

    // 获取 persist:qzone 对应的 session
    const qzoneSession = session.fromPartition(QZONE_PARTITION)

    // 在正确的 session 上监听请求
    qzoneSession.webRequest.onBeforeSendHeaders(filter, (details, cb) => {
      let referer = details.url
      let origin = details.url
      try {
        const url = new URL(details.url)
        referer = url.origin
        origin = url.origin

        const isQzoneImage =
          details.resourceType === 'image' &&
          (url.hostname.endsWith('qpic.cn') ||
            url.hostname.includes('photo.store.qq.com') ||
            url.hostname.includes('qzone.qq.com'))

        if (isQzoneImage) {
          referer = 'https://user.qzone.qq.com/'
          origin = 'https://user.qzone.qq.com'
        }

        // 对 photo.store.qq.com 请求注入 qq_photo_key cookie
        if (url.hostname.includes('photo.store.qq.com')) {
          const photoService = this.services?.get(ServiceNames.PHOTO)
          if (photoService?.qq_photo_key) {
            const existing = details.requestHeaders['Cookie'] || ''
            details.requestHeaders['Cookie'] = existing
              ? `${existing}; qq_photo_key=${photoService.qq_photo_key}`
              : `qq_photo_key=${photoService.qq_photo_key}`
          }
        }
      } catch (e) {
        console.error('URL 解析失败:', details.url, e)
      }
      details.requestHeaders.Referer = referer
      details.requestHeaders.Origin = origin
      cb({ requestHeaders: details.requestHeaders })
    })

    qzoneSession.webRequest.onHeadersReceived(filter, (details, callback) => {
      const responseHeaders = details.responseHeaders

      delete responseHeaders['access-control-allow-origin']
      delete responseHeaders['access-control-allow-headers']
      delete responseHeaders['access-control-allow-methods']

      responseHeaders['Access-Control-Allow-Origin'] = ['*']
      responseHeaders['Access-Control-Allow-Headers'] = ['*']
      responseHeaders['Access-Control-Allow-Methods'] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']

      responseHeaders['Access-Control-Allow-Credentials'] = ['true']

      callback({ responseHeaders })
    })

    // 加载页面
    try {
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        await win.loadURL(process.env['ELECTRON_RENDERER_URL'])
      } else {
        await win.loadFile(rendererFile)
      }
    } catch (error) {
      if (showingStartupFailure) return win
      logger.error('[WindowManager] 加载主界面失败', error)
      await showStartupFailure('主界面文件未能载入，请重新加载。')
    }

    return win
  }

  async openQzoneWeb({ url, uin, p_skey, cookies, targetUin } = {}) {
    const targetUrl =
      url && isQzoneWebUrl(url)
        ? normalizeQzoneWebUrl(url)
        : targetUin
          ? `https://user.qzone.qq.com/${String(targetUin).replace(/^o/, '')}`
          : 'https://user.qzone.qq.com'

    const qzoneWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 650,
      title: 'QQ空间',
      frame: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        partition: QZONE_PARTITION
      }
    })

    this._registerWindow(qzoneWindow, 'qzone-web')

    qzoneWindow.webContents.setWindowOpenHandler((details) => {
      if (isQzoneWebUrl(details.url)) {
        this.openQzoneWeb({ url: details.url })
        return { action: 'deny' }
      }
      openSafeExternal(details.url)
      return { action: 'deny' }
    })

    qzoneWindow.webContents.on('will-navigate', (event, nextUrl) => {
      if (isQzoneWebUrl(nextUrl)) return
      try {
        const parsed = new URL(nextUrl)
        if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.qq.com')) return
      } catch {
        // ignore parse errors and block below
      }
      event.preventDefault()
      openSafeExternal(nextUrl)
    })

    const ses = qzoneWindow.webContents.session
    const sessionCookies = await this._readQzoneCookieMap(ses)
    const providedCookies =
      cookies && typeof cookies === 'object' && !Array.isArray(cookies) ? cookies : {}
    const authCookies = {
      ...sessionCookies,
      ...this.qzoneAuth.cookies,
      ...providedCookies
    }
    const authUin = rawQqUin(
      uin || this.qzoneAuth.uin || authCookies.p_uin || authCookies.uin || authCookies.pt2gguin
    )
    const authPSkey = p_skey || this.qzoneAuth.p_skey || authCookies.p_skey || ''
    const cookieUin = qqCookieUin(authUin)
    const cookieValues = {
      ...authCookies,
      ...(cookieUin ? { uin: cookieUin, p_uin: cookieUin } : {}),
      ...(authPSkey ? { p_skey: authPSkey } : {})
    }

    if (authUin || authPSkey || Object.keys(cookieValues).length) {
      this.setQzoneAuth({ uin: authUin, p_skey: authPSkey, cookies: cookieValues })
      await this._writeQzoneCookies(ses, cookieValues)
    }

    await qzoneWindow.loadURL(targetUrl)

    if (is.dev) {
      qzoneWindow.webContents.openDevTools()
    }

    return qzoneWindow
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

      servicesToBind.forEach(({ service }) => {
        if (service && typeof service.setAssociatedWindow === 'function') {
          service.setAssociatedWindow(window)
          // 只在开发环境输出调试信息
          if (is.dev) {
            // console.debug(`[WindowManager] 已绑定 ${serviceName.description} 服务到主窗口`)
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
      try {
        this.windows.delete(id)
        if (this.mainWindowId === id) {
          this.mainWindowId = null
        }
      } catch (error) {
        if (is.dev) {
          console.error(`[WindowManager] 清理窗口 ${id} 失败:`, error)
        }
      }
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
    try {
      for (const [id, win] of this.windows) {
        try {
          if (win && !win.isDestroyed()) {
            win.destroy()
          }
        } catch (error) {
          // 只在开发环境输出错误信息
          if (is.dev) {
            console.error(`[WindowManager] 销毁窗口 ${id} 失败:`, error)
          }
          // 继续处理其他窗口
        }
      }
    } finally {
      // 确保清理操作始终执行
      this.windows.clear()
      this.mainWindowId = null
    }
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
