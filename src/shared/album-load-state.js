export const ALBUM_LOAD_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  FORBIDDEN: 'forbidden',
  ERROR: 'error'
})

const readErrorMessage = (value) => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return [
    value.message,
    value.msg,
    value.error?.message,
    value.detail?.message,
    value.data?.message,
    value.data?.msg
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
}

const readErrorCode = (value) => {
  if (!value || typeof value !== 'object') return ''
  const codes = [value.code, value.error?.code, value.detail?.code, value.data?.code].filter(
    (code) => code !== undefined && code !== null && code !== ''
  )
  return String(codes.find((code) => Number(code) !== 0) ?? codes[0] ?? '')
}

export const createAlbumLoadState = (status = ALBUM_LOAD_STATUS.IDLE, options = {}) => {
  const friendMode = options.friendMode === true

  switch (status) {
    case ALBUM_LOAD_STATUS.LOADING:
      return {
        status,
        title: '正在读取相册',
        description: '请稍候，正在从 QQ 空间获取相册列表。',
        retryable: false
      }
    case ALBUM_LOAD_STATUS.READY:
      return { status, title: '', description: '', retryable: false }
    case ALBUM_LOAD_STATUS.EMPTY:
      return {
        status,
        title: '这里还没有可见相册',
        description: friendMode
          ? '对方可能还没有创建相册，或暂时没有向你公开的相册。'
          : '当前空间还没有相册，可以稍后再来看看。',
        retryable: false
      }
    case ALBUM_LOAD_STATUS.FORBIDDEN:
      return {
        status,
        title: '暂时无法查看相册',
        description: friendMode
          ? '当前账号没有权限查看对方的相册，其他公开内容仍可继续浏览。'
          : '当前账号没有权限查看这些相册。',
        retryable: false
      }
    case ALBUM_LOAD_STATUS.ERROR:
      return {
        status,
        title: '相册暂时加载失败',
        description: options.description || '没有成功读取相册列表，请稍后重新加载。',
        retryable: options.retryable !== false
      }
    default:
      return {
        status: ALBUM_LOAD_STATUS.IDLE,
        title: '选择一个相册',
        description: '从左侧选择一个相册来查看照片。',
        retryable: false
      }
  }
}

export const classifyAlbumLoadFailure = (failure, { friendMode = false } = {}) => {
  const code = readErrorCode(failure)
  const message = readErrorMessage(failure)

  if (
    code === '403' ||
    /没有权限|无权限|无权|访问受限|权限访问|空间权限|主人设置|禁止访问|permission|forbidden/i.test(
      message
    )
  ) {
    return createAlbumLoadState(ALBUM_LOAD_STATUS.FORBIDDEN, { friendMode })
  }

  if (code === '401' || /登录态|登录状态|未登录|请先登录|登录过期/i.test(message)) {
    return createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, {
      description: '登录状态已失效，请重新登录后再试。',
      retryable: false,
      friendMode
    })
  }

  if (/timeout|timed out|网络|network|ECONN|ENOTFOUND/i.test(message)) {
    return createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, {
      description: '网络连接不稳定，请检查网络后重新加载。',
      friendMode
    })
  }

  if (code === '500' || /status code 5\d\d|服务器错误|服务异常/i.test(message)) {
    return createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, {
      description: 'QQ 空间暂时没有返回相册数据，请稍后重新加载。',
      friendMode
    })
  }

  return createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, { friendMode })
}

export const albumResponseHasList = (response) => {
  const data = response?.data
  return Boolean(
    data && (Array.isArray(data.albumListModeClass) || Array.isArray(data.albumListModeSort))
  )
}

export const resolveAlbumResponseState = (response, { friendMode = false } = {}) => {
  const code = Number(response?.code)
  const message = readErrorMessage(response)

  if ((Number.isFinite(code) && code !== 0) || /没有权限|无权限|访问受限/.test(message)) {
    return classifyAlbumLoadFailure(response, { friendMode })
  }

  if (!response?.data) {
    return createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, {
      description: 'QQ 空间没有返回相册数据，请稍后重新加载。',
      friendMode
    })
  }

  if (!albumResponseHasList(response)) {
    const total = Number(response.data.albumsInUser)
    if (Number.isFinite(total) && total === 0) {
      return createAlbumLoadState(ALBUM_LOAD_STATUS.EMPTY, { friendMode })
    }
    return createAlbumLoadState(ALBUM_LOAD_STATUS.ERROR, { friendMode })
  }

  return createAlbumLoadState(ALBUM_LOAD_STATUS.READY, { friendMode })
}
