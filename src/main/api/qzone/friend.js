import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'

/**
 * 获取好友亲密度列表
 * @param {string} uin - 登录用户 QQ 号（cookie 格式，带 o 前缀）
 * @param {string} p_skey - 登录凭证
 * @param {string|number} hostUin - 用户 QQ 号（纯数字）
 * @param {number} doType - 1=我在意谁 2=谁在意我
 */
export async function getFriendList(uin, p_skey, hostUin, doType = 1) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/friend_ship_manager.cgi'
  const params = {
    uin: hostUin,
    do: doType,
    rd: Math.random(),
    fupdate: 1,
    clean: 1,
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
 * 获取 QQ 好友及分组（与 QQ 空间首页 @ 面板同源接口）
 * @param {string} uin - 登录用户 QQ 号（cookie 格式，带 o 前缀）
 * @param {string} p_skey - 登录凭证
 * @param {string|number} hostUin - 目标 QQ 号（通常为登录用户自己）
 */
export async function getQQFriends(uin, p_skey, hostUin) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/r.qzone.qq.com/cgi-bin/tfriend/friend_show_qqfriends.cgi'
  const params = {
    uin: hostUin,
    follow_flag: 1,
    groupface_flag: 0,
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
 * 获取当前账号可见的 QQ 群列表，以及积分页已返回的首个群成员资料。
 * 数据来自 QQ 空间「QQ群好友积分榜」页面使用的官方接口。
 */
export async function getQQGroups(uin, p_skey, hostUin) {
  const url = 'https://h5.qzone.qq.com/proxy/domain/flower.qzone.qq.com/cgi-bin/getscoreorder'
  const params = {
    uin: hostUin,
    random: Math.random(),
    g_tk: getGTK(p_skey)
  }

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${hostUin}/app/points`
    }
  })
  return response.data
}

/** 获取指定 QQ 群中当前账号可见的成员资料与积分列表。 */
export async function getQQGroupMembers(uin, p_skey, hostUin, groupId) {
  const url = 'https://h5.qzone.qq.com/proxy/domain/flower.qzone.qq.com/cgi-bin/getgrouporder'
  const params = {
    groupid: groupId,
    uin: hostUin,
    random: Math.random(),
    fupdate: 1,
    g_tk: getGTK(p_skey)
  }

  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      Referer: `https://user.qzone.qq.com/${hostUin}/app/points`
    }
  })
  return response.data
}
