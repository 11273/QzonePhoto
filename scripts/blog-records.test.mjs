import assert from 'node:assert/strict'
import test from 'node:test'

import {
  blogOfficialUrl,
  normalizeBlogRecord,
  safeWebUrl
} from '../src/renderer/src/utils/blogRecords.js'

test('external links reject executable and non-web protocols', () => {
  assert.equal(safeWebUrl('javascript:alert(1)'), '')
  assert.equal(safeWebUrl('mqqapi://card/show_pslcard'), '')
  assert.equal(safeWebUrl('//example.com/path'), 'https://example.com/path')
})

test('blog summaries build official read links without pretending to contain the body', () => {
  const feed = normalizeBlogRecord(
    {
      blogId: 'entry_1',
      hostUin: '10001',
      nickname: '匿名作者',
      title: '日志标题',
      abstract: '<p>第一段<br>第二段</p>',
      pubTime: 1700000000
    },
    { formatTime: () => '2023-11-14 22:13' }
  )
  assert.equal(feed.appType, '日志')
  assert.equal(feed.linkCard.url, 'https://user.qzone.qq.com/10001/blog/entry_1')
  assert.match(feed.contentText, /第一段\n第二段/)
  assert.equal(feed.commentsFetchable, false)
  assert.equal(blogOfficialUrl('not-a-uin', 'entry'), '')
  assert.equal(blogOfficialUrl('10001', '../entry'), '')
})
