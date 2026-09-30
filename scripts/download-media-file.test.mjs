import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detectMediaSignature,
  isExpectedMediaKind,
  replaceMediaFilenameExtension
} from '../src/main/utils/download-media-file.mjs'

test('detects actual image formats instead of forcing every photo to jpg', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.deepEqual(detectMediaSignature(png, 'image/jpeg'), {
    kind: 'image',
    extension: '.png'
  })
  assert.equal(isExpectedMediaKind('image', detectMediaSignature(png)), true)
  assert.equal(isExpectedMediaKind('video', detectMediaSignature(png)), false)
})

test('detects mp4 and rejects html responses as media', () => {
  const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom')])
  assert.deepEqual(detectMediaSignature(mp4), { kind: 'video', extension: '.mp4' })
  assert.equal(detectMediaSignature(Buffer.from('<html>error</html>'), 'text/html'), null)
  assert.equal(detectMediaSignature(Buffer.from('<html>error</html>'), 'image/jpeg'), null)
})

test('keeps the corrected extension when limiting Windows-friendly filenames', () => {
  const corrected = replaceMediaFilenameExtension(`${'a'.repeat(300)}.jpg`, '.png')
  assert.equal(corrected.length, 220)
  assert.match(corrected, /\.png$/)
  assert.equal(replaceMediaFilenameExtension('photo', '.jpg'), 'photo.jpg')
})
