import request from '@main/api/utils/request'
import { APPID } from '@main/const'
import { hash33 } from '@main/api/utils/helpers'

const appid = APPID

// 初始化登录需要的信息
export async function xlogin() {
  const url = 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin'
  const params = {
    s_url: 'https://qzs.qzone.qq.com/qzone/v5/loginsucc.html?para=izone',
    appid
  }
  const response = await request.get(url, { params })
  return response.headers['set-cookie']
    ?.find((cookie) => cookie.startsWith('pt_login_sig'))
    ?.split(';')[0]
    .split('=')[1]
}

// 获取二维码
export async function ptqrshow() {
  const url = 'https://ssl.ptlogin2.qq.com/ptqrshow'
  const params = { appid, daid: 5 }
  return await request.get(url, { params, responseType: 'arraybuffer' })
}

// 监听扫码返回结果
export async function ptqrlogin(qrsig, ptLoginSig) {
  const url = 'https://xui.ptlogin2.qq.com/ssl/ptqrlogin'
  const params = {
    u1: 'https://qzs.qzone.qq.com/qzone/v5/loginsucc.html?para=izone',
    ptqrtoken: hash33(qrsig),
    from_ui: 1,
    login_sig: ptLoginSig,
    aid: appid,
    daid: 5
  }

  const response = await request.get(url, {
    params,
    headers: {
      cookie: `qrsig=${qrsig}`
    }
  })

  return response.data
}
