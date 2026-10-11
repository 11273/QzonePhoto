import assert from 'node:assert/strict'
import test from 'node:test'

import {
  __mediaDetailTestUtils,
  buildMediaDetailRows
} from '../src/renderer/src/utils/mediaDetails.js'

test('媒体详情会合并业务上下文与不同来源的字段', () => {
  const rows = buildMediaDetailRows(
    {
      type: 'video',
      width: 1920,
      height: 1080,
      size: 5 * 1024 * 1024,
      duration: 65,
      poiName: '深圳',
      desc: '旅行记录'
    },
    { albumName: '生活', author: '企鹅', likeCount: 3 }
  )

  assert.deepEqual(Object.fromEntries(rows.map(({ label, value }) => [label, value])), {
    类型: '视频',
    相册: '生活',
    发布者: '企鹅',
    尺寸: '1920 × 1080',
    大小: '5 MB',
    时长: '1:05',
    地点: '深圳',
    描述: '旅行记录',
    点赞: '3'
  })
})

test('无值、对象和零统计不会生成噪音行', () => {
  const rows = buildMediaDetailRows({ exif: { camera: 'x' } }, { commentCount: 0 })
  assert.deepEqual(rows, [{ label: '类型', value: '照片' }])
})

test('上游字段为对象时会继续使用后续可读字段', () => {
  const rows = buildMediaDetailRows(
    { poiName: '西湖', desc: '傍晚' },
    { location: { id: 1 }, description: { raw: true } }
  )
  const details = Object.fromEntries(rows.map(({ label, value }) => [label, value]))
  assert.equal(details.地点, '西湖')
  assert.equal(details.描述, '傍晚')
})

test('格式化器兼容秒时间戳、字节与长视频', () => {
  assert.match(__mediaDetailTestUtils.formatTimestamp(1_700_000_000), /^2023/)
  assert.equal(__mediaDetailTestUtils.formatSize(1536), '1.5 KB')
  assert.equal(__mediaDetailTestUtils.formatDuration(3661), '1:01:01')
})
