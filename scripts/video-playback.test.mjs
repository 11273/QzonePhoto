import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyVideoPlaybackPreference,
  DEFAULT_VIDEO_VOLUME,
  isHlsVideoSource,
  readVideoPlaybackPreference,
  resolveVideoCoverSource,
  resolveVideoPlaybackSource,
  saveVideoPlaybackPreference,
  VIDEO_PLAYBACK_PREFERENCE_KEY
} from '../src/renderer/src/utils/video-playback.mjs'

const createStorage = () => {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  }
}

test('recognizes HLS URLs with query strings', () => {
  assert.equal(isHlsVideoSource('https://example.com/video.m3u8?token=1'), true)
  assert.equal(isHlsVideoSource('https://example.com/video.mp4'), false)
})

test('prefers playable video fields and keeps nested API fallbacks', () => {
  assert.equal(
    resolveVideoPlaybackSource({
      url: 'https://example.com/cover.jpg',
      video_info: { video_url: 'https://example.com/video.m3u8' }
    }),
    'https://example.com/video.m3u8'
  )
})

test('uses the resolved API cover before the album-list fallback', () => {
  assert.equal(
    resolveVideoCoverSource(
      { cover_url: 'https://example.com/resolved-cover.jpg' },
      { pre: 'https://example.com/list-cover.jpg' }
    ),
    'https://example.com/resolved-cover.jpg'
  )
  assert.equal(
    resolveVideoCoverSource({ video_info: { cover_url: 'https://example.com/nested-cover.jpg' } }),
    'https://example.com/nested-cover.jpg'
  )
})

test('applies a safe default volume without changing the paused state', () => {
  const storage = createStorage()
  assert.deepEqual(readVideoPlaybackPreference(storage), {
    muted: false,
    volume: DEFAULT_VIDEO_VOLUME
  })

  const video = { muted: true, volume: 1, paused: true }
  applyVideoPlaybackPreference(video, storage)
  assert.equal(video.paused, true)
  assert.equal(video.muted, false)
  assert.equal(video.volume, DEFAULT_VIDEO_VOLUME)
})

test('persists a user volume choice for every opened player', () => {
  const storage = createStorage()
  saveVideoPlaybackPreference({ muted: true, volume: 0.22 }, storage)

  assert.equal(
    storage.getItem(VIDEO_PLAYBACK_PREFERENCE_KEY),
    JSON.stringify({ muted: true, volume: 0.22 })
  )
  assert.deepEqual(readVideoPlaybackPreference(storage), { muted: true, volume: 0.22 })
})
