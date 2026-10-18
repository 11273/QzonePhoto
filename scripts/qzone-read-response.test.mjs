import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getQzoneReadFailure,
  isValidQzoneAlbumListResponse,
  normalizeQzoneReadResponse,
  readQzoneResponseMessage
} from '../src/shared/qzone-read-response.js'

test('读取接口保留官方业务错误和嵌套原因', () => {
  const response = normalizeQzoneReadResponse(
    { code: 0, ret: -3002, data: { errmsg: '需要安全验证' } },
    { label: '好友列表', isValid: () => false }
  )

  assert.equal(response.code, -3002)
  assert.equal(response.message, '需要安全验证')
})

test('顶层成功码不会遮住 subcode 或 result 中的失败码', () => {
  const subcodeResponse = normalizeQzoneReadResponse(
    { code: 0, subcode: -3000, message: '登录状态已失效', data: { items: [] } },
    { label: '好友列表', isValid: () => true }
  )
  const resultResponse = normalizeQzoneReadResponse(
    { code: 0, result: { ret: -3002, errmsg: '需要安全验证' } },
    { label: '访客记录', isValid: () => true }
  )

  assert.equal(subcodeResponse.code, -3000)
  assert.equal(subcodeResponse.message, '登录状态已失效')
  assert.equal(resultResponse.code, -3002)
  assert.equal(resultResponse.message, '需要安全验证')
})

test('成功码但结构残缺的列表不会伪装成空数据', () => {
  const response = normalizeQzoneReadResponse(
    { code: 0, data: { total: 53 } },
    { label: '好友照片', isValid: (value) => Array.isArray(value.data?.photos) }
  )

  assert.equal(response.code, -1)
  assert.match(response.message, /数据不完整/)
})

test('真实空列表仍保持成功状态', () => {
  const response = normalizeQzoneReadResponse(
    { code: 0, data: { photos: [], hasmore: false } },
    { label: '好友照片', isValid: (value) => Array.isArray(value.data?.photos) }
  )

  assert.equal(response.code, 0)
  assert.deepEqual(response.data.photos, [])
})

test('规范化函数可以兼容接口字段别名', () => {
  const response = normalizeQzoneReadResponse(
    { ret: 0, data: { videos: [{ id: 1 }] } },
    {
      label: '视频',
      isValid: (value) => Array.isArray(value.data?.videos),
      normalize: (value) => ({ ...value, data: { ...value.data, Videos: value.data.videos } })
    }
  )

  assert.equal(response.code, 0)
  assert.equal(response.data.Videos.length, 1)
})

test('顶层成功文案不会遮住嵌套的官方访问限制', () => {
  const payload = {
    code: 0,
    message: 'success',
    data: { protect_content: '非好友仅可查看最近一年的内容' }
  }

  assert.equal(readQzoneResponseMessage(payload, payload.data), '非好友仅可查看最近一年的内容')
})

test('IPC 成功但业务失败时仍能提取错误码和官方原因', () => {
  const failure = getQzoneReadFailure({
    code: 0,
    subcode: -3002,
    message: 'success',
    result: { errmsg: '需要安全验证' }
  })

  assert.equal(failure.code, -3002)
  assert.equal(failure.message, '需要安全验证')
  assert.equal(getQzoneReadFailure({ code: 0, data: { items: [] } }), null)
})

test('相册列表兼容分类首屏、平铺首屏、单分类分页和真实空空间', () => {
  assert.equal(
    isValidQzoneAlbumListResponse({ data: { albumListModeClass: [], albumsInUser: 3 } }),
    true
  )
  assert.equal(
    isValidQzoneAlbumListResponse({ data: { albumListModeSort: [], albumsInUser: 3 } }),
    true
  )
  assert.equal(isValidQzoneAlbumListResponse({ data: { albumList: [], totalInClass: 0 } }), true)
  assert.equal(isValidQzoneAlbumListResponse({ data: { albumsInUser: 0 } }), true)
  assert.equal(isValidQzoneAlbumListResponse({ data: { albumsInUser: 48 } }), false)
})
