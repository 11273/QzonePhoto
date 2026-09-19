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

test('任务列表默认按创建时间从新到旧排序', () => {
  assert.deepEqual(
    sortDownloadTasks(tasks).map((task) => task.id),
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

test('无效排序值会回退到最新创建', () => {
  assert.equal(normalizeDownloadTaskSort('unknown'), DOWNLOAD_TASK_SORT.CREATED_DESC)
  assert.deepEqual(
    sortDownloadTasks(tasks, 'unknown').map((task) => task.id),
    ['completed-new', 'waiting-middle', 'failed-old']
  )
})
