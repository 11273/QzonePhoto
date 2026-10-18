const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readCode = (payload) => {
  if (!isRecord(payload)) return -1
  const candidates = [
    payload.code,
    payload.ret,
    payload.subcode,
    payload.errno,
    payload.errorCode,
    payload.result?.code,
    payload.result?.ret,
    payload.result?.subcode,
    payload.result?.errno,
    payload.result?.errorCode
  ].filter((value) => value !== undefined && value !== null && value !== '')
  const failed = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) !== 0)
  if (failed !== undefined) return Number(failed)
  const successful = candidates.find((value) => Number.isFinite(Number(value)))
  return successful === undefined ? 0 : Number(successful)
}

export const readQzoneResponseMessage = (...values) =>
  values
    .flatMap((value) =>
      isRecord(value)
        ? [
            value.message,
            value.msg,
            value.retmsg,
            value.errmsg,
            value.err,
            value.reason,
            value.detail,
            value.error_description,
            value.errorMessage,
            value.protect_content,
            value.protectContent
          ]
        : []
    )
    .find((value) => typeof value === 'string' && value.trim()) || ''

/**
 * 标准化 QQ 空间读取接口：保留官方业务错误，同时阻止“成功码 + 残缺结构”伪装成空数据。
 * 只用于读取接口；写入接口可能使用不同的成功码，不能套用这里的规则。
 */
export const normalizeQzoneReadResponse = (
  payload,
  { label = '内容', isValid = () => true, normalize = (value) => value } = {}
) => {
  if (!isRecord(payload)) {
    return { code: -1, message: `QQ 空间返回的${label}数据不完整` }
  }

  const code = readCode(payload)
  const message = readQzoneResponseMessage(payload, payload.data, payload.result)
  if (code !== 0) return { ...payload, code, message: message || `${label}读取失败` }

  if (!isValid(payload)) {
    return {
      ...payload,
      code: -1,
      message: message || `QQ 空间返回的${label}数据不完整`
    }
  }

  const normalized = normalize(payload)
  return {
    ...(isRecord(normalized) ? normalized : payload),
    code: 0,
    message
  }
}
