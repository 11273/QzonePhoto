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

export function resolveLoginBusyState({ loading = false, isLoggingIn = false, loginMessage = '' }) {
  if (isLoggingIn) {
    return {
      busy: true,
      title: loginMessage || '正在登录，马上进入空间...',
      description: '正在同步登录状态，请稍等',
      note: '请保持应用开启，完成后将自动进入空间'
    }
  }
  if (loading) {
    return {
      busy: true,
      title: '正在获取登录二维码',
      description: '正在连接 QQ 登录服务',
      note: '连接完成后即可扫码或选择本机账号'
    }
  }
  return { busy: false, title: '', description: '', note: '' }
}
