import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDownloadCompletionProgress,
  getDownloadManagerSummary
} from '../src/shared/download-batch-stats.mjs'

test('206/207 成功且一条失败时显示 99%，并明确说明任务已经结束', () => {
  const stats = { total: 207, completed: 206, error: 1 }
  assert.equal(getDownloadCompletionProgress(stats), 99)
  assert.equal(getDownloadManagerSummary(stats), '已结束 · 206/207 已完成 · 1 个失败')
})

test('剩余任务正在下载、等待、暂停或取消时，都不能提前显示 100%', () => {
  for (const status of ['downloading', 'waiting', 'paused', 'cancelled', 'error']) {
    const stats = { total: 1000, completed: 999, [status]: 1 }
    assert.equal(getDownloadCompletionProgress(stats), 99, status)
  }
  assert.equal(
    getDownloadManagerSummary({ total: 207, completed: 206, waiting: 1 }),
    '1 个进行中 · 206/207 已完成'
  )
  assert.equal(
    getDownloadManagerSummary({ total: 207, completed: 206, paused: 1 }),
    '已暂停 · 206/207 已完成'
  )
  assert.equal(
    getDownloadManagerSummary({ total: 207, completed: 206, cancelled: 1 }),
    '已结束 · 206/207 已完成 · 1 个已取消'
  )
})

test('失败任务重试时恢复进行中提示，全部成功后才显示 100%', () => {
  const retrying = { total: 207, completed: 206, error: 0, downloading: 1 }
  assert.equal(getDownloadCompletionProgress(retrying), 99)
  assert.equal(getDownloadManagerSummary(retrying), '1 个进行中 · 206/207 已完成')
  const completed = { total: 207, completed: 207 }
  assert.equal(getDownloadCompletionProgress(completed), 100)
  assert.equal(getDownloadManagerSummary(completed), '207/207 已完成')
})

test('空列表或缺失统计显示 0%，未对齐的统计不会被误报为已结束', () => {
  for (const stats of [{}, { total: 0 }, { total: NaN }, { total: Infinity }]) {
    assert.equal(getDownloadCompletionProgress(stats), 0)
    assert.equal(getDownloadManagerSummary(stats), '')
  }
  assert.equal(getDownloadCompletionProgress({ total: 10, completed: -1 }), 0)
  assert.equal(
    getDownloadManagerSummary({ total: 207, completed: 205, error: 1 }),
    '205/207 已完成 · 1 个失败'
  )
})
