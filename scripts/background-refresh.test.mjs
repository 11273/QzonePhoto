import assert from 'node:assert/strict'
import test from 'node:test'
import { createBackgroundRefresh } from '../src/shared/background-refresh.mjs'

test('coalesces in-flight focus refreshes and throttles successful checks', async () => {
  let time = 1000
  let calls = 0
  let resolve
  const refresh = createBackgroundRefresh(
    () => {
      calls++
      return new Promise((done) => (resolve = done))
    },
    { now: () => time }
  )
  const first = refresh()
  assert.equal(first, refresh())
  await Promise.resolve()
  resolve('latest')
  assert.equal(await first, 'latest')
  await refresh()
  assert.equal(calls, 1)
  time += 60001
  const second = refresh()
  await Promise.resolve()
  resolve('newer')
  assert.equal(await second, 'newer')
  assert.equal(calls, 2)
})

test('backs off failed checks, keeps previous state and recovers without an unhandled rejection', async () => {
  let time = 1000
  let fail = true
  let calls = 0
  let state = 'cached'
  const refresh = createBackgroundRefresh(
    async () => {
      calls++
      if (fail) throw new Error('timeout')
      state = 'fresh'
      return state
    },
    { now: () => time, minIntervalMs: 100, maxBackoffMs: 400 }
  )
  await refresh()
  assert.equal(state, 'cached')
  await refresh()
  assert.equal(calls, 1)
  time += 100
  await refresh()
  time += 100
  await refresh()
  assert.equal(calls, 2)
  time += 100
  await refresh()
  time += 399
  await refresh()
  assert.equal(calls, 3)
  fail = false
  time += 1
  await refresh()
  assert.equal(state, 'fresh')
  time += 100
  await refresh()
  assert.equal(calls, 5)
})

test('explicit refresh bypasses a cooldown but never duplicates an in-flight request', async () => {
  let calls = 0
  const refresh = createBackgroundRefresh(async ({ force } = {}) => {
    calls++
    return force
  })
  await refresh()
  assert.equal(await refresh({ force: true }), true)
  assert.equal(calls, 2)
})
