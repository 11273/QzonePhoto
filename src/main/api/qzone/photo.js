import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'
import { parseSetCookie } from '@main/utils'

// Extract raw QQ number from cookie uin (strip "o" prefix)
const rawUin = (uin) => String(uin).replace(/^o/, '')

const cleanArray = (items) => (Array.isArray(items) ? items : []).filter(Boolean)

const evalObjectLiteral = (source) => {
  if (!source || typeof source !== 'string') return null
  try {
    return Function('"use strict";return (' + source + ')')()
  } catch {
    return null
  }
}

const extractHomeModuleData = (html = '') => {
  const match = String(html).match(/var\s+_feedsdata\s*=\s*({[\s\S]*?})\s*;\s*(?:for\s*\(|if\s*\()/)
  return evalObjectLiteral(match?.[1])
}

const extractHomeFeedBlocks = (html = '') => {
  const source = String(html || '')
  const blocks = []
  const startPattern = /<li\b[^>]*class=(["'])[^"']*\bf-single\b[^"']*\1[^>]*>/gi
  let match
  while ((match = startPattern.exec(source))) {
    const start = match.index
    const next = source.slice(startPattern.lastIndex).search(/<li\b[^>]*class=(["'])[^"']*\bf-single\b[^"']*\1[^>]*>/i)
    const end = next >= 0 ? startPattern.lastIndex + next : source.indexOf('</ul>', startPattern.lastIndex)
    if (end > start) blocks.push(source.slice(start, end))
  }
  return blocks
}

const attachHomeFeedHtml = (feeds, html = '') => {
  const blocks = extractHomeFeedBlocks(html)
  if (!blocks.length) return feeds
  const used = new Set()
  return feeds.map((feed, index) => {
    const key = String(feed?.key || '')
    const idPart = `${feed?.uin || ''}_${feed?.appid || ''}_${feed?.typeid || ''}_${feed?.abstime || ''}_${feed?.feedno || ''}`
    let blockIndex = blocks.findIndex((block, blockIdx) => {
      if (used.has(blockIdx)) return false
      return (key && block.includes(`data-key="${key}"`)) || (idPart && block.includes(idPart))
    })
    if (blockIndex < 0 && !used.has(index)) blockIndex = index
    if (blockIndex >= 0 && blocks[blockIndex]) {
      used.add(blockIndex)
      return { ...feed, html: feed.html || blocks[blockIndex] }
    }
    return feed
  })
}

const normalizeHomeFeedsPayload = (payload, html = '', fallbackPager = {}) => {
  const body = payload || {}
  const data = body.data || {}
  const main = data.main || {}
  const feeds = cleanArray([
    ...cleanArray(data.host_data),
    ...cleanArray(data.firstpage_data),
    ...cleanArray(data.friend_data),
    ...cleanArray(data.about_data),
    ...cleanArray(data.data)
  ])
  const withHtml = attachHomeFeedHtml(feeds, html)
  const start = Number(fallbackPager.start || 0)
  const nextOffset = Number(main.offset)
  return {
    code: body.code === '' ? 0 : Number(body.code ?? 0),
    message: body.message || '',
    hasMore: !!(main.hasMoreFeeds || main.hasMoreFeeds_0) && withHtml.length > 0,
    pager: {
      start: Number.isFinite(nextOffset) && nextOffset > start ? nextOffset : start + withHtml.length,
      count: Number(fallbackPager.count || 10)
    },
    feeds: withHtml
  }
}

const homeHtmlErrorMessage = (html = '') => {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  if (/主人设置了保密|没有权限|无权|访问受限|仅主人|权限/.test(text)) {
    return '对不起，主人设置了保密，您没有权限查看'
  }
  if (/登录|请先登录|未登录/.test(text)) return '登录态已失效，请重新登录'
  return '主页响应解析失败'
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
  // 支持回答问题访问（priv=5）和密码访问（priv=2）
  if (opts.question !== undefined) params.question = opts.question
  if (opts.answer !== undefined) params.answer = opts.answer

  // 模拟 Qzone 网页的请求签名：带 Referer/Origin + 已有的 qq_photo_key，
  // 让服务端返回稳定 key；否则每次会下发新的一次性签名 key。
  const cookieParts = [`uin=${uin}`, `p_skey=${p_skey}`]
  if (opts.qq_photo_key) cookieParts.push(`qq_photo_key=${opts.qq_photo_key}`)

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: cookieParts.join(';'),
      Referer: 'https://user.qzone.qq.com/',
      Origin: 'https://user.qzone.qq.com'
    }
  })

  // 提取 set-cookie 中的 qq_photo_key
  let qq_photo_key = null
  const setCookieHeader = response.headers?.['set-cookie']
  if (setCookieHeader) {
    const cookies = parseSetCookie(setCookieHeader)
    qq_photo_key = cookies['qq_photo_key'] || null
  }

  return { data: response.data, qq_photo_key }
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
 * 拉某条好友动态的评论列表（infocenter 评论 CGI）。
 *
 * 关键参数（从网页实际请求逆向，多 feed 样本对比验证）：
 *   - method: POST + form-urlencoded（GET 不稳）
 *   - hostUin = feed 作者 uin（**不是** self 登录 uin）
 *   - uin     = self 登录 uin
 *   - topicId = data-topicid，格式 `<feedAuthor>_<tid>__1`
 *   - feedsType = 8 固定（不是 feeds3 raw 里的 data-feedstype=100）
 *
 * 只对 appid=311 (说说) 调；相册/日志/视频/分享的评论已经在
 * feeds3_html_more 第一次返回的 HTML 里，不需要二次请求。
 *
 * 响应：frameElement.callback({ ret, result: { feeds: <HTML> } })，
 * axios interceptor 已自动解 callback wrap。
 *
 * @param {string} uin       cookie uin（登录者）
 * @param {string} p_skey    登录 skey
 * @param {object} feedRef   { topicId, hostUin, feedsType, start, num, sort }
 */
export async function emotion_cgi_ic_getcomments(uin, p_skey, feedRef = {}) {
  const {
    topicId,
    hostUin,
    feedsType = 8,
    start = 0,
    num = 20,
    sort = 1
  } = feedRef
  if (!topicId || !hostUin) {
    return { code: -1, message: 'missing topicId/hostUin' }
  }
  const url =
    'https://user.qzone.qq.com/proxy/domain/taotao.qzone.qq.com/cgi-bin/emotion_cgi_ic_getcomments'
  const params = { g_tk: getGTK(p_skey) }
  const body = new URLSearchParams({
    topicId,
    hostUin: String(hostUin),
    uin: rawUin(uin),
    feedsType: String(feedsType),
    start: String(start),
    num: String(num),
    sort: String(sort),
    source: 'ic',
    format: 'fs',
    plat: 'qzone',
    ref: 'feeds',
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    paramstr: '1',
    isfakereq: '1',
    qzreferrer: `https://user.qzone.qq.com/${rawUin(uin)}/infocenter`
  })
  const response = await request.post(url, body.toString(), {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Origin: 'https://user.qzone.qq.com',
      Referer: `https://user.qzone.qq.com/${rawUin(uin)}/infocenter`
    }
  })
  // axios interceptor 解 frameElement.callback 后：
  //   { ret, needVerify, err, msg, result: { feeds: <HTML>, ... } }
  const body2 = response.data || {}
  return {
    code: body2.ret ?? body2.code ?? 0,
    message: body2.msg || body2.message || '',
    feedsHtml: body2.result?.feeds || body2.data?.feeds || ''
  }
}

/**
 * 拉「好友动态」时间线（QQ 空间网页右上「动态」入口对应的接口）。
 *
 * 这个接口返回 `_Callback({...})` 包裹的 JS object literal —— 单引号、
 * unquoted key、嵌入大量 \x3C 转义的 HTML，标准 JSON.parse 解析不了。
 * 我们用 Function('return (...)') 在主进程内 eval（vs renderer eval 风险
 * 等价；服务器本身已经被信任），抽出 data 数组 + 翻页指针。
 *
 * @param {string} uin    cookie uin (带 o 前缀)
 * @param {string} p_skey 登录 skey
 * @param {string} hostUin 浏览者自己的 QQ（feeds3 只看自己接收到的好友动态）
 * @param {object} pager   { pagenum, begintime, externparam, count }
 */
export async function feeds3_html_more(uin, p_skey, hostUin, pager = {}) {
  const { pagenum = 1, begintime = 0, externparam = 'undefined', count = 10, dayspac = 0, scope = 0 } = pager
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds3_html_more'
  const params = {
    uin: hostUin || rawUin(uin),
    scope,
    view: 1,
    daylist: '',
    uinlist: '',
    gid: '',
    flag: 1,
    filter: 'all',
    applist: 'all',
    refresh: 0,
    aisortEndTime: 0,
    aisortOffset: 0,
    getAisort: 0,
    aisortBeginTime: 0,
    pagenum,
    externparam,
    firstGetGroup: 0,
    icServerTime: 0,
    mixnocache: 0,
    scene: 0,
    begintime: begintime || 'undefined',
    count,
    dayspac: dayspac || 'undefined',
    sidomain: 'qzonestyle.gtimg.cn',
    useutf8: 1,
    outputhtmlfeed: 1,
    rd: Math.random(),
    usertime: Date.now(),
    g_tk: getGTK(p_skey)
  }

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${hostUin || rawUin(uin)}/infocenter`
    }
  })

  // axios 全局 interceptor 已经把 _Callback({...}) 解包成 object，并把
  // 内部 JS object literal 也 eval 过了。data 长这样：
  //   { code, subcode, message, data: { main: {...}, data: [...] } }
  const body = response.data || {}
  const inner = body.data || {}
  const main = inner.main || {}
  const list = Array.isArray(inner.data) ? inner.data : []

  return {
    code: body.code ?? 0,
    hasMore: !!main.hasMoreFeeds,
    pager: {
      pagenum: main.pagenum ? Number(main.pagenum) : pagenum + 1,
      begintime: main.begintime ? Number(main.begintime) : 0,
      externparam: main.externparam || '',
      dayspac: main.dayspac ? Number(main.dayspac) : 0
    },
    feeds: list
  }
}

/**
 * 拉「我的主页 / 好友主页」动态。
 *
 * 官方主页首屏不是 emotion_cgi_msglist_v6，而是先加载 feeds_html_module，
 * 响应里同时包含 _feedsdata 元数据和完整 feed HTML。后续分页走
 * feeds_html_act_all，并复用同一套 outputhtmlfeed 结构。
 */
export async function feeds_home_html(uin, p_skey, hostUin, pager = {}) {
  const { start = 0, count = 10 } = pager
  const loginUin = rawUin(uin)
  const targetUin = hostUin || loginUin

  if (!targetUin || !loginUin || !p_skey) {
    return { code: -1, message: '登录态缺失', hasMore: false, pager: { start, count }, feeds: [] }
  }

  if (Number(start) <= 0) {
    const url =
      'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds_html_module'
    const params = {
      g_iframeUser: 1,
      i_uin: targetUin,
      i_login_uin: loginUin,
      mode: 4,
      previewV8: 1,
      style: 35,
      version: 8,
      needDelOpr: true,
      transparence: true,
      hideExtend: false,
      showcount: count,
      MORE_FEEDS_CGI: 'http://ic2.s8.qzone.qq.com/cgi-bin/feeds/feeds_html_act_all',
      refer: 2,
      paramstring: 'os-mac|100'
    }
    const response = await request.get(url, {
      params,
      headers: {
        Cookie: `uin=${uin};p_skey=${p_skey}`,
        Referer: `https://user.qzone.qq.com/${targetUin}/main`
      },
      responseType: 'text'
    })
    const html = String(response.data || '')
    const payload = extractHomeModuleData(html)
    if (!payload) {
      return {
        code: -1,
        message: homeHtmlErrorMessage(html),
        hasMore: false,
        pager: { start, count },
        feeds: []
      }
    }
    return normalizeHomeFeedsPayload(payload, html, { start, count })
  }

  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds_html_act_all'
  const params = {
    uin: targetUin,
    hostuin: targetUin,
    scope: 0,
    filter: 'all',
    flag: 1,
    refresh: 0,
    firstGetGroup: 0,
    mixnocache: 0,
    scene: 0,
    begintime: 'undefined',
    icServerTime: '',
    start,
    count,
    sidomain: 'qzonestyle.gtimg.cn',
    useutf8: 1,
    outputhtmlfeed: 1,
    refer: 2,
    r: Math.random(),
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${targetUin}/main`
    }
  })
  return normalizeHomeFeedsPayload(response.data || {}, '', { start, count })
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
/**
 * 获取相册访客信息（与 QQ 空间相册详情页"访客"同源接口）
 * @returns data: { modvisitcount: [{ totalcount, todaycount }], items: [...visitors], calvisitcount: number[31] }
 */
export async function cgi_get_visitor_simple(uin, p_skey, hostUin, albumId) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_simple'
  const params = {
    uin: hostUin,
    mask: 2,
    mod: 2,
    contentid: albumId,
    fupdate: 1,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

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

/**
 * 顶部 5 类动态未读计数（动态 tab 角标用）
 * 返回：{ myFeeds / friendFeeds / specialCareFeeds / aboutHostFeeds / replyHostFeeds }_new_cnt
 */
export async function cgi_get_feeds_count(uin, p_skey, hostUin) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/cgi_get_feeds_count.cgi'
  const params = {
    uin: hostUin || rawUin(uin),
    rd: Math.random(),
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${hostUin || rawUin(uin)}`
    }
  })
  // axios interceptor 已解 callback({...})
  const body = response.data || {}
  return {
    code: body.code ?? 0,
    counts: body.data || {}
  }
}

/**
 * 「与我相关」时间线（feeds2_html_pav_all）
 *   - scope=1 固定，分页用 offset / count
 *   - 返回结构与 feeds3_html_more 类似，但 main.hasMoreFeeds + main.offset
 */
export async function feeds2_html_pav_all(uin, p_skey, hostUin, pager = {}) {
  const { offset = 0, count = 10, beginTime = 0, endTime = 0 } = pager
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds2_html_pav_all'
  const params = {
    uin: hostUin || rawUin(uin),
    begin_time: beginTime,
    end_time: endTime,
    getappnotification: 1,
    getnotifi: 1,
    has_get_key: 0,
    offset,
    set: 0,
    count,
    useutf8: 1,
    outputhtmlfeed: 1,
    grz: Math.random(),
    scope: 1,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${hostUin || rawUin(uin)}`
    }
  })
  const body = response.data || {}
  const inner = body.data || {}
  const main = inner.main || {}
  const list = Array.isArray(inner.data) ? inner.data : []
  return {
    code: body.code ?? 0,
    hasMore: !!main.hasMoreFeeds,
    pager: {
      offset: main.offset ? Number(main.offset) : offset + count,
      hostMore: main.host_more || ''
    },
    feeds: list
  }
}

/**
 * 「我的收藏」列表（fav.qzone.qq.com/cgi-bin/get_fav_list）
 *   - type: 0=全部 / 1=网页 / 2=本地图片 / 3=日志 / 4=相册照片 / 5=说说 / 6=文字 / 7=分享
 *   - 返回结构：{ total_num, fav_list: [{ id, type, create_time, title, abstract, desp,
 *                                       img_list[], origin_img_list[], shuoshuo_info{owner_uin,owner_nam,...},
 *                                       user_agent, ... }] }
 */
export async function get_fav_list(uin, p_skey, opts = {}) {
  const { type = 0, start = 0, num = 10 } = opts
  // 注意：必须走 user.qzone.qq.com 域的 proxy，不走 h5.qzone.qq.com。
  // h5 域服务器对 cookie 校验严格（需要 ptcz / pt4_token 等），
  // 而主进程 axios 只能给 uin / p_skey；同 CGI 走 user 域 proxy 同样 200，cookie 校验更宽松。
  const url =
    'https://user.qzone.qq.com/proxy/domain/fav.qzone.qq.com/cgi-bin/get_fav_list'
  const params = {
    uin: rawUin(uin),
    type,
    start,
    num,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    need_nick: 1,
    need_cnt: start === 0 ? 1 : 0,
    need_new_user: start === 0 ? 1 : 0,
    fupdate: 1,
    callback: '_Callback',
    random: Math.random(),
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin}; p_uin=${uin}; skey=${p_skey}; p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${rawUin(uin)}/myhome/favorite`,
      Host: 'user.qzone.qq.com'
    }
  })
  const body = response.data || {}
  const data = body.data && typeof body.data === 'object' ? body.data : body
  return {
    code: body.code ?? 0,
    total: Number(data.total_num) || 0,
    favList: Array.isArray(data.fav_list) ? data.fav_list : []
  }
}

/**
 * 「那年今日」时间线（feeds2_html_today_lastyear）
 *   - year 是要回顾的年份；count 一次取多少条
 *   - 数据为空时 main.host_more / friend_more 会给出友好提示文案
 */
export async function feeds2_html_today_lastyear(uin, p_skey, opts = {}) {
  const { year, count = 8, mode = 1 } = opts
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds2_html_today_lastyear'
  const params = {
    login_uin: rawUin(uin),
    mode,
    refer: 'qzone',
    useutf8: 1,
    count,
    year: year ?? new Date().getFullYear() - 1,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${rawUin(uin)}`
    }
  })
  const body = response.data || {}
  const inner = body.data || {}
  const main = inner.main || {}
  const list = [
    ...(Array.isArray(inner.data) ? inner.data : []),
    ...(Array.isArray(inner.host_data) ? inner.host_data : []),
    ...(Array.isArray(inner.friend_data) ? inner.friend_data : []),
    ...(Array.isArray(inner.about_data) ? inner.about_data : []),
    ...(Array.isArray(inner.firstpage_data) ? inner.firstpage_data : [])
  ].filter((item) => item && typeof item === 'object' && item.html)
  return {
    code: body.code ?? 0,
    hasMore: !!(main.hasMoreFeeds_0 || main.hasMoreFeeds_1) && list.length > 0,
    emptyHint: main.friend_more || main.host_more || '',
    feeds: list
  }
}

/**
 * 「留言板」列表（m.qzone.qq.com/cgi-bin/new/get_msgb）
 *   - 官方 PC 页每页 10 条，分页用 start / num
 *   - 楼层号由 total - start - index 反推
 *   - 只读接口，不包含发表 / 回复 / 删除能力
 */
export async function get_msgb(uin, p_skey, hostUin, opts = {}) {
  const start = Math.max(0, Number(opts.start) || 0)
  const num = Math.min(50, Math.max(1, Number(opts.num) || 10))
  const targetUin = rawUin(hostUin || uin)
  const url = 'https://user.qzone.qq.com/proxy/domain/m.qzone.qq.com/cgi-bin/new/get_msgb'
  const params = {
    uin: rawUin(uin),
    hostUin: targetUin,
    num,
    start,
    hostword: 0,
    essence: 1,
    r: Math.random(),
    iNotice: 0,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    format: 'jsonp',
    ref: 'qzone',
    g_tk: getGTK(p_skey)
  }

  const response = await request.get(url, {
    params,
    telemetry: false,
    headers: {
      Cookie: `uin=${uin};p_uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${targetUin}`
    }
  })
  const body = response.data || {}
  const data = body.data || {}
  const comments = Array.isArray(data.commentList) ? data.commentList : []
  return {
    code: Number(body.code ?? 0),
    message: body.message || '',
    total: Number(data.total) || 0,
    auditNum: Number(data.auditNum) || 0,
    auditON: !!data.auditON,
    authorInfo: data.authorInfo || {},
    start,
    num,
    hasMore: start + comments.length < (Number(data.total) || 0),
    comments
  }
}
