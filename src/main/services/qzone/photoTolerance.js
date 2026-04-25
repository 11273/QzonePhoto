// 容错获取相册照片：
// 服务端偶发把单张照片字段（含非法字符 / 截断 utf-8 / 不可见控制符）写进
// JSONP 回调里，导致 extractJSONFromCallback 的 Function() eval 失败、整页拿不到。
// 这里提供一个二分定位 + 跳过坏数据的包装：把 page 折半递归，定位到 pageNum=1
// 仍然解析失败时把那一张标记 skippedCount，正常返回剩余照片。

const BISECTION_THROTTLE_MS = 50
const PAYLOAD_SNIPPET_LEN = 200

// 命中以下关键字时认为是登录态失效 / 风控拦截，直接报错而不二分浪费请求
const AUTH_REQUIRED_MARKERS = [
  '请重新登录',
  '登录已过期',
  '/login.cgi',
  'login.qzone',
  '验证码',
  'captcha'
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const toNonNegativeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

const getPayloadSnippet = (payload) => {
  if (typeof payload !== 'string') return ''
  return payload.slice(0, PAYLOAD_SNIPPET_LEN).replace(/\s+/g, ' ')
}

// 判断响应"形态"，用来选择后续策略；命中范围放宽：
// 任何字符串响应（即 extractJSONFromCallback 解析失败原样回落的）都尝试二分，
// 只挑几个明显的登录拦截关键字短路掉，避免在 captcha 上浪费调用。
const classifyPhotoPayload = (payload) => {
  if (payload && typeof payload === 'object') {
    if (payload.code === 0 && payload.data) return { kind: 'success' }
    if (payload.code === -10805) return { kind: 'permission-denied' }
    if (typeof payload.code === 'number') {
      return {
        kind: 'api-error',
        code: payload.code,
        message: payload.message || `API 错误: code=${payload.code}, message=${payload.message}`
      }
    }
    return { kind: 'unknown' }
  }

  if (typeof payload === 'string') {
    const text = payload.trim()
    if (!text) return { kind: 'empty' }
    if (AUTH_REQUIRED_MARKERS.some((m) => text.includes(m))) {
      return { kind: 'auth-required', message: '会话失效或被风控拦截，请重新登录后重试' }
    }
    return { kind: 'recoverable' }
  }

  return { kind: 'empty' }
}

// 把一段 data 字段标准化成 renderer 端期望的形状；缺啥补啥
const normalizeDataBlock = ({ pageStart, pageNum, ...overrides }) => {
  const photoList = Array.isArray(overrides.photoList) ? overrides.photoList : []
  const requestedCount = toNonNegativeNumber(overrides.requestedCount, pageNum)
  const totalInAlbum = toNonNegativeNumber(overrides.totalInAlbum)
  const skippedCount = toNonNegativeNumber(overrides.skippedCount)
  const loadedCount = toNonNegativeNumber(overrides.loadedCount, photoList.length)

  const nextStartCandidate = Number(overrides.nextPageStart)
  const nextPageStart =
    Number.isFinite(nextStartCandidate) && nextStartCandidate >= pageStart
      ? nextStartCandidate
      : pageStart + requestedCount

  const hasMoreOverride = overrides.hasMore
  const hasMore =
    typeof hasMoreOverride === 'boolean'
      ? hasMoreOverride
      : totalInAlbum > 0
        ? nextPageStart < totalInAlbum
        : photoList.length === requestedCount

  return {
    photoList,
    totalInAlbum,
    hasMore,
    nextPageStart,
    requestedCount,
    skippedCount,
    loadedCount
  }
}

// 统一 builder：success / skip / fail 都走这一个，避免三个函数字段对齐
const buildResponse = ({ code = 0, message = '', pageStart, pageNum, raw, overrides = {} }) => {
  const baseObject = raw && typeof raw === 'object' ? raw : {}
  const baseData = baseObject.data && typeof baseObject.data === 'object' ? baseObject.data : {}
  const data = normalizeDataBlock({
    pageStart,
    pageNum,
    ...baseData,
    ...overrides
  })
  return { ...baseObject, code, message, data }
}

const mergeHalves = (left, right, pageStart, pageNum) => {
  const leftData = left.data
  const rightData = right.data

  const totalInAlbum =
    leftData.totalInAlbum > 0
      ? leftData.totalInAlbum
      : rightData.totalInAlbum > 0
        ? rightData.totalInAlbum
        : 0

  const photoList = [...leftData.photoList, ...rightData.photoList]
  const skippedCount = leftData.skippedCount + rightData.skippedCount
  const loadedCount = leftData.loadedCount + rightData.loadedCount
  const nextPageStart = Math.max(
    pageStart + pageNum,
    leftData.nextPageStart,
    rightData.nextPageStart
  )

  return buildResponse({
    code: 0,
    message: skippedCount > 0 ? `已自动跳过 ${skippedCount} 张异常照片` : '',
    pageStart,
    pageNum,
    overrides: {
      photoList,
      totalInAlbum,
      skippedCount,
      loadedCount,
      nextPageStart,
      hasMore: totalInAlbum > 0 ? nextPageStart < totalInAlbum : true
    }
  })
}

/**
 * 容错版照片分页拉取：把单页失败拆分为更小的窗口去定位坏数据。
 * @param {(start: number, num: number) => Promise<unknown>} requestPage 真正发请求的函数；返回原始 payload（已过 extractJSONFromCallback）
 * @param {number} pageStart
 * @param {number} pageNum
 */
export const fetchPhotosTolerantly = async (requestPage, pageStart, pageNum) => {
  const payload = await requestPage(pageStart, pageNum)
  const cls = classifyPhotoPayload(payload)

  switch (cls.kind) {
    case 'success':
      return buildResponse({
        code: 0,
        message: payload.message || '',
        pageStart,
        pageNum,
        raw: payload
      })

    case 'permission-denied':
      return buildResponse({
        code: -10805,
        message: payload.message || '回答错误',
        pageStart,
        pageNum,
        raw: payload,
        overrides: { hasMore: false }
      })

    case 'api-error':
      return buildResponse({
        code: cls.code,
        message: cls.message,
        pageStart,
        pageNum,
        overrides: { hasMore: false }
      })

    case 'auth-required':
      console.warn('[photoTolerance] 命中登录态失效 / 风控拦截', {
        pageStart,
        pageNum,
        snippet: getPayloadSnippet(payload)
      })
      return buildResponse({
        code: -1,
        message: cls.message,
        pageStart,
        pageNum,
        overrides: { hasMore: false }
      })

    case 'recoverable': {
      console.warn('[photoTolerance] 解析失败，启动二分隔离', {
        pageStart,
        pageNum,
        snippet: getPayloadSnippet(payload)
      })

      if (pageNum <= 1) {
        console.warn('[photoTolerance] 跳过单张坏数据', { pageStart })
        return buildResponse({
          code: 0,
          message: `第 ${pageStart + 1} 张照片数据异常，已自动跳过`,
          pageStart,
          pageNum,
          overrides: {
            photoList: [],
            skippedCount: pageNum,
            hasMore: true,
            nextPageStart: pageStart + pageNum
          }
        })
      }

      const leftCount = Math.floor(pageNum / 2)
      const rightCount = pageNum - leftCount

      const left = await fetchPhotosTolerantly(requestPage, pageStart, leftCount)
      if (left.code !== 0) return left

      await sleep(BISECTION_THROTTLE_MS)

      const right = await fetchPhotosTolerantly(requestPage, pageStart + leftCount, rightCount)
      if (right.code !== 0) return right

      return mergeHalves(left, right, pageStart, pageNum)
    }

    case 'empty':
    case 'unknown':
    default:
      console.warn('[photoTolerance] 未识别的响应形态', {
        kind: cls.kind,
        pageStart,
        pageNum,
        snippet: getPayloadSnippet(payload)
      })
      return buildResponse({
        code: -1,
        message:
          typeof payload === 'string' && payload
            ? `照片数据解析失败：${getPayloadSnippet(payload)}`
            : '响应格式异常',
        pageStart,
        pageNum,
        overrides: { hasMore: false }
      })
  }
}
