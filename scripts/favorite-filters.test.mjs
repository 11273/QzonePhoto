import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFavoriteTypeCounts } from '../src/renderer/src/utils/favoriteFilters.js'

test('normalizeFavoriteTypeCounts supports numeric arrays', () => {
  assert.deepEqual(normalizeFavoriteTypeCounts([12, 2, 3, 4, 1, 1, 1], 12), {
    0: 12,
    1: 2,
    2: 3,
    3: 4,
    4: 1,
    5: 1,
    6: 1
  })
})

test('normalizeFavoriteTypeCounts supports official object-like entries', () => {
  assert.deepEqual(
    normalizeFavoriteTypeCounts([
      { type: 1, num: 3 },
      { type: 3, count: 5 },
      { id: 4, total: 2 }
    ]),
    { 0: 10, 1: 3, 3: 5, 4: 2 }
  )
})

test('normalizeFavoriteTypeCounts prefers total_num for the all filter', () => {
  assert.deepEqual(normalizeFavoriteTypeCounts({ 1: 3, 3: 5 }, 20), {
    0: 20,
    1: 3,
    3: 5
  })
})
