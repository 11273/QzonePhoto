import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http2 from 'node:http2'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import { setTimeout as delay } from 'node:timers/promises'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const boundaries = {
  electron: 'export const app = {}',
  '@electron-toolkit/utils': 'export const is = { dev: false }',
  '@main/core/logger': 'export default { error() {}, info() {} }',
  '@main/core/window': 'export default { getMainWindow: () => null }',
  '@main/api': `export { fileUpload, fileBatchControl, uploadVideoCover } from '@main/api/qzone/upload'`,
  '@main/api/utils/h2-client': `import { h2Post as send, closeAllH2Sessions } from ${JSON.stringify(path.join(root, 'src/main/api/utils/h2-client.js'))};
    export { closeAllH2Sessions };
    export const h2Post = (url, body, headers, transfer) => send(__runtime.origin + new URL(url).pathname, body, headers, transfer)`,
  '@main/services/video-metadata': 'export const getVideoMetadata = () => {}',
  '@main/utils/heic-converter.mjs': `export const isHeicImage = () => false;
    export const cleanupExpiredHeicCache = () => {};
    export const getHeicUploadCacheDirectory = () => {};
    export const prepareHeicForUpload = () => {};
    export const removePreparedHeicFile = () => {}`,
  '@main/services/app-telemetry':
    'export const reportHealthEvent = () => {}; export const telemetryBuckets = {}'
}
const bundle = await build({
  stdin: {
    contents: `export { UploadService } from '@main/services/main/upload';
    export { uploadVideoCover } from '@main/api/qzone/upload';
    export { h2Post, closeAllH2Sessions } from '@main/api/utils/h2-client'`,
    resolveDir: root
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  alias: { '@main': path.join(root, 'src/main'), '@shared': path.join(root, 'src/shared') },
  plugins: [
    {
      name: 'loopback-upload-boundaries',
      setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path }) =>
          Object.hasOwn(boundaries, path) ? { path, namespace: 'boundary' } : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({
          contents: boundaries[path],
          loader: 'js',
          resolveDir: root
        }))
      }
    }
  ]
})

const setup = async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-upload-rate-'))
  const chunks = []
  const sessions = new Set()
  let refuseNext = false
  let failNext = false
  const server = http2.createServer()
  server.on('session', (session) => {
    sessions.add(session)
    session.on('error', () => {})
  })
  server.on('stream', (stream) => {
    stream.on('error', () => {})
    const data = []
    stream.on('data', (chunk) => data.push(chunk))
    stream.on('end', () => {
      const wire = Buffer.concat(data)
      const body = JSON.parse(wire.toString())
      chunks.push({ wire: wire.length, body })
      if (refuseNext) {
        refuseNext = false
        stream.close(http2.constants.NGHTTP2_REFUSED_STREAM)
        return
      }
      stream.respond({ ':status': 200, 'content-type': 'application/json' })
      if (body.control_req) {
        stream.end(
          JSON.stringify({ ret: 0, data: { session: 'cover-session', slice_size: 16384 } })
        )
        return
      }
      if (failNext) {
        failNext = false
        stream.end(JSON.stringify({ ret: 1, msg: 'synthetic upload failure' }))
        return
      }
      stream.end(JSON.stringify({ ret: 0, data: { flag: body.end === 128 * 1024 ? 1 : 0 } }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const module = { exports: {} }
  compileFunction(bundle.outputFiles[0].text, ['require', 'module', 'exports', '__runtime'])(
    createRequire(import.meta.url),
    module,
    module.exports,
    { origin }
  )
  const service = new module.exports.UploadService()
  service.currentHostUin = service.currentUin = '10001'
  service.currentPSkey = 'synthetic-secret'
  service.db = { data: { tasks: [], settings: {} }, write: async () => {} }
  service.updateTaskInDB = () => {}
  service.triggerUpdate = () => {}
  service.pushTaskProgressDirect = () => {}
  service.processQueue = () => {}
  t.after(async () => {
    for (const token of service.cancelTokens.values()) token.cancelled = true
    service.getSpeedLimiter().setRate(0)
    module.exports.closeAllH2Sessions()
    for (const session of sessions) session.destroy()
    server.close()
    await fs.rm(directory, { recursive: true, force: true })
  })
  return {
    ...module.exports,
    service,
    chunks,
    origin,
    refuseNext: () => {
      refuseNext = true
    },
    failNext: () => {
      failNext = true
    },
    async task(id, isVideo = false) {
      const source = Buffer.alloc(128 * 1024, isVideo ? 8 : 7)
      const filePath = path.join(directory, `${id}.${isVideo ? 'mp4' : 'jpg'}`)
      await fs.writeFile(filePath, source)
      const task = { id, filePath, isVideo, total: source.length, session: id, status: 'uploading' }
      service.activeTasks.set(id, task)
      service.db.data.tasks.push(task)
      return task
    }
  }
}

const waitUntil = async (predicate) => {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return
    await delay(10)
  }
  assert.fail('upload did not reach the expected state')
}

test('real HTTP/2 image/video uploads share one wire-byte budget and preserve every chunk', async (t) => {
  const app = await setup(t)
  const tasks = await Promise.all([app.task('photo'), app.task('video', true)])
  await app.service.setSpeedLimit(256 * 1024)
  const started = performance.now()
  await Promise.all(tasks.map((task) => app.service.performChunkedUpload(task)))
  const elapsed = performance.now() - started
  const wireBytes = app.chunks.reduce((sum, chunk) => sum + chunk.wire, 0)
  assert.ok(wireBytes > 256 * 1024 * 1.3, 'base64/JSON overhead must also be limited')
  assert.ok(elapsed >= (wireBytes / (256 * 1024)) * 970, `${wireBytes} bytes in ${elapsed}ms`)
  assert.ok(elapsed < 5000)
  for (const task of tasks) {
    const received = app.chunks
      .filter((chunk) => chunk.body.session === task.id)
      .sort((a, b) => a.body.offset - b.body.offset)
    assert.deepEqual(
      Buffer.concat(received.map((chunk) => Buffer.from(chunk.body.data, 'base64'))),
      await fs.readFile(task.filePath)
    )
    assert.equal(task.progress, 100)
  }
  t.diagnostic(`${wireBytes} HTTP/2 wire bytes at total 256KB/s: ${Math.round(elapsed)}ms`)
})

test('real HTTP/2 retries pay the same budget; unrelated control requests stay unlimited', async (t) => {
  const app = await setup(t)
  const limiter = app.service.getSpeedLimiter()
  limiter.setRate(64 * 1024)
  app.refuseNext()
  const started = performance.now()
  await app.h2Post(`${app.origin}/retry`, { data: 'a'.repeat(8192) }, {}, { limiter })
  assert.equal(app.chunks.length, 2)
  assert.ok(performance.now() - started >= 240, 'both transmitted attempts must count')
  limiter.setRate(1024)
  const controlStarted = performance.now()
  await app.h2Post(`${app.origin}/control`, { control: true })
  assert.ok(performance.now() - controlStarted < 500)
  assert.equal(limiter.queue.length, 0)
})

test('upload limit changes and pause/resume work while requests are waiting for bandwidth', async (t) => {
  const app = await setup(t)
  const task = await app.task('paused')
  await app.service.setSpeedLimit(1024)
  const pending = app.service.performChunkedUpload(task)
  await waitUntil(() => app.service.getSpeedLimiter().queue.length === 4)
  const rejected = assert.rejects(pending, (error) => error.cancelled === true)
  await app.service.pauseTask(task.id)
  await rejected
  assert.equal(app.service.getSpeedLimiter().queue.length, 0)
  assert.equal(app.chunks.length, 0, 'a paused waiter must not send a chunk later')
  await app.service.resumeTask(task.id)
  task.session = task.id
  const resumed = app.service.performChunkedUpload(task)
  await waitUntil(() => app.service.getSpeedLimiter().queue.length > 0)
  const started = performance.now()
  await app.service.setSpeedLimit(0)
  await resumed
  assert.ok(performance.now() - started < 1000)
  assert.equal(task.progress, 100)
  assert.equal(app.chunks.length, 8)
  assert.equal(app.service.getSpeedLimiter().timer, null)
})

test('upload settings persist independently of download settings and reject failed/invalid saves', async (t) => {
  const app = await setup(t)
  assert.equal(app.service.getSpeedLimit(), 0)
  await app.service.setSpeedLimit(512 * 1024)
  app.service.speedLimiter = undefined
  app.service.loadSettings()
  assert.equal(app.service.getSpeedLimit(), 512 * 1024)
  await assert.rejects(app.service.setSpeedLimit(NaN), TypeError)
  app.service.db.write = async () => {
    throw new Error('read only')
  }
  await assert.rejects(app.service.setSpeedLimit(0), /read only/)
  assert.equal(app.service.getSpeedLimit(), 512 * 1024)
})

test('one failed upload chunk promptly cancels other bandwidth waiters and preserves the real error', async (t) => {
  const app = await setup(t)
  const task = await app.task('failed')
  app.failNext()
  await app.service.setSpeedLimit(64 * 1024)
  await assert.rejects(app.service.performChunkedUpload(task), /synthetic upload failure/)
  assert.equal(app.chunks.length, 1, 'no queued chunk should be transmitted after failure')
  assert.equal(app.service.getSpeedLimiter().queue.length, 0)
})

test('real HTTP/2 video cover chunks use the same upload budget while metadata initialization stays free', async (t) => {
  const app = await setup(t)
  const task = await app.task('cover')
  await app.service.setSpeedLimit(256 * 1024)
  const started = performance.now()
  await app.uploadVideoCover(
    '10001',
    'synthetic',
    '10001',
    'synthetic-video',
    task.filePath,
    'synthetic-album',
    'test album',
    'sample.mp4',
    1,
    {},
    { limiter: app.service.getSpeedLimiter() }
  )
  const chunks = app.chunks.filter((chunk) => chunk.body.session === 'cover-session')
  assert.equal(chunks.length, 8)
  const bytes = chunks.reduce((sum, chunk) => sum + chunk.wire, 0)
  assert.ok(performance.now() - started >= (bytes / (256 * 1024)) * 970)
  assert.deepEqual(
    Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.body.data, 'base64'))),
    await fs.readFile(task.filePath)
  )
})
