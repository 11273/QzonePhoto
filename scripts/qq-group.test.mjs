import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeQQGroupMembers,
  normalizeQQGroups,
  paginateQQGroupMembers,
  QQ_GROUP_MEMBER_PAGE_SIZE
} from '../src/shared/qq-group.js'

test('normalizes and deduplicates visible QQ groups', () => {
  const result = normalizeQQGroups({
    data: {
      areadata: { groupid: 20001 },
      groupinfo: [
        { groupid: 20001, groupname: '摄影交流' },
        { groupid: '20001', groupname: '重复项' },
        { groupid: 20002, groupname: '' }
      ]
    }
  })

  assert.deepEqual(result, {
    defaultGroupId: '20001',
    groups: [
      { id: '20001', name: '摄影交流' },
      { id: '20002', name: '未命名群' }
    ]
  })
})

test('uses group score order to exclude unrelated friend profiles', () => {
  const members = normalizeQQGroupMembers(
    {
      data: {
        friendinfo: {
          10001: { nickname: '成员甲' },
          10002: { nickname: '成员乙' },
          10999: { nickname: '非群成员' }
        },
        groupdayscore: [{ uin: 10002, score: 8 }],
        grouptotalscore: [
          { uin: 10001, totalscore: 20 },
          { uin: 10002, totalscore: 30 }
        ]
      }
    },
    '20001'
  )

  assert.deepEqual(
    members.map(({ uin, name }) => ({ uin, name })),
    [
      { uin: '10002', name: '成员乙' },
      { uin: '10001', name: '成员甲' }
    ]
  )
  assert.deepEqual(
    members.map(({ uin, dayScore, totalScore, dayRank, totalRank }) => ({
      uin,
      dayScore,
      totalScore,
      dayRank,
      totalRank
    })),
    [
      { uin: '10002', dayScore: 8, totalScore: 30, dayRank: 1, totalRank: 2 },
      { uin: '10001', dayScore: 0, totalScore: 20, dayRank: 0, totalRank: 1 }
    ]
  )
  assert.equal(members[0].score, 30)
})

test('keeps every member returned by the selected-group endpoint', () => {
  const members = normalizeQQGroupMembers(
    {
      groupmeminfo: {
        10001: { nickname: '成员甲' },
        10002: { nickname: '成员乙', remark: '备注' }
      },
      groupdayscore: [{ uin: 10001, score: 5 }]
    },
    '20001'
  )

  assert.equal(members.length, 2)
  assert.equal(members[1].remark, '备注')
  assert.match(members[0].img, /\/10001\/10001\/100$/)
})

test('reveals group members in local pages without requesting another group', () => {
  const members = Array.from({ length: 75 }, (_, index) => ({ uin: String(10000 + index) }))

  assert.equal(paginateQQGroupMembers(members).length, QQ_GROUP_MEMBER_PAGE_SIZE)
  assert.equal(paginateQQGroupMembers(members, QQ_GROUP_MEMBER_PAGE_SIZE * 2).length, 60)
  assert.equal(paginateQQGroupMembers(members, 90).length, 75)
})
