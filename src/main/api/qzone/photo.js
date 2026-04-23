import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'
import { parseSetCookie } from '@main/utils'

// Extract raw QQ number from cookie uin (strip "o" prefix)
const rawUin = (uin) => String(uin).replace(/^o/, '')

const toNonNegativeNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

const getPhotoPayloadSnippet = (payload) => {
  if (typeof payload !== 'string') return ''
  return payload.slice(0, 160).replace(/\s+/g, ' ')
}

const isRecoverablePhotoPayload = (payload) => {
  if (typeof payload !== 'string') return false

  const text = payload.trim()
  if (!/^[a-zA-Z_$][\w$]*\s*\(/.test(text)) return false

  return (
    text.includes('photoList') ||
    text.includes('totalInAlbum') ||
    text.includes('subcode') ||
    text.includes('"code"') ||
    text.includes("'code'")
  )
}

const normalizePhotoPayload = (payload, pageStart, pageNum, overrides = {}) => {
  const basePayload = payload && typeof payload === 'object' ? payload : {}
  const baseData = basePayload.data && typeof basePayload.data === 'object' ? basePayload.data : {}
  const photoList = Array.isArray(overrides.photoList ?? baseData.photoList)
    ? (overrides.photoList ?? baseData.photoList)
    : []
  const requestedCount = toNonNegativeNumber(overrides.requestedCount ?? baseData.requestedCount, pageNum)
  const totalInAlbum = toNonNegativeNumber(overrides.totalInAlbum ?? baseData.totalInAlbum)
  const skippedCount = toNonNegativeNumber(overrides.skippedCount ?? baseData.skippedCount)
  const loadedCount = toNonNegativeNumber(overrides.loadedCount ?? baseData.loadedCount, photoList.length)
  const nextPageStartValue = Number(overrides.nextPageStart ?? baseData.nextPageStart)
  const nextPageStart =
    Number.isFinite(nextPageStartValue) && nextPageStartValue >= pageStart
      ? nextPageStartValue
      : pageStart + requestedCount
  const hasMoreValue = overrides.hasMore ?? baseData.hasMore
  const hasMore =
    typeof hasMoreValue === 'boolean'
      ? hasMoreValue
      : totalInAlbum > 0
        ? nextPageStart < totalInAlbum
        : photoList.length === requestedCount

  return {
    ...basePayload,
    code: typeof basePayload.code === 'number' ? basePayload.code : 0,
    message: overrides.message ?? basePayload.message ?? '',
    data: {
      ...baseData,
      photoList,
      totalInAlbum,
      hasMore,
      nextPageStart,
      requestedCount,
      skippedCount,
      loadedCount
    }
  }
}

const resolveMergedTotalInAlbum = (leftData = {}, rightData = {}) => {
  const leftTotal = toNonNegativeNumber(leftData.totalInAlbum, -1)
  const rightTotal = toNonNegativeNumber(rightData.totalInAlbum, -1)

  if (leftTotal > 0) return leftTotal
  if (rightTotal > 0) return rightTotal

  return 0
}

const buildPhotoFailurePayload = (pageStart, pageNum, message, code = -1) => {
  return {
    code,
    message,
    data: {
      photoList: [],
      totalInAlbum: 0,
      hasMore: false,
      nextPageStart: pageStart + pageNum,
      requestedCount: pageNum,
      skippedCount: 0,
      loadedCount: 0
    }
  }
}

const buildSkippedPhotoPayload = (pageStart, pageNum) => {
  return normalizePhotoPayload(
    {
      code: 0,
      message: `第 ${pageStart + 1} 张照片数据异常，已自动跳过`,
      data: {}
    },
    pageStart,
    pageNum,
    {
      photoList: [],
      hasMore: true,
      nextPageStart: pageStart + pageNum,
      requestedCount: pageNum,
      skippedCount: pageNum,
      loadedCount: 0
    }
  )
}

const createPhotoRequestContext = (opts = {}) => ({
  qqPhotoKey: opts.qq_photo_key || null
})

const buildPhotoRequestOptions = (opts = {}, context) => {
  const requestOpts = { ...opts }
  if (context.qqPhotoKey) {
    requestOpts.qq_photo_key = context.qqPhotoKey
  }
  return requestOpts
}

const requestPhotoPage = async (
  uin,
  p_skey,
  hostUin,
  pageStart,
  pageNum,
  topicId,
  opts = {},
  context = createPhotoRequestContext(opts)
) => {
  const url = 'https://h5.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo'
  const params = {
    hostUin,
    uin: rawUin(uin),
    appid: 4,
    pageStart,
    pageNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    g_tk: getGTK(p_skey),
    topicId
  }
  const requestOpts = buildPhotoRequestOptions(opts, context)

  // 支持回答问题访问（priv=5）和密码访问（priv=2）
  if (requestOpts.question !== undefined) params.question = requestOpts.question
  if (requestOpts.answer !== undefined) params.answer = requestOpts.answer

  // 模拟 Qzone 网页的请求签名：带 Referer/Origin + 已有的 qq_photo_key，
  // 让服务端返回稳定 key；否则每次会下发新的一次性临时 key，与图片签名 URL 严格绑定，导致跨分页无法复用。
  const cookieParts = [`uin=${uin}`, `p_skey=${p_skey}`]
  if (requestOpts.qq_photo_key) cookieParts.push(`qq_photo_key=${requestOpts.qq_photo_key}`)

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: cookieParts.join(';'),
      Referer: 'https://user.qzone.qq.com/',
      Origin: 'https://user.qzone.qq.com'
    }
  })

  const setCookieHeader = response.headers?.['set-cookie']
  if (setCookieHeader) {
    const cookies = parseSetCookie(setCookieHeader)
    if (cookies['qq_photo_key']) {
      context.qqPhotoKey = cookies['qq_photo_key']
    }
  }

  return response.data
}

const fetchPhotoPageWithTolerance = async (
  uin,
  p_skey,
  hostUin,
  pageStart,
  pageNum,
  topicId,
  opts = {},
  context = createPhotoRequestContext(opts)
) => {
  const payload = await requestPhotoPage(
    uin,
    p_skey,
    hostUin,
    pageStart,
    pageNum,
    topicId,
    opts,
    context
  )

  if (payload?.code === 0 && payload?.data) {
    return normalizePhotoPayload(payload, pageStart, pageNum)
  }

  if (payload?.code === -10805) {
    return {
      ...payload,
      data: {
        ...(payload?.data && typeof payload.data === 'object' ? payload.data : {}),
        photoList: [],
        totalInAlbum: 0,
        hasMore: false,
        nextPageStart: pageStart + pageNum,
        requestedCount: pageNum,
        skippedCount: 0,
        loadedCount: 0
      }
    }
  }

  if (isRecoverablePhotoPayload(payload)) {
    if (pageNum <= 1) {
      return buildSkippedPhotoPayload(pageStart, pageNum)
    }

    const leftCount = Math.floor(pageNum / 2)
    const rightCount = pageNum - leftCount
    const left = await fetchPhotoPageWithTolerance(
      uin,
      p_skey,
      hostUin,
      pageStart,
      leftCount,
      topicId,
      opts,
      context
    )

    if (left?.code !== 0) {
      return left
    }

    const right = await fetchPhotoPageWithTolerance(
      uin,
      p_skey,
      hostUin,
      pageStart + leftCount,
      rightCount,
      topicId,
      opts,
      context
    )

    if (right?.code !== 0) {
      return right
    }

    const leftData = left.data || {}
    const rightData = right.data || {}
    const totalInAlbum = resolveMergedTotalInAlbum(leftData, rightData)
    const mergedPhotos = [...(leftData.photoList || []), ...(rightData.photoList || [])]
    const mergedSkippedCount =
      toNonNegativeNumber(leftData.skippedCount) + toNonNegativeNumber(rightData.skippedCount)
    const mergedLoadedCount =
      toNonNegativeNumber(leftData.loadedCount) + toNonNegativeNumber(rightData.loadedCount)
    const mergedMessage =
      mergedSkippedCount > 0 ? `已自动跳过 ${mergedSkippedCount} 张异常照片` : ''
    const mergedNextPageStart = Math.max(
      pageStart + pageNum,
      toNonNegativeNumber(leftData.nextPageStart),
      toNonNegativeNumber(rightData.nextPageStart)
    )
    const basePayload =
      (leftData.totalInAlbum ? left : null) || (rightData.totalInAlbum ? right : null) || left || right

    return normalizePhotoPayload(basePayload, pageStart, pageNum, {
      photoList: mergedPhotos,
      totalInAlbum,
      hasMore: totalInAlbum > 0 ? mergedNextPageStart < totalInAlbum : true,
      nextPageStart: mergedNextPageStart,
      requestedCount: pageNum,
      skippedCount: mergedSkippedCount,
      loadedCount: mergedLoadedCount,
      message: mergedMessage
    })
  }

  if (payload && typeof payload === 'object') {
    return buildPhotoFailurePayload(
      pageStart,
      pageNum,
      payload?.message || `API 错误: code=${payload?.code}, message=${payload?.message}`,
      typeof payload?.code === 'number' ? payload.code : -1
    )
  }

  return buildPhotoFailurePayload(
    pageStart,
    pageNum,
    `照片数据解析失败：${getPhotoPayloadSnippet(payload) || '响应格式异常'}`
  )
}
/**
 * 获取相册列表
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param pageStart 分页起始位置
 * @param pageNum 每页数量
 * @param mode 模式 (2=normal普通模式, 3=class分类模式, 4=oneClass单个分类模式)
 * @param classId 分类ID (mode=4时需要)
 * @returns
 */
export async function fcg_list_album_v3(
  uin,
  p_skey,
  hostUin,
  pageStart,
  pageNum,
  mode = null,
  classId = null
) {
  const url = 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3'
  const params = {
    hostUin,
    uin: rawUin(uin),
    appid: 4,
    pageStart,
    pageNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    // 由于网页调整视图会同步干扰数据，这里需要强制指定模式 3，但是 3 会导致数据获取不全，所以需要指定 needUserInfo
    mode: mode || 3,
    needUserInfo: 1,
    //最新创建在前
    sortOrder: 1
  }

  // 添加classId参数 (单个分类模式时)
  if (classId !== null) {
    params.classId = classId
  }

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 获取相册中的照片
 * @param {object} opts - 额外选项
 * @param {string} opts.question - 相册问题（priv=5 时需要）
 * @param {string} opts.answer - MD5 后的答案
 * @param {string} opts.qq_photo_key - 已有的 qq_photo_key，回带给服务端以保持稳定 key（否则服务端会每次下发一次性临时 key，与图片签名 URL 严格绑定，导致跨分页无法复用）
 */
export async function cgi_list_photo(uin, p_skey, hostUin, pageStart, pageNum, topicId, opts = {}) {
  const context = createPhotoRequestContext(opts)
  const payload = await fetchPhotoPageWithTolerance(
    uin,
    p_skey,
    hostUin,
    pageStart,
    pageNum,
    topicId,
    opts,
    context
  )

  return { data: payload, qq_photo_key: context.qqPhotoKey }
}

/**
 * 获取照片浮层视图列表
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param topicId 相册ID
 * @param picKey 照片Key
 * @param cmtNum 评论数量
 * @param isFirst 是否首次
 * @param postNum 帖子数量
 * @returns
 */
export async function cgi_floatview_photo_list_v2(
  uin,
  p_skey,
  hostUin,
  topicId,
  picKey,
  cmtNum = 10,
  isFirst = 1,
  postNum = 18
) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_floatview_photo_list_v2'
  const params = {
    g_tk: getGTK(p_skey),
    topicId,
    picKey,
    cmtNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    uin: rawUin(uin),
    hostUin,
    appid: 4,
    isFirst,
    postNum
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 获取视频数据
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param getMethod 获取方法
 * @param start 开始位置
 * @param count 获取数量
 * @param need_old 是否需要旧数据
 * @param getUserInfo 是否获取用户信息
 * @returns
 */
export async function cgi_video_get_data(
  uin,
  p_skey,
  hostUin,
  getMethod = 2,
  start = 0,
  count = 20,
  need_old = 1,
  getUserInfo = 1
) {
  const url = 'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data'
  const params = {
    g_tk: getGTK(p_skey),
    uin: rawUin(uin),
    hostUin,
    appid: 4,
    getMethod,
    start,
    count,
    need_old,
    getUserInfo,
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 删除照片
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param albumId 相册ID
 * @param photoData 照片数据数组，每个元素包含 {id, modifytime}
 * @param albumName 相册名称
 * @param priv 权限
 * @returns
 */
export async function cgi_delpic_multi_v2(
  uin,
  p_skey,
  hostUin,
  albumId,
  photoData,
  albumName = 'undefined',
  priv = 3
) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/cgi-bin/common/cgi_delpic_multi_v2'

  // 构造codelist格式，根据官方源码：
  // imageId|picrefer|时间戳|||imageId|imageType|0
  // 多张照片用 _ 分隔
  const codelistParts = photoData.map((photo) => {
    const photoId = photo.id
    const picrefer = photo.picrefer || ''
    const imageType = photo.imageType || 1
    const timestamp = Date.now()
    // 格式：[imageId, picrefer, 时间戳, "", "", imageId, imageType, 0].join("|")
    return [photoId, picrefer, timestamp, '', '', photoId, imageType, 0].join('|')
  })
  const codelist = codelistParts.join('_')

  // ismultiup 是照片数量对应的0字符串
  const ismultiup = '0'.repeat(photoData.length)

  const data = {
    qzreferrer: `https://user.qzone.qq.com/${hostUin}`,
    albumid: albumId,
    nvip: '1',
    bgid: 'undefined',
    tpid: 'undefined',
    priv: priv.toString(),
    albumname: albumName,
    codelist: codelist,
    ismultiup: ismultiup,
    resetcover: '1',
    newcover: '',
    uin: rawUin(uin),
    hostUin: hostUin,
    plat: 'qzone',
    source: 'qzone',
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  }

  const response = await request.post(url, data, {
    params: {
      g_tk: getGTK(p_skey)
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })

  // 返回的是HTML页面，需要解析JavaScript中的JSON数据
  const htmlContent = response.data
  // 使用正则提取JSON数据
  const jsonMatch = htmlContent.match(/frameElement\.callback\(([\s\S]*?)\)/)

  if (jsonMatch && jsonMatch[1]) {
    try {
      // 去除可能的尾部分号和空格
      const jsonStr = jsonMatch[1].trim().replace(/;?\s*$/, '')
      const result = eval('(' + jsonStr + ')')
      return result
    } catch (error) {
      console.error('解析删除照片响应失败:', error)
      throw new Error('解析删除响应失败')
    }
  }

  throw new Error('删除照片响应格式异常')
}

/**
 * 获取QQ空间动态（说说）
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param begintime 开始时间戳（秒）
 * @param fuin 查看谁的动态（默认等于hostUin）
 * @returns
 */
export async function feeds2_html_picfeed_qqtab(uin, p_skey, hostUin, begintime = 0, fuin = null) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds2_html_picfeed_qqtab'
  const params = {
    g_tk: getGTK(p_skey),
    t: Date.now(),
    uin: rawUin(uin),
    hostUin,
    fuin: fuin || hostUin,
    appid: 4,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    begintime
  }

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })

  return response.data
}

/**
 * 删除动态
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param skey 动态的skey
 * @param time 动态的时间戳
 * @param typeid 动态类型ID
 * @param flag 标志位，默认0
 * @returns
 */
export async function feeds_delete_cgi(uin, p_skey, hostUin, skey, time, typeid = 0, flag = 0) {
  const url = 'https://user.qzone.qq.com/proxy/domain/w.qzone.qq.com/cgi-bin/feeds/feeds_delete_cgi'

  const params = {
    g_tk: getGTK(p_skey)
  }

  // 构造表单数据
  const formData = new URLSearchParams({
    // qzreferrer: `https://user.qzone.qq.com/${hostUin}`,
    appid: 4,
    type: typeid,
    key: skey,
    flag: flag,
    time: time,
    uin: rawUin(uin),
    hostUin: hostUin,
    plat: 'qzone',
    source: 'qzone',
    inCharset: 'UTF-8',
    outCharset: 'UTF-8'
  })
  console.log(formData.toString())
  const response = await request.post(url, formData.toString(), {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  })

  return response.data
}

/**
 * 获取好友照片动态流
 * @param uin cookie uin
 * @param p_skey 登录后有
 * @param start 偏移量（0开始）
 * @param count 每次获取数量
 * @param begintime 时间戳（秒），用于翻页
 * @returns { hasmore, begintime, photos: [...] }
 */
export async function feeds2_html_picfeed(uin, p_skey, start = 0, count = 20, begintime = 0) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds2_html_picfeed'
  const params = {
    g_tk: getGTK(p_skey),
    t: Date.now(),
    start,
    cache: 0,
    refer: 'qzone',
    plat: 'qzone',
    json_esc: 1,
    count,
    begintime,
    view: 1,
    filter: 4,
    applist: 4,
    sidomain: 'qzonestyle.gtimg.cn',
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    uin: rawUin(uin)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 获取相册问题和答案（仅相册主人可获取答案）
 * @param uin cookie uin
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param albumId 相册ID
 * @returns { question, answer, priv, name, ... }
 */
export async function cgi_get_albuminfo_v2(uin, p_skey, hostUin, albumId) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/cgi-bin/common/cgi_get_albuminfo_v2'
  const params = {
    g_tk: getGTK(p_skey),
    albumId,
    hostUin,
    uin: hostUin,
    appid: 4,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    source: 'qzone',
    plat: 'qzone'
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}
