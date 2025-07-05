import request from '@main/api/utils/request'
import { APPID } from '@main/const'
import { parseSetCookie } from '@main/utils'
import { hash33 } from '@main/api/utils/helpers'

const appid = APPID

// 本地登录账号：获取本地登录账号的 cookie
export async function xlogin() {
  const url = 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin'
  const params = {
    proxy_url: 'https://qzs.qq.com/qzone/v6/portal/proxy.html',
    appid,
    s_url: 'https://qzs.qzone.qq.com/qzone/v5/loginsucc.html'
  }
  const response = await request.get(url, { params })
  return parseSetCookie(response.headers['set-cookie'])
}

// 本地登录账号：获取本地登录账号信息
export async function pt_get_uins(pt_local_token, olu) {
  const params = {
    callback: 'ptuiCB',
    pt_local_tk: pt_local_token,
    r: Math.random()
  }

  const headers = {
    cookie: `pt_local_token=${pt_local_token};olu=${olu}`,
    Referer: 'https://xui.ptlogin2.qq.com/'
  }

  for (const port of [4301, 4303, 4305, 4307, 4309]) {
    const url = `https://localhost.ptlogin2.qq.com:${port}/pt_get_uins`

    try {
      const response = await request.get(url, {
        params,
        headers
      })

      if (response.status === 200 && response.data) {
        console.log(`✅ pt_get_uins 成功使用端口 ${port}`)
        return { data: response.data, cookie: parseSetCookie(response.headers['set-cookie']) }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      console.warn(`⚠️ pt_get_uins 端口 ${port} 请求失败`)
    }
  }

  throw new Error('所有端口都尝试失败，无法获取 pt_get_uins 响应')
}

// 本地登录账号：获取本地登录账号的 头像
export async function getface(uin, olu) {
  const url = 'https://ssl.ptlogin2.qq.com/getface'
  const params = {
    imgtype: 3,
    appid,
    uin
  }
  const headers = {
    cookie: `olu=${olu}`
  }
  try {
    const response = await request.get(url, { params, headers })
    const match = response.data.match(/pt\.setHeader\(\{\s*"(\d+)"\s*:\s*"([^"]+)"\s*\}\)/)

    if (match) {
      const faceUrl = match[2]
      return faceUrl
    } else {
      throw new Error('头像数据解析失败')
    }
    // eslint-disable-next-line no-unused-vars
  } catch (_) {
    console.warn(`[getface] ❌ 获取头像失败`)
    return ''
  }
}

// 本地登录账号：主要获取 clientkey 用于完成登录
export async function pt_get_st(clientuin, pt_local_tk) {
  const url = 'https://localhost.ptlogin2.qq.com:4301/pt_get_st'
  const params = {
    clientuin,
    r: Math.random(),
    callback: 'ptuiCB',
    pt_local_tk
  }
  const headers = {
    cookie: `pt_local_token=${pt_local_tk}`,
    Referer: 'https://xui.ptlogin2.qq.com/'
  }
  console.log('params :>> ', params, headers)
  try {
    const response = await request.get(url, { params, headers })
    return { data: response.data, cookie: parseSetCookie(response.headers['set-cookie']) }
  } catch (err) {
    console.warn(`[getface] ❌ pt_get_st:`, err.statusText)
    throw err.statusText
  }
}

// 本地登录账号：获取登录跳转链接
export async function jump(clientuin, keyindex, clientkey) {
  const url = 'https://ssl.ptlogin2.qq.com/jump'
  const params = {
    u1: 'https://qzs.qzone.qq.com/qzone/v5/loginsucc.html',
    daid: 5, // 固定
    clientuin,
    keyindex,
    pt_aid: appid,
    pt_local_tk: hash33(clientkey),
    pt_3rd_aid: 0, // 固定
    ptopt: 1 // 固定
  }
  const headers = {
    cookie: `clientkey=${clientkey}`
  }
  try {
    const response = await request.get(url, {
      params,
      headers,
      withCredentials: true,
      maxRedirects: 0
    })
    return response.data
  } catch (err) {
    console.warn(`[getface] ❌ jump:`, err.statusText)
    return ''
  }
}
