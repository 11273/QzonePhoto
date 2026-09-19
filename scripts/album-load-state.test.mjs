import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALBUM_LOAD_STATUS,
  classifyAlbumLoadFailure,
  createAlbumLoadState,
  resolveAlbumResponseState
} from '../src/shared/album-load-state.js'

test('好友空间权限限制会转换为持久的无权限状态', () => {
  const state = resolveAlbumResponseState(
    {
      code: -3000,
      message: '对不起，您没有权限访问对方的空间',
      data: {}
    },
    { friendMode: true }
  )

  assert.equal(state.status, ALBUM_LOAD_STATUS.FORBIDDEN)
  assert.equal(state.title, '暂时无法查看相册')
  assert.match(state.description, /其他公开内容仍可继续浏览/)
  assert.doesNotMatch(state.title, /空间/)
  assert.equal(state.retryable, false)
  assert.doesNotMatch(state.description, /接口|响应|code/i)
})

test('空相册与异常响应不会混为一谈', () => {
  const empty = resolveAlbumResponseState(
    { code: 0, data: { albumsInUser: 0 } },
    { friendMode: true }
  )
  const invalid = resolveAlbumResponseState({ code: 0, data: { albumsInUser: 3 } })

  assert.equal(empty.status, ALBUM_LOAD_STATUS.EMPTY)
  assert.match(empty.description, /没有创建相册|没有向你公开/)
  assert.equal(invalid.status, ALBUM_LOAD_STATUS.ERROR)
  assert.equal(invalid.retryable, true)
})

test('正常相册列表进入就绪状态', () => {
  const state = resolveAlbumResponseState({
    code: 0,
    data: { albumsInUser: 1, albumListModeClass: [] }
  })

  assert.equal(state.status, ALBUM_LOAD_STATUS.READY)
})

test('网络和登录错误给出合适的恢复方式', () => {
  const network = classifyAlbumLoadFailure(new Error('network timeout'))
  const auth = classifyAlbumLoadFailure({ code: 401, message: '登录状态已失效' })

  assert.equal(network.status, ALBUM_LOAD_STATUS.ERROR)
  assert.match(network.description, /网络连接/)
  assert.equal(network.retryable, true)
  assert.equal(auth.status, ALBUM_LOAD_STATUS.ERROR)
  assert.equal(auth.retryable, false)
})

test('默认占位仍提示选择相册', () => {
  const state = createAlbumLoadState()
  assert.equal(state.status, ALBUM_LOAD_STATUS.IDLE)
  assert.equal(state.title, '选择一个相册')
})
