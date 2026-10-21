import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const boundaries = {
  electron: 'export const app = {}',
  'fs-extra': 'export default __runtime.fs',
  '@electron-toolkit/utils': 'export const is = { dev: false }',
  '@main/core/logger': 'export default console',
  '@main/core/window': 'export default { getMainWindow: () => null }',
  '@main/api': `export const fileUpload = (...args) => __runtime.upload(...args);
    export const fileBatchControl = () => {}; export const uploadVideoCover = () => {}`,
  '@main/services/video-metadata': 'export const getVideoMetadata = () => {}',
  '@main/utils/heic-converter.mjs': `export const isHeicImage = () => false;
    export const cleanupExpiredHeicCache = () => {};
    export const getHeicUploadCacheDirectory = () => {};
    export const prepareHeicForUpload = () => {};
    export const removePreparedHeicFile = () => {}`,
  '@main/services/app-telemetry':
    'export const reportHealthEvent = () => {}; export const telemetryBuckets = {}'
}
const bundle = await build({
  entryPoints: [path.join(root, 'src/main/services/main/upload.js')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  alias: { '@main': path.join(root, 'src/main'), '@shared': path.join(root, 'src/shared') },
  plugins: [
    {
      name: 'upload-boundaries',
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

const setup = async (t, { maxRead = Infinity, truncateAfterSend = false } = {}) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-upload-read-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const source = Buffer.from(Array.from({ length: 16384 * 6 + 17 }, (_, i) => i % 251))
  const filePath = path.join(directory, 'sample.jpg')
  await fs.writeFile(filePath, source)
  const sent = []
  let closed = false
  let truncation
  const runtime = {
    fs: {
      promises: {
        open: async (...args) => {
          const handle = await fs.open(...args)
          return {
            read: async (buffer, offset, length, position) => {
              // Make the source change deterministic before the next round of four workers.
              if (truncateAfterSend && position >= 16384 * 4) await truncation
              return handle.read(buffer, offset, Math.min(length, maxRead), position)
            },
            close: async () => {
              closed = true
              await handle.close()
            }
          }
        }
      }
    },
    upload: async (_uin, _key, _host, _session, offset, base64, end) => {
      sent.push({ offset, end, bytes: Buffer.from(base64, 'base64') })
      if (truncateAfterSend && sent.length === 1) {
        truncation = fs.truncate(filePath, 0)
        await truncation
      }
      return { ret: 0, data: { flag: end === source.length ? 1 : 0 } }
    }
  }
  const module = { exports: {} }
  compileFunction(bundle.outputFiles[0].text, ['require', 'module', 'exports', '__runtime'])(
    createRequire(import.meta.url),
    module,
    module.exports,
    runtime
  )
  const service = new module.exports.UploadService()
  service.updateTaskInDB = () => {}
  service.pushTaskProgressDirect = () => {}
  const task = { id: 'synthetic', filePath, total: source.length, session: 'synthetic' }
  return {
    service,
    task,
    sent,
    source,
    closed: () => closed,
    assertChunks() {
      for (const { offset, end, bytes } of sent) {
        assert.deepEqual(bytes, source.subarray(offset, end), 'never send unread/padded bytes')
      }
    }
  }
}

test('normal image and video chunks retain their exact bytes and completion', async (t) => {
  for (const isVideo of [false, true]) {
    const app = await setup(t)
    app.task.isVideo = isVideo
    await app.service.performChunkedUpload(app.task)
    app.assertChunks()
    assert.equal(
      app.sent.reduce((sum, chunk) => sum + chunk.bytes.length, 0),
      app.source.length
    )
    assert.equal(app.task.progress, 100)
    assert.equal(app.closed(), true)
  }
})

test('legal short reads are filled before a chunk is encoded and sent', async (t) => {
  const app = await setup(t, { maxRead: 137 })
  await app.service.performChunkedUpload(app.task)
  app.assertChunks()
  assert.equal(app.task.uploaded, app.source.length)
  assert.equal(app.closed(), true)
})

test('a source truncated during upload fails cleanly without sending unread memory', async (t) => {
  const app = await setup(t, { truncateAfterSend: true })
  await assert.rejects(app.service.performChunkedUpload(app.task), /文件已变化或被截断/)
  app.assertChunks()
  assert.ok(app.sent.length < Math.ceil(app.source.length / app.service.defaultChunkSize))
  assert.equal(app.closed(), true)
})
