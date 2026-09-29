import assert from 'node:assert/strict'
import test from 'node:test'

import { createDemoQzoneAPI } from '../src/preload/demo-api.js'

test('demo visitor APIs stay local and return renderer-compatible data', async () => {
  let realCalls = 0
  const api = createDemoQzoneAPI({
    getVisitorStatus: async () => {
      realCalls += 1
    },
    getVisitorDetail: async () => {
      realCalls += 1
    },
    app: {},
    update: {},
    download: {},
    upload: {},
    window: {}
  })

  const [status, detail] = await Promise.all([
    api.getVisitorStatus(),
    api.getVisitorDetail({ mask: 2, mod: 2 })
  ])

  assert.equal(realCalls, 0)
  assert.deepEqual(status.data.module_3.data.items, [])
  assert.equal(detail.code, 0)
  assert.equal(Array.isArray(detail.data.items), true)
  assert.equal(detail.data.calvisitcount.length, 30)
  assert.equal(Array.isArray(detail.data.modvisitcount), true)
})
