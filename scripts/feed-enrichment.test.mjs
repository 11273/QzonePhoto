import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { compileFunction } from 'node:vm'

const source = await readFile(
  new URL('../src/renderer/src/views/photo/components/photo-module.vue', import.meta.url),
  'utf8'
)
const enrichment = source.slice(
  source.indexOf('const enrichFeedsWithShuoshuo ='),
  source.indexOf('let currentLoadId =')
)
assert.match(enrichment, /background: true/)
const setup = () => {
  const feeds = { value: [{ time: '100', sourceName: 'original', comments: [] }] }
  const host = { value: '10001' }
  let respond
  let reject
  const requests = []
  const window = {
    QzoneAPI: {
      getShuoshuo: (...args) => {
        requests.push(args)
        return new Promise((resolve, rejectPromise) => {
          respond = resolve
          reject = rejectPromise
        })
      }
    }
  }
  const api = compileFunction(
    `${enrichment}
    let currentLoadId = 1;
    return { enrich: enrichFeedsWithShuoshuo, setLoadId: value => currentLoadId = value }`,
    ['window', 'feeds', 'effectiveHostUin']
  )(window, feeds, host)
  return {
    ...api,
    feeds,
    host,
    requests,
    respond: (value) => respond(value),
    reject: () => reject(new Error('optional failure'))
  }
}
const reply = { msglist: [{ created_time: 100, source_name: 'enriched' }] }

test('feed enrichment is explicitly passive and keeps the existing feed if unavailable', async () => {
  const app = setup()
  const pending = app.enrich(1)
  assert.deepEqual(app.requests[0][1], { skipAuthCheck: true, background: true })
  app.reject()
  await pending
  assert.equal(app.feeds.value[0].sourceName, 'original')
})

test('late enrichment cannot replace data after refreshing or switching spaces', async () => {
  for (const change of [
    (app) => app.setLoadId(2),
    (app) => {
      app.host.value = '10002'
    }
  ]) {
    const app = setup()
    const pending = app.enrich(1)
    change(app)
    app.respond(reply)
    await pending
    assert.equal(app.feeds.value[0].sourceName, 'original')
  }
})

test('enrichment still fills metadata for the current load', async () => {
  const app = setup()
  const pending = app.enrich(1)
  app.respond(reply)
  await pending
  assert.equal(app.feeds.value[0].sourceName, 'enriched')
})
