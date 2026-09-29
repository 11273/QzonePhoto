import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildImageDownloadCandidates,
  downloadBatchTaskStatus,
  downloadTaskIds,
  filterAlbumMediaByDate,
  filterFeedsByDate,
  formatDownloadBatchDateRange,
  normalizeDownloadBatch,
  normalizeDownloadDateRange,
  shouldFallbackDownload
} from '../src/shared/download-batch.js'

test('日期范围包含起止日并兼容秒和毫秒时间戳', () => {
  const range = normalizeDownloadDateRange({ start: '2025-07-05', end: '2025-07-08' })
  const start = new Date('2025-07-05T00:00:00').getTime()
  const end = Math.floor(new Date('2025-07-08T23:59:59').getTime() / 1000)
  const result = filterAlbumMediaByDate(
    [
      { id: 'before', uploadtime: Math.floor(start / 1000) - 1 },
      { id: 'start', uploadTime: start },
      { id: 'end', modifytime: end },
      { id: 'after', uploadtime: end + 2 },
      { id: 'missing' }
    ],
    range
  )

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['start', 'end']
  )
  assert.deepEqual(
    {
      scanned: result.scanned,
      matched: result.matched,
      skipped: result.skipped,
      missingTime: result.missingTime
    },
    { scanned: 5, matched: 2, skipped: 3, missingTime: 1 }
  )
})

test('动态按发布时间筛选并按媒体数量统计', () => {
  const inside = Math.floor(new Date('2025-07-06T12:00:00').getTime() / 1000)
  const outside = Math.floor(new Date('2025-07-10T12:00:00').getTime() / 1000)
  const result = filterFeedsByDate(
    [
      { id: 'inside', time: inside, photos: [{}, {}] },
      { id: 'outside', time: outside, photos: [{}] },
      { id: 'missing', photos: [{}, {}, {}] }
    ],
    { start: '2025-07-05', end: '2025-07-08' }
  )

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['inside']
  )
  assert.deepEqual(
    {
      scanned: result.scanned,
      matched: result.matched,
      skipped: result.skipped,
      missingTime: result.missingTime
    },
    { scanned: 6, matched: 2, skipped: 4, missingTime: 3 }
  )
})

test('视频集合可以按各自上传时间筛选而不改变分组', () => {
  const inside = Math.floor(new Date('2025-07-06T12:00:00').getTime() / 1000)
  const outside = Math.floor(new Date('2025-07-10T12:00:00').getTime() / 1000)
  const result = filterFeedsByDate(
    [
      {
        id: 'videos',
        dateMode: 'media',
        time: outside,
        photos: [
          { id: 'inside', uploadtime: inside },
          { id: 'outside', uploadtime: outside }
        ]
      }
    ],
    { start: '2025-07-05', end: '2025-07-08' }
  )

  assert.deepEqual(
    result.items[0].photos.map((item) => item.id),
    ['inside']
  )
  assert.equal(result.matched, 1)
  assert.equal(result.skipped, 1)
})

test('没有日期条件时保留时间缺失的数据', () => {
  const result = filterAlbumMediaByDate([{ id: 1 }, { id: 2, uploadtime: 10 }], null)
  assert.equal(result.matched, 2)
  assert.equal(result.missingTime, 0)
})

test('下载批次默认立即开始并规范化日期', () => {
  const batch = normalizeDownloadBatch({
    id: 'batch-1',
    label: '我的相册',
    sourceType: 'album',
    dateRange: { start: '2025-07-08', end: '2025-07-05' }
  })

  assert.equal(batch.autoStart, true)
  assert.equal(formatDownloadBatchDateRange(batch), '2025-07-05 至 2025-07-08')
})

test('关闭自动开始时任务直接进入暂停状态', () => {
  assert.equal(downloadBatchTaskStatus({ id: 'batch-1', autoStart: false }), 'paused')
  assert.equal(downloadBatchTaskStatus({ id: 'batch-2', autoStart: true }), 'waiting')
  assert.equal(downloadBatchTaskStatus(null), 'waiting')
})

test('图片候选地址原图优先并去重', () => {
  assert.deepEqual(buildImageDownloadCandidates({ raw: 'raw', url: 'raw', pre: 'preview' }), [
    { url: 'raw', quality: 'original' },
    { url: 'preview', quality: 'preview' }
  ])
})

test('仅对可恢复的图片网络错误使用下一档地址', () => {
  const base = { type: 'image', candidateIndex: 0, candidateCount: 2 }
  assert.equal(shouldFallbackDownload({ ...base, httpStatus: 403 }), true)
  assert.equal(shouldFallbackDownload({ ...base, networkError: true }), true)
  assert.equal(shouldFallbackDownload({ ...base, httpStatus: 500 }), false)
  assert.equal(shouldFallbackDownload({ ...base, cancelled: true, httpStatus: 403 }), false)
  assert.equal(shouldFallbackDownload({ ...base, candidateIndex: 1, httpStatus: 403 }), false)
  assert.equal(shouldFallbackDownload({ ...base, type: 'video', httpStatus: 403 }), false)
})

test('调用结果兼容旧数组和批次对象', () => {
  assert.deepEqual(downloadTaskIds(['1']), ['1'])
  assert.deepEqual(downloadTaskIds({ taskIds: ['2'] }), ['2'])
  assert.deepEqual(downloadTaskIds(null), [])
})
