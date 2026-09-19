import assert from 'node:assert/strict'
import test from 'node:test'

import { FAVORITE_FILTERS, favoriteFilterFor } from '../src/renderer/src/utils/favoriteFilters.js'

test('favorite categories use official filter parameters rather than item type values', () => {
  assert.deepEqual(
    FAVORITE_FILTERS.map(({ label, type }) => [label, type]),
    [
      ['全部', 0],
      ['日志', 1],
      ['说说', 3],
      ['分享', 4],
      ['照片', 2],
      ['文字', 5],
      ['网页', 6]
    ]
  )
  assert.equal(favoriteFilterFor(3).label, '说说')
  assert.equal(favoriteFilterFor('2').label, '照片')
  assert.equal(favoriteFilterFor(7).type, 0)
})
