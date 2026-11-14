import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { TransferRateLimiter } from '../src/main/utils/transfer-rate-limiter.mjs'
import { normalizeTransferRate } from '../src/shared/transfer-rate.mjs'

test('rate validation keeps zero unlimited and rejects invalid IPC values', () => {
  for (const value of [0, 1024, 128 * 1024, 1024 ** 3])
    assert.equal(normalizeTransferRate(value), value)
  for (const value of [null, true, '', '1024', -1, 1, 1023, 1.5, NaN, Infinity, 1024 ** 3 + 1]) {
    assert.throws(() => normalizeTransferRate(value), TypeError)
  }
  const limiter = new TransferRateLimiter()
  for (let i = 0; i < 10000; i++) assert.equal(limiter.consume(65536), null)
  assert.equal(limiter.timer, null)
  assert.equal(limiter.queue.length, 0)
})

test('every waiter shares the same total budget, with no initial burst', async () => {
  const limiter = new TransferRateLimiter()
  limiter.setRate(128 * 1024)
  const started = performance.now()
  await Promise.all(Array.from({ length: 4 }, () => limiter.consume(32768)))
  const elapsed = performance.now() - started
  assert.ok(elapsed >= 970 && elapsed < 2500, `${elapsed}ms for 128KB at 128KB/s`)
  assert.equal(limiter.timer, null)
  assert.equal(limiter.queue.length, 0)
})

test('increasing or disabling a live limit immediately wakes pending transfers', async () => {
  const limiter = new TransferRateLimiter()
  limiter.setRate(1024)
  const pending = limiter.consume(16 * 1024)
  await delay(50)
  limiter.setRate(1024 ** 2)
  await pending
  const more = limiter.consume(1024 ** 2)
  const started = performance.now()
  limiter.setRate(0)
  await more
  assert.ok(performance.now() - started < 100)
  assert.equal(limiter.timer, null)
})

test('abort signals and upload cancellation callbacks release pending reservations', async () => {
  const limiter = new TransferRateLimiter()
  limiter.setRate(1024)
  const controller = new AbortController()
  const signalled = limiter.consume(1024 ** 2, { signal: controller.signal })
  controller.abort()
  await assert.rejects(signalled, { code: 'ERR_CANCELED' })
  let cancelled = false
  const polled = limiter.consume(1024 ** 2, { isCancelled: () => cancelled })
  cancelled = true
  await assert.rejects(polled, { code: 'ERR_CANCELED' })
  assert.equal(limiter.queue.length, 0)
  assert.equal(limiter.timer, null)
})
