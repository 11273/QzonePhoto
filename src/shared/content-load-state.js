export const CONTENT_LOAD_STATUS = Object.freeze({
  EMPTY: 'empty',
  FORBIDDEN: 'forbidden',
  ERROR: 'error'
})

export const CONTENT_LOAD_REASON = Object.freeze({
  EMPTY: 'empty',
  NON_FRIEND_HISTORY: 'non-friend-history',
  FORBIDDEN: 'forbidden',
  UNAVAILABLE: 'unavailable',
  NOT_FOUND: 'not-found',
  ACCESS_VERIFICATION: 'access-verification',
  AUTH_REQUIRED: 'auth-required',
  RATE_LIMITED: 'rate-limited',
  SECURITY_CHECK: 'security-check',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  SERVER: 'server',
  INVALID_RESPONSE: 'invalid-response',
  UNKNOWN: 'unknown'
})

const readMessage = (value) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return [
    value.message,
    value.msg,
    value.retmsg,
    value.errmsg,
    value.err,
    value.reason,
    value.detail,
    value.error_description,
    value.errorMessage,
    value.error,
    value.error?.message,
    value.cause?.message,
    value.error?.response?.data?.message,
    typeof value.error?.response?.data === 'string' ? value.error.response.data : '',
    value.response?.data?.message,
    value.response?.data?.msg,
    value.response?.data?.retmsg,
    value.response?.data?.errmsg,
    value.response?.data?.reason,
    value.response?.data?.detail,
    value.response?.data?.error_description,
    typeof value.response?.data === 'string' ? value.response.data : '',
    value.data?.message,
    value.data?.msg,
    value.data?.retmsg,
    value.data?.errmsg,
    value.data?.err,
    value.data?.reason,
    value.data?.detail,
    value.data?.error_description,
    value.data?.error?.message,
    value.data?.protect_content,
    value.data?.protectContent,
    value.protect_content,
    value.protectContent,
    value.result?.message,
    value.result?.msg,
    value.result?.retmsg,
    value.result?.errmsg,
    value.result?.err,
    value.result?.reason,
    value.result?.detail,
    value.result?.protect_content,
    value.result?.protectContent
  ]
    .filter((item) => typeof item === 'string' && item.trim())
    .join(' ')
}

const readCode = (value) => {
  if (!value || typeof value !== 'object') return ''
  const applicationCodes = [
    value.code,
    value.ret,
    value.subcode,
    value.errno,
    value.errorCode,
    value.error?.response?.data?.code,
    value.error?.response?.data?.ret,
    value.error?.response?.data?.subcode,
    value.response?.data?.code,
    value.response?.data?.ret,
    value.response?.data?.subcode,
    value.response?.data?.errno,
    value.data?.code,
    value.data?.ret,
    value.data?.subcode,
    value.data?.errno,
    value.result?.code,
    value.result?.ret
  ].filter((code) => code !== undefined && code !== null && code !== '')
  const numericApplicationCode = applicationCodes.find(
    (code) => Number.isFinite(Number(code)) && Number(code) !== 0
  )
  if (numericApplicationCode !== undefined) return String(numericApplicationCode)

  const httpStatuses = [
    value.status,
    value.statusCode,
    value.error?.status,
    value.error?.response?.status,
    value.response?.status
  ].filter((status) => Number(status) >= 400)
  if (httpStatuses.length) return String(httpStatuses[0])

  const transportCode = [value.error?.code, value.code].find(
    (code) => typeof code === 'string' && code.trim() && !Number.isFinite(Number(code))
  )
  return String(transportCode ?? applicationCodes[0] ?? '')
}

export const createContentLoadState = (status, options = {}) => {
  const label = String(options.label || '内容')
  const friendMode = options.friendMode === true
  const reason = options.reason || status

  if (status === CONTENT_LOAD_STATUS.EMPTY) {
    return {
      status,
      reason,
      title: options.emptyTitle || `暂无${label}`,
      description:
        options.emptyDescription ||
        (friendMode
          ? `当前账号没有读取到可见${label}；可能暂无内容，也可能没有向你公开。`
          : `这里还没有${label}。`),
      retryable: false
    }
  }

  if (status === CONTENT_LOAD_STATUS.FORBIDDEN) {
    return {
      status,
      reason,
      title: `暂时无法查看${label}`,
      description: friendMode
        ? '当前账号没有权限查看这部分内容，其他公开内容仍可继续浏览。'
        : `当前账号没有权限查看${label}。`,
      retryable: false
    }
  }

  return {
    status: CONTENT_LOAD_STATUS.ERROR,
    reason,
    title: `${label}暂时加载失败`,
    description:
      options.description ||
      `没有成功读取${label}，QQ 空间没有提供可识别的失败原因；请稍后重新加载。`,
    retryable: options.retryable !== false
  }
}

export const classifyContentLoadFailure = (failure, options = {}) => {
  const label = String(options.label || '内容')
  const friendMode = options.friendMode === true
  const code = readCode(failure)
  const message = readMessage(failure)

  if (
    code === '-10805' ||
    /回答错误|答案错误|密码错误|访问问题.*(?:错误|不正确)|相册密码.*(?:错误|不正确)/i.test(message)
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.ACCESS_VERIFICATION,
        retryable: true
      }),
      title: '相册验证未通过',
      description: '相册问题答案或访问密码不正确，请重新输入后再试。'
    }
  }

  if (
    /非好友(?:仅可|只可|只能|仅允许|只允许)(?:查看|访问)(?:最近|近)?一年(?:内)?的?(?:内容|照片|动态)?/.test(
      message
    )
  ) {
    const isAlbumContent = /相册|照片/.test(label)
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.FORBIDDEN, {
        ...options,
        reason: CONTENT_LOAD_REASON.NON_FRIEND_HISTORY
      }),
      description: isAlbumContent
        ? 'QQ 空间只允许非好友查看最近一年的内容，这个相册中暂无当前账号可见的照片。'
        : `QQ 空间只允许非好友查看最近一年的内容，因此更早的${label}不会显示。`
    }
  }

  if (
    code === '404' ||
    code === '410' ||
    /(?:status|HTTP)\s*(?:code\s*)?(?:404|410)\b/i.test(message) ||
    /(?:相册|照片|视频|动态|说说|日志|留言|内容)(?:已被)?删除|(?:相册|照片|视频|动态|说说|日志|留言|内容)不存在|内容已失效|记录不存在/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.FORBIDDEN, {
        ...options,
        reason: CONTENT_LOAD_REASON.NOT_FOUND
      }),
      title: `无法找到${label}`,
      description: `QQ 空间已找不到这部分${label}，可能已被删除、失效或更改了可见范围。`
    }
  }

  if (/视频记录缺少相册或文件标识|视频信息不完整|缺少.*视频.*(?:标识|参数|字段)/i.test(message)) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.INVALID_RESPONSE,
        retryable: false
      }),
      title: '视频信息不完整',
      description: '这条视频缺少查询播放地址所需的相册或文件标识，当前无法播放。',
      retryable: false
    }
  }

  if (
    /空间(?:尚未|未)开通|未开通(?:QQ)?空间|空间不存在|用户不存在|账号不存在|号码不存在|已注销|空间已关闭|关闭了空间|暂停访问|空间被封禁|找不到(?:该)?用户/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.FORBIDDEN, {
        ...options,
        reason: CONTENT_LOAD_REASON.UNAVAILABLE
      }),
      title: friendMode ? '对方的 QQ 空间不可用' : '当前 QQ 空间不可用',
      description: friendMode
        ? `对方可能未开通或已关闭 QQ 空间，因此无法读取${label}。`
        : `当前 QQ 空间可能尚未开通或已关闭，因此无法读取${label}。`
    }
  }

  if (
    code === '403' ||
    /(?:status|HTTP)\s*(?:code\s*)?403\b/i.test(message) ||
    /没有权限|无权限|无权|权限不足|访问受限|权限访问|空间权限|主人设置|禁止访问|拒绝访问|保密|仅可查看|仅好友可见|好友可见|指定人可见|回答问题可见|permission|forbidden|not authorized|access denied/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.FORBIDDEN, {
        ...options,
        reason: CONTENT_LOAD_REASON.FORBIDDEN
      }),
      description: friendMode
        ? `对方设置了空间或内容的可见范围，当前账号无法查看这部分${label}；其他公开内容仍可继续浏览。`
        : `当前账号没有读取${label}的权限，请确认内容可见范围或重新登录后再试。`
    }
  }

  if (
    code === '401' ||
    code === '-3000' ||
    /(?:status|HTTP)\s*(?:code\s*)?401\b/i.test(message) ||
    /登录态|登录状态|未登录|请先登录|登录过期|重新登录|会话失效/i.test(message)
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.AUTH_REQUIRED,
        retryable: false
      }),
      title: '需要重新登录',
      description: `登录状态已失效，重新登录后即可继续读取${label}。`,
      retryable: false
    }
  }

  if (
    code === '-3002' ||
    /验证码|captcha|安全校验|安全验证|风控拦截|异常访问|账号风险/i.test(message)
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.SECURITY_CHECK
      }),
      title: 'QQ 空间需要安全验证',
      description: '当前请求触发了 QQ 空间安全校验，请稍后重试；若持续出现，可重新登录后再试。'
    }
  }

  if (
    code === '429' ||
    code === '-429' ||
    /(?:status|HTTP)\s*(?:code\s*)?429\b/i.test(message) ||
    /请求频繁|操作频繁|访问频繁|读取频繁|频率限制|rate.?limit/i.test(message)
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.RATE_LIMITED
      }),
      title: '读取有些频繁',
      description: 'QQ 空间暂时限制了连续请求，请稍等片刻后重新加载。'
    }
  }

  if (
    code === '408' ||
    code === '504' ||
    /(?:status|HTTP)\s*(?:code\s*)?(?:408|504)\b|timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNABORTED/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.TIMEOUT
      }),
      title: `${label}读取超时`,
      description: 'QQ 空间响应时间过长，请检查网络后重新加载。'
    }
  }

  if (
    /网络(?:连接)?(?:异常|不可用|中断|错误)|无网络|断网|network|ECONN|ENOTFOUND|EAI_AGAIN|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_PROXY_CONNECTION_FAILED|offline|socket hang up|CERT_|certificate|SSL|TLS/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.NETWORK
      }),
      title: '网络连接异常',
      description: `当前没有成功连接 QQ 空间，请检查网络、代理或安全软件后重新读取${label}。`
    }
  }

  const numericCode = Number(code)
  if (
    (Number.isFinite(numericCode) && numericCode >= 500 && numericCode < 600) ||
    /(?:status|HTTP)\s*(?:code\s*)?5\d\d\b|服务器错误|服务异常|服务繁忙|系统繁忙|网络繁忙|服务维护/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.SERVER
      }),
      title: 'QQ 空间服务暂时异常',
      description: `QQ 空间暂时没有正常返回${label}，请稍后重新加载。`
    }
  }

  if (
    /响应异常|格式异常|解析失败|没有返回|未返回|空响应|数据不完整|信息不完整|响应不完整|缺少.*(?:标识|参数|字段)|ERR_BAD_RESPONSE|SyntaxError|JSONP|unexpected|invalid\s*(?:json|response)/i.test(
      message
    )
  ) {
    return {
      ...createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
        ...options,
        reason: CONTENT_LOAD_REASON.INVALID_RESPONSE
      }),
      title: 'QQ 空间返回的数据不完整',
      description: `已经连接到 QQ 空间，但没有收到完整的${label}数据，请稍后重新加载。`
    }
  }

  const containsUnreadableCharacters =
    /�{2,}/.test(message) ||
    Array.from(message).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint <= 31 && ![9, 10, 13].includes(codePoint)
    })
  if (containsUnreadableCharacters) {
    return createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
      ...options,
      reason: CONTENT_LOAD_REASON.UNKNOWN
    })
  }

  return createContentLoadState(CONTENT_LOAD_STATUS.ERROR, {
    ...options,
    reason: CONTENT_LOAD_REASON.UNKNOWN
  })
}
