import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DOWNLOAD_TIME_PREFERENCES,
  getPhotoFileTime,
  normalizeDownloadTimePreference
} from '../src/main/utils/download-file-time.mjs'

const photo = {
  exif: { originalTime: '2014:03:02 08:09:10' },
  rawshoottime: '2014-03-02 08:09:11',
  uploadtime: 1_741_000_000,
  modifytime: 1_742_000_000
}

test('uses original shooting time by default', () => {
  const value = getPhotoFileTime(photo)
  assert.ok(value instanceof Date)
  assert.equal(value.getFullYear(), 2014)
  assert.equal(value.getMonth(), 2)
  assert.equal(value.getDate(), 2)
})

test('can explicitly use the upload timestamp', () => {
  assert.equal(
    getPhotoFileTime(photo, DOWNLOAD_TIME_PREFERENCES.UPLOAD).getTime(),
    photo.uploadtime * 1000
  )
})

test('accepts Unix seconds or milliseconds and falls back across missing sources', () => {
  const timestamp = 1_700_000_000
  assert.equal(getPhotoFileTime({ rawshoottime: timestamp }).getTime(), timestamp * 1000)
  assert.equal(
    getPhotoFileTime({ uploadTime: timestamp * 1000 }, 'upload').getTime(),
    timestamp * 1000
  )
  assert.equal(getPhotoFileTime({ modifytime: timestamp }, 'unknown').getTime(), timestamp * 1000)
  assert.equal(normalizeDownloadTimePreference('unknown'), 'shoot')
})
