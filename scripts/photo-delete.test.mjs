import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPhotoDeleteCodelist,
  normalizeAlbumPrivacy,
  normalizePhotoDeleteItem
} from '../src/shared/photo-delete.js'

test('normalizes historical and newly uploaded photo deletion identifiers', () => {
  assert.deepEqual(normalizePhotoDeleteItem({ lloc: 'old-l', sloc: 'old-s' }), {
    lloc: 'old-l',
    sloc: 'old-s'
  })
  assert.deepEqual(normalizePhotoDeleteItem({ id: 'new-l', picrefer: 'new-s' }), {
    lloc: 'new-l',
    sloc: 'new-s'
  })
})

test('builds the QQ Space multi-photo deletion codelist with album privacy', () => {
  assert.equal(
    buildPhotoDeleteCodelist(
      [
        { lloc: 'old-l', sloc: 'old-s' },
        { id: 'new-l', picrefer: 'new-s' }
      ],
      5
    ),
    'old-l|53|0|0||old-s|5|0_new-l|53|0|0||new-s|5|0'
  )
  assert.equal(normalizeAlbumPrivacy(undefined), 1)
  assert.throws(() => buildPhotoDeleteCodelist([{ lloc: 'missing-sloc' }], 1), /lloc 或 sloc/)
})
