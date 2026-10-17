import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileFunction } from 'node:vm'
import { build } from 'esbuild'
import { Low } from 'lowdb'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
// Bundle the real service and its helpers; isolate Electron, logging and telemetry only.
const boundaryModules = {
  electron: 'export const app = {}, dialog = {}, shell = {}',
  '@electron-toolkit/utils': 'export const is = { dev: false }',
  '@main/core/logger': 'export default console',
  '@main/services/service-manager': 'export const ServiceNames = { PHOTO: "photo" }',
  '@main/services/app-telemetry':
    'export const reportHealthEvent = async () => {}; export const telemetryBuckets = {}'
}
const bundled = await build({
  entryPoints: [path.join(projectRoot, 'src/main/services/main/download.js')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  alias: {
    '@main': path.join(projectRoot, 'src/main'),
    '@shared': path.join(projectRoot, 'src/shared')
  },
  plugins: [
    {
      name: 'download-test-boundaries',
      setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path: specifier }) =>
          Object.hasOwn(boundaryModules, specifier)
            ? { path: specifier, namespace: 'test-boundary' }
            : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'test-boundary' }, ({ path: specifier }) => ({
          contents: boundaryModules[specifier],
          loader: 'js'
        }))
      }
    }
  ]
})
const serviceModule = { exports: {} }
compileFunction(bundled.outputFiles[0].text, ['require', 'module', 'exports'])(
  createRequire(import.meta.url),
  serviceModule,
  serviceModule.exports
)
const { DownloadService } = serviceModule.exports

const createService = async (t, settings = {}) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-metadata-setting-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  let savedData = null
  const db = new Low(
    {
      read: async () => (savedData ? JSON.parse(savedData) : null),
      write: async (data) => {
        savedData = JSON.stringify(data)
      }
    },
    { settings: { ...settings }, tasks: [], batches: [] }
  )
  // Avoid the constructor's real userData initialization and automatic download queue.
  const service = Object.assign(Object.create(DownloadService.prototype), {
    db,
    downloadPath: directory,
    currentUin: '10001',
    activeTasks: new Map(),
    maxActiveTasksInMemory: 1000,
    processQueue() {}
  })
  return service
}

const metadata = {
  description: '测试动态正文',
  authorName: '测试作者',
  albumName: '测试相册'
}
const photo = {
  name: '测试照片',
  picKey: 'synthetic-photo',
  url: 'https://example.invalid/photo.jpg',
  rawshoottime: '2014-03-02 08:09:10',
  metadataDescription: metadata.description,
  mediaMetadata: metadata
}

test('disabled feed metadata survives reopening settings and reloading the database', async (t) => {
  const service = await createService(t)
  assert.equal(service.getWriteFeedDescriptionSetting(), true)
  assert.equal(await service.setWriteFeedDescriptionSetting(false), false)
  assert.equal(service.getWriteFeedDescriptionSetting(), false)
  await service.db.read()
  assert.equal(service.getWriteFeedDescriptionSetting(), false)
  await service.setWriteFeedDescriptionSetting(true)
  assert.equal(service.getWriteFeedDescriptionSetting(), true)
})

test('settings preserve explicit false, zero and empty values', async (t) => {
  const service = await createService(t, { falseValue: false, zeroValue: 0, emptyValue: '' })
  assert.equal(service.getSetting('falseValue'), false)
  assert.equal(service.getSetting('zeroValue'), 0)
  assert.equal(service.getSetting('emptyValue'), '')
  assert.equal(service.getSetting('missingValue'), null)
})

test('disabled metadata applies to single image and video tasks carrying their own metadata', async (t) => {
  const service = await createService(t)
  // Isolate task creation from the separately tested persistence bug.
  service.getWriteFeedDescriptionSetting = () => false
  for (const type of ['image', 'video']) {
    const taskId = await service.addTask({
      type,
      filename: 'test.jpg',
      url: photo.url,
      metadataDescription: photo.metadataDescription,
      mediaMetadata: photo.mediaMetadata
    })
    const task = service.activeTasks.get(taskId)
    assert.equal(task.metadata_description, '')
    assert.equal(task.media_metadata, null)
  }
})

test('album and feed downloads do not write descriptions, authors or keywords when disabled', async (t) => {
  const service = await createService(t)
  service.getWriteFeedDescriptionSetting = () => false
  const albumTaskIds = await service.addAlbumTasks(
    {
      uin: '10001',
      album: { id: 'synthetic-album', name: '测试相册', feedDescription: '相册自带说明' },
      photos: [photo]
    },
    {}
  )
  const feedTaskIds = await service.addFeedsTasks({
    uin: '10001',
    feeds: [{ skey: 'synthetic-feed', time: 1700000000, desc: '动态正文', photos: [photo] }]
  })
  for (const taskId of [...albumTaskIds, ...feedTaskIds]) {
    const task = service.activeTasks.get(taskId)
    assert.equal(task.metadata_description, '')
    assert.equal(task.media_metadata, null)
    assert.ok(task.file_time)
    const filePath = path.join(service.downloadPath, `${taskId}.jpg`)
    await fs.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]))
    await service.applyTaskMediaMetadata(filePath, task)
    const output = await fs.readFile(filePath)
    assert.equal(output.includes(Buffer.from('2014:03:02 08:09:10\0', 'ascii')), true)
    const tiffStart = output.indexOf(Buffer.from('Exif\0\0', 'ascii')) + 6
    const ifd0 = tiffStart + output.readUInt32LE(tiffStart + 4)
    const tags = Array.from({ length: output.readUInt16LE(ifd0) }, (_, index) =>
      output.readUInt16LE(ifd0 + 2 + index * 12)
    )
    // ImageDescription, Artist, XPTitle, XPComment, XPAuthor, XPKeywords, XPSubject, Copyright.
    for (const tag of [0x010e, 0x013b, 0x9c9b, 0x9c9c, 0x9c9d, 0x9c9e, 0x9c9f, 0x8298]) {
      assert.equal(tags.includes(tag), false)
    }
    assert.equal(output.includes(Buffer.from('http://ns.adobe.com/xap/1.0/', 'ascii')), false)
  }
})

test('metadata is retained for enabled tasks and later toggles affect only new tasks', async (t) => {
  const service = await createService(t)
  const options = { filename: 'test.jpg', url: photo.url, mediaMetadata: metadata }
  const enabledTask = service.createTask(options)
  assert.deepEqual(enabledTask.media_metadata, metadata)
  await service.setWriteFeedDescriptionSetting(false)
  assert.equal(service.createTask(options).media_metadata, null)
  assert.deepEqual(enabledTask.media_metadata, metadata)
  await service.setWriteFeedDescriptionSetting(true)
  assert.deepEqual(service.createTask(options).media_metadata, metadata)
})
