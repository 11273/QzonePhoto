import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  getLocalMediaMimeType,
  handleLocalMediaRequest,
  registerLocalMedia,
  resolveLocalMedia
} from '../src/main/utils/local-media-registry.js'

test('local previews serve images as images and retain the existing video MIME types', () => {
  for (const [filename, type] of Object.entries({
    'sample.JPG': 'image/jpeg',
    'sample.png': 'image/png',
    'sample.webp': 'image/webp',
    'sample.gif': 'image/gif',
    'sample.avif': 'image/avif',
    'sample.mp4': 'video/mp4',
    'sample.webm': 'video/webm',
    'sample.mov': 'video/quicktime',
    'sample.m4v': 'video/x-m4v',
    'sample.avi': 'video/x-msvideo',
    'sample.html': 'application/octet-stream'
  }))
    assert.equal(getLocalMediaMimeType(filename), type)
})

test('the actual local-media response streams complete files and byte ranges without disclosing paths', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-local-response-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'sample.png')
  const bytes = Buffer.from('89504e470d0a1a0a0102030405060708', 'hex')
  await fs.writeFile(filePath, bytes)
  const url = `qzone-local://local/${registerLocalMedia(filePath)}`
  const response = await handleLocalMediaRequest(new Request(url))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
  const ranged = await handleLocalMediaRequest(
    new Request(url, { headers: { Range: 'bytes=4-9' } })
  )
  assert.equal(ranged.status, 206)
  assert.equal(ranged.headers.get('content-range'), 'bytes 4-9/16')
  assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), bytes.subarray(4, 10))
  assert.equal(
    (await handleLocalMediaRequest(new Request(url, { headers: { Range: 'bytes=999-' } }))).status,
    416
  )
  assert.equal(
    (await handleLocalMediaRequest(new Request('qzone-local://wrong/unknown'))).status,
    404
  )
  assert.equal(
    (await handleLocalMediaRequest(new Request('qzone-local://local/unknown'))).status,
    404
  )
  await fs.unlink(filePath)
  const missing = await handleLocalMediaRequest(new Request(url))
  assert.equal(missing.status, 500)
  assert.equal((await missing.text()).includes(directory), false)
})

test('local media tokens remain opaque and reject unknown, malformed or expired tokens', () => {
  const token = registerLocalMedia('/isolated-fixture/example.jpg')
  assert.equal(resolveLocalMedia(token), '/isolated-fixture/example.jpg')
  assert.equal(resolveLocalMedia('../example.jpg'), null)
  assert.equal(resolveLocalMedia('00000000-0000-4000-8000-000000000000'), null)
  const now = Date.now
  try {
    Date.now = () => now() + 3 * 60 * 60 * 1000
    assert.equal(resolveLocalMedia(token), null)
  } finally {
    Date.now = now
  }
})
