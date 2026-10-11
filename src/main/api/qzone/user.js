import { net } from 'electron'
import { extractJSONFromCallback, getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'

// Extract raw QQ number from cookie uin (strip "o" prefix)
const rawUin = (uin) => String(uin).replace(/^o/, '')

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
  return response.data
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
  return response.data
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
  return response.data
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
  return response.data
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
  const data = body.data && typeof body.data === 'object' ? body.data : {}
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
    code: Number(body.code ?? 0),
    message: body.message || data.message || '',
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
  return typeof parsed === 'object' ? parsed : { code: -1, message: '响应异常', raw: parsed }
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
  const result = body.result && typeof body.result === 'object' ? body.result : body
  const msglist = Array.isArray(result.msglist)
    ? result.msglist
    : Array.isArray(result.posts)
      ? result.posts
      : []
  const total = Number(result.total ?? result.total_num ?? result.usrinfo?.msgnum) || 0
  return {
    code: Number(result.code ?? body.code ?? 0),
    message: result.message || result.msg || body.message || '',
    total,
    pos: safePos,
    num: safeNum,
    hasMore: total > 0 ? safePos + msglist.length < total : msglist.length >= safeNum,
    msglist
  }
}
