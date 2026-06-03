const P_SKEY_KEY = 'QZ-P-SKEY'
const UIN_KEY = 'QZ-UIN'
const COOKIES_KEY = 'QZ-COOKIES'

function getLocalCookies() {
  try {
    return JSON.parse(localStorage.getItem(COOKIES_KEY) || '{}')
  } catch {
    return {}
  }
}

// 获取登录信息
export function getLocalUserInfo() {
  return {
    p_skey: localStorage.getItem(P_SKEY_KEY),
    uin: localStorage.getItem(UIN_KEY),
    cookies: getLocalCookies()
  }
}

// 设置登录信息
export function setLocalUserInfo(p_skey, uin, cookies = {}) {
  localStorage.setItem(P_SKEY_KEY, p_skey)
  localStorage.setItem(UIN_KEY, uin)
  localStorage.setItem(COOKIES_KEY, JSON.stringify(cookies || {}))
}

// 删除登录信息
export function removeLocalUserInfo() {
  localStorage.removeItem(P_SKEY_KEY)
  localStorage.removeItem(UIN_KEY)
  localStorage.removeItem(COOKIES_KEY)
}
