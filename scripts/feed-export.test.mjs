import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFeedExportText,
  countFeedComments,
  readableFeedText
} from '../src/renderer/src/utils/feedExport.js'

test('feed export keeps complete text, original media and interaction details', () => {
  const feed = {
    name: '测试用户',
    uin: '10001',
    feedstime: '2026-09-15 10:30',
    appType: '说说',
    contentText: '正文 @{uin:10002,nick:好友,who:1}',
    media: [
      { type: 'photo', origin: 'https://example.com/original.jpg', thumb: 'thumb.jpg' },
      { type: 'video', url: 'https://example.com/video.mp4' }
    ],
    likeCount: 3,
    likers: [{ name: '点赞者', uin: '10003' }],
    cmtCount: 2
  }
  const comments = [
    {
      author: '评论者',
      uin: '10004',
      text: '第一条',
      time: '10:31',
      responses: [
        { author: '回复者', uin: '10005', targetNick: '评论者', text: '收到', responses: [] }
      ]
    }
  ]

  const output = buildFeedExportText(feed, comments)
  assert.match(output, /正文 @好友/)
  assert.match(output, /\[图片\] https:\/\/example\.com\/original\.jpg/)
  assert.match(output, /\[视频\] https:\/\/example\.com\/video\.mp4/)
  assert.match(output, /点赞：3/)
  assert.match(output, /点赞者（QQ：10003）/)
  assert.match(output, /评论（已提取 2 \/ 接口统计 2）/)
  assert.match(output, /回复者（QQ：10005） 回复 @评论者：收到/)
})

test('comment counting includes nested replies', () => {
  assert.equal(
    countFeedComments([{ responses: [{ responses: [{ responses: [] }] }] }, { responses: [] }]),
    4
  )
})

test('readable feed text normalizes rich mentions without dropping surrounding content', () => {
  assert.equal(readableFeedText('前文  @{uin:42,nick:小明,who:1}\r\n后文'), '前文 @小明\n后文')
})
