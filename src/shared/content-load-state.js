export const CONTENT_LOAD_STATUS = Object.freeze({
  EMPTY: 'empty',
  FORBIDDEN: 'forbidden',
  ERROR: 'error'
})

const readMessage = (value) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return [
    value.message,
    value.msg,
    value.error,
    value.error?.message,
    value.data?.message,
    value.data?.msg
  ]
    .filter((item) => typeof item === 'string' && item.trim())
    .join(' ')
}

const readCode = (value) => {
  if (!value || typeof value !== 'object') return ''
  const codes = [value.code, value.error?.code, value.data?.code].filter(
    (code) => code !== undefined && code !== null && code !== ''
  )
  return String(codes.find((code) => Number(code) !== 0) ?? codes[0] ?? '')
}

export const createContentLoadState = (status, options = {}) => {
  const label = String(options.label || '内容')
  const friendMode = options.friendMode === true

  if (status === CONTENT_LOAD_STATUS.EMPTY) {
    return {
      status,
      title: options.emptyTitle || `暂无${label}`,
      description:
        options.emptyDescription ||
        (friendMode ? `对方暂时没有向你公开的${label}。` : `这里还没有${label}。`),
      retryable: false
    }
  }

  if (status === CONTENT_LOAD_STATUS.FORBIDDEN) {
    return {
      status,
      title: `暂时无法查看${label}`,
      description: friendMode
        ? '当前账号没有权限查看这部分内容，其他公开内容仍可继续浏览。'
        : `当前账号没有权限查看${label}。`,
      retryable: false
    }
  }

  return {
    status: CONTENT_LOAD_STATUS.ERROR,
    title: `${label}暂时加载失败`,
    description: options.description || `没有成功读取${label}，请稍后重新加载。`,
    retryable: options.retryable !== false
  }
}

export const classifyContentLoadFailure = (failure, options = {}) => {
  const code = readCode(failure)
  const message = readMessage(failure)

  if (
    code === '403' ||
    /没有权限|无权限|无权|访问受限|权限访问|空间权限|主人设置|禁止访问|保密|permission|forbidden/i.test(
      message
    )
  ) {
    return createContentLoadState(CONTENT_LOAD_STATUS.FORBIDDEN, options)
  }

  if (code === '401' || /登录态|登录状态|未登录|请先登录|登录过期/i.test(message)) {
    return createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
      ...options,
      description: '登录状态已失效，请重新登录后再试。',
      retryable: false
    })
  }

  if (/timeout|timed out|网络|network|ECONN|ENOTFOUND/i.test(message)) {
    return createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
      ...options,
      description: '网络连接不稳定，请检查网络后重新加载。'
    })
  }

  if (code === '429' || /请求频繁|操作频繁|稍后再试|rate.?limit/i.test(message)) {
    return createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
      ...options,
      description: '读取得有些频繁，请稍后重新加载。'
    })
  }

  return createContentLoadState(CONTENT_LOAD_STATUS.ERROR, options)
}
