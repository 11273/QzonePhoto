// ptuiCB uses 65/66/67 for expiry/waiting/confirmation, not Qzone business errors.
// Keep this protocol-specific so the same codes on other APIs still fail normally.
export function getQrLoginFailure(payload) {
  const code = payload?.code
  if (code !== undefined && code !== null && code !== '' && Number.isFinite(Number(code))) {
    if ([0, 65, 66, 67].includes(Number(code))) return null
    return { code, message: payload.message || '扫码状态读取失败', detail: payload }
  }
  return { code: 'INVALID_QR_RESPONSE', message: '扫码状态接口没有返回有效数据' }
}
