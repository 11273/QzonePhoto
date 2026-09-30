import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasUsableQrCode,
  normalizeQrCodePayload
} from '../src/renderer/src/views/login/login-state.mjs'

test('rejects empty QR responses instead of letting the login view crash', () => {
  for (const payload of [
    null,
    undefined,
    {},
    [],
    { img: '' },
    { img: 'data:image/png;base64,a' }
  ]) {
    assert.equal(normalizeQrCodePayload(payload), null)
    assert.equal(hasUsableQrCode(payload), false)
  }
})

test('normalizes a complete QR response without discarding compatible fields', () => {
  const payload = normalizeQrCodePayload({
    img: ' data:image/png;base64,a ',
    qrsig: ' qr-token ',
    pt_login_sig: ' login-token ',
    compatible: true
  })

  assert.deepEqual(payload, {
    img: 'data:image/png;base64,a',
    qrsig: 'qr-token',
    pt_login_sig: 'login-token',
    compatible: true
  })
  assert.equal(hasUsableQrCode(payload), true)
})
