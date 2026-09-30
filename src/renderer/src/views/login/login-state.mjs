const REQUIRED_QR_FIELDS = ['img', 'qrsig', 'pt_login_sig']

export function normalizeQrCodePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null

  const normalized = { ...payload }
  for (const field of REQUIRED_QR_FIELDS) {
    if (typeof normalized[field] !== 'string' || !normalized[field].trim()) return null
    normalized[field] = normalized[field].trim()
  }

  return normalized
}

export function hasUsableQrCode(payload) {
  return normalizeQrCodePayload(payload) !== null
}
