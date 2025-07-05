import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'

export async function getMeInfo(uin, p_skey) {
  const url = 'https://h5.qzone.qq.com/proxy/domain/vip.qzone.qq.com/fcg-bin/fcg_get_vipinfo_mobile'
  const params = {
    get_all: 1,
    g_tk: getGTK(p_skey)
  }

  const response = await request.get(url, {
    params,
    headers: {
      cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}
