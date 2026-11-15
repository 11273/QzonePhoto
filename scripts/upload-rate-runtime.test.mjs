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
  '@main/services/video-metadata':
    'export const getVideoMetadata = (...args) => __runtime.metadata(...args)',
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
    export { calculateFileMD5, extractVideoCover } from '@main/utils/file-processor';
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
  const pending = []
  const controls = {
    holdInit: false,
    holdChunks: false,
    videoCover: false,
    status: 200,
    uniqueSessions: false
  }
  const lengths = new Map()
  const coverSessions = new Set()
  let sessionIndex = 0
  let refuseNext = false
  let failNext = false
  const server = http2.createServer()
  server.on('session', (session) => {
    sessions.add(session)
    session.on('error', () => {})
  })
  server.on('stream', (stream) => {
    stream.on('error', () => {})
    let aborted = false
    stream.on('aborted', () => {
      aborted = true
    })
    const data = []
    stream.on('data', (chunk) => data.push(chunk))
    stream.on('end', () => {
      if (aborted) return // Cancellation may interrupt a JSON request body mid-transfer.
      const wire = Buffer.concat(data)
      const body = JSON.parse(wire.toString())
      const isCover = Boolean(
        body.control_req?.[0]?.biz_req?.stExtendInfo?.mapParams?.vid ||
        coverSessions.has(body.session)
      )
      chunks.push({ wire: wire.length, body, stream, isCover })
      if (refuseNext) {
        refuseNext = false
        stream.close(http2.constants.NGHTTP2_REFUSED_STREAM)
        return
      }
      const reply = () => {
        if (stream.destroyed || stream.closed) return
        stream.respond({ ':status': controls.status, 'content-type': 'application/json' })
        if (body.control_req) {
          const session = controls.uniqueSessions ? `session-${++sessionIndex}` : 'cover-session'
          lengths.set(session, body.control_req[0].file_len)
          if (isCover) coverSessions.add(session)
          stream.end(JSON.stringify({ ret: 0, data: { session, slice_size: 16384 } }))
          return
        }
        if (failNext || (isCover && controls.failCover)) {
          failNext = false
          controls.failCover = false
          stream.end(JSON.stringify({ ret: 1, msg: 'synthetic upload failure' }))
          return
        }
        const flag = body.end === (lengths.get(body.session) || 128 * 1024) ? 1 : 0
        stream.end(
          JSON.stringify({
            ret: 0,
            data: {
              flag,
              ...(controls.videoCover &&
                body.appid === 'video_qzone' &&
                flag && { biz: { sVid: 'synthetic-video' } })
            }
          })
        )
      }
      if (controls.failAndHold && body.data) {
        if (!controls.failedOne) {
          controls.failedOne = true
          failNext = true
          reply()
        } else pending.push(reply)
      } else if (
        body.control_req
          ? controls.holdInit || (isCover && controls.holdCoverInit)
          : controls.holdChunks || (isCover && controls.holdCoverChunks)
      )
        pending.push(reply)
      else reply()
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const module = { exports: {} }
  compileFunction(bundle.outputFiles[0].text, ['require', 'module', 'exports', '__runtime'])(
    createRequire(import.meta.url),
    module,
    module.exports,
    {
      origin,
      metadata: (_file, signal) => {
        controls.metadataStarted = true
        if (controls.holdMetadata) {
          return new Promise((_resolve, reject) => {
            const abort = () => reject(Object.assign(new Error('上传已取消'), { cancelled: true }))
            if (signal?.aborted) abort()
            else signal?.addEventListener('abort', abort, { once: true })
          })
        }
        return {
          duration: 1000,
          cover: `data:image/jpeg;base64,${Buffer.alloc(16384 + 7, 23).toString('base64')}`
        }
      }
    }
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
    service.processQueue = () => {}
    for (const token of service.cancelTokens.values()) {
      token.cancelled = true
      token.controller?.abort()
    }
    service.getSpeedLimiter().setRate(0)
    clearTimeout(service._writeTimeout)
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
    controls,
    release: () => {
      for (const reply of pending.splice(0)) reply()
    },
    enableQueue: () => {
      service.dbInitialized = true
      delete service.processQueue
      service.db.write = async () => {}
    },
    snapshotDatabase: () => {
      delete service.updateTaskInDB
    },
    refuseNext: () => {
      refuseNext = true
    },
    failNext: () => {
      failNext = true
    },
    async task(id, isVideo = false, size = 128 * 1024) {
      const source = Buffer.alloc(size, isVideo ? 8 : 7)
      const filePath = path.join(directory, `${id}.${isVideo ? 'mp4' : 'jpg'}`)
      await fs.writeFile(filePath, source)
      const task = {
        id,
        filePath,
        filename: path.basename(filePath),
        albumId: 'synthetic-album',
        albumName: 'test album',
        batchId: 1,
        videoDuration: isVideo ? 1000 : null,
        isVideo,
        total: source.length,
        session: id,
        progress: 0,
        uploaded: 0,
        status: 'uploading'
      }
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

test('pause during upload initialization cannot send chunks or mark the task completed afterwards', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.controls.holdInit = true
  const task = await app.task('pause-initialization')
  task.status = 'waiting'
  task.session = null
  app.service.processQueue()
  await waitUntil(() => app.chunks.some((chunk) => chunk.body.control_req))
  await app.service.pauseTask(task.id)
  app.controls.holdInit = false
  app.release()
  await delay(80)
  assert.equal(task.status, 'paused')
  assert.equal(task.session, null)
  assert.equal(app.chunks.filter((chunk) => chunk.body.data).length, 0)
  assert.equal(app.service.uploadingTasks.size, 0)
})

test('pause cancels active HTTP/2 streams instead of accepting late acknowledgements', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.controls.holdChunks = true
  const task = await app.task('pause-active')
  task.md5 = 'already-initialized'
  task.status = 'waiting'
  app.service.processQueue()
  await waitUntil(() => app.chunks.length === 4)
  await app.service.pauseTask(task.id)
  await delay(80)
  assert.ok(app.chunks.every((chunk) => chunk.stream.closed || chunk.stream.destroyed))
  app.controls.holdChunks = false
  app.release()
  await waitUntil(() => !app.service.uploadingTasks.size)
  assert.equal(task.status, 'paused')
  assert.equal(task.uploaded, 0)
  assert.equal(task.progress, 0)
})

test('HTTP failure cannot be accepted as success even when its JSON body contains ret zero', async (t) => {
  const app = await setup(t)
  app.controls.status = 503
  await assert.rejects(app.h2Post(`${app.origin}/status`, { data: 'small chunk' }), /503/)
})

test('video remains below 100% until the cover is saved; cancelling its initialization stays cancelled', async (t) => {
  const app = await setup(t)
  app.controls.videoCover = true
  app.controls.holdInit = true
  const task = await app.task('video-cover-cancel', true)
  task.videoCover = `data:image/jpeg;base64,${Buffer.alloc(32768, 9).toString('base64')}`
  const pending = app.service.performChunkedUpload(task)
  pending.catch(() => {})
  await waitUntil(() => app.chunks.some((chunk) => chunk.body.control_req))
  assert.ok(task.progress < 100, 'video file is not complete while its cover is still pending')
  await app.service.pauseTask(task.id)
  app.controls.holdInit = false
  app.release()
  await assert.rejects(pending, (error) => error.cancelled === true)
  assert.equal(task.status, 'paused')
  assert.equal(app.chunks.filter((chunk) => chunk.body.session === 'cover-session').length, 0)
})

test('rapid pause/resume serializes old and new runs for image/video at unlimited and limited rates', async (t) => {
  for (const isVideo of [false, true])
    for (const rate of [0, 64 * 1024]) {
      await t.test(
        `${isVideo ? 'video' : 'image'} ${rate ? 'limited' : 'unlimited'}`,
        async (t) => {
          const app = await setup(t)
          app.enableQueue()
          app.snapshotDatabase()
          app.controls.uniqueSessions = true
          app.controls.holdChunks = true
          const task = await app.task('rapid-resume', isVideo, 16384 * 5 + 17)
          task.status = 'waiting'
          task.session = null
          await app.service.setSpeedLimit(rate)
          app.service.processQueue()
          await waitUntil(() => app.chunks.some((chunk) => chunk.body.data))
          const original = app.chunks.find((chunk) => chunk.body.data).body.session
          await app.service.pauseTask(task.id)
          await app.service.resumeAll() // Reads DB snapshots while the old run is still unwinding.
          app.controls.holdChunks = false
          app.release()
          await app.service.setSpeedLimit(0)
          await waitUntil(() => task.status === 'completed')
          assert.equal(task.error, null)
          const received = app.chunks.filter(
            (chunk) => chunk.body.data && chunk.body.session !== original
          )
          assert.equal(new Set(received.map((chunk) => chunk.body.session)).size, 1)
          assert.deepEqual(
            Buffer.concat(
              received
                .sort((a, b) => a.body.offset - b.body.offset)
                .map((chunk) => Buffer.from(chunk.body.data, 'base64'))
            ),
            await fs.readFile(task.filePath)
          )
          assert.equal(app.service.getTaskFromDB(task.id).status, 'completed')
          assert.equal(app.service.uploadingTasks.size, 0)
          assert.equal(app.service.cancelTokens.size, 0)
          assert.equal(app.service.getSpeedLimiter().queue.length, 0)
          await delay(1100)
          assert.equal(app.service.getTaskFromDB(task.id).status, 'completed')
        }
      )
    }
})

test('cancelling one HTTP/2 upload leaves other files on the shared connection unaffected', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.service.concurrency = 2
  app.controls.holdChunks = true
  const first = await app.task('cancel-first')
  const second = await app.task('keep-second', true)
  for (const task of [first, second]) {
    task.status = 'waiting'
    task.md5 = 'initialized'
  }
  app.service.processQueue()
  await waitUntil(() => app.chunks.filter((chunk) => chunk.body.data).length === 8)
  const pausedAt = performance.now()
  await app.service.pauseTask(first.id)
  await waitUntil(() => !app.service.uploadingTasks.has(first.id))
  assert.ok(performance.now() - pausedAt < 500)
  assert.ok(
    app.chunks
      .filter((chunk) => chunk.body.session === first.id)
      .every((chunk) => chunk.stream.closed)
  )
  assert.ok(
    app.chunks
      .filter((chunk) => chunk.body.session === second.id)
      .every((chunk) => !chunk.stream.closed)
  )
  app.controls.holdChunks = false
  app.release()
  await waitUntil(() => second.status === 'completed')
  assert.equal(first.status, 'paused')
  assert.equal(first.uploaded, 0)
  assert.equal(second.error, undefined)
})

test('a failed chunk aborts in-flight siblings without waiting for their acknowledgements', async (t) => {
  const app = await setup(t)
  app.controls.failAndHold = true
  const task = await app.task('failed-active-siblings')
  const started = performance.now()
  await assert.rejects(app.service.performChunkedUpload(task), /synthetic upload failure/)
  assert.ok(performance.now() - started < 500)
  await delay(30)
  assert.ok(app.chunks.every((chunk) => chunk.stream.closed || chunk.stream.destroyed))
  assert.ok(task.progress < 100)
})

test('retry rebuilds a fresh session after an HTTP failure and sends all exact bytes', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.controls.uniqueSessions = true
  app.controls.status = 503
  const task = await app.task('retry-status', false, 16384 * 3 + 7)
  task.status = 'waiting'
  task.session = null
  app.service.processQueue()
  await waitUntil(() => task.status === 'error')
  assert.match(task.error, /503/)
  assert.ok(task.progress < 100)
  app.controls.status = 200
  await app.service.retryTask(task.id)
  await waitUntil(() => task.status === 'completed')
  const received = app.chunks.filter((chunk) => chunk.body.data)
  assert.deepEqual(
    Buffer.concat(
      received
        .sort((a, b) => a.body.offset - b.body.offset)
        .map((chunk) => Buffer.from(chunk.body.data, 'base64'))
    ),
    await fs.readFile(task.filePath)
  )
  assert.equal(task.retryCount, 1)
  assert.equal(task.error, null)
})

test('deletion and logout stop active requests before removing local upload state', async (t) => {
  for (const operation of ['deleteTask', 'deleteTasksBySession', 'setCurrentUser']) {
    await t.test(operation, async (t) => {
      const app = await setup(t)
      app.enableQueue()
      app.snapshotDatabase()
      app.controls.holdChunks = true
      const task = await app.task('cancel-lifecycle')
      task.sessionId = 'remove-session'
      task.status = 'waiting'
      task.md5 = 'initialized'
      app.service.processQueue()
      await waitUntil(() => app.chunks.some((chunk) => chunk.body.data))
      if (operation === 'setCurrentUser') await app.service.setCurrentUser(null, null)
      else await app.service[operation](operation === 'deleteTask' ? task.id : task.sessionId)
      await delay(50)
      assert.ok(app.chunks.filter((chunk) => chunk.body.data).every((chunk) => chunk.stream.closed))
      assert.equal(app.service.uploadingTasks.size, 0)
      assert.equal(app.service.cancelTokens.size, 0)
      assert.equal(app.service.activeTasks.has(task.id), false)
      assert.equal(app.service.getTaskFromDB(task.id), null)
      app.controls.holdChunks = false
      app.release()
      await delay(120)
      assert.equal(app.service.getTaskFromDB(task.id), null)
    })
  }
})

test('video and cover share the limit and finish only after both files are acknowledged', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.controls.uniqueSessions = true
  app.controls.videoCover = true
  app.controls.holdCoverChunks = true
  const task = await app.task('full-video-cover', true, 16384 * 3 + 5)
  const cover = Buffer.alloc(16384 + 19, 19)
  task.videoCover = `data:image/jpeg;base64,${cover.toString('base64')}`
  task.status = 'waiting'
  task.session = null
  await app.service.setSpeedLimit(128 * 1024)
  const started = performance.now()
  app.service.processQueue()
  await waitUntil(() => app.chunks.some((chunk) => chunk.isCover && chunk.body.data))
  assert.equal(task.status, 'uploading')
  assert.ok(task.progress < 100)
  app.controls.holdCoverChunks = false
  app.release()
  await waitUntil(() => task.status === 'completed')
  const bodies = app.chunks.filter((chunk) => chunk.body.data)
  const wireBytes = bodies.reduce((sum, chunk) => sum + chunk.wire, 0)
  const elapsed = performance.now() - started
  assert.ok(elapsed >= (wireBytes / (128 * 1024)) * 970)
  assert.equal(task.progress, 100)
  assert.deepEqual(
    Buffer.concat(
      bodies.filter((chunk) => chunk.isCover).map((chunk) => Buffer.from(chunk.body.data, 'base64'))
    ),
    cover
  )
  assert.deepEqual(
    Buffer.concat(
      bodies
        .filter((chunk) => !chunk.isCover)
        .sort((a, b) => a.body.offset - b.body.offset)
        .map((chunk) => Buffer.from(chunk.body.data, 'base64'))
    ),
    await fs.readFile(task.filePath)
  )
  assert.equal(
    (await fs.readdir(os.tmpdir())).some((name) => name.startsWith('full-video-cover_cover_')),
    false
  )
  t.diagnostic(`video + cover: ${wireBytes} wire bytes at 128KB/s in ${Math.round(elapsed)}ms`)
})

test('pause/resume during cover initialization and active cover chunks remains recoverable', async (t) => {
  for (const stage of ['holdCoverInit', 'holdCoverChunks']) {
    await t.test(stage, async (t) => {
      const app = await setup(t)
      app.enableQueue()
      app.snapshotDatabase()
      app.controls.uniqueSessions = true
      app.controls.videoCover = true
      app.controls[stage] = true
      const task = await app.task(`pause-${stage}`, true, 16384 + 5)
      task.videoCover = `data:image/jpeg;base64,${Buffer.alloc(16384 + 3, 17).toString('base64')}`
      task.status = 'waiting'
      task.session = null
      await app.service.setSpeedLimit(128 * 1024)
      app.service.processQueue()
      await waitUntil(() =>
        app.chunks.some(
          (chunk) =>
            chunk.isCover && Boolean(chunk.body.control_req) === (stage === 'holdCoverInit')
        )
      )
      const oldCover = app.chunks.find((chunk) => chunk.isCover).stream
      await app.service.pauseAll()
      assert.equal(task.progress, 0)
      await app.service.resumeAll()
      app.controls[stage] = false
      app.release()
      await app.service.setSpeedLimit(0)
      await waitUntil(() => task.status === 'completed')
      assert.equal(oldCover.closed, true)
      assert.equal(task.error, null)
      assert.equal(app.service.getTaskFromDB(task.id).status, 'completed')
      assert.equal(app.service.getSpeedLimiter().queue.length, 0)
      assert.equal(
        (await fs.readdir(os.tmpdir())).some((name) => name.startsWith(`${task.id}_cover_`)),
        false
      )
    })
  }
})

test('a failed video cover stays retryable and does not count as a completed video', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.controls.uniqueSessions = true
  app.controls.videoCover = true
  app.controls.failCover = true
  const task = await app.task('retry-cover', true, 16384 + 11)
  task.videoCover = `data:image/jpeg;base64,${Buffer.alloc(8192, 11).toString('base64')}`
  task.status = 'waiting'
  task.session = null
  app.service.processQueue()
  await waitUntil(() => task.status === 'error' && !app.service.uploadingTasks.size)
  assert.match(task.error, /视频封面上传失败:.*ret=1/)
  assert.ok(task.progress < 100)
  assert.equal(await app.service.retryAllFailed(task.albumId), 1)
  await waitUntil(() => app.service.getTaskFromDB(task.id).status === 'completed')
  assert.equal(app.service.getTaskFromDB(task.id).retryCount, 1)
  assert.equal(app.service.getTaskFromDB(task.id).error, null)
})

test('MD5 calculation can be interrupted before sending initialization or any media', async (t) => {
  const app = await setup(t)
  const task = await app.task('abort-md5')
  await fs.truncate(task.filePath, 128 * 1024 * 1024)
  const controller = new AbortController()
  const pending = app.calculateFileMD5(task.filePath, controller.signal)
  controller.abort()
  await assert.rejects(pending, { code: 'ABORT_ERR' })
  assert.equal(app.chunks.length, 0)
})

test('pause cancels fallback cover extraction and a legacy task can resume without a stored cover', async (t) => {
  const app = await setup(t)
  app.enableQueue()
  app.controls.uniqueSessions = true
  app.controls.videoCover = true
  app.controls.holdMetadata = true
  const task = await app.task('fallback-cover', true, 16384 + 5)
  task.status = 'waiting'
  task.session = null
  app.service.processQueue()
  await waitUntil(() => app.controls.metadataStarted)
  const started = performance.now()
  await app.service.pauseTask(task.id)
  await waitUntil(() => !app.service.uploadingTasks.size)
  assert.ok(performance.now() - started < 500)
  assert.equal(task.status, 'paused')
  assert.equal(app.chunks.filter((chunk) => chunk.isCover).length, 0)
  app.controls.holdMetadata = false
  await app.service.resumeTask(task.id)
  await waitUntil(() => task.status === 'completed')
  assert.equal(task.error, null)
  assert.equal(task.progress, 100)
  assert.equal(app.chunks.filter((chunk) => chunk.isCover && chunk.body.data).length, 2)
})

test('same-named videos prepare independent cover files even within the same millisecond', async (t) => {
  const app = await setup(t)
  const now = Date.now
  let paths = []
  try {
    Date.now = () => 1794700000000
    paths = await Promise.all([
      app.extractVideoCover(
        `data:image/jpeg;base64,${Buffer.from('first').toString('base64')}`,
        '/one/regression-cover.mp4'
      ),
      app.extractVideoCover(
        `data:image/jpeg;base64,${Buffer.from('second').toString('base64')}`,
        '/two/regression-cover.mp4'
      )
    ])
    assert.notEqual(paths[0], paths[1])
    assert.deepEqual(await Promise.all(paths.map((file) => fs.readFile(file, 'utf8'))), [
      'first',
      'second'
    ])
  } finally {
    Date.now = now
    await Promise.all(paths.map((file) => fs.rm(file, { force: true })))
  }
})
