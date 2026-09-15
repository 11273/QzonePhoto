import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPaginationGuard,
  isNearScrollEnd,
  normalizePaginationFlag,
  shouldContinuePagination
} from '../src/renderer/src/utils/paginationGuard.js'

test('keeps a failed page retryable and continues after a later success', () => {
  let now = 1_000
  const guard = createPaginationGuard({ cooldownMs: 500, maxFailures: 2, now: () => now })

  assert.equal(guard.canLoad('page-2'), true)
  assert.deepEqual(guard.fail('page-2'), {
    failureCount: 1,
    retryAfter: 1_500,
    shouldPauseAuto: false,
    shouldStop: false
  })
  assert.equal(guard.canLoad('page-2'), false)

  now = 1_500
  assert.equal(guard.canLoad('page-2'), true)
  assert.equal(guard.fail('page-2').shouldStop, false)

  now = 2_000
  assert.equal(guard.canLoad('page-2'), true)
  guard.succeed()
  assert.equal(guard.canLoad('page-3'), true)
})

test('trusts an advancing server cursor even when the visible page deduplicates to zero', () => {
  assert.equal(
    shouldContinuePagination({
      serverHasMore: true,
      cursorMoved: true,
      itemCount: 0,
      pageSize: 10
    }),
    true
  )
  assert.equal(
    shouldContinuePagination({ serverHasMore: true, cursorMoved: false, itemCount: 10 }),
    false
  )
})

test('stops at an explicit end-of-list and infers legacy terminal pages', () => {
  assert.equal(shouldContinuePagination({ serverHasMore: 'false', cursorMoved: true }), false)
  assert.equal(
    shouldContinuePagination({ nextOffset: 40, total: 41, itemCount: 1, pageSize: 20 }),
    true
  )
  assert.equal(
    shouldContinuePagination({ nextOffset: 41, total: 41, itemCount: 1, pageSize: 20 }),
    false
  )
  assert.equal(shouldContinuePagination({ itemCount: 9, pageSize: 10 }), false)
  assert.equal(normalizePaginationFlag('0'), false)
})

test('scroll trigger fires only near the active container end', () => {
  const container = { scrollHeight: 1_000, clientHeight: 400, scrollTop: 200 }
  assert.equal(isNearScrollEnd(container, 120), false)
  container.scrollTop = 500
  assert.equal(isNearScrollEnd(container, 120), true)
})
