import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import { Readable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { build } from 'esbuild'
import ffmpegStatic from 'ffmpeg-static'
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
    service.speedLimiter?.setRate(0)
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

const runFfmpeg = promisify(execFile)
const createHlsScenario = async (
  t,
  { format = 'mpegts', encrypted = false, singleFile = false } = {}
) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-hls-source-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const extra = []
  if (encrypted) {
    await fs.writeFile(path.join(directory, 'secret.key'), Buffer.alloc(16, 7))
    await fs.writeFile(path.join(directory, 'key.info'), `secret.key\n${directory}/secret.key\n`)
    extra.push('-hls_key_info_file', path.join(directory, 'key.info'))
  }
  if (singleFile) extra.push('-hls_flags', 'single_file')
  await runFfmpeg(ffmpegStatic, [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=96x64:rate=10',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=44100',
    '-t',
    '2.4',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-threads',
    '1',
    '-g',
    '10',
    '-c:a',
    'aac',
    '-f',
    'hls',
    '-hls_time',
    '1',
    '-hls_list_size',
    '0',
    '-hls_segment_type',
    format,
    ...extra,
    path.join(directory, 'index.m3u8')
  ])
  await fs.writeFile(
    path.join(directory, 'master.m3u8'),
    '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=128000\nindex.m3u8?variant=1\n'
  )
  const requests = []
  const state = {
    missing: '',
    invalid: '',
    truncated: '',
    failures: {},
    redirect: false,
    alternateSegment: ''
  }
  const url = await serveDownloadScenario(t, async (req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost')
    const name = path.basename(requestUrl.pathname)
    requests.push({ name, range: req.headers.range, cookie: req.headers.cookie })
    if (state.redirect && name === 'redirect.m3u8') {
      res.writeHead(302, { Location: '/nested/index.m3u8' }).end()
      return
    }
    if (state.missing === name || state.failures[name] > 0) {
      if (state.failures[name]) state.failures[name]--
      res.writeHead(404).end()
      return
    }
    if (state.invalid === name) {
      res
        .writeHead(200, { 'Content-Type': 'application/octet-stream' })
        .end('not a valid video segment')
      return
    }
    let payload
    try {
      payload = await fs.readFile(path.join(directory, name))
    } catch {
      res.writeHead(404).end()
      return
    }
    if (state.alternateSegment && name === 'index.m3u8') {
      payload = Buffer.from(payload.toString().replace(/index0\.ts/, state.alternateSegment))
    }
    const type = name.endsWith('.m3u8') ? 'application/x-mpeg' : 'application/octet-stream'
    if (state.truncated === name) {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': payload.length })
      res.write(payload.subarray(0, 64))
      setTimeout(() => res.destroy(), 20)
      return
    }
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '')
    if (range && !name.endsWith('.m3u8')) {
      const start = Number(range[1])
      const end = range[2] ? Math.min(Number(range[2]), payload.length - 1) : payload.length - 1
      res
        .writeHead(206, {
          'Content-Type': type,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${payload.length}`,
          'Accept-Ranges': 'bytes'
        })
        .end(payload.subarray(start, end + 1))
    } else
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': payload.length }).end(payload)
  })
  return { url, requests, directory, state }
}

const decodedFrames = async (filename) => {
  const { stdout } = await runFfmpeg(ffmpegStatic, [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    ...(filename.endsWith('.m3u8') ? ['-allowed_extensions', 'ALL'] : []), // Own generated fixture key.
    '-i',
    filename,
    '-map',
    '0:v:0',
    '-f',
    'framemd5',
    '-'
  ])
  return stdout
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(',').at(-1).trim())
}

test('real HLS: TS, master, AES-128 and fMP4 byte ranges save complete playable MP4 files', async (t) => {
  for (const options of [
    { name: 'ts' },
    { name: 'master', master: true },
    { name: 'aes', encrypted: true },
    { name: 'fmp4', format: 'fmp4', singleFile: true }
  ]) {
    await t.test(options.name, async (t) => {
      const service = await createService(t)
      const source = await createHlsScenario(t, options)
      const task = makeTask(
        service,
        options.name,
        `${source.url}/${options.master ? 'master' : 'index'}.m3u8`,
        'video'
      )
      task.total = 2048 // The response is a tiny playlist, never the completed video.
      await service.executeDownload(task)
      assert.equal(task.status, 'completed', task.error)
      assert.equal(task.progress, 100)
      const output = path.join(service.downloadPath, task.filename)
      const bytes = await fs.readFile(output)
      assert.equal(bytes.subarray(4, 8).toString(), 'ftyp')
      assert.ok(bytes.length > 10000)
      assert.equal(task.total, bytes.length)
      assert.deepEqual(
        await decodedFrames(output),
        await decodedFrames(path.join(source.directory, 'index.m3u8'))
      )
      await runFfmpeg(ffmpegStatic, [
        '-v',
        'error',
        '-i',
        output,
        '-map',
        '0:a:0',
        '-f',
        'null',
        '-'
      ])
      assert.ok(source.requests.some((request) => request.name === 'index.m3u8'))
      if (options.encrypted)
        assert.ok(source.requests.some((request) => request.name === 'secret.key'))
      if (options.singleFile) assert.ok(source.requests.some((request) => request.range))
      assert.equal(
        (await fs.readdir(service.downloadPath)).some((name) => name.startsWith('.qzonephoto-')),
        false
      )
    })
  }
})

test('real HLS: missing segments fail without a partial MP4, and retry after recovery succeeds', async (t) => {
  const service = await createService(t)
  const source = await createHlsScenario(t)
  source.state.missing = 'index2.ts'
  const task = makeTask(service, 'missing-segment', `${source.url}/index.m3u8`, 'video')
  const output = path.join(service.downloadPath, task.filename)
  await service.executeDownload(task)
  assert.equal(task.status, 'error')
  assert.match(task.error, /404/)
  assert.deepEqual(await fs.readdir(service.downloadPath), [])
  source.state.missing = ''
  task.status = 'waiting'
  await service.executeDownload(task)
  assert.equal(task.status, 'completed', task.error)
  assert.equal((await decodedFrames(output)).length, 24)
})

test('real HLS: malformed or interrupted segments cannot silently produce a shortened successful video', async (t) => {
  for (const failure of ['invalid', 'truncated']) {
    await t.test(failure, async (t) => {
      const service = await createService(t)
      const source = await createHlsScenario(t)
      source.state[failure] = 'index1.ts'
      const task = makeTask(service, failure, `${source.url}/index.m3u8`, 'video')
      await service.executeDownload(task)
      assert.equal(task.status, 'error')
      assert.deepEqual(await fs.readdir(service.downloadPath), [])
    })
  }
})

test('real HLS: transient CDN 404 responses retry both playlists and segments without losing frames', async (t) => {
  const service = await createService(t)
  const source = await createHlsScenario(t)
  source.state.failures = { 'index.m3u8': 1, 'index1.ts': 2 }
  const task = makeTask(service, 'transient-hls', `${source.url}/index.m3u8`, 'video')
  await service.executeDownload(task)
  assert.equal(task.status, 'completed', task.error)
  assert.equal((await decodedFrames(path.join(service.downloadPath, task.filename))).length, 24)
  assert.equal(source.requests.filter((request) => request.name === 'index.m3u8').length, 2)
  assert.ok(source.requests.filter((request) => request.name === 'index1.ts').length >= 3)
})

test('real HLS: pause interrupts a long Retry-After before the first playlist is received', async (t) => {
  const service = await createService(t)
  let calls = 0
  const url = await serveDownloadScenario(t, (_req, res) => {
    calls++
    res.writeHead(429, { 'Retry-After': '30' }).end()
  })
  const task = makeTask(service, 'hls-backoff-pause', `${url}/index.m3u8`, 'video')
  service.processQueue()
  await waitUntil(() => calls === 1, 'playlist request was not sent')
  await delay(30)
  await service.pauseTask(task.id)
  await waitUntil(
    () => service.downloadingTasks.size === 0,
    'paused task retained a queue slot',
    1000
  )
  assert.equal(task.status, 'paused')
  assert.equal(calls, 1)
  assert.deepEqual(await fs.readdir(service.downloadPath), [])
})

test('video-library batch keeps its HLS source without querying a nonexistent photo album', async (t) => {
  const service = await createService(t)
  const source = await createHlsScenario(t)
  service.getVideoDetailInfo = () => assert.fail('video-library records have no photo album/picKey')
  const ids = await service.processBatch(
    [
      {
        id: 'library-video',
        name: 'library-video',
        is_video: true,
        sourceKey: 'video',
        url: `${source.url}/index.m3u8`,
        raw: `${source.url}/index.m3u8`
      }
    ],
    service.downloadPath,
    { id: 'video', name: '我的视频', sourceKey: 'video' },
    { uin: 'o12345', p_skey: 'synthetic-private-key' },
    {},
    { id: 'library-batch', autoStart: false }
  )
  assert.equal(ids.length, 1)
  const task = service.activeTasks.get(ids[0])
  assert.equal(task.status, 'paused')
  assert.equal(task.url, `${source.url}/index.m3u8`)
  await service.resumeTask(task.id)
  await waitUntil(() => task.status === 'completed', 'video-library batch did not save a video')
  assert.equal((await decodedFrames(path.join(service.downloadPath, task.filename))).length, 24)
})

test('real HLS: relative redirects and untrusted segment hosts preserve credential boundaries', async (t) => {
  const service = await createService(t)
  const source = await createHlsScenario(t)
  source.state.redirect = true
  // localhost is a distinct media host; credentials must be rechecked for each resource.
  source.state.alternateSegment = `${source.url.replace('127.0.0.1', 'localhost')}/index0.ts`
  const task = makeTask(service, 'redirect-hls', `${source.url}/redirect.m3u8`, 'video')
  task.request_headers = {
    Cookie: 'p_skey=synthetic-private-cookie',
    Referer: 'https://user.qzone.qq.com/'
  }
  await service.executeDownload(task)
  assert.equal(task.status, 'completed', task.error)
  assert.ok(source.requests.some((request) => request.name === 'index0.ts'))
  assert.ok(source.requests.every((request) => !request.cookie))
})

test('real HLS: aggregate limit, immediate pause/resume and restoring unlimited preserve the queue', async (t) => {
  const service = await createService(t)
  const source = await createHlsScenario(t)
  await service.setSpeedLimit(16 * 1024)
  const tasks = [0, 1].map((id) =>
    makeTask(service, `limited-hls-${id}`, `${source.url}/index.m3u8`, 'video')
  )
  service.processQueue()
  await waitUntil(() => tasks.every((task) => task.downloaded > 8192), 'limited HLS did not stream')
  assert.ok(
    tasks.every((task) => task.status === 'downloading' && task.progress < 100 && task.total === 0)
  )
  const bytes = tasks.reduce((sum, task) => sum + task.downloaded, 0)
  assert.ok(bytes < 50000, `unexpected limit burst: ${bytes}`)
  await service.pauseTask(tasks[0].id)
  await service.resumeTask(tasks[0].id)
  await service.setSpeedLimit(0)
  await waitUntil(
    () => tasks.every((task) => task.status === 'completed'),
    tasks.map((task) => task.error).join('; '),
    12000
  )
  assert.equal(service.getSpeedLimiter().queue.length, 0)
  assert.equal(service.getSpeedLimiter().timer, null)
  assert.equal(service.downloadingTasks.size, 0)
  assert.equal(service.cancelTokens.size, 0)
  for (const task of tasks)
    assert.equal((await decodedFrames(path.join(service.downloadPath, task.filename))).length, 24)
  assert.equal((await fs.readdir(service.downloadPath)).length, 2)
})

test('real HLS: local-file references are rejected rather than read by FFmpeg', async (t) => {
  const service = await createService(t)
  const source = await createHlsScenario(t)
  source.state.alternateSegment = `file://${source.directory}/secret.key`
  const task = makeTask(service, 'local-reference', `${source.url}/index.m3u8`, 'video')
  await service.executeDownload(task)
  assert.equal(task.status, 'error')
  assert.match(task.error, /不支持的分段地址/)
  assert.deepEqual(await fs.readdir(service.downloadPath), [])
})

test('real HTTP aggregate limit covers concurrent files and restores identical unlimited bytes', async (t) => {
  const payload = Buffer.alloc(128 * 1024, 7)
  const url = await serveDownloadScenario(t, (_req, res) => {
    res
      .writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': payload.length })
      .end(payload)
  })
  const service = await createService(t)
  await service.setSpeedLimit(128 * 1024)
  const started = performance.now()
  await Promise.all(
    [0, 1].map(async (i) => {
      const task = makeTask(service, `limited-${i}`, url)
      const file = path.join(service.downloadPath, task.filename)
      const result = await service.downloadFile(task, file, { token: undefined })
      assert.ok(result.rateLimitWaitMs > 0)
      assert.deepEqual(await fs.readFile(file), payload)
    })
  )
  const elapsed = performance.now() - started
  t.diagnostic(`2 × 128KB HTTP downloads at total 128KB/s: ${Math.round(elapsed)}ms`)
  assert.ok(elapsed >= 1950 && elapsed < 4500, `aggregate limit failed: ${elapsed}ms`)
  await service.setSpeedLimit(0)
  const task = makeTask(service, 'unlimited-after-limit', url)
  const result = await service.downloadFile(task, path.join(service.downloadPath, task.filename), {
    token: undefined
  })
  assert.equal(result.rateLimitWaitMs, 0)
})

test('real HTTP low limits do not trigger the image idle timeout; cancellation and dynamic changes stay prompt', async (t) => {
  const payload = Buffer.alloc(64 * 1024, 8)
  const url = await serveDownloadScenario(t, (_req, res) => {
    res
      .writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': payload.length })
      .end(payload)
  })
  const service = await createService(t)
  service.imageRequestTimeout = 100
  await service.setSpeedLimit(32 * 1024)
  const task = makeTask(service, 'low-rate', url)
  await service.downloadFile(task, path.join(service.downloadPath, task.filename), {
    token: undefined
  })
  assert.deepEqual(await fs.readFile(path.join(service.downloadPath, task.filename)), payload)

  const axios = createRequire(import.meta.url)('axios')
  await service.setSpeedLimit(1024)
  const token = axios.CancelToken.source()
  const cancelledTask = makeTask(service, 'cancel-limited', url)
  const file = path.join(service.downloadPath, cancelledTask.filename)
  const transfer = service.downloadFile(cancelledTask, file, token)
  await waitUntil(() => service.getSpeedLimiter().queue.length > 0, 'limiter did not wait')
  const rejected = assert.rejects(transfer, (error) => axios.isCancel(error))
  token.cancel('test pause')
  await rejected
  assert.equal(service.getSpeedLimiter().queue.length, 0)
  await assert.rejects(fs.access(file))

  const dynamic = makeTask(service, 'dynamic-limit', url)
  const dynamicFile = path.join(service.downloadPath, dynamic.filename)
  const pending = service.downloadFile(dynamic, dynamicFile, axios.CancelToken.source())
  await waitUntil(() => service.getSpeedLimiter().queue.length > 0, 'dynamic limiter did not wait')
  const started = performance.now()
  await service.setSpeedLimit(0)
  await pending
  assert.ok(performance.now() - started < 1000)
  assert.deepEqual(await fs.readFile(dynamicFile), payload)
})

test('download limits persist, validate before saving and leave the old value on storage failure', async (t) => {
  const service = await createService(t)
  assert.equal(service.getSpeedLimit(), 0)
  await service.setSpeedLimit(524288)
  assert.equal(service.db.data.settings.speedLimitBps, 524288)
  service.speedLimiter = undefined
  service.loadSettings()
  assert.equal(service.getSpeedLimit(), 524288)
  await assert.rejects(service.setSpeedLimit(-1), TypeError)
  service.db.write = async () => {
    throw new Error('disk full')
  }
  await assert.rejects(service.setSpeedLimit(0), /disk full/)
  assert.equal(service.getSpeedLimit(), 524288)
  assert.equal(service.db.data.settings.speedLimitBps, 524288)
})

test('real HTTP unlimited streaming has no artificial wait and stays near the original direct-pipe path', async (t) => {
  const payload = Buffer.alloc(4 * 1024 ** 2, 3)
  const url = await serveDownloadScenario(t, (_req, res) => {
    res
      .writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': payload.length })
      .end(payload)
  })
  const service = await createService(t)
  const axios = createRequire(import.meta.url)('axios')
  const direct = []
  const current = []
  for (let i = 0; i < 3; i++) {
    let started = performance.now()
    const response = await axios({ url, responseType: 'stream' })
    await pipeline(
      response.data,
      createWriteStream(path.join(service.downloadPath, `direct-${i}.bin`))
    )
    direct.push(performance.now() - started)
    const task = makeTask(service, `fast-${i}`, url)
    started = performance.now()
    const result = await service.downloadFile(
      task,
      path.join(service.downloadPath, task.filename),
      { token: undefined }
    )
    current.push(performance.now() - started)
    assert.equal(result.rateLimitWaitMs, 0)
    assert.deepEqual(await fs.readFile(path.join(service.downloadPath, task.filename)), payload)
  }
  const median = (values) => [...values].sort((a, b) => a - b)[1]
  t.diagnostic(
    `4MB loopback median: original direct pipe ${median(direct).toFixed(1)}ms; unlimited limiter ${median(current).toFixed(1)}ms`
  )
  assert.ok(
    median(current) <= median(direct) * 2 + 100,
    'unlimited must not introduce a fixed delay'
  )
  assert.equal(service.getSpeedLimiter().timer, null)
  assert.equal(service.getSpeedLimiter().queue.length, 0)
})

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
