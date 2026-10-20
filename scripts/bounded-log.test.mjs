import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  createBoundedLogWriter,
  readDiagnosticLogTail,
  MAX_LOG_BYTES,
  MAX_LOG_ENTRY_BYTES
} from '../src/main/utils/bounded-log.mjs'

const setup = async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qzone-bounded-log-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return path.join(dir, 'app.log')
}

test('migrates a sparse 156 GB historical log by retaining only its tail', async (t) => {
  const filename = await setup(t)
  const fd = fs.openSync(filename, 'w')
  const size = 156 * 1024 ** 3
  fs.ftruncateSync(fd, size)
  const tail = Buffer.from('\nrecent diagnostic\n')
  fs.writeSync(fd, tail, 0, tail.length, size - tail.length)
  fs.closeSync(fd)
  createBoundedLogWriter(filename)
  assert.ok(fs.statSync(filename).size <= MAX_LOG_BYTES)
  assert.match(fs.readFileSync(filename, 'utf8'), /recent diagnostic/)
})

test('caps entries, rotates exactly one archive and preserves newest diagnostics', async (t) => {
  const filename = await setup(t)
  const writer = createBoundedLogWriter(filename, { maxBytes: 1024, maxEntryBytes: 256 })
  for (let index = 0; index < 35; index++) writer.append(`entry-${index} ${'x'.repeat(200)}`)
  assert.ok(fs.statSync(filename).size <= 1024)
  assert.ok(fs.statSync(`${filename}.1`).size <= 1024)
  assert.deepEqual(fs.readdirSync(path.dirname(filename)).sort(), ['app.log', 'app.log.1'])
  assert.match(await readDiagnosticLogTail(filename, 1024), /entry-34/)
})

test('suppresses timestamp-varying duplicate storms and bounds unique flood output', async (t) => {
  const filename = await setup(t)
  let time = 1000
  const writer = createBoundedLogWriter(filename, { now: () => time })
  for (let index = 0; index < 10000; index++) {
    writer.append(`[${index}] [ERROR] write EPIPE`)
  }
  assert.equal(fs.readFileSync(filename, 'utf8').split('\n').length, 2)
  for (let index = 0; index < 10000; index++) writer.append(`unique ${index}`)
  assert.ok(fs.readFileSync(filename, 'utf8').split('\n').length < 205)
  time += 60001
  assert.ok(writer.append('[later] [ERROR] write EPIPE'))
  assert.match(fs.readFileSync(filename, 'utf8'), /已合并/)
})

test('bounds UTF-8 entries and reads a bounded tail including rotated history', async (t) => {
  const filename = await setup(t)
  const writer = createBoundedLogWriter(filename)
  const entry = writer.append('测'.repeat(30000))
  assert.ok(Buffer.byteLength(entry) <= MAX_LOG_ENTRY_BYTES)
  assert.ok(!entry.includes('\ufffd'))
  const tail = await readDiagnosticLogTail(filename, 128)
  assert.ok(Buffer.byteLength(tail) <= 128)
  assert.ok(!tail.includes('\ufffd'))
  fs.writeFileSync(`${filename}.1`, 'previous\n')
  fs.writeFileSync(filename, 'current\n')
  assert.equal(await readDiagnosticLogTail(filename, 128), 'previous\ncurrent\n')
  assert.equal(await readDiagnosticLogTail(path.join(path.dirname(filename), 'missing')), '')
})

test('caps oversized pre-existing archives and tolerates unavailable storage', async (t) => {
  const filename = await setup(t)
  fs.writeFileSync(`${filename}.1`, 'old\n'.repeat(1000))
  createBoundedLogWriter(filename, { maxBytes: 1024 })
  assert.ok(fs.statSync(`${filename}.1`).size <= 1024)
  const writer = createBoundedLogWriter(path.join(filename, 'missing.log'))
  assert.doesNotThrow(() => writer.append('still safe'))
})
