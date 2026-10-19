import assert from 'node:assert/strict'
import test from 'node:test'
import { getDownloadFailureHint } from '../src/shared/download-failure.mjs'

test('download failures distinguish expired URLs from network and disk problems', () => {
  assert.match(getDownloadFailureHint('Request failed with status code 404'), /源文件已失效/)
  assert.match(getDownloadFailureHint('Request failed with status code 403'), /地址已过期/)
  assert.match(getDownloadFailureHint('ETIMEDOUT'), /连接超时/)
  assert.match(getDownloadFailureHint('aborted'), /连接中断/)
  assert.match(getDownloadFailureHint('ENOSPC'), /磁盘空间不足/)
  assert.match(getDownloadFailureHint('EACCES'), /无法写入/)
  assert.match(getDownloadFailureHint('视频地址返回的内容不是有效视频'), /未返回有效媒体/)
})

test('unknown download errors do not leak signed URLs or raw technical details', () => {
  const hint = getDownloadFailureHint(new Error('https://example.invalid/video?token=secret'))
  assert.doesNotMatch(hint, /secret|example|token/)
  assert.match(hint, /单独重试/)
  assert.equal(getDownloadFailureHint(), hint)
})
