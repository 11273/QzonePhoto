import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
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
    db: { data: { tasks: [], settings: {}, batches: [] }, write: async () => {} },
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
      res.write(video.subarray(offset, nextOffset))
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
