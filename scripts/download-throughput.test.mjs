import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { RollingDownloadThroughput } from '../src/shared/download-throughput.mjs'

test('short files count towards batch speed after each task finishes', () => {
  const meter = new RollingDownloadThroughput()
  meter.record(6000, 1000)
  meter.record(4000, 1250)
  assert.equal(meter.getBytesPerSecond(1250), 20000)
  assert.equal(meter.getBytesPerSecond(2000), 10000)
  assert.equal(meter.getBytesPerSecond(3000), 5000)
  assert.equal(meter.getBytesPerSecond(3300), 0)
})

test('old bytes expire, invalid values are ignored, and speed resets', () => {
  const meter = new RollingDownloadThroughput()
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
