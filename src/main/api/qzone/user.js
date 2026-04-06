import { getGTK } from '@main/api/utils/helpers'
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
  const url =
    'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/user/cgi_personal_card'
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
 * @param {string} hostUin 主人QQ号
 */
export async function getVisitorStatus(uin, p_skey, hostUin) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/main_page_cgi'
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
 * 获取说说列表（含评论IP、设备型号等隐藏数据）
 * @param {string} uin cookie uin
 * @param {string} p_skey 登录凭证
 * @param {string} targetUin 目标QQ号
 * @param {number} pos 偏移量
 * @param {number} num 数量
 */
export async function getShuoshuo(uin, p_skey, targetUin, pos = 0, num = 20) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6'
  const params = {
    uin: targetUin,
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
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}
