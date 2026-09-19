import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mergeMessageBoardPages,
  messageReplyTarget
} from '../src/renderer/src/utils/messageBoardRecords.js'

test('message board pages remove duplicate roots and merge additional replies', () => {
  const first = [
    {
      id: 'message-1',
      uin: '10001',
      pubtime: '2026-09-19 10:00:00',
      replyList: [{ id: 'reply-1', uin: '10002', content: '第一条回复' }]
    }
  ]
  const second = [
    {
      ...first[0],
      replyList: [first[0].replyList[0], { id: 'reply-2', uin: '10003', content: '第二条回复' }]
    },
    { id: 'message-2', uin: '10004', pubtime: '2026-09-19 11:00:00', replyList: [] }
  ]
  const merged = mergeMessageBoardPages(first, second)
  assert.equal(merged.length, 2)
  assert.equal(merged[0].replyList.length, 2)
})

test('message board replies preserve their reply target', () => {
  assert.deepEqual(messageReplyTarget({ target_uin: '10005', target_name: '被回复者' }), {
    uin: '10005',
    name: '被回复者'
  })
  assert.deepEqual(messageReplyTarget({ toUin: 'o10006', toName: '另一位用户' }), {
    uin: '10006',
    name: '另一位用户'
  })
})
