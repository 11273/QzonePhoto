import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  cleanupExpiredHeicCache,
  isHeicImage,
  removePreparedHeicFile,
  toJpegFilename
} from '../src/main/utils/heic-converter.mjs'

test('recognizes HEIC extensions and gives uploads a JPEG filename', () => {
  assert.equal(isHeicImage('/photos/IMG_0001.HEIC'), true)
  assert.equal(isHeicImage('/photos/IMG_0001.heif'), true)
  assert.equal(isHeicImage('/photos/IMG_0001.jpg'), false)
  assert.equal(toJpegFilename('/photos/IMG_0001.HEIC'), 'IMG_0001.jpg')
  assert.equal(toJpegFilename(''), 'photo.jpg')
})

test('only removes prepared JPEGs inside the HEIC cache directory', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-heic-cleanup-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const cache = path.join(root, 'cache')
  const outside = path.join(root, 'outside.jpg')
  const unrelated = path.join(cache, 'keep.jpg')
  const prepared = path.join(cache, `${'a'.repeat(64)}.jpg`)
  await fs.mkdir(cache)
  await fs.writeFile(outside, 'keep')
  await fs.writeFile(unrelated, 'keep')
  await fs.writeFile(prepared, 'remove')

  assert.equal(await removePreparedHeicFile(outside, cache), false)
  assert.equal(await removePreparedHeicFile(unrelated, cache), false)
  assert.equal(await removePreparedHeicFile(prepared, cache), true)
  assert.equal(await fs.readFile(outside, 'utf8'), 'keep')
  assert.equal(await fs.readFile(unrelated, 'utf8'), 'keep')
  await assert.rejects(fs.access(prepared))
})

test('expires only converter-owned cache files', async (t) => {
  const cache = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-heic-expiry-'))
  t.after(() => fs.rm(cache, { recursive: true, force: true }))
  const oldJpeg = path.join(cache, `${'b'.repeat(64)}.jpg`)
  const unrelated = path.join(cache, 'keep.jpg')
  const now = Date.now()
  await fs.writeFile(oldJpeg, 'old')
  await fs.writeFile(unrelated, 'keep')
  const oldDate = new Date(now - 40 * 24 * 60 * 60 * 1000)
  await fs.utimes(oldJpeg, oldDate, oldDate)

  assert.equal(await cleanupExpiredHeicCache(cache, { now }), 1)
  await assert.rejects(fs.access(oldJpeg))
  assert.equal(await fs.readFile(unrelated, 'utf8'), 'keep')
})
