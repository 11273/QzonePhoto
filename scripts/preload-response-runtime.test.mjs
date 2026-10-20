import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { compileFunction } from 'node:vm'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const boundaries = {
  electron: `export const ipcRenderer = __runtime.ipcRenderer;
    export const contextBridge = __runtime.contextBridge`,
  '@shared/utils/auth': `export const getLocalUserInfo = () =>
    ({ uin: 'private-account', p_skey: 'private-secret' })`
}
const bundle = await build({
  entryPoints: [path.join(root, 'src/preload/index.js')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  alias: { '@shared': path.join(root, 'src/shared'), '@preload': path.join(root, 'src/preload') },
  plugins: [
    {
      name: 'ipc-runtime-boundaries',
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

const setup = () => {
  const exposed = {}
  const logs = []
  const requests = []
  let response = { code: 0, data: {} }
  const runtime = {
    contextBridge: {
      exposeInMainWorld: (name, api) => {
        exposed[name] = api
      }
    },
    ipcRenderer: {
      invoke: async (channel, context) => {
        requests.push({ channel, context })
        return response
      },
      on() {},
      removeListener() {},
      removeAllListeners() {}
    }
  }
  const consoleSpy = Object.fromEntries(
    ['debug', 'info', 'warn', 'error'].map((level) => [
      level,
      (...args) => logs.push({ level, args })
    ])
  )
  const module = { exports: {} }
  compileFunction(bundle.outputFiles[0].text, [
    'require',
    'module',
    'exports',
    '__runtime',
    'console',
    'process'
  ])(createRequire(import.meta.url), module, module.exports, runtime, consoleSpy, {
    env: { NODE_ENV: 'development' }
  })
  assert.ok(exposed.QzoneAPI)
  return {
    ...exposed,
    logs,
    requests,
    respond: (value) => {
      response = value
    }
  }
}

test('real preload accepts every normal QR state, including expiry, without console errors', async () => {
  const app = setup()
  for (const code of [66, 67, 65, 0, '66']) {
    const result = { code, message: 'QR state', data: 'login-redirect' }
    app.respond({ code: 0, data: result })
    assert.deepEqual(await app.QzoneAPI.checkLoginState({}), result)
  }
  assert.equal(app.logs.filter((log) => log.level === 'error').length, 0)
  assert.doesNotMatch(JSON.stringify(app.logs), /private-secret|private-account|login-redirect/)
})

test('QR transport, malformed and unknown responses still fail; other Qzone APIs keep business validation', async () => {
  const app = setup()
  for (const response of [
    { code: 500, message: 'transport failure' },
    { code: 0, data: null },
    { code: 0, data: { code: 68, message: 'unexpected state' } }
  ]) {
    app.respond(response)
    await assert.rejects(app.QzoneAPI.checkLoginState({}))
  }
  app.respond({ code: 0, data: { code: 66, message: 'not a QR response' } })
  await assert.rejects(app.QzoneAPI.getPhotoList({}), { message: 'not a QR response' })
  let expired = false
  app.api.onAuthExpired(() => {
    expired = true
  })
  app.respond({ code: 0, data: { code: -3000, message: 'expired' } })
  await assert.rejects(app.QzoneAPI.getPhotoList({}), { name: 'AuthExpiredError', code: -3000 })
  assert.equal(expired, true)
})

test('passive failures reject silently while interactive feedback failures remain visible', async () => {
  const app = setup()
  app.respond({ code: 500, error: { code: 'TIMEOUT', message: 'timeout' } })
  await assert.rejects(app.QzoneAPI.app.fetchNotices({ background: true, page: '#/login' }))
  await assert.rejects(app.QzoneAPI.app.fetchFeedbackThreads({ background: true }))
  await assert.rejects(app.QzoneAPI.app.reportHealth({ event: 'test' }))
  assert.equal(app.logs.length, 0)
  assert.equal(app.requests[0].context.payload.background, undefined)
  assert.deepEqual(app.requests[0].context.headers, {})
  await assert.rejects(app.QzoneAPI.app.fetchFeedbackThreads())
  assert.equal(app.logs.filter((log) => log.level === 'error').length, 1)
  app.respond({ code: 0, data: { threads: [] } })
  assert.deepEqual(await app.QzoneAPI.app.fetchFeedbackThreads({ background: true }), {
    threads: []
  })
})

test('private backend business codes cannot log the Qzone account out', async () => {
  const app = setup()
  let expired = false
  app.api.onAuthExpired(() => {
    expired = true
  })
  app.respond({ code: 0, data: { code: -3000, message: 'private service unavailable' } })
  await assert.rejects(app.QzoneAPI.app.reportHealth({ event: 'test' }))
  assert.equal(expired, false)
  assert.equal(app.logs.length, 0)
})

test('optional enrichment rejects silently without logging out, while explicit reads remain visible', async () => {
  const app = setup()
  let expired = false
  app.api.onAuthExpired(() => {
    expired = true
  })
  app.respond({ code: 0, data: { code: -3000, message: 'unavailable', detail: 'private-data' } })
  await assert.rejects(app.QzoneAPI.getShuoshuo({}, { background: true, skipAuthCheck: true }), {
    code: -3000,
    message: 'unavailable'
  })
  assert.equal(expired, false)
  assert.equal(app.logs.length, 0)
  assert.equal(app.requests.at(-1).context.meta.background, undefined)
  assert.equal(app.requests.at(-1).context.meta.skipAuthCheck, true)
  await assert.rejects(app.QzoneAPI.getShuoshuo({}, { skipAuthCheck: true }))
  assert.equal(app.logs.filter((log) => log.level === 'error').length, 1)
  assert.doesNotMatch(JSON.stringify(app.logs), /private-data|private-secret|private-account/)
  app.respond({ code: 0, data: { code: 0, msglist: [] } })
  assert.deepEqual(await app.QzoneAPI.getShuoshuo({}, { background: true }), {
    code: 0,
    msglist: []
  })
})
