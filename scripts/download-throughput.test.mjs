import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { RollingDownloadThroughput } from '../src/shared/download-throughput.mjs'
import { didDownloadTaskCountsChange } from '../src/shared/download-batch-stats.mjs'

test('short files count towards batch speed after each task finishes', () => {
  const meter = new RollingDownloadThroughput()
  meter.record(6000, 1000)
  meter.record(4000, 1250)
  assert.equal(meter.getBytesPerSecond(1250), 10000)
  assert.equal(meter.getBytesPerSecond(2000), 10000)
  assert.equal(meter.getBytesPerSecond(3000), 5000)
  assert.equal(meter.getBytesPerSecond(5300), 0)
})

test('old bytes expire, invalid values are ignored, and speed resets', () => {
  const meter = new RollingDownloadThroughput(2000)
  meter.record(1000, 1000)
  meter.record(3000, 3000)
  meter.record(0, 3000)
  meter.record(-5, 3000)
  meter.record(NaN, 3000)
  assert.equal(meter.getBytesPerSecond(3001), 1500)
  meter.reset()
  assert.equal(meter.getBytesPerSecond(3001), 0)
})

test('dense streams reuse time buckets instead of storing every chunk', () => {
  const meter = new RollingDownloadThroughput()
  for (let i = 0; i < 10000; i += 1) meter.record(128, 1000 + (i % 200))
  assert.equal(meter.samples.length, 1)
  assert.ok(meter.getBytesPerSecond(1200) > 0)
})

test('speed is sampled once per second and remains steady across chunk/image bursts', () => {
  const meter = new RollingDownloadThroughput()
  const speeds = []
  for (let time = 1000; time <= 12000; time += 50) {
    if (time % 250 === 0) meter.record(16000, time)
    const speed = meter.getBytesPerSecond(time)
    speeds.push(speed)
    if (time % 1000 !== 0) assert.equal(speed, speeds.at(-2))
    if (time >= 5000) assert.ok(speed >= 64000 && speed <= 68000, String(speed))
  }
  assert.equal(meter.getBytesPerSecond(16100), 0, 'a stalled stream must not retain stale speed')
  meter.record(2000, 17000)
  assert.equal(meter.getBytesPerSecond(17000), 2000, 'a new burst must not include idle time')
})

test('backend samples received bytes and publishes live speed for the UI', async () => {
  const [service, pusher, ui] = await Promise.all([
    readFile(new URL('../src/main/services/main/download.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/main/services/download-event-pusher.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../src/renderer/src/components/DownloadManager/index.vue', import.meta.url),
      'utf8'
    )
  ])
  assert.match(service, /this\.downloadThroughput\.record\(chunk\.length, now\)/)
  assert.match(service, /currentSpeed: this\.downloadThroughput\.getBytesPerSecond\(\)/)
  assert.match(pusher, /stats\.currentSpeed \|\| 0/)
  assert.match(ui, /taskStats\.value\.currentSpeed \?\?/)
})

test('clear all tasks discards stale throughput samples', async () => {
  const service = await readFile(
    new URL('../src/main/services/main/download.js', import.meta.url),
    'utf8'
  )
  const clearTasks = service.split('async clearTasks() {')[1]?.split('// 选择下载目录')[0]
  assert.ok(clearTasks, 'clearTasks implementation must exist')
  assert.match(clearTasks, /this\.downloadThroughput\.reset\(\)/)
})

test('speed-only statistics do not trigger batch-summary reloads', () => {
  const before = {
    total: 511,
    waiting: 15,
    downloading: 3,
    completed: 493,
    error: 0,
    paused: 0,
    cancelled: 0,
    currentSpeed: 0
  }
  assert.equal(didDownloadTaskCountsChange(before, { ...before, currentSpeed: 7200 }), false)
  assert.equal(didDownloadTaskCountsChange(before, { ...before, currentSpeed: 0 }), false)
  assert.equal(didDownloadTaskCountsChange(before, { ...before, completed: 494 }), true)
  assert.equal(didDownloadTaskCountsChange(before, { ...before, waiting: 14 }), true)
  assert.equal(didDownloadTaskCountsChange(before, { ...before, total: 512 }), true)
  assert.equal(didDownloadTaskCountsChange(null, before), true)
  assert.equal(didDownloadTaskCountsChange(before, null), false)
})

test('download manager separates speed updates from bounded batch reload scheduling', async () => {
  const ui = await readFile(
    new URL('../src/renderer/src/components/DownloadManager/index.vue', import.meta.url),
    'utf8'
  )
  const handler = ui
    .split('const handleStatsUpdate = (...args) => {')[1]
    ?.split('// 处理活跃任务更新')[0]
  assert.ok(handler)
  assert.match(handler, /didDownloadTaskCountsChange\(taskStats\.value, stats\)/)
  assert.match(handler, /if \(taskCountsChanged\) scheduleBatchReload\(\)/)
  const scheduler = ui
    .split('const scheduleBatchReload = () => {')[1]
    ?.split('// 设置事件监听器')[0]
  assert.ok(scheduler)
  assert.match(scheduler, /if \(batchReloadTimer\) return/)
})

test('waiting downloads keep the progress layout stable and closing cancels refresh', async () => {
  const ui = await readFile(
    new URL('../src/renderer/src/components/DownloadManager/index.vue', import.meta.url),
    'utf8'
  )
  const running = ui
    .split('const hasRunningDownloads = computed(')[1]
    ?.split('const DOWNLOAD_STATUS_OPTIONS')[0]
  assert.ok(running)
  assert.match(running, /taskStats\.value\.downloading/)
  assert.match(running, /taskStats\.value\.waiting/)
  const watcher = ui.split('watch(visible, async (newVisible) => {')[1]?.split('// 翻页时')[0]
  assert.ok(watcher)
  assert.match(watcher, /if \(batchReloadTimer\) clearTimeout\(batchReloadTimer\)/)
  assert.match(watcher, /batchReloadTimer = null/)
})

test('download rows keep their identity and pages use correlated, bounded background refreshes', async () => {
  const ui = await readFile(
    new URL('../src/renderer/src/components/DownloadManager/index.vue', import.meta.url),
    'utf8'
  )
  assert.match(ui, /:key="task\.id"/)
  assert.doesNotMatch(ui, /_renderKey/)
  assert.match(ui, /window\.QzoneAPI\.download\.getTasks\(/)
  assert.doesNotMatch(ui, /onTasksPage\(handleTasksPage\)/)
  assert.match(ui, /requestId !== pageRequestId \|\| !visible\.value/)
  assert.match(ui, /if \(!visible\.value\) return/)
  assert.match(ui, /if \(pageReloadTimer \|\| pageRequestPending\) return/)
  assert.match(ui, /if \(pageReloadRequested\) schedulePageReload\(\)/)
  assert.match(ui, /loadTasksPage\(\{ silent: true \}\)/)
  assert.match(ui, /Object\.assign\(currentTask, changedTask\)/)
})
