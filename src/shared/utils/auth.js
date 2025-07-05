const P_SKEY_KEY = 'QZ-P-SKEY'
const UIN_KEY = 'QZ-UIN'

// 获取登录信息
export function getLocalUserInfo() {
  return {
    p_skey: localStorage.getItem(P_SKEY_KEY),
    uin: localStorage.getItem(UIN_KEY)
  }
}

// 设置登录信息
export function setLocalUserInfo(p_skey, uin) {
  localStorage.setItem(P_SKEY_KEY, p_skey)
  localStorage.setItem(UIN_KEY, uin)
}

// 删除登录信息
export function removeLocalUserInfo() {
  localStorage.removeItem(P_SKEY_KEY)
  localStorage.removeItem(UIN_KEY)
}
