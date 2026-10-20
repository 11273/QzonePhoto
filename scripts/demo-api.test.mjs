import assert from 'node:assert/strict'
import test from 'node:test'

import { createDemoQzoneAPI } from '../src/preload/demo-api.js'

test('demo automatic/manual download settings remain local and never call the real client', async () => {
  const forbidden = () => assert.fail('demo settings must not modify real download preferences')
  const api = createDemoQzoneAPI({
    download: {
      getConcurrencySettings: forbidden,
      setConcurrency: forbidden,
      setAutomaticConcurrency: forbidden
    }
  })
  assert.deepEqual(await api.download.getConcurrencySettings(), { concurrency: 3, automatic: true })
  assert.equal(await api.download.setConcurrency(2), 2)
  assert.deepEqual(await api.download.getConcurrencySettings(), {
    concurrency: 2,
    automatic: false
  })
  assert.deepEqual(await api.download.setAutomaticConcurrency(true), {
    concurrency: 2,
    automatic: true
  })
})

test('demo download pages use the same response, sorting and filtering contract as IPC', async () => {
  const api = createDemoQzoneAPI({})
  const page = await api.download.getTasks({ page: 1, pageSize: 2 })
  assert.equal(page.tasks.length, 2)
  assert.equal(page.pagination.total, 6)
  assert.ok(page.tasks.every((task) => task.status === 'downloading'))
  const completed = await api.download.getTasks({ status: 'completed' })
  assert.equal(completed.pagination.total, 3)
  assert.ok(completed.tasks.every((task) => task.status === 'completed'))
  assert.deepEqual(await api.download.requestTasksPage({ page: 1, pageSize: 2 }), page)
})

test('demo visitor APIs stay local and return renderer-compatible data', async () => {
  let realCalls = 0
  const api = createDemoQzoneAPI({
    getVisitorStatus: async () => {
      realCalls += 1
    },
    getVisitorDetail: async () => {
      realCalls += 1
    },
    getVisitorMore: async () => {
      realCalls += 1
    },
    getScheduledShuoshuo: async () => {
      realCalls += 1
    },
    app: {},
    update: {},
    download: {},
    upload: {},
    window: {}
  })

  const [status, detail, visitorMore, scheduled] = await Promise.all([
    api.getVisitorStatus(),
    api.getVisitorDetail({ mask: 2, mod: 2 }),
    api.getVisitorMore({ page: 1 }),
    api.getScheduledShuoshuo({ pos: 0, num: 10 })
  ])

  assert.equal(realCalls, 0)
  assert.deepEqual(status.data.module_3.data.items, [])
  assert.equal(detail.code, 0)
  assert.equal(Array.isArray(detail.data.items), true)
  assert.equal(detail.data.calvisitcount.length, 30)
  assert.equal(Array.isArray(detail.data.modvisitcount), true)
  assert.deepEqual(visitorMore.items, [])
  assert.deepEqual(scheduled.msglist, [])
})
