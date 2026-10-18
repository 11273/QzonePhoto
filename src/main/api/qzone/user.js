import { net } from 'electron'
import { extractJSONFromCallback, getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'
import { normalizeQzoneReadResponse } from '@shared/qzone-read-response'

// Extract raw QQ number from cookie uin (strip "o" prefix)
const rawUin = (uin) => String(uin).replace(/^o/, '')
const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const qzoneCode = (...values) => {
  const candidates = values
    .flatMap((value) =>
      isRecord(value)
        ? [value.code, value.ret, value.subcode, value.errno, value.errorCode]
        : [value]
    )
    .filter((value) => value !== undefined && value !== null && value !== '')
  const failed = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) !== 0)
  if (failed !== undefined) return Number(failed)
  const successful = candidates.find((value) => Number.isFinite(Number(value)))
  return successful === undefined ? 0 : Number(successful)
}
const qzoneMessage = (...values) =>
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

export async function getMeInfo(uin, p_skey) {
  const url = 'https://h5.qzone.qq.com/proxy/domain/vip.qzone.qq.com/fcg-bin/fcg_get_vipinfo_mobile'
  const params = {
    get_all: 1,
    g_tk: getGTK(p_skey),
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  }

  const response = await request.get(url, {
    params,
    headers: {
      cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return normalizeQzoneReadResponse(response.data, {
    label: '个人资料',
    isValid: (body) => isRecord(body?.data)
  })
}

/**
 * 获取好友个人名片（隐藏数据：真实姓名、亲密度、星座、所在地等）
 * @param {string} uin cookie uin
 * @param {string} p_skey 登录凭证
 * @param {string} targetUin 目标QQ号
 */
export async function getPersonalCard(uin, p_skey, targetUin) {
  const url = 'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/user/cgi_personal_card'
  const params = {
    uin: targetUin,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return normalizeQzoneReadResponse(response.data, {
    label: '好友资料',
    isValid: (body) => Boolean(String(body?.uin || '').trim())
  })
}

/**
 * 获取访客在线状态和最后访问时间
 * @param {string} uin cookie uin
 * @param {string} p_skey 登录凭证
 */
export async function getVisitorStatus(uin, p_skey) {
  const url = 'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi'
  const params = {
    uin: rawUin(uin),
    param: `3_${rawUin(uin)}_0`,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return normalizeQzoneReadResponse(response.data, {
    label: '访客状态',
    isValid: (body) => isRecord(body?.data) && isRecord(body.data.module_3)
  })
}

/**
 * 获取访客详细记录（30天访问统计、访客列表）
 * @param {string} uin cookie uin
 * @param {string} p_skey 登录凭证
 * @param {number} mask 2=相册访客
 * @param {number} mod 2=相册模块
 */
export async function getVisitorDetail(uin, p_skey, mask = 2, mod = 2) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_simple'
  const params = {
    uin: rawUin(uin),
    mask,
    mod,
    fupdate: 1,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return normalizeQzoneReadResponse(response.data, {
    label: '访客记录',
    isValid: (body) => {
      const data = body?.data
      if (!isRecord(data)) return false
      return (
        Array.isArray(data.items) ||
        Array.isArray(data.modvisitcount) ||
        Array.isArray(data.calvisitcount) ||
        Object.prototype.hasOwnProperty.call(data, 'count') ||
        Object.prototype.hasOwnProperty.call(data, 'todaycount')
      )
    }
  })
}

/**
 * 获取完整访客记录。
 * 官方访客页使用 mask=3（谁看过我）与 mask=5（我看过谁），按 page 翻页。
 * 与 simple 接口分开保留，避免首页为了统计一次性拉取完整名单。
 */
export async function getVisitorMore(uin, p_skey, mask = 3, mod = 8, page = 1) {
  const safeMask = Number(mask) === 5 ? 5 : 3
  const safePage = Math.max(1, Number(page) || 1)
  const url =
    'https://user.qzone.qq.com/proxy/domain/g.qzone.qq.com/cgi-bin/friendshow/cgi_get_visitor_more'
  const params = {
    uin: rawUin(uin),
    mask: safeMask,
    mod: Number(mod) || 8,
    page: safePage,
    fupdate: 1,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    telemetry: false,
    headers: {
      Cookie: `uin=${uin};p_uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${rawUin(uin)}`
    }
  })
  const body = extractJSONFromCallback(response.data)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      code: -1,
      message: '访客记录响应异常',
      page: safePage,
      totalPages: 1,
      total: 0,
      blockedCount: 0,
      items: []
    }
  }
  const code = qzoneCode(body)
  const data = isRecord(body.data) ? body.data : null
  if ((Number.isFinite(code) && code !== 0) || !data) {
    return {
      code: Number.isFinite(code) && code !== 0 ? code : -1,
      message: qzoneMessage(body, data) || 'QQ 空间返回的访客记录数据不完整',
      page: safePage,
      totalPages: 1,
      total: 0,
      blockedCount: 0,
      items: []
    }
  }
  const items = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.list)
      ? data.list
      : Array.isArray(data.visitor)
        ? data.visitor
        : Array.isArray(data.visitors)
          ? data.visitors
          : []
  const totalPages = Math.max(
    1,
    Number(
      data.totalpage ??
        data.total_page ??
        data.totalPage ??
        data.pages ??
        data.pagecount ??
        data.pageCount
    ) || 1
  )
  return {
    code: 0,
    message: qzoneMessage(body, data),
    page: Number(data.page ?? data.curpage ?? data.curPage ?? safePage) || safePage,
    totalPages,
    total: Number(data.count ?? data.total ?? data.totalcount ?? data.totalCount) || 0,
    blockedCount: Number(data.visitor_to_blk_count ?? data.blockedCount) || 0,
    items
  }
}

/**
 * 获取说说列表（含评论IP、设备型号等隐藏数据）
 * @param {string} uin cookie uin
 * @param {string} p_skey 登录凭证
 * @param {string} targetUin 目标QQ号
 * @param {number} pos 偏移量
 * @param {number} num 数量
 */
export async function getShuoshuo(uin, p_skey, targetUin, pos = 0, num = 20) {
  const url = 'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6'
  const hostUin = rawUin(targetUin || uin)
  const params = {
    uin: hostUin,
    ftype: 0,
    sort: 0,
    pos,
    num,
    replynum: 20,
    g_tk: getGTK(p_skey),
    code_version: 1,
    format: 'jsonp',
    need_private_comment: 1
  }
  const requestUrl = new URL(url)
  Object.entries(params).forEach(([key, value]) => requestUrl.searchParams.set(key, value))
  const response = await net.fetch(requestUrl.toString(), {
    headers: {
      Cookie: `uin=${uin}; p_uin=${uin}; p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${hostUin}`,
      Origin: 'https://user.qzone.qq.com',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  })
  const text = await response.text()
  if (!response.ok) {
    return {
      code: -response.status,
      message: response.status === 501 ? '接口被 QQ 空间风控拦截' : `HTTP ${response.status}`,
      raw: text
    }
  }
  const parsed = extractJSONFromCallback(text)
  if (!isRecord(parsed)) {
    return { code: -1, message: 'QQ 空间返回的说说数据不完整' }
  }
  const parsedCode = qzoneCode(parsed)
  const hasListShape =
    Array.isArray(parsed.msglist) ||
    Array.isArray(parsed.data?.msglist) ||
    Object.prototype.hasOwnProperty.call(parsed, 'total') ||
    Object.prototype.hasOwnProperty.call(parsed, 'usrinfo')
  if ((Number.isFinite(parsedCode) && parsedCode !== 0) || !hasListShape) {
    return {
      ...parsed,
      code: Number.isFinite(parsedCode) && parsedCode !== 0 ? parsedCode : -1,
      message: qzoneMessage(parsed, parsed.data) || 'QQ 空间返回的说说数据不完整'
    }
  }
  return parsed
}

/**
 * 获取当前账号的定时说说。
 * 参数与官网 mood_v6 的 schedule 数据源保持一致；只读，不包含发布或删除能力。
 */
export async function getScheduledShuoshuo(uin, p_skey, pos = 0, num = 20) {
  const safePos = Math.max(0, Number(pos) || 0)
  const safeNum = Math.min(50, Math.max(1, Number(num) || 20))
  const loginUin = rawUin(uin)
  const url =
    'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_timershuoshuolist_v6'
  const params = {
    uin: loginUin,
    hostUin: loginUin,
    notice: 0,
    sort: 0,
    pos: safePos,
    num: safeNum,
    code_version: 1,
    format: 'jsonp',
    need_private_comment: 1,
    g_tk: getGTK(p_skey)
  }
  const response = await request.get(url, {
    params,
    telemetry: false,
    headers: {
      Cookie: `uin=${uin};p_uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${loginUin}/mood?tab=schedule`
    }
  })
  const body = extractJSONFromCallback(response.data)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      code: -1,
      message: '定时说说响应异常',
      total: 0,
      pos: safePos,
      num: safeNum,
      hasMore: false,
      msglist: []
    }
  }
  const result = isRecord(body.result) ? body.result : body
  const code = qzoneCode(result, body)
  const hasScheduleShape =
    Array.isArray(result.msglist) ||
    Array.isArray(result.posts) ||
    Object.prototype.hasOwnProperty.call(result, 'total') ||
    Object.prototype.hasOwnProperty.call(result, 'total_num') ||
    Object.prototype.hasOwnProperty.call(result, 'usrinfo')
  if ((Number.isFinite(code) && code !== 0) || !hasScheduleShape) {
    return {
      code: Number.isFinite(code) && code !== 0 ? code : -1,
      message: qzoneMessage(result, body) || 'QQ 空间返回的定时说说数据不完整',
      total: 0,
      pos: safePos,
      num: safeNum,
      hasMore: false,
      msglist: []
    }
  }
  const msglist = Array.isArray(result.msglist)
    ? result.msglist
    : Array.isArray(result.posts)
      ? result.posts
      : []
  const total = Number(result.total ?? result.total_num ?? result.usrinfo?.msgnum) || 0
  return {
    code: 0,
    message: qzoneMessage(result, body),
    total,
    pos: safePos,
    num: safeNum,
    hasMore: total > 0 ? safePos + msglist.length < total : msglist.length >= safeNum,
    msglist
  }
}
