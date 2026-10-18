const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const isValidQzoneAlbumListResponse = (body) => {
  const data = body?.data
  if (!isRecord(data)) return false
  if (
    Array.isArray(data.albumListModeClass) ||
    Array.isArray(data.albumListModeSort) ||
    Array.isArray(data.albumList)
  ) {
    return true
  }
  return Number(data.albumsInUser) === 0
}

export const readQzoneResponseCode = (payload) => {
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
  (() => {
    const messages = values
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
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())

    // 一些 QQ 空间接口会在顶层写“success”，同时把真实的限制原因放在
    // data.protect_content / result.errmsg。优先保留有信息量的原因，避免界面
    // 最终只能显示“没有提供可识别的失败原因”。
    return (
      messages.find(
        (value) => !/^(?:success|succeed|ok|操作成功|请求成功|成功)[.!。！]?$/i.test(value)
      ) ||
      messages[0] ||
      ''
    )
  })()

/**
 * 检查已经穿过 IPC 外层的 QQ 空间业务响应。
 *
 * IPC 本身成功只代表主进程 handler 正常执行；QQ 空间仍可能在 data 中返回
 * ret/subcode != 0。读取接口统一在 preload 使用这个检查，避免某个页面忘记
 * 手动判断后把业务失败当成空列表。
 */
export const getQzoneReadFailure = (payload) => {
  if (!isRecord(payload)) return null
  const code = readQzoneResponseCode(payload)
  if (!Number.isFinite(code) || code === 0) return null
  return {
    code,
    message: readQzoneResponseMessage(payload, payload.data, payload.result) || 'QQ 空间读取失败',
    detail: payload
  }
}

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

  const code = readQzoneResponseCode(payload)
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
