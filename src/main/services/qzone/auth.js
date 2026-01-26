import { ptqrshow, xlogin, ptqrlogin } from '@main/api'
import { getface, jump, pt_get_st, pt_get_uins, xlogin as localXlogin } from '@main/api/qzone/local'
import request from '@main/api/utils/request'
import { extractJson, parseSetCookie } from '@main/utils'

export class QzoneAuthService {
  constructor() {
    this.token = null
  }

  async getLocalUnis() {
    // logger.info('[getLocalUnis] 🚀 开始获取本地 UIN 列表')

    try {
      // Step 1: 获取 pt_local_token、olu
      const xloginRes = await localXlogin()
      const pt_local_token = xloginRes?.pt_local_token

      if (!pt_local_token) {
        console.error('[getLocalUnis] ❌ 获取 pt_local_token 失败:', xloginRes)
        return
      }

      // console.log('[getLocalUnis] ✅ 获取 pt_local_token:', pt_local_token)

      // Step 2: 获取原始 JS 字符串
      const { data: ptGetUinsRes, cookie } = await pt_get_uins(pt_local_token, xloginRes.olu)

      if (!ptGetUinsRes || typeof ptGetUinsRes !== 'string') {
        console.error('[getLocalUnis] ❌ 获取 pt_get_uins 响应失败:', ptGetUinsRes)
        return
      }

      // console.log('[getLocalUnis] 📦 原始响应长度:', ptGetUinsRes.length)

      // Step 3: 提取 JSON 数据
      const jsonData = extractJson(ptGetUinsRes)

      // if (jsonData) {
      //   console.log(`[getLocalUnis] ✅ 成功提取 ${jsonData.length} 条 UIN 数据`, jsonData)
      // }

      // Step 4: 获取头像
      // 并发获取所有头像
      const results = await Promise.all(
        jsonData.map(async (user) => {
          const face = await getface(user.uin, cookie.olu).catch()
          return {
            ...user,
            pt_local_token,
            face: face || 'https://ui.ptlogin2.qq.com/style/0/images/1.gif'
          }
        })
      )
      // console.log(`[getLocalUnis] ✅ 接口完成`, results)
      return results
    } catch (err) {
      console.error('[getLocalUnis] ❌ 异常捕获:', err)
    }
  }

  async localLogin(preload) {
    const { pt_local_token, uin } = preload.userInfo
    const ptGetStRes = await pt_get_st(uin, pt_local_token)
    // console.log('pt_get_st:', ptGetStRes)
    const { data, cookie } = ptGetStRes

    const jsonData = extractJson(data)
    const { clientkey } = cookie

    // console.log('pt_get_st:', jsonData)

    const jumpRes = await jump(uin, jsonData.keyindex, clientkey)
    // console.log('jumpRes:', jumpRes)
    return jumpRes
  }

  async getQrcodeImg() {
    const pt_login_sig = await xlogin()
    const qrcodeData = await ptqrshow()
    const qrsig = qrcodeData.headers['set-cookie']
      ?.find((cookie) => cookie.startsWith('qrsig'))
      ?.split(';')[0]
      .split('=')[1]

    const img = Buffer.from(qrcodeData.data).toString('base64')

    return {
      pt_login_sig,
      qrsig,
      img: 'data:image/png;base64,' + img
    }
  }

  async listenScanResult({ qrsig, pt_login_sig }) {
    return await ptqrlogin(qrsig, pt_login_sig)
  }

  async getLoginInfo({ url }) {
    try {
      const response = await request.get(url, { withCredentials: true, maxRedirects: 0 })
      const setCookieHeader = response.headers['set-cookie']
      if (!setCookieHeader) throw new Error('No Set-Cookie header found')

      const cookies = parseSetCookie(setCookieHeader)
      const p_skey = cookies['p_skey']
      const uin = cookies['uin']

      if (!p_skey || !uin) throw new Error('Required cookies not found')

      return { p_skey, uin }
    } catch (error) {
      console.error('Error fetching login info:', error)
      throw error
    }
  }
}
