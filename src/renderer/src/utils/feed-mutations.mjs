const finiteNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const feedMutationResult = (response, { allowAlreadyDeleted = false } = {}) => {
  const payload = response?.data && typeof response.data === 'object' ? response.data : response
  const code = finiteNumber(payload?.code ?? payload?.ret)
  const result = finiteNumber(payload?.result)
  const success =
    code === 0 || result === 0 || (allowAlreadyDeleted && (code === -4404 || result === -4404))

  return {
    success,
    code: code ?? result,
    message: String(payload?.message || payload?.msg || payload?.errmsg || '').trim()
  }
}

export const feedMutationErrorText = (operation, result) => {
  if (result?.message) return result.message
  if (Number(result?.code) === -3000) return '登录状态已失效，请重新登录后再试'
  if (Number(result?.code) === -3002) return 'QQ 空间要求完成安全验证，请前往官网操作'
  if (operation === '置顶') {
    return '置顶失败；该能力由 QQ 空间控制，通常需要黄钻权限'
  }
  return `${operation}失败，请稍后重试`
}
