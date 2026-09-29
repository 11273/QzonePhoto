import assert from 'node:assert/strict'
import test from 'node:test'

import { QZONE_UTILS } from '../src/shared/const.js'

test('相册能力字段缺失时不会误报允许分享', () => {
  assert.equal(QZONE_UTILS.checkAllowShare({}), false)
  assert.equal(QZONE_UTILS.checkAllowShare({ allowShare: 0 }), false)
  assert.equal(QZONE_UTILS.checkAllowShare({ allowShare: 1 }), true)
  assert.equal(QZONE_UTILS.getAlbumPermissionText({ priv: 1 }), '所有人可见')
})
