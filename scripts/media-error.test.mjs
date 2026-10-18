import assert from 'node:assert/strict'
import test from 'node:test'

import {
  describeHlsError,
  describeMediaElementError,
  describePlaybackRejection
} from '../src/renderer/src/utils/media-error.mjs'

test('媒体元素错误会区分网络、解码和格式问题', () => {
  assert.match(describeMediaElementError({ code: 2 }, { type: 'video' }), /网络连接中断/)
  assert.match(describeMediaElementError({ code: 3 }, { type: 'video' }), /无法解码/)
  assert.match(describeMediaElementError({ code: 4 }, { type: 'video' }), /权限限制/)
  assert.match(describeMediaElementError(null, { type: 'image' }), /没有查看权限/)
})

test('HLS 错误不会全部退化为无法播放', () => {
  const types = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' }
  assert.match(describeHlsError({ type: 'networkError' }, types), /网络连接异常/)
  assert.match(describeHlsError({ type: 'mediaError' }, types), /无法解码/)
  assert.match(describeHlsError({ details: 'manifestParsingError' }, types), /播放清单/)
})

test('播放拒绝提示说明自动播放策略且忽略主动中断', () => {
  assert.match(describePlaybackRejection({ name: 'NotAllowedError' }), /不会自动播放/)
  assert.match(describePlaybackRejection({ name: 'NotSupportedError' }), /格式或编码/)
  assert.equal(describePlaybackRejection({ name: 'AbortError' }), '')
})
