import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { compileFunction } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const boundaries = {
  electron: 'export const app = __runtime.app',
  '@main/config/app-api': 'export const getAppApiConfig = async () => __runtime.config',
  '@main/core/logger': 'export default { debug: () => {} }'
}
const bundle = await build({
  entryPoints: [path.join(root, 'src/main/services/app-telemetry.js')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  plugins: [
    {
      name: 'local-api-boundaries',
      setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path }) =>
          Object.hasOwn(boundaries, path) ? { path, namespace: 'boundary' } : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({
          contents: boundaries[path],
          loader: 'js'
        }))
      }
    }
  ]
})

const setup = async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-app-api-test-'))
  const requests = []
  let status = 200
  let data = { ok: true, data: { notice: null, notices: [] } }
  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requests.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString() })
    const reply = typeof data === 'function' ? await data(req) : { status, data }
    if (!res.destroyed) {
      res.writeHead(reply.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(reply.data))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await fs.rm(dir, { recursive: true, force: true })
  })
  const runtime = {
    config: { apiBaseUrl: `http://127.0.0.1:${server.address().port}` },
    app: { getPath: () => dir, getVersion: () => 'test', isPackaged: false }
  }
  const module = { exports: {} }
  compileFunction(bundle.outputFiles[0].text, ['require', 'module', 'exports', '__runtime'])(
    createRequire(import.meta.url),
    module,
    module.exports,
    runtime
  )
  return {
    ...module.exports,
    requests,
    respond: (nextStatus, nextData) => {
      status = nextStatus
      data = nextData
    }
  }
}

test('notice HTTP failures and malformed bodies reject instead of erasing cached state; empty success remains valid', async (t) => {
  const api = await setup(t)
  for (const [status, data] of [
    [503, {}],
    [429, {}],
    [200, { ok: false }],
    [200, 'upstream error']
  ]) {
    api.respond(status, data)
    await assert.rejects(api.fetchNotices())
  }
  api.respond(200, { ok: true, data: { notice: null, notices: [] } })
  assert.deepEqual(await api.fetchNotices(), { notice: null, notices: [], health: null })
  assert.equal(
    api.requests.at(-1).method,
    'POST',
    'failed startup attempts must not mark launch as reported'
  )
  await api.fetchNotices()
  assert.equal(api.requests.at(-1).method, 'GET')
  const notice = { id: 'test', title: 'local notice', content: 'test' }
  api.respond(200, { ok: true, data: { notice } })
  assert.deepEqual((await api.fetchNotices()).notices, [notice])
})

test('feedback refresh validates data and retains compatibility with old replies-only backends', async (t) => {
  const api = await setup(t)
  for (const [status, data] of [
    [503, {}],
    [429, {}],
    [200, 'invalid body']
  ]) {
    api.respond(status, data)
    await assert.rejects(api.fetchFeedbackThreads())
  }
  api.respond(200, { ok: true, data: { threads: [] } })
  assert.deepEqual(await api.fetchFeedbackThreads(), { threads: [] })
  api.respond(404, (req) =>
    req.url.endsWith('/replies')
      ? {
          status: 200,
          data: { ok: true, data: { replies: [{ feedbackId: 1, reply: 'legacy reply' }] } }
        }
      : { status: 404, data: {} }
  )
  assert.equal((await api.fetchFeedbackThreads()).threads[0].messages[0].content, 'legacy reply')
  assert.equal(api.requests.at(-1).url, '/api/feedback/replies')
})

test(
  'a stalled public API times out without blocking subsequent recovery',
  { timeout: 10000 },
  async (t) => {
    const api = await setup(t)
    api.respond(200, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return { status: 200, data: { ok: true, data: { notice: null, notices: [] } } }
    })
    await assert.rejects(api.fetchNotices(), /timeout/)
    api.respond(200, { ok: true, data: { notice: null, notices: [] } })
    assert.equal((await api.fetchNotices()).notice, null)
  }
)

test('health failures are not misreported as successful storage', async (t) => {
  const api = await setup(t)
  api.respond(503, {})
  await assert.rejects(api.reportHealthEvent({ event: 'local-test' }))
  api.respond(200, { ok: true, data: { stored: true } })
  assert.deepEqual(await api.reportHealthEvent({ event: 'local-test' }), { stored: true })
})
