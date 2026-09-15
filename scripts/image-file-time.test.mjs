import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  formatExifDateTime,
  writeImageDateTime,
  writeImageDescription
} from '../src/main/utils/image-description-writer.mjs'
import { writeTaskMediaMetadata } from '../src/main/utils/media-metadata-writer.mjs'

const minimalJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9])

test('formats explicit EXIF dates without substituting a feed publish time', () => {
  assert.equal(formatExifDateTime('2014-03-02 08:09:10'), '2014:03:02 08:09:10')
  assert.equal(formatExifDateTime('2014:03:02 08:09:10'), '2014:03:02 08:09:10')
})

test('writes the selected file time into JPEG EXIF', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-photo-time-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'photo.jpg')
  await fs.writeFile(filePath, minimalJpeg)

  const result = await writeImageDateTime(filePath, '2014-03-02 08:09:10')
  const output = await fs.readFile(filePath)

  assert.equal(result.written, true)
  assert.equal(result.format, 'embedded-exif-datetime')
  assert.equal(output.includes(Buffer.from('2014:03:02 08:09:10\0', 'ascii')), true)
})

test('a date-only download task does not add feed descriptions', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-photo-task-time-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'plain-photo.jpg')
  await fs.writeFile(filePath, minimalJpeg)

  await writeTaskMediaMetadata(filePath, {
    type: 'image',
    file_time: new Date(2014, 2, 2, 8, 9, 10).getTime(),
    metadata_description: '',
    media_metadata: null
  })
  const output = await fs.readFile(filePath)

  assert.equal(output.includes(Buffer.from('2014:03:02 08:09:10\0', 'ascii')), true)
  assert.equal(output.includes(Buffer.from('企鹅相册', 'utf8')), false)
})

test('description metadata uses capture time for EXIF and keeps publish time separate', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-photo-metadata-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'feed-photo.jpg')
  await fs.writeFile(filePath, minimalJpeg)

  await writeImageDescription(filePath, '动态正文', {
    publishedAt: '2026-09-15 18:00:00',
    captureAt: '2014-03-02 08:09:10'
  })
  const output = await fs.readFile(filePath)

  assert.equal(output.includes(Buffer.from('2014:03:02 08:09:10\0', 'ascii')), true)
})
