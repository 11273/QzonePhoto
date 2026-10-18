import assert from 'node:assert/strict'
import test from 'node:test'

import {
  feedMutationErrorText,
  feedMutationResult
} from '../src/renderer/src/utils/feed-mutations.mjs'

test('feedMutationResult accepts QQ Space success variants', () => {
  assert.equal(feedMutationResult({ code: 0 }).success, true)
  assert.equal(feedMutationResult({ result: '0' }).success, true)
  assert.equal(feedMutationResult({ data: { ret: 0 } }).success, true)
})

test('feedMutationResult only treats already-deleted as delete success', () => {
  assert.equal(feedMutationResult({ code: -4404 }).success, false)
  assert.equal(feedMutationResult({ code: -4404 }, { allowAlreadyDeleted: true }).success, true)
})

test('feedMutationErrorText keeps server detail and explains pin permission', () => {
  assert.equal(feedMutationErrorText('删除', { message: '没有权限' }), '没有权限')
  assert.match(feedMutationErrorText('置顶', { code: -1 }), /黄钻权限/)
})
