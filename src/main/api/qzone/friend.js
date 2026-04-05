import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'

/**
 * 获取好友亲密度列表
 * @param {string} uin - 登录用户QQ号（cookie格式，带o前缀）
 * @param {string} p_skey - 登录凭证
 * @param {string|number} hostUin - 用户QQ号（纯数字）
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
