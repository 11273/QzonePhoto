import assert from 'node:assert/strict'
import test from 'node:test'

import { buildContactBackupFiles, contactBackupTimestamp } from '../src/shared/contact-backup.js'

test('contact backup creates readable HTML, text and CSV files without unescaped names', () => {
  const exportedAt = new Date(2026, 8, 19, 8, 9, 10)
  const files = buildContactBackupFiles(
    {
      owner: { name: '备份账号', uin: '10000' },
      friends: [
        {
          groupName: '同学',
          name: '<昵称>',
          remark: '备注',
          uin: '10001',
          online: 1,
          yellow: 6,
          v6: 1,
          img: 'https://example.test/a'
        }
      ],
      groups: [{ id: '20001', name: '交流群', memberCount: 1 }],
      groupMembers: [{ groupId: '20001', groupName: '交流群', name: '成员', uin: '10002' }]
    },
    exportedAt
  )

  assert.deepEqual(Object.keys(files), [
    '联系人总览_2026-09-19_08-09-10.html',
    '备份说明_2026-09-19_08-09-10.txt',
    '联系人数据_2026-09-19_08-09-10.json',
    '联系人汇总_2条.csv',
    '好友/好友名单_2026-09-19_08-09-10.html',
    '好友/好友分组_1组.csv',
    '好友/好友列表_1位.csv',
    '群/群与成员_2026-09-19_08-09-10.html',
    '群/群列表_1个.csv',
    '群/群成员_1条.csv',
    '亲密度/亲密度名单_2026-09-19_08-09-10.html',
    '亲密度/亲密度_0条.csv'
  ])
  assert.match(files['联系人总览_2026-09-19_08-09-10.html'], /&lt;昵称&gt;/)
  assert.doesNotMatch(files['联系人总览_2026-09-19_08-09-10.html'], /<昵称>/)
  assert.match(files['联系人总览_2026-09-19_08-09-10.html'], /data-fold="close"/)
  assert.match(files['联系人总览_2026-09-19_08-09-10.html'], /aria-expanded="true"/)
  assert.ok(files['联系人汇总_2条.csv'].startsWith('\ufeff'))
  assert.match(files['备份说明_2026-09-19_08-09-10.txt'], /可见群成员记录：1 条/)
  assert.match(files['好友/好友名单_2026-09-19_08-09-10.html'], /有黄钻资料/)
  assert.match(files['好友/好友名单_2026-09-19_08-09-10.html'], /来源账号 备份账号 · QQ 10000/)
  assert.match(files['好友/好友名单_2026-09-19_08-09-10.html'], /在线 · 黄钻 6 · QQ 会员/)
  assert.doesNotMatch(files['好友/好友名单_2026-09-19_08-09-10.html'], /data-filter="friends"/)
  const machineData = JSON.parse(files['联系人数据_2026-09-19_08-09-10.json'])
  assert.equal(machineData.schemaVersion, 1)
  assert.deepEqual(machineData.owner, { name: '备份账号', uin: '10000' })
  assert.equal(machineData.collections[0].records[0].yellowLevel, 6)
})

test('contact backup folder timestamp is stable and filename-safe', () => {
  assert.equal(contactBackupTimestamp(new Date(2026, 8, 19, 8, 9, 10)), '2026-09-19_08-09-10')
})

test('scoped backups share one HTML layout and only add relevant detail CSV files', () => {
  const exportedAt = new Date(2026, 8, 19, 8, 9, 10)
  const friends = buildContactBackupFiles({ scope: 'friends', friends: [] }, exportedAt)
  assert.deepEqual(Object.keys(friends), [
    '联系人总览_2026-09-19_08-09-10.html',
    '备份说明_2026-09-19_08-09-10.txt',
    '联系人数据_2026-09-19_08-09-10.json',
    '联系人汇总_0条.csv',
    '好友/好友名单_2026-09-19_08-09-10.html',
    '好友/好友分组_0组.csv',
    '好友/好友列表_0位.csv'
  ])

  const groups = buildContactBackupFiles(
    { scope: 'groups', groups: [], groupMembers: [] },
    exportedAt
  )
  assert.deepEqual(Object.keys(groups), [
    '联系人总览_2026-09-19_08-09-10.html',
    '备份说明_2026-09-19_08-09-10.txt',
    '联系人数据_2026-09-19_08-09-10.json',
    '联系人汇总_0条.csv',
    '群/群与成员_2026-09-19_08-09-10.html',
    '群/群列表_0个.csv',
    '群/群成员_0条.csv'
  ])

  const currentGroup = buildContactBackupFiles(
    {
      scope: 'current-group',
      groups: [{ id: '20001', name: '匿名群', status: '已读取' }],
      groupMembers: [{ groupId: '20001', groupName: '匿名群', name: '匿名成员', uin: '10001' }]
    },
    exportedAt
  )
  const currentGroupHtml = currentGroup['联系人总览_2026-09-19_08-09-10.html']
  assert.match(currentGroupHtml, /当前群/)
  assert.doesNotMatch(currentGroupHtml, /data-fold="open"/)
  assert.doesNotMatch(currentGroupHtml, /data-filter="groups"/)

  const currentFriendGroup = buildContactBackupFiles(
    { scope: 'current-friend-group', friendGroups: [], friends: [] },
    exportedAt
  )
  assert.match(currentFriendGroup['联系人总览_2026-09-19_08-09-10.html'], /当前好友分组/)
  assert.ok(currentFriendGroup['好友/好友列表_0位.csv'])

  const intimacy = buildContactBackupFiles({ scope: 'intimacy', care: [], careBy: [] }, exportedAt)
  assert.deepEqual(Object.keys(intimacy), [
    '联系人总览_2026-09-19_08-09-10.html',
    '备份说明_2026-09-19_08-09-10.txt',
    '联系人数据_2026-09-19_08-09-10.json',
    '联系人汇总_0条.csv',
    '亲密度/亲密度名单_2026-09-19_08-09-10.html',
    '亲密度/亲密度_0条.csv'
  ])
  assert.doesNotMatch(intimacy['亲密度/亲密度名单_2026-09-19_08-09-10.html'], /data-fold="open"/)

  const currentIntimacy = buildContactBackupFiles(
    {
      scope: 'current-intimacy',
      intimacyType: 'care-by',
      care: [],
      careBy: [{ name: '匿名好友', uin: '10001', score: 50 }]
    },
    exportedAt
  )
  const currentIntimacyHtml = currentIntimacy['联系人总览_2026-09-19_08-09-10.html']
  assert.match(currentIntimacyHtml, /当前亲密度/)
  assert.match(currentIntimacyHtml, /谁在意我/)
  assert.doesNotMatch(currentIntimacyHtml, /我在意谁/)
  assert.ok(currentIntimacy['亲密度/亲密度_1条.csv'])
})

test('full backup aggregates friend groups, QQ groups and intimacy into one searchable HTML', () => {
  const exportedAt = new Date(2026, 8, 19, 8, 9, 10)
  const files = buildContactBackupFiles(
    {
      scope: 'all',
      friendGroups: [
        { id: 1, name: '同学' },
        { id: 2, name: '家人' }
      ],
      friends: [{ groupid: 1, groupName: '同学', remark: '小明', name: 'Ming', uin: '10001' }],
      groups: [{ id: '20001', name: '摄影群', status: '已读取', memberCount: 1 }],
      groupMembers: [{ groupId: '20001', groupName: '摄影群', name: '成员', uin: '10002' }],
      care: [{ name: '在意的人', uin: '10003', score: 90 }],
      careBy: [{ name: '在意我的人', uin: '10004', score: 80 }]
    },
    exportedAt
  )
  const html = files['联系人总览_2026-09-19_08-09-10.html']

  assert.match(html, /data-kind="friends"/)
  assert.match(html, /data-kind="groups"/)
  assert.match(html, /data-kind="intimacy"/)
  assert.match(html, />同学</)
  assert.match(html, />家人</)
  assert.match(html, />摄影群</)
  assert.match(html, />我在意谁</)
  assert.match(html, />谁在意我</)
  assert.match(html, /搜索备注、昵称、QQ 号或分组/)
  assert.match(html, /data-filter="friends"/)
  assert.ok(files['联系人汇总_4条.csv'])
})

test('contact backup preserves score dimensions and marks reciprocal intimacy records', () => {
  const exportedAt = new Date(2026, 8, 19, 8, 9, 10)
  const files = buildContactBackupFiles(
    {
      scope: 'all',
      groups: [{ id: '20001', name: '匿名群', status: '已读取', memberCount: 1 }],
      groupMembers: [
        {
          groupId: '20001',
          groupName: '匿名群',
          name: '匿名成员',
          uin: '10002',
          level: 12,
          dayScore: 3,
          weekScore: 10,
          monthScore: 20,
          totalScore: 99,
          dayRank: 2,
          totalRank: 8
        }
      ],
      care: [{ name: '匿名好友', uin: '10003', score: 90 }],
      careBy: [{ name: '匿名好友', uin: '10003', score: 80 }]
    },
    exportedAt
  )

  assert.match(files['群/群与成员_2026-09-19_08-09-10.html'], /总积分 99 · 今日 3/)
  assert.match(files['群/群成员_1条.csv'], /"今日积分"/)
  assert.match(files['群/群成员_1条.csv'], /"总榜排名"/)
  assert.match(files['亲密度/亲密度名单_2026-09-19_08-09-10.html'], /双方名单均出现/)
  assert.match(files['亲密度/亲密度_2条.csv'], /"双方名单均出现"/)
})

test('partial backup preserves readable files and explains retryable missing sections', () => {
  const exportedAt = new Date(2026, 8, 19, 8, 9, 10)
  const files = buildContactBackupFiles(
    {
      scope: 'all',
      friends: [{ groupName: '同学', name: '可见好友', uin: '10001' }],
      warnings: [{ type: 'groups', message: '群列表暂时无法读取' }]
    },
    exportedAt
  )

  assert.match(files['联系人总览_2026-09-19_08-09-10.html'], /部分内容暂时未读取/)
  assert.match(files['联系人总览_2026-09-19_08-09-10.html'], /群列表暂时无法读取/)
  assert.match(files['备份说明_2026-09-19_08-09-10.txt'], /未完整读取/)
  assert.ok(files['好友/好友列表_1位.csv'])
  assert.ok(files['群/群列表_0个.csv'])
})

test('large grouped backups collapse later groups by default while keeping search controls', () => {
  const exportedAt = new Date(2026, 8, 19, 8, 9, 10)
  const groups = Array.from({ length: 8 }, (_, index) => ({
    id: String(20000 + index),
    name: `匿名群 ${index + 1}`,
    status: '已读取'
  }))
  const files = buildContactBackupFiles({ scope: 'groups', groups, groupMembers: [] }, exportedAt)
  const html = files['群/群与成员_2026-09-19_08-09-10.html']

  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /class="collection-body" hidden/)
  assert.match(html, /placeholder="搜索群名、群号、成员昵称或 QQ 号"/)
  assert.doesNotMatch(html, /data-filter="groups"/)
})
