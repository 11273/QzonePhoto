import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ALBUM_LOAD_STATUS,
  classifyAlbumLoadFailure,
  createAlbumLoadState,
  createAlbumVisibilityGapDescription,
  isOfficialEmptyAlbumCategoryPage,
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

test('接口用成功状态码返回限制说明时仍按权限提示处理', () => {
  const state = resolveAlbumResponseState(
    {
      code: 0,
      message: '非好友仅可查看最近一年的内容',
      data: { albumsInUser: 2 }
    },
    { friendMode: true }
  )

  assert.equal(state.status, ALBUM_LOAD_STATUS.FORBIDDEN)
  assert.match(state.description, /最近一年的内容/)
  assert.equal(state.retryable, false)
})

test('嵌套 protect_content 的访问限制不会被当成空相册', () => {
  const state = resolveAlbumResponseState(
    {
      code: 0,
      data: {
        albumsInUser: 2,
        protect_content: '非好友仅可查看最近一年的内容'
      }
    },
    { friendMode: true }
  )

  assert.equal(state.status, ALBUM_LOAD_STATUS.FORBIDDEN)
  assert.match(state.description, /最近一年的内容/)
})

test('空相册与异常响应不会混为一谈', () => {
  const empty = resolveAlbumResponseState(
    { code: 0, data: { albumsInUser: 0 } },
    { friendMode: true }
  )
  const invalid = resolveAlbumResponseState({ code: 0, data: { albumsInUser: 3 } })

  assert.equal(empty.status, ALBUM_LOAD_STATUS.EMPTY)
  assert.match(empty.description, /尚未创建相册|没有向你公开/)
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
  assert.match(network.description, /响应时间过长/)
  assert.equal(network.retryable, true)
  assert.equal(auth.status, ALBUM_LOAD_STATUS.ERROR)
  assert.equal(auth.retryable, false)
})

test('默认占位仍提示选择相册', () => {
  const state = createAlbumLoadState()
  assert.equal(state.status, ALBUM_LOAD_STATUS.IDLE)
  assert.equal(state.title, '选择一个相册')
})

test('服务端统计大于可见列表时不误报网络或数据损坏', () => {
  const description = createAlbumVisibilityGapDescription({
    reported: 48,
    visible: 47,
    context: '“最爱”分类'
  })

  assert.match(description, /多 1 个/)
  assert.match(description, /隐藏、删除、未向当前账号开放/)
  assert.doesNotMatch(description, /网络|损坏|加载失败/)
})

test('单分类接口的官方空尾页与残缺响应保持区分', () => {
  assert.equal(
    isOfficialEmptyAlbumCategoryPage({
      albumList: null,
      albumsInUser: 0,
      totalInPage: 0,
      totalInClass: 0
    }),
    true
  )
  assert.equal(isOfficialEmptyAlbumCategoryPage({ albumList: null, totalInPage: 3 }), false)
  assert.equal(isOfficialEmptyAlbumCategoryPage({}), false)
})
