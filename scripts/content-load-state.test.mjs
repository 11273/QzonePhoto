import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTENT_LOAD_STATUS,
  classifyContentLoadFailure,
  createContentLoadState
} from '../src/shared/content-load-state.js'

test('好友模块无权限时只说明当前内容不可见', () => {
  const state = classifyContentLoadFailure(
    { code: 403, message: '没有权限访问' },
    { label: '视频', friendMode: true }
  )

  assert.equal(state.status, CONTENT_LOAD_STATUS.FORBIDDEN)
  assert.equal(state.title, '暂时无法查看视频')
  assert.match(state.description, /其他公开内容仍可继续浏览/)
  assert.equal(state.retryable, false)
  assert.doesNotMatch(state.description, /接口|响应|code/i)
})

test('临时故障可以重试且不暴露原始错误', () => {
  const state = classifyContentLoadFailure(new Error('network timeout'), { label: '照片' })

  assert.equal(state.status, CONTENT_LOAD_STATUS.ERROR)
  assert.equal(state.title, '照片暂时加载失败')
  assert.match(state.description, /网络连接/)
  assert.equal(state.retryable, true)
  assert.doesNotMatch(state.description, /timeout/i)
})

test('登录失效不提供无意义的原地重试', () => {
  const state = classifyContentLoadFailure(
    { code: 401, message: '登录状态已失效' },
    { label: '动态' }
  )

  assert.equal(state.retryable, false)
  assert.match(state.description, /重新登录/)
})

test('真正空数据与加载失败保持区分', () => {
  const state = createContentLoadState(CONTENT_LOAD_STATUS.EMPTY, {
    label: '视频',
    friendMode: true,
    emptyDescription: '对方还没有公开的视频。'
  })

  assert.equal(state.status, CONTENT_LOAD_STATUS.EMPTY)
  assert.equal(state.title, '暂无视频')
  assert.equal(state.description, '对方还没有公开的视频。')
  assert.equal(state.retryable, false)
})
