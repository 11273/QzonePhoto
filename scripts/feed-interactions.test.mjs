import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectAllComments,
  collectAllLikers,
  countCommentTree,
  mergeCommentRoots,
  mergeLikers
} from '../src/renderer/src/utils/feedInteractions.js'

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

test('matching the like count without names is still incomplete', async () => {
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
  assert.equal(result.complete, false)
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
