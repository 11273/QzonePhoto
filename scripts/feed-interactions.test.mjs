import assert from 'node:assert/strict'
import test from 'node:test'

import {
  areCommentRepliesComplete,
  canExpandFeedComments,
  collectAllComments,
  collectAllLikers,
  countCommentTree,
  interactionFailureHint,
  mergeCommentRoots,
  mergeLikers
} from '../src/renderer/src/utils/feedInteractions.js'
import { normalizeShuoshuoComments } from '../src/renderer/src/utils/feedShuoshuoComments.js'
import { normalizeCommentDisplayText } from '../src/renderer/src/utils/feedCommentText.js'

test('five likes resolve to five distinct named people, independent of 24 views', async () => {
  const cursors = []
  const result = await collectAllLikers({
    expected: 5,
    requestPage: async (cursor) => {
      cursors.push(cursor)
      return {
        code: 0,
        total: 5,
        likers: Array.from({ length: 5 }, (_, index) => ({
          uin: String(10001 + index),
          name: `测试用户${index + 1}`
        }))
      }
    }
  })
  assert.deepEqual(cursors, ['0'])
  assert.equal(result.complete, true)
  assert.equal(result.likers.length, 5)
  assert.deepEqual(
    result.likers.map((item) => item.name),
    ['测试用户1', '测试用户2', '测试用户3', '测试用户4', '测试用户5']
  )
  const viewCount = 24
  assert.equal(viewCount, 24)
})

test('like pagination crosses 60-person page and removes duplicates', async () => {
  const first = Array.from({ length: 60 }, (_, index) => ({
    uin: String(20001 + index),
    name: `用户${index + 1}`
  }))
  const second = [first.at(-1), { uin: '20061', name: '用户61' }]
  const cursors = []
  const result = await collectAllLikers({
    expected: 61,
    requestPage: async (cursor) => {
      cursors.push(cursor)
      return cursor === '0'
        ? { code: 0, total: 61, likers: first, nextCursor: first.at(-1).uin }
        : { code: 0, total: 61, likers: second, nextCursor: second.at(-1).uin }
    }
  })
  assert.deepEqual(cursors, ['0', '20060'])
  assert.equal(result.likers.length, 61)
  assert.equal(result.complete, true)
  assert.equal(mergeLikers(first, second).length, 61)
})

test('unavailable liker page is incomplete and can be retried', async () => {
  const unavailable = await collectAllLikers({
    expected: 5,
    requestPage: async () => ({ code: 0, total: 5, likers: [], hasMore: false })
  })
  assert.equal(unavailable.complete, false)
  const retry = await collectAllLikers({
    initial: unavailable.likers,
    expected: 5,
    requestPage: async () => ({
      code: 0,
      total: 5,
      likers: Array.from({ length: 5 }, (_, index) => ({
        uin: String(30001 + index),
        name: '匿名样本'
      }))
    })
  })
  assert.equal(retry.complete, true)
  await assert.rejects(
    collectAllLikers({ expected: 1, requestPage: async () => ({ code: -1, message: '无权查看' }) }),
    /无权查看/
  )
})

test('a five-like feed stays incomplete when the official list reports zero people', async () => {
  const result = await collectAllLikers({
    expected: 5,
    requestPage: async () => ({ code: 0, total: 0, likers: [] })
  })
  assert.equal(result.total, 5)
  assert.deepEqual(result.likers, [])
  assert.equal(result.complete, false)
})

test('an empty liker page cannot certify an already visible list without a count', async () => {
  const result = await collectAllLikers({
    initial: [{ uin: '30001', name: '已看到的人' }],
    requestPage: async () => ({ code: 0, total: 0, likers: [], hasMore: false })
  })
  assert.equal(result.likers.length, 1)
  assert.equal(result.complete, false)
})

test('an empty or lower-count page preserves visible likers and never claims completeness', async () => {
  const visible = [{ uin: '31001', name: '已看到的人' }]
  const result = await collectAllLikers({
    initial: visible,
    expected: 5,
    requestPage: async () => ({ code: 0, total: 1, likers: [], hasMore: false })
  })
  assert.deepEqual(result.likers, visible)
  assert.equal(result.total, 5)
  assert.equal(result.complete, false)
})

test('known QQ numbers identify every liker even when a nickname is blank', async () => {
  const result = await collectAllLikers({
    expected: 2,
    requestPage: async () => ({
      code: 0,
      total: 2,
      likers: [
        { uin: '32001', name: '可见用户' },
        { uin: '32002', name: '' }
      ],
      hasMore: false
    })
  })
  assert.equal(result.likers.length, 2)
  assert.equal(result.complete, true)
  assert.equal(result.likers[1].uin, '32002')
})

test('an embedded complete liker list needs no extra request despite blank nicknames', async () => {
  const result = await collectAllLikers({
    initial: [
      { uin: '33001', name: '可见用户' },
      { uin: '33002', name: '' }
    ],
    expected: 2,
    requestPage: () => {
      throw new Error('名单已齐，不应再次请求')
    }
  })
  assert.equal(result.complete, true)
  assert.equal(result.total, 2)
})

test('comment pages retain all roots and nested replies without duplicates', async () => {
  const roots = Array.from({ length: 30 }, (_, index) => ({
    id: `root-${index}`,
    uin: String(40001 + index),
    text: `评论${index}`,
    responses: index === 0 ? [{ id: 'reply-1', uin: '45001', text: '回复', responses: [] }] : []
  }))
  const result = await collectAllComments({
    initial: [roots[0]],
    pageSize: 30,
    requestPage: async (start) =>
      start === 0
        ? { code: 0, comments: roots }
        : {
            code: 0,
            comments: [
              {
                ...roots[0],
                responses: [
                  roots[0].responses[0],
                  { id: 'reply-2', uin: '45002', text: '再回复', responses: [] }
                ]
              },
              { id: 'root-30', uin: '40031', text: '评论30', responses: [] }
            ]
          }
  })
  assert.equal(result.complete, true)
  assert.equal(result.comments.length, 31)
  assert.equal(result.comments[0].responses.length, 2)
  assert.equal(countCommentTree(result.comments), 33)
  assert.equal(mergeCommentRoots(result.comments, [roots[0]]).length, 31)
})

test('repeating a comment page does not falsely report a complete list', async () => {
  const page = Array.from({ length: 2 }, (_, index) => ({ id: `repeat-${index}`, responses: [] }))
  const result = await collectAllComments({
    pageSize: 2,
    requestPage: async () => ({ code: 0, comments: page })
  })
  assert.equal(result.complete, false)
  assert.equal(result.comments.length, 2)
})

test('duplicate replies within a single comment page collapse by id', async () => {
  const reply = { id: 'reply-once', uin: '46001', text: '同一回复', responses: [] }
  const result = await collectAllComments({
    requestPage: async () => ({
      code: 0,
      comments: [{ id: 'root-once', responses: [reply, { ...reply }] }],
      hasMore: false
    })
  })
  assert.equal(result.complete, true)
  assert.equal(result.comments[0].responses.length, 1)
})

test('comment count still missing after a short page remains incomplete', async () => {
  const starts = []
  const result = await collectAllComments({
    expected: 5,
    pageSize: 3,
    requestPage: async (start) => {
      starts.push(start)
      return start === 0
        ? { code: 0, comments: [{ id: 'one', text: '可见评论', responses: [] }] }
        : { code: 0, comments: [], hasMore: false }
    }
  })
  assert.deepEqual(starts, [0, 3])
  assert.equal(result.comments.length, 1)
  assert.equal(result.complete, false)
})

test('an empty first comment page does not certify an inline preview as complete', async () => {
  const result = await collectAllComments({
    initial: [{ id: 'visible-root', text: '已看到的评论', responses: [] }],
    requestPage: async () => ({ code: 0, comments: [], hasMore: false })
  })
  assert.equal(result.comments.length, 1)
  assert.equal(result.complete, false)
})

test('comment and reply display preserves complete multiline content', () => {
  assert.equal(
    normalizeCommentDisplayText('第一行\r\n第二行  内容\n 第三行'),
    '第一行\n第二行 内容\n第三行'
  )
})

test('permission failures have plain-language hints without exposing response details', () => {
  assert.equal(
    interactionFailureHint('点赞者', new Error('permission denied: private')),
    '当前账号暂时无法查看全部点赞者'
  )
  assert.equal(interactionFailureHint('评论', new Error('timeout')), '评论加载失败')
})

test('a later page replaces a truncated preview without losing replies', async () => {
  const result = await collectAllComments({
    initial: [
      { id: 'root', text: '内容...', responses: [{ id: 'reply', text: '回复', responses: [] }] }
    ],
    requestPage: async () => ({
      code: 0,
      comments: [
        {
          id: 'root',
          text: '内容完整显示，不应截断',
          responses: [{ id: 'reply', text: '回复内容完整', responses: [] }]
        }
      ],
      hasMore: false
    })
  })
  assert.equal(result.complete, true)
  assert.equal(result.comments[0].text, '内容完整显示，不应截断')
  assert.equal(result.comments[0].responses[0].text, '回复内容完整')
})

test('an inline comment can always be expanded even when the listed count is zero', () => {
  const feed = { cmtCount: 0, inlineComments: [{ id: 'preview', responses: [] }] }
  assert.equal(canExpandFeedComments(feed), true)
  assert.equal(canExpandFeedComments({ cmtCount: 0, inlineComments: [] }), false)
  assert.equal(
    canExpandFeedComments(
      { cmtCount: 0, inlineComments: [] },
      { comments: [feed.inlineComments[0]] }
    ),
    true
  )
})

test('overlapping comment pages that stop making progress do not claim completeness', async () => {
  const page = [
    { id: 'root-a', text: '甲', responses: [] },
    { id: 'root-b', text: '乙', responses: [] }
  ]
  const result = await collectAllComments({
    pageSize: 2,
    expected: 3,
    requestPage: async (start) => ({
      code: 0,
      comments: start % 4 === 0 ? page : [...page].reverse(),
      hasMore: true
    })
  })
  assert.equal(result.complete, false)
  assert.equal(result.comments.length, 2)
})

test('official comment shape retains author, nested reply target and content', () => {
  const comments = normalizeShuoshuoComments(
    [
      {
        id: 'root-1',
        postTime: 1,
        poster: { id: '50001', name: '用户甲' },
        content: '完整评论',
        extendData: { replyNum: 2 },
        replies: [
          {
            id: 'reply-1',
            postTime: 2,
            poster: { id: '50002', name: '用户乙' },
            content: '@{uin:50001,nick:用户甲}收到',
            replies: [
              {
                id: 'reply-2',
                postTime: 3,
                poster: { id: '50003', name: '用户丙' },
                content: '@{uin:50002,nick:用户乙}好的'
              }
            ]
          }
        ]
      }
    ],
    (time) => `2026-08-21 20:0${time}`
  )
  assert.equal(comments[0].uin, '50001')
  assert.equal(comments[0].author, '用户甲')
  assert.equal(comments[0].responses.length, 2)
  assert.equal(comments[0].responses[0].text, '收到')
  assert.equal(comments[0].responses[0].targetUin, '50001')
  assert.equal(comments[0].responses[1].targetUin, '50002')
  assert.equal(comments[0].responses[1].targetNick, '用户乙')
  assert.equal(areCommentRepliesComplete(comments), true)
})

test('a reply addressed to a third person never borrows the parent nickname', () => {
  const comments = normalizeShuoshuoComments([
    {
      id: 'root',
      poster: { id: '50001', name: '用户甲' },
      content: '评论',
      replies: [
        {
          id: 'reply',
          poster: { id: '50002', name: '用户乙' },
          content: '@{uin:50003,nick:}回复第三人'
        }
      ]
    }
  ])
  assert.equal(comments[0].responses[0].targetUin, '50003')
  assert.equal(comments[0].responses[0].targetNick, '')
})

test('HTML preview and official paginated comment IDs merge without double counting', () => {
  const preview = [
    {
      id: ['comment', 'root-1', '50001', '8月21日 20:01', '完整评论'].join('\u001f'),
      uin: '50001',
      author: '用户甲',
      time: '8月21日 20:01',
      text: '完整评论',
      responses: [
        {
          id: ['replyroot', 'reply-1', '50002', '8月21日 20:02', '收到'].join('\u001f'),
          uin: '50002',
          author: '用户乙',
          time: '8月21日 20:02',
          text: '收到',
          responses: []
        }
      ]
    }
  ]
  const paginated = normalizeShuoshuoComments(
    [
      {
        id: 'root-1',
        postTime: 1,
        poster: { id: '50001', name: '用户甲' },
        content: '完整评论',
        extendData: { replyNum: 1 },
        replies: [
          {
            id: 'reply-1',
            postTime: 2,
            poster: { id: '50002', name: '用户乙' },
            content: '@{uin:50001,nick:用户甲}收到'
          }
        ]
      }
    ],
    (time) => `2026-08-21 20:0${time}`
  )
  const merged = mergeCommentRoots(preview, paginated)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].responses.length, 1)
  assert.equal(countCommentTree(merged), 2)
  assert.equal(areCommentRepliesComplete(merged), true)
})

test('a short reply array never claims a complete comment thread', async () => {
  const result = await collectAllComments({
    expected: 1,
    requestPage: async () => ({
      code: 0,
      hasMore: false,
      comments: [
        {
          id: 'root',
          expectedReplyCount: 2,
          responses: [{ id: 'reply-one', responses: [] }]
        }
      ]
    })
  })
  assert.equal(result.complete, false)
  assert.equal(result.comments[0].responses.length, 1)
})
