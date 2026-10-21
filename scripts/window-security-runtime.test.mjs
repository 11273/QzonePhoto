import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileFunction } from 'node:vm'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const boundaries = {
  electron: 'export const { BrowserWindow, screen, session, shell } = __runtime',
  '@electron-toolkit/utils': 'export const is = __runtime.is',
  '@main/services/service-manager': 'export const ServiceNames = { PHOTO: "photo" }',
  '@main/core/logger': 'export default { error() {}, warn() {} }'
}
const bundle = await build({
  entryPoints: [path.join(root, 'src/main/core/window.js')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'window-boundaries',
      setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path }) =>
          Object.hasOwn(boundaries, path) ? { path, namespace: 'boundary' } : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({
          contents: boundaries[path],
          loader: 'js'
        }))
      }
    }
  ]
})

// Exercise the real registered handlers; no real account, browser profile or OS links.
const setup = async (rendererUrl) => {
  const hooks = {}
  const external = []
  const qzone = []
  class Window extends EventEmitter {
    constructor() {
      super()
      this.id = 1
      this.webContents = new EventEmitter()
      this.webContents.setWindowOpenHandler = () => {}
    }
    async loadFile(file) {
      this.url = pathToFileURL(file).href
    }
    async loadURL(url) {
      this.url = url
    }
    isDestroyed() {
      return false
    }
    isVisible() {
      return true
    }
  }
  const display = { bounds: { x: 0, y: 0, width: 1440, height: 900 } }
  const runtime = {
    BrowserWindow: Window,
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    session: {
      fromPartition: () => ({
        webRequest: {
          onBeforeSendHeaders: (_filter, handler) => {
            hooks.headers = handler
          },
          onHeadersReceived() {}
        }
      })
    },
    shell: {
      openExternal: (url) => {
        external.push(url)
      }
    },
    is: { dev: Boolean(rendererUrl) }
  }
  const module = { exports: {} }
  compileFunction(bundle.outputFiles[0].text, [
    'require',
    'module',
    'exports',
    '__runtime',
    '__dirname',
    'process'
  ])(createRequire(import.meta.url), module, module.exports, runtime, path.join(root, 'out/main'), {
    ...process,
    resourcesPath: root,
    env: rendererUrl ? { ELECTRON_RENDERER_URL: rendererUrl } : {}
  })
  const manager = module.exports.default
  manager.setServices(new Map([['photo', { qq_photo_key: 'synthetic-photo-key' }]]))
  manager.openQzoneWeb = ({ url }) => {
    qzone.push(url)
  }
  const win = await manager.createMainWindow()
  return {
    win,
    external,
    qzone,
    headers(url, resourceType = 'image', requestHeaders = {}) {
      let result
      hooks.headers({ url, resourceType, requestHeaders }, (value) => {
        result = value.requestHeaders
      })
      return result
    },
    navigate(url, eventName = 'will-navigate', isMainFrame = true) {
      let blocked = false
      win.webContents.emit(
        eventName,
        {
          url,
          isMainFrame,
          preventDefault: () => {
            blocked = true
          }
        },
        url
      )
      return blocked
    }
  }
}

test('photo key only reaches photo-store hosts, preserving cookies and legacy HTTP images', async () => {
  const app = await setup()
  for (const host of ['photo.store.qq.com', 'a1.photo.store.qq.com', 'PHOTO.STORE.QQ.COM']) {
    assert.equal(
      app.headers(`https://${host}/image`, 'image', { Cookie: 'existing=1' }).Cookie,
      'existing=1; qq_photo_key=synthetic-photo-key'
    )
  }
  for (const url of [
    'https://photo.store.qq.com.attacker.test/image',
    'https://evilphoto.store.qq.com/image',
    'https://attacker.test/photo.store.qq.com',
    'https://photo.store.qq.com@attacker.test/image',
    'https://qpic.cn/image'
  ]) {
    assert.equal(app.headers(url, 'image', { Cookie: 'existing=1' }).Cookie, 'existing=1', url)
  }
  assert.equal(
    app.headers('http://a1.photo.store.qq.com/image').Cookie,
    'qq_photo_key=synthetic-photo-key'
  )
  assert.equal(app.headers('https://a.qpic.cn/image').Referer, 'https://user.qzone.qq.com/')
  assert.equal(app.headers('https://evilqpic.cn/image').Referer, 'https://evilqpic.cn')
  assert.equal(
    app.headers('https://qzone.qq.com.attacker.test/image').Origin,
    'https://qzone.qq.com.attacker.test'
  )
})

test('packaged main window stays on its own document, with routing and recovery intact', async () => {
  const app = await setup()
  const renderer = app.win.url
  for (const url of [renderer, `${renderer}#/login`, `${renderer}?retry=1#/index`]) {
    assert.equal(app.navigate(url), false, url)
  }
  for (const url of [
    'https://attacker.test/',
    new URL('./other.html', renderer).href,
    `${renderer}.html`,
    'data:text/html,unexpected',
    'javascript:alert(1)'
  ])
    assert.equal(app.navigate(url), true, url)
  assert.deepEqual(app.external, ['https://attacker.test/'])
  assert.equal(app.navigate('https://user.qzone.qq.com/10001'), true)
  assert.deepEqual(app.qzone, ['https://user.qzone.qq.com/10001'])
  assert.equal(app.navigate('https://attacker.test/', 'will-redirect'), true)
  assert.equal(app.navigate('https://attacker.test/', 'will-redirect', false), false)

  app.win.webContents.emit('did-fail-load', {}, -2, 'failed', renderer, true)
  await new Promise(setImmediate)
  assert.match(app.win.url, /^data:text\/html/)
  assert.equal(app.navigate(renderer), false, 'startup retry must still be allowed')
})

test('development navigation compares URL components, not hostname/path prefixes', async () => {
  const app = await setup('http://localhost:5173/app/')
  assert.equal(app.navigate('http://localhost:5173/app/?retry=1#/index'), false)
  for (const url of [
    'http://localhost:5173/app/attacker.html',
    'http://localhost:5173/app/../other',
    'http://localhost:5174/app/',
    'https://localhost:5173/app/',
    'http://localhost.attacker.test:5173/app/',
    'http://user:pass@localhost:5173/app/'
  ])
    assert.equal(app.navigate(url), true, url)
})
