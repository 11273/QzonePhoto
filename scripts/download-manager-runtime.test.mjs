import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import { Readable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { build } from 'esbuild'
import { RollingDownloadThroughput } from '../src/shared/download-throughput.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const boundaries = {
  electron: 'export const app = {}, dialog = {}, shell = {}',
  '@electron-toolkit/utils': 'export const is = { dev: false }',
  '@main/core/logger': 'export default console',
  '@main/core/window': 'export default { getMainWindow: () => null }',
  '@main/services/service-manager': 'export const ServiceNames = { PHOTO: "photo" }',
  '@main/services/app-telemetry':
    'export const reportHealthEvent = async () => {}; export const telemetryBuckets = {}'
}
const bundled = await build({
  stdin: {
    contents: `export { DownloadService } from '@main/services/main/download';
      export { DownloadEventPusher } from '@main/services/download-event-pusher';
      export { resolveLocalMedia } from '@main/utils/local-media-registry'`,
    resolveDir: projectRoot
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  alias: {
    '@main': path.join(projectRoot, 'src/main'),
    '@shared': path.join(projectRoot, 'src/shared')
  },
  plugins: [
    {
      name: 'download-runtime-boundaries',
      setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path: specifier }) =>
          Object.hasOwn(boundaries, specifier)
            ? { path: specifier, namespace: 'boundary' }
            : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path: specifier }) => ({
          contents: boundaries[specifier],
          loader: 'js'
        }))
      }
    }
  ]
})
const module = { exports: {} }
compileFunction(bundled.outputFiles[0].text, ['require', 'module', 'exports'])(
  createRequire(import.meta.url),
  module,
  module.exports
)
const { DownloadService, DownloadEventPusher, resolveLocalMedia } = module.exports

const createService = async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-download-runtime-'))
  const service = Object.assign(Object.create(DownloadService.prototype), {
    db: { data: { tasks: [], settings: { concurrency: 4 }, batches: [] }, write: async () => {} },
    dbInitialized: true,
    downloadPath: directory,
    activeTasks: new Map(),
    downloadingTasks: new Set(),
    cancelTokens: new Map(),
    downloadThroughput: new RollingDownloadThroughput(),
    taskThroughputs: new Map(),
    concurrency: 4,
    maxActiveTasksInMemory: 1000,
    updateTrigger: () => {}
  })
  t.after(async () => {
    service.processQueue = () => {}
    for (const token of service.cancelTokens.values()) token.cancel('test cleanup')
    await delay(150)
    clearTimeout(service._writeTimeout)
    clearTimeout(service.queueWakeTimer)
    await fs.rm(directory, { recursive: true, force: true })
  })
  return service
}

const makeTask = (service, id, url, type = 'image') => {
  const task = {
    id,
    url,
    name: id,
    filename: `${id}.${type === 'video' ? 'mp4' : 'jpg'}`,
    type,
    directory: service.downloadPath,
    status: 'waiting',
    priority: 2,
    create_time: 100,
    progress: 0,
    downloaded: 0,
    total: 0,
    speed: 0
  }
  service.db.data.tasks.push({ ...task })
  service.activeTasks.set(id, task)
  return task
}

const waitUntil = async (condition, message, timeout = 8000) => {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if (condition()) return
    await delay(20)
  }
  assert.fail(message)
}

const startServer = async (t) => {
  const video = Buffer.alloc(256 * 1024)
  Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex').copy(video)
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  let activeVideos = 0
  let peakVideos = 0
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/missing')) {
      res.writeHead(404).end()
      return
    }
    if (req.url.startsWith('/image')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': image.length })
      setTimeout(() => res.end(image), 35)
      return
    }
    const unknownLength = req.url.includes('unknown')
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      ...(!unknownLength && { 'Content-Length': video.length })
    })
    activeVideos++
    peakVideos = Math.max(peakVideos, activeVideos)
    let offset = 0
    const timer = setInterval(() => {
      if (offset >= video.length) {
        clearInterval(timer)
        res.end()
        return
      }
      const nextOffset = Math.min(offset + 4096, video.length)
      const chunk = video.subarray(offset, nextOffset)
      if (nextOffset === video.length) {
        clearInterval(timer)
        res.end(chunk)
      } else res.write(chunk)
      offset = nextOffset
    }, 40)
    res.on('close', () => {
      clearInterval(timer)
      activeVideos--
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return { url: `http://127.0.0.1:${server.address().port}`, peakVideos: () => peakVideos }
}

const serveDownloadScenario = async (t, handler) => {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.closeAllConnections()
    server.close()
  })
  return `http://127.0.0.1:${server.address().port}`
}

const imageSample = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
const sendImageSample = (res) =>
  res
    .writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': imageSample.length })
    .end(imageSample)

test('download photo key stays on QQ media hosts, not arbitrary or deceptive URLs', async (t) => {
  const service = await createService(t)
  service.serviceManager = new Map([['photo', { qq_photo_key: 'synthetic-photo-key' }]])
  const axios = createRequire(import.meta.url)('axios')
  const adapter = axios.defaults.adapter
  t.after(() => {
    axios.defaults.adapter = adapter
  })
  let cookie
  axios.defaults.adapter = async (config) => {
    cookie = config.headers.get('Cookie')
    return {
      status: 200,
      config,
      headers: { 'content-type': 'image/jpeg', 'content-length': imageSample.length },
      data: Readable.from([imageSample])
    }
  }
  for (const [url, trusted] of [
    ['https://a1.photo.store.qq.com/image', true],
    ['https://a.qpic.cn/image', true],
    ['https://photo.store.qq.com.attacker.test/image', false],
    ['https://evilqq.com/image', false],
    ['https://evilqpic.cn/image', false],
    ['https://qq.com@attacker.test/image', false],
    ['http://photo.store.qq.com/image', true]
  ]) {
    const task = makeTask(service, `cookie-${service.activeTasks.size}`, url)
    task.request_headers = {
      [trusted ? 'Cookie' : 'cookie']: 'uin=synthetic; p_skey=synthetic-secret'
    }
    await service.downloadFile(
      task,
      path.join(service.downloadPath, task.filename),
      axios.CancelToken.source()
    )
    assert.equal(
      cookie || '',
      trusted ? 'uin=synthetic; p_skey=synthetic-secret; qq_photo_key=synthetic-photo-key' : '',
      url
    )
  }
})

test('real HTTP benchmark: automatic multi-image downloads outperform fixed three without exceeding six', async (t) => {
  const payload = await fs.readFile(
    new URL('../website/assets/screenshots/download.png', import.meta.url)
  )
  let requests = 0
  let active = 0
  let peak = 0
  const url = await serveDownloadScenario(t, (_req, res) => {
    requests++
    peak = Math.max(peak, ++active)
    res.on('close', () => active--)
    setTimeout(
      () =>
        res
          .writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': payload.length })
          .end(payload),
      65
    )
  })
  const run = async (automatic) => {
    const service = await createService(t)
    service.concurrency = 3
    service.db.data.settings = { concurrency: 3, concurrencyMode: automatic ? 'auto' : 'manual' }
    for (let i = 0; i < 90; i++) {
      const task = makeTask(service, `${automatic ? 'auto' : 'fixed'}-${i}`, url)
      task.filename = `${task.id}.png`
    }
    requests = 0
    peak = 0
    const started = performance.now()
    service.processQueue()
    await waitUntil(() => service.getTaskStats().completed === 90, 'benchmark did not finish')
    const elapsed = performance.now() - started
    assert.equal(requests, 90, 'each image must use exactly one request')
    assert.equal(service.getTaskStats().error, 0)
    assert.ok(peak <= (automatic ? 6 : 3))
    if (automatic) assert.equal(peak, 6, 'healthy images should actually reach six slots')
    for (const task of service.db.data.tasks) {
      assert.deepEqual(await fs.readFile(path.join(task.directory, task.filename)), payload)
    }
    return elapsed
  }
  const fixed = await run(false)
  const automatic = await run(true)
  t.diagnostic(
    `90 real HTTP image downloads: fixed 3 = ${Math.round(fixed)}ms; automatic = ${Math.round(automatic)}ms`
  )
  assert.ok(
    automatic < fixed * 0.85,
    'automatic mode should materially reduce latency-bound batch time'
  )
})

test('existing manual concurrency remains manual, settings persist, and invalid input cannot stall the queue', async (t) => {
  const service = await createService(t)
  service.db.data.settings = { concurrency: 2 }
  service.loadSettings()
  assert.deepEqual(service.getConcurrencySettings(), { automatic: false, concurrency: 2 })
  await assert.rejects(service.setConcurrency('invalid'), TypeError)
  assert.equal(service.concurrency, 2)
  await service.setAutomaticConcurrency(true)
  assert.equal(service.isAutomaticConcurrency(), true)
  await service.setConcurrency(1)
  service.loadSettings()
  assert.deepEqual(service.getConcurrencySettings(), { automatic: false, concurrency: 1 })
  service.db.data.settings = {}
  service.loadSettings()
  assert.deepEqual(service.getConcurrencySettings(), { automatic: true, concurrency: 3 })
})

test('large video-heavy queues prefetch eligible images without exceeding the memory cap', async (t) => {
  const service = await createService(t)
  service.db.data.settings = { concurrencyMode: 'auto' }
  service.maxActiveTasksInMemory = 8
  for (let i = 0; i < 40; i++) {
    makeTask(service, `memory-${i}`, 'http://127.0.0.1/unused', i < 30 ? 'video' : 'image')
  }
  for (const id of [...service.activeTasks.keys()].slice(3)) service.activeTasks.delete(id)
  service.executeDownload = (task) => {
    service.downloadingTasks.add(task.id)
    task.status = 'downloading'
  }
  await service.processQueue()
  assert.ok(service.activeTasks.size <= 8)
  const running = [...service.activeTasks.values()].filter((task) => task.status === 'downloading')
  assert.equal(running.filter((task) => task.type === 'image').length, 3)
  assert.equal(running.filter((task) => task.type === 'video').length, 3)
})

test('lowering manual concurrency during an automatic batch does not cancel or duplicate transfers', async (t) => {
  const service = await createService(t)
  service.db.data.settings = { concurrencyMode: 'auto' }
  const counts = new Map()
  let enforceManualLimit = false
  const violations = []
  const executeDownload = service.executeDownload
  service.executeDownload = function (task) {
    // Observe admission, not HTTP arrival: requests admitted before the setting
    // changed can reach the server afterwards and must finish without cancelling.
    if (enforceManualLimit && this.downloadingTasks.size >= 1) {
      violations.push(this.downloadingTasks.size + 1)
    }
    return executeDownload.call(this, task)
  }
  const url = await serveDownloadScenario(t, (req, res) => {
    counts.set(req.url, (counts.get(req.url) || 0) + 1)
    setTimeout(() => sendImageSample(res), 60)
  })
  for (let i = 0; i < 60; i++) makeTask(service, `change-${i}`, `${url}/${i}`)
  service.processQueue()
  await waitUntil(
    () => service.getConcurrencyPolicy().limit >= 5,
    'automatic concurrency never ramped'
  )
  await service.setConcurrency(1)
  // Already-started transfers may finish naturally. Only new ones are limited.
  enforceManualLimit = true
  await waitUntil(() => service.getTaskStats().completed === 60, 'manual limit stalled the batch')
  assert.deepEqual(violations, [])
  assert.ok([...counts.values()].every((count) => count === 1))
  assert.equal(service.isAutomaticConcurrency(), false)
})

test('real mixed queue: long videos leave image slots, and video-only downloads stay capped at three', async (t) => {
  const service = await createService(t)
  service.db.data.settings = { concurrencyMode: 'auto' }
  const { url, peakVideos } = await startServer(t)
  for (let i = 0; i < 5; i++) makeTask(service, `mixed-video-${i}`, `${url}/video`, 'video')
  for (let i = 0; i < 18; i++) makeTask(service, `mixed-image-${i}`, `${url}/image`)
  service.processQueue()
  await waitUntil(
    () => service.getTaskStats().completed >= 18,
    'images are blocked behind the videos'
  )
  assert.ok(
    service.db.data.tasks
      .filter((task) => task.type === 'image')
      .every((task) => task.status === 'completed')
  )
  assert.ok(service.getTaskStats().downloading > 0)
  assert.ok(peakVideos() <= 3)
  await waitUntil(() => service.getTaskStats().completed === 23, 'mixed queue did not finish')
  assert.ok(peakVideos() <= 3)
})

test('real 429: the queue honors Retry-After, reduces pressure, and retries the affected image once', async (t) => {
  const service = await createService(t)
  service.db.data.settings = { concurrencyMode: 'auto' }
  const starts = []
  const counts = new Map()
  let limitedAt = 0
  const url = await serveDownloadScenario(t, (req, res) => {
    starts.push(Date.now())
    counts.set(req.url, (counts.get(req.url) || 0) + 1)
    if (req.url === '/0' && counts.get(req.url) === 1) {
      limitedAt = Date.now()
      res.writeHead(429, { 'Retry-After': '1' }).end()
    } else setTimeout(() => sendImageSample(res), 25)
  })
  for (let i = 0; i < 9; i++) makeTask(service, `rate-${i}`, `${url}/${i}`)
  service.processQueue()
  await waitUntil(
    () => service.getTaskStats().completed === 9,
    'rate-limited queue did not recover'
  )
  assert.equal(counts.get('/0'), 2)
  assert.equal(starts.length, 10)
  assert.ok(
    starts.slice(3).every((time) => time >= limitedAt + 950),
    'new requests bypassed backoff'
  )
  assert.equal(service.getTaskStats().error, 0)
})

test('persistent 503 is bounded to two retries; 403 and 404 are never blindly retried', async (t) => {
  const service = await createService(t)
  const counts = new Map()
  const url = await serveDownloadScenario(t, (req, res) => {
    counts.set(req.url, (counts.get(req.url) || 0) + 1)
    res.writeHead(Number(req.url.slice(1))).end()
  })
  for (const status of [503, 403, 404]) makeTask(service, `status-${status}`, `${url}/${status}`)
  service.processQueue()
  await waitUntil(() => service.getTaskStats().error === 3, 'permanent errors did not settle')
  assert.equal(counts.get('/503'), 3)
  assert.equal(counts.get('/403'), 1)
  assert.equal(counts.get('/404'), 1)
  assert.equal(service.getTaskStats().waiting, 0)
})

test('real disconnect: partial files are discarded and fallback waits for backoff before saving intact bytes', async (t) => {
  const service = await createService(t)
  let failedAt = 0
  let recoveredAt = 0
  const url = await serveDownloadScenario(t, (req, res) => {
    if (req.url === '/reset') {
      failedAt = Date.now()
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': 5000 })
      res.write(imageSample)
      setTimeout(() => res.destroy(), 15)
    } else {
      recoveredAt = Date.now()
      sendImageSample(res)
    }
  })
  const task = makeTask(service, 'disconnect', `${url}/reset`)
  task.download_candidates = [{ url: `${url}/reset` }, { url: `${url}/good` }]
  service.processQueue()
  await waitUntil(() => task.status === 'completed', 'disconnected image did not recover')
  assert.ok(recoveredAt >= failedAt + 950)
  assert.equal(task.download_candidate_index, 1)
  assert.deepEqual(await fs.readFile(path.join(task.directory, task.filename)), imageSample)
})

test('a response that never starts times out and recovers, while an active long stream is not cut off', async (t) => {
  const service = await createService(t)
  service.imageRequestTimeout = 120
  let calls = 0
  const payload = Buffer.concat([imageSample, Buffer.alloc(4096)])
  const url = await serveDownloadScenario(t, (_req, res) => {
    if (++calls === 1) return
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': payload.length })
    let offset = 0
    const timer = setInterval(() => {
      if (offset >= payload.length) {
        clearInterval(timer)
        res.end()
      } else {
        res.write(payload.subarray(offset, offset + 512))
        offset += 512
      }
    }, 30)
    res.on('close', () => clearInterval(timer))
  })
  const task = makeTask(service, 'timeout', url)
  service.processQueue()
  await waitUntil(() => task.status === 'completed', 'timed-out request did not recover')
  assert.equal(calls, 2)
  assert.deepEqual(await fs.readFile(path.join(task.directory, task.filename)), payload)
})

test('pausing or clearing during backoff cannot restart a task behind the user’s back', async (t) => {
  for (const operation of ['pause', 'clear']) {
    const service = await createService(t)
    let calls = 0
    const url = await serveDownloadScenario(t, (_req, res) => {
      calls++
      res.writeHead(429, { 'Retry-After': '1' }).end()
    })
    const task = makeTask(service, `stop-${operation}`, url)
    service.processQueue()
    await waitUntil(() => service.transientRetries?.get(task.id) === 1, 'retry was not scheduled')
    if (operation === 'pause') await service.pauseTask(task.id)
    else await service.clearTasks()
    await delay(1200)
    assert.equal(calls, 1)
    assert.equal(service.downloadingTasks.size, 0)
    if (operation === 'pause') assert.equal(task.status, 'paused')
    else assert.equal(service.db.data.tasks.length, 0)
  }
})

test('real stream: a long video remains first while three slots cycle short images; progress is monotonic', async (t) => {
  const service = await createService(t)
  const { url } = await startServer(t)
  const video = makeTask(service, 'video', `${url}/video`, 'video')
  for (let i = 0; i < 24; i++) makeTask(service, `image-${i}`, `${url}/image/${i}`)
  makeTask(service, 'missing', `${url}/missing`)
  const pusher = new DownloadEventPusher()
  pusher.downloadService = service
  const events = []
  const mainWindow = {
    webContents: { send: (_channel, tasks) => events.push(JSON.parse(JSON.stringify(tasks))) }
  }
  const progress = []
  const speeds = []
  service.setUpdateTrigger((ids) => {
    for (const id of ids) pusher.changedTaskIds.add(id)
    pusher._pushChangedTasks(mainWindow)
  })
  const polling = setInterval(() => {
    if (video.status === 'downloading') {
      assert.equal(service.getTasks(1, 10).tasks[0].id, video.id)
      progress.push(video.progress)
      speeds.push(service.getTaskStats().currentSpeed)
      assert.ok(video.progress < 100)
    }
  }, 50)
  t.after(() => clearInterval(polling))
  service.processQueue()
  await waitUntil(
    () => service.getTaskStats().completed === 25 && service.getTaskStats().error === 1,
    'queue did not settle'
  )
  clearInterval(polling)
  await delay(100)
  assert.ok(progress.length > 20)
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]))
  assert.ok(speeds.some((speed) => speed > 0))
  assert.equal(video.progress, 100)
  assert.equal(service.getTaskStats().currentSpeed, 0)
  const completedUpdates = events.flat().filter((task) => task.status === 'completed')
  assert.ok(completedUpdates.length >= 25)
  assert.ok(
    events.flat().every((task) => !task.deleted),
    'completed tasks must not be reported as deleted'
  )
  assert.equal(service.taskThroughputs.size, 0)
})

test('real cancellation: pause/resume immediately does not cancel the task or duplicate the video stream', async (t) => {
  const service = await createService(t)
  const server = await startServer(t)
  const task = makeTask(service, 'pause-video', `${server.url}/video`, 'video')
  service.processQueue()
  await waitUntil(() => task.downloaded > 16384, 'video did not start')
  await service.pauseTask(task.id)
  assert.equal(task.status, 'paused')
  await service.resumeTask(task.id)
  await waitUntil(() => task.status === 'completed', 'resumed video did not complete')
  assert.equal(server.peakVideos(), 1)
  assert.equal(service.getTaskFromDB(task.id).status, 'completed')
})

test('a finished short file refills its slot on the next event-loop turn, without a fixed batch delay', async (t) => {
  const service = await createService(t)
  const { url } = await startServer(t)
  const task = makeTask(service, 'refill', `${url}/image`)
  service.processQueue = () => {}
  let completedAt = 0
  let refilledAt = 0
  service.setUpdateTrigger(() => {
    if (task.status === 'completed') completedAt = performance.now()
  })
  service.processQueue = () => {
    refilledAt = performance.now()
  }
  await service.executeDownload(task)
  await new Promise(setImmediate)
  assert.ok(refilledAt >= completedAt && refilledAt - completedAt < 80)
})

test('video tasks without a cover never use the full video as their thumbnail', async (t) => {
  const service = await createService(t)
  const options = { url: 'https://example.invalid/movie.mp4', filename: 'movie.mp4', type: 'video' }
  assert.equal(service.createTask(options).thumbnail_url, '')
  assert.equal(
    service.createTask({ ...options, thumbnailUrl: 'https://example.invalid/cover.jpg' })
      .thumbnail_url,
    'https://example.invalid/cover.jpg'
  )
  assert.equal(service.createTask({ ...options, type: 'image' }).thumbnail_url, options.url)
})

test('completed image/video preview uses task-owned short-lived tokens and rejects incomplete or invalid files', async (t) => {
  const service = await createService(t)
  const image = makeTask(service, 'local-image', 'https://expired.invalid/photo.jpg')
  image.status = 'completed'
  const imagePath = path.join(image.directory, image.filename)
  await fs.writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
  service.db.data.tasks[0] = { ...image }
  const preview = await service.getTaskPreview(image.id)
  assert.match(preview.src, /^qzone-local:\/\/local\/[a-f0-9-]+$/)
  assert.equal(preview.src.includes(service.downloadPath), false)
  assert.equal(resolveLocalMedia(new URL(preview.src).pathname.slice(1)), imagePath)
  assert.equal(await service.getTaskPreview('missing'), null)
  service.db.data.tasks[0].status = 'downloading'
  assert.equal(await service.getTaskPreview(image.id), null)
  service.db.data.tasks[0].status = 'completed'
  service.db.data.tasks[0].filename = '../escape.jpg'
  assert.equal(await service.getTaskPreview(image.id), null)
  service.db.data.tasks[0].filename = image.filename
  await fs.writeFile(imagePath, '<html>not an image</html>')
  assert.equal(await service.getTaskPreview(image.id), null)
  await fs.unlink(imagePath)
  assert.equal(await service.getTaskPreview(image.id), null)
  const video = makeTask(service, 'local-video', 'https://expired.invalid/movie.mp4', 'video')
  video.status = 'completed'
  await fs.writeFile(
    path.join(video.directory, video.filename),
    Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex')
  )
  service.db.data.tasks[1] = { ...video }
  assert.match((await service.getTaskPreview(video.id)).src, /^qzone-local:/)
  service.db.data.tasks[1].type = 'contact-backup'
  assert.equal(await service.getTaskPreview(video.id), null)
})

test('unknown content length remains indeterminate until the saved file is verified', async (t) => {
  const service = await createService(t)
  const { url } = await startServer(t)
  const task = makeTask(service, 'unknown-video', `${url}/unknown`, 'video')
  task.total = 1024 // A stale API size must not cause early 100% or a backward jump.
  service.processQueue()
  await waitUntil(() => task.downloaded > 16384, 'unknown-length video did not start')
  assert.equal(task.total, 0)
  assert.equal(task.progress, 0)
  await waitUntil(() => task.status === 'completed', 'unknown-length video did not complete')
  assert.equal(task.progress, 100)
  assert.equal(task.total, 256 * 1024)
})

test('pausing before the HTTP request and bulk resume preserve the paused state and queue slots', async (t) => {
  const service = await createService(t)
  const server = await startServer(t)
  const task = makeTask(service, 'early-pause', `${server.url}/video`, 'video')
  service.processQueue()
  await service.cancelAll()
  assert.equal(task.status, 'paused')
  assert.equal(service.getTaskStats().currentSpeed, 0)
  await service.resumeAll()
  await waitUntil(
    () => service.getTaskFromDB(task.id).status === 'completed',
    'bulk resume did not restart the paused task'
  )
  assert.equal(server.peakVideos(), 1)
})

test('page reads overlay the latest live bytes instead of regressing to a persisted snapshot', async (t) => {
  const service = await createService(t)
  const task = makeTask(service, 'live-progress', 'https://example.invalid/video', 'video')
  task.status = 'downloading'
  task.progress = 78
  task.downloaded = 78000
  const page = service.getTasks(1, 10)
  assert.equal(page.tasks[0].progress, 78)
  assert.equal(page.tasks[0].downloaded, 78000)
  assert.equal(service.db.data.tasks[0].progress, 0)
})

test('pusher distinguishes a completed DB task from a genuinely deleted task, including clear-all tombstones', async () => {
  const pusher = new DownloadEventPusher()
  const completed = { id: 'complete', status: 'completed', progress: 100 }
  pusher.downloadService = {
    activeTasks: new Map(),
    getTaskFromDB: (id) => (id === completed.id ? completed : null)
  }
  const sent = []
  pusher.changedTaskIds = new Set(['complete', 'removed'])
  pusher._pushChangedTasks({ webContents: { send: (_channel, tasks) => sent.push(tasks) } })
  await delay(30)
  assert.deepEqual(sent.flat(), [completed, { id: 'removed', deleted: true }])
  pusher.throttledTriggerImmediatePush = () => {}
  pusher.markTasksChanged([{ id: 'cleared', deleted: true }])
  assert.deepEqual([...pusher.changedTaskIds], ['cleared'])
})
