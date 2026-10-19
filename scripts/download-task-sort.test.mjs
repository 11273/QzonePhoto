import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DOWNLOAD_TASK_SORT,
  normalizeDownloadTaskSort,
  sortDownloadTasks
} from '../src/shared/download-task-sort.js'

const tasks = [
  { id: 'failed-old', status: 'error', create_time: 100 },
  { id: 'completed-new', status: 'completed', create_time: 300 },
  { id: 'waiting-middle', status: 'waiting', create_time: 200 }
]

test('任务列表支持显式按创建时间从新到旧排序', () => {
  assert.deepEqual(
    sortDownloadTasks(tasks, DOWNLOAD_TASK_SORT.CREATED_DESC).map((task) => task.id),
    ['completed-new', 'waiting-middle', 'failed-old']
  )
  assert.equal(tasks[0].id, 'failed-old')
})

test('任务列表支持按创建时间从旧到新排序', () => {
  assert.deepEqual(
    sortDownloadTasks(tasks, DOWNLOAD_TASK_SORT.CREATED_ASC).map((task) => task.id),
    ['failed-old', 'waiting-middle', 'completed-new']
  )
})

test('状态优先排序保留队列顺序并把完成任务放在后面', () => {
  const queueTasks = [
    ...tasks,
    { id: 'waiting-first', status: 'waiting', create_time: 50 },
    { id: 'downloading', status: 'downloading', create_time: 400 }
  ]

  assert.deepEqual(
    sortDownloadTasks(queueTasks, DOWNLOAD_TASK_SORT.STATUS_PRIORITY).map((task) => task.id),
    ['downloading', 'waiting-first', 'waiting-middle', 'failed-old', 'completed-new']
  )
})

test('默认和无效排序值会回退到下载优先，进行中任务不会藏在底部', () => {
  assert.equal(normalizeDownloadTaskSort('unknown'), DOWNLOAD_TASK_SORT.STATUS_PRIORITY)
  assert.deepEqual(
    sortDownloadTasks(tasks, 'unknown').map((task) => task.id),
    ['waiting-middle', 'failed-old', 'completed-new']
  )
  assert.deepEqual(sortDownloadTasks(tasks), sortDownloadTasks(tasks, 'unknown'))
})

test('长视频和同一毫秒入队的图片保持队列顺序，不按进度、速度或更新时间重排', () => {
  const queue = [
    { id: 'video', status: 'downloading', create_time: 100, progress: 1 },
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `image-${index}`,
      status: 'waiting',
      create_time: 100,
      progress: 0
    }))
  ]
  for (let i = 1; i <= 30; i++) {
    queue[0].progress = i * 3
    queue[0].speed = i % 2 ? 512000 : 640000
    queue[0].update_time = Date.now()
    queue[i].status = 'completed'
    if (queue[i + 1]) queue[i + 1].status = 'downloading'
    assert.equal(sortDownloadTasks(queue)[0].id, 'video')
  }
})
