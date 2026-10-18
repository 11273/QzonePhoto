import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchPhotosTolerantly } from '../src/main/services/qzone/photoTolerance.js'

test('公开相册受最近一年规则限制时不再二分并误报照片损坏', async () => {
  let requestCount = 0
  const response = await fetchPhotosTolerantly(
    async () => {
      requestCount += 1
      return {
        code: 0,
        message: '',
        data: {
          photoList: null,
          protect_content: '非好友仅可查看最近一年的内容',
          totalInAlbum: 53,
          totalInPage: 0
        }
      }
    },
    0,
    100
  )

  assert.equal(requestCount, 1)
  assert.equal(response.code, 403)
  assert.equal(response.message, '非好友仅可查看最近一年的内容')
  assert.equal(response.data.totalInAlbum, 53)
  assert.equal(response.data.protectContent, '非好友仅可查看最近一年的内容')
  assert.deepEqual(response.data.photoList, [])
  assert.equal(response.data.skippedCount, 0)
  assert.equal(response.data.hasMore, false)
})

test('正常公开照片响应仍按原分页结果返回', async () => {
  const response = await fetchPhotosTolerantly(
    async () => ({
      code: 0,
      data: {
        photoList: [{ id: 'photo-1' }],
        totalInAlbum: 1,
        totalInPage: 1
      }
    }),
    0,
    100
  )

  assert.equal(response.code, 0)
  assert.deepEqual(response.data.photoList, [{ id: 'photo-1' }])
  assert.equal(response.data.totalInAlbum, 1)
})
