import assert from 'node:assert/strict'
import test from 'node:test'

import { toIpcSafeValue } from '../src/shared/ipc-payload.js'

test('converts nested proxies into a structured-clone-safe IPC payload', () => {
  const nested = new Proxy({ camera: 'demo', maker: () => 'ignored' }, {})
  const payload = new Proxy(
    {
      album: { id: 'album-1' },
      photos: [{ id: 'photo-1', exif: nested }],
      selected: new Set(['photo-1'])
    },
    {}
  )

  const safe = toIpcSafeValue(payload)
  assert.doesNotThrow(() => structuredClone(safe))
  assert.deepEqual(safe, {
    album: { id: 'album-1' },
    photos: [{ id: 'photo-1', exif: { camera: 'demo' } }],
    selected: ['photo-1']
  })
})

test('omits circular and unsupported values instead of failing the whole download request', () => {
  const value = { id: 'photo-1', optional: undefined, symbol: Symbol('x') }
  value.self = value
  assert.deepEqual(toIpcSafeValue(value), { id: 'photo-1' })
})
