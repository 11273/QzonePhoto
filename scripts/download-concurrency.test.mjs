import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AdaptiveDownloadConcurrency,
  isTransientDownloadError,
  normalizeDownloadConcurrency,
  retryAfterMilliseconds
} from '../src/shared/download-concurrency.mjs'

const succeed = (policy, now, extra = {}) =>
  policy.observeSuccess(
    { type: 'image', bytes: 10000, elapsedMs: 100, epoch: policy.epoch, ...extra },
    now
  )

test('automatic image concurrency grows gradually from three and never exceeds six', () => {
  const policy = new AdaptiveDownloadConcurrency()
  assert.equal(policy.limit, 3)
  for (let now = 0; now < 10000; now += 10) {
    const before = policy.limit
    succeed(policy, now)
    assert.ok(policy.limit - before <= 1)
    assert.ok(policy.limit <= 6)
  }
  assert.equal(policy.limit, 6)
})

test('videos, skipped bytes, and stale completions do not increase image concurrency', () => {
  const policy = new AdaptiveDownloadConcurrency()
  for (let i = 0; i < 100; i++) {
    succeed(policy, i * 1000, { type: 'video' })
    succeed(policy, i * 1000, { bytes: 0 })
    succeed(policy, i * 1000, { epoch: -1 })
  }
  assert.equal(policy.limit, 3)
})

test('slow successful images reduce pressure without cancelling an existing transfer', () => {
  const policy = new AdaptiveDownloadConcurrency()
  succeed(policy, 100, { elapsedMs: 16000 })
  assert.equal(policy.limit, 2)
  assert.equal(policy.blockedUntil, 0)
  for (let i = 0; i < 20; i++) succeed(policy, 1000)
  assert.equal(policy.limit, 2)
})

test('rate limits halve concurrency, respect Retry-After, and ignore old in-flight successes', () => {
  const policy = new AdaptiveDownloadConcurrency()
  const epoch = policy.epoch
  const error = { response: { status: 429, headers: { 'retry-after': '10' } } }
  policy.observeFailure(error, 1000)
  assert.equal(policy.limit, 1)
  assert.equal(policy.blockedUntil, 11000)
  for (let i = 0; i < 20; i++) succeed(policy, 15000, { epoch })
  assert.equal(policy.limit, 1)
  succeed(policy, 11000)
  assert.equal(policy.limit, 1, 'recovery must not immediately jump back to the previous limit')
  succeed(policy, 13000)
  assert.equal(policy.limit, 2)
})

test('one simultaneous failure burst is one backoff round; later failures back off longer', () => {
  const policy = new AdaptiveDownloadConcurrency()
  const error = { code: 'ECONNRESET' }
  policy.observeFailure(error, 1000)
  policy.observeFailure(error, 1010)
  policy.observeFailure(error, 1020)
  assert.equal(policy.failureRounds, 1)
  assert.equal(policy.blockedUntil, 2020)
  policy.observeFailure(error, 2030)
  assert.equal(policy.failureRounds, 2)
  assert.equal(policy.blockedUntil, 4030)
})

test('permission failures, missing files, disk errors, and user cancellation never retry or back off', () => {
  const policy = new AdaptiveDownloadConcurrency()
  for (const error of [
    { response: { status: 403 } },
    { response: { status: 404 } },
    { code: 'ENOSPC' },
    { code: 'ERR_CANCELED' },
    { __CANCEL__: true, code: 'ECONNRESET' }
  ]) {
    assert.equal(isTransientDownloadError(error), false)
    policy.observeFailure(error, 100)
  }
  assert.equal(policy.limit, 3)
  assert.equal(policy.blockedUntil, 0)
})

test('Retry-After accepts seconds and HTTP dates without turning malformed values into huge timers', () => {
  const now = Date.UTC(2026, 9, 20)
  assert.equal(retryAfterMilliseconds('3', now), 3000)
  assert.equal(retryAfterMilliseconds(new Date(now + 7000).toUTCString(), now), 7000)
  for (const value of ['', undefined, '-1', 'NaN', '0.5', 'junk']) {
    assert.equal(retryAfterMilliseconds(value, now), 0)
  }
  assert.equal(retryAfterMilliseconds('999999999999', now), 2 ** 31 - 1)
})

test('manual concurrency rejects invalid input instead of leaving the queue stuck at NaN', () => {
  for (const value of [1, 3, 10, '6'])
    assert.equal(normalizeDownloadConcurrency(value), Number(value))
  for (const value of [NaN, Infinity, undefined, null, true, {}, '', 0, -1, 11, 2.5, '3oops']) {
    assert.throws(() => normalizeDownloadConcurrency(value), TypeError)
  }
})
