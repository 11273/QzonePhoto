import {
  CONTENT_LOAD_REASON,
  CONTENT_LOAD_STATUS,
  classifyContentLoadFailure
} from './content-load-state.js'

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
    value.retmsg,
    value.errmsg,
    value.error?.message,
    value.detail?.message,
    value.data?.message,
    value.data?.msg,
    value.data?.retmsg,
    value.data?.errmsg,
    value.data?.protect_content,
    value.data?.protectContent,
    value.protect_content,
    value.protectContent
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
}

export const createAlbumLoadState = (status = ALBUM_LOAD_STATUS.IDLE, options = {}) => {
  const friendMode = options.friendMode === true

  switch (status) {
    case ALBUM_LOAD_STATUS.LOADING:
      return {
        status,
        reason: 'loading',
        title: '正在读取相册',
        description: '请稍候，正在从 QQ 空间获取相册列表。',
        retryable: false
      }
    case ALBUM_LOAD_STATUS.READY:
      return { status, reason: 'ready', title: '', description: '', retryable: false }
    case ALBUM_LOAD_STATUS.EMPTY:
      return {
        status,
        reason: CONTENT_LOAD_REASON.EMPTY,
        title: '这里还没有可见相册',
        description: friendMode
          ? '当前账号没有读取到可见相册；对方可能尚未创建相册，也可能没有向你公开。'
          : '当前空间还没有相册，可以稍后再来看看。',
        retryable: false
      }
    case ALBUM_LOAD_STATUS.FORBIDDEN:
      return {
        status,
        reason: options.reason || CONTENT_LOAD_REASON.FORBIDDEN,
        title: '暂时无法查看相册',
        description: friendMode
          ? '当前账号没有权限查看对方的相册，其他公开内容仍可继续浏览。'
          : '当前账号没有权限查看这些相册。',
        retryable: false
      }
    case ALBUM_LOAD_STATUS.ERROR:
      return {
        status,
        reason: options.reason || CONTENT_LOAD_REASON.UNKNOWN,
        title: '相册暂时加载失败',
        description: options.description || '没有成功读取相册列表，请稍后重新加载。',
        retryable: options.retryable !== false
      }
    default:
      return {
        status: ALBUM_LOAD_STATUS.IDLE,
        reason: 'idle',
        title: '选择一个相册',
        description: '从左侧选择一个相册来查看照片。',
        retryable: false
      }
  }
}

export const createAlbumVisibilityGapDescription = ({
  reported,
  visible,
  context = '相册列表'
} = {}) => {
  const missing = Math.max(1, Number(reported || 0) - Number(visible || 0))
  return `${context}报告的数量比当前可见列表多 ${missing} 个；QQ 空间没有返回这些相册，它们可能已隐藏、删除、未向当前账号开放，或统计尚未更新。`
}

export const isOfficialEmptyAlbumCategoryPage = (data) =>
  Boolean(
    data &&
    Object.prototype.hasOwnProperty.call(data, 'albumList') &&
    Object.prototype.hasOwnProperty.call(data, 'totalInPage') &&
    Object.prototype.hasOwnProperty.call(data, 'albumsInUser') &&
    data.albumList == null &&
    Number(data.totalInPage || 0) === 0 &&
    Number(data.albumsInUser || 0) === 0
  )

export const classifyAlbumLoadFailure = (failure, { friendMode = false } = {}) => {
  const state = classifyContentLoadFailure(failure, { label: '相册', friendMode })
  return {
    ...state,
    status:
      state.status === CONTENT_LOAD_STATUS.FORBIDDEN
        ? ALBUM_LOAD_STATUS.FORBIDDEN
        : ALBUM_LOAD_STATUS.ERROR
  }
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
  const classifiedMessage = classifyContentLoadFailure(response, { label: '相册', friendMode })
  if (
    (Number.isFinite(code) && code !== 0) ||
    (message && classifiedMessage.reason !== CONTENT_LOAD_REASON.UNKNOWN)
  ) {
    return {
      ...classifiedMessage,
      status:
        classifiedMessage.status === CONTENT_LOAD_STATUS.FORBIDDEN
          ? ALBUM_LOAD_STATUS.FORBIDDEN
          : ALBUM_LOAD_STATUS.ERROR
    }
  }

  if (!response?.data) {
    return classifyAlbumLoadFailure(
      { ...response, message: readErrorMessage(response) || 'QQ 空间没有返回相册数据' },
      { friendMode }
    )
  }

  if (!albumResponseHasList(response)) {
    const total = Number(response.data.albumsInUser)
    if (Number.isFinite(total) && total === 0) {
      return createAlbumLoadState(ALBUM_LOAD_STATUS.EMPTY, { friendMode })
    }
    return classifyAlbumLoadFailure(
      { code: -1, message: 'QQ 空间返回的相册数据不完整' },
      { friendMode }
    )
  }

  return createAlbumLoadState(ALBUM_LOAD_STATUS.READY, { friendMode })
}
