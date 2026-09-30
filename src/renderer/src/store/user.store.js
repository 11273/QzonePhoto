import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLocalUserInfo, removeLocalUserInfo, setLocalUserInfo } from '@shared/utils/auth'
import { withTimeout } from '@shared/utils/async-timeout.mjs'

const USER_INFO_TIMEOUT_MS = 15000

export const useUserStore = defineStore('user', () => {
  const demoMode = window.QzoneAPI?.demoMode === true
  const userInfo = ref({})
  const qzPSkey = ref(demoMode ? 'demo-p-skey' : '')
  const qzUin = ref(demoMode ? '100012026' : '')
  const qzCookies = ref({})
  const isRestoringSession = ref(false)
  const sessionRestoreError = ref('')
  let restorePromise = null

  const plainCookies = (cookies = {}) =>
    Object.fromEntries(
      Object.entries(JSON.parse(JSON.stringify(cookies || {})))
        .filter(([, value]) => value)
        .map(([key, value]) => [key, String(value)])
    )

  const syncQzoneWindowAuth = async ({ clear = false } = {}) => {
    try {
      const auth = clear
        ? { clear: true }
        : {
            uin: String(qzUin.value || ''),
            p_skey: String(qzPSkey.value || ''),
            cookies: plainCookies(qzCookies.value)
          }
      await window.QzoneAPI.setQzoneAuth?.(auth)
    } catch (error) {
      console.warn('[UserStore] 同步 QQ 空间窗口登录态失败:', error)
    }
  }

  // 初始化时从本地存储恢复
  const clearStoredSession = async () => {
    removeLocalUserInfo()
    qzPSkey.value = ''
    qzUin.value = ''
    qzCookies.value = {}
    await syncQzoneWindowAuth({ clear: true })
  }

  const isExpiredSessionError = (error) =>
    error?.code === -3000 || error?.name === 'AuthExpiredError'

  const bindCurrentUser = async (uin, p_skey, profile = userInfo.value) => {
    try {
      await window.QzoneAPI.download.setCurrentUser(uin)
    } catch (error) {
      console.warn('[UserStore] 设置下载服务用户失败:', error)
    }

    try {
      await window.QzoneAPI.upload.setCurrentUser(uin, p_skey, profile?.uin || uin)
    } catch (error) {
      console.warn('[UserStore] 设置上传服务用户失败:', error)
    }
  }

  // 登录态恢复只做一次。网络短暂不可用、系统代理或抓包证书异常时保留本地登录态，
  // 让页面先可用；只有明确收到登录过期信号才清除凭证。
  const initFromLocal = () => {
    if (restorePromise) return restorePromise

    restorePromise = (async () => {
      isRestoringSession.value = true
      sessionRestoreError.value = ''
      try {
        if (demoMode) {
          const res = await window.QzoneAPI.fetchUserInfo()
          userInfo.value = res?.data || {}
          return
        }

        const { p_skey, uin, cookies } = getLocalUserInfo()
        qzPSkey.value = p_skey || ''
        qzUin.value = uin || ''
        qzCookies.value = cookies || {}
        await syncQzoneWindowAuth()

        if (!uin || !p_skey) return

        const res = await withTimeout(
          window.QzoneAPI.fetchUserInfo(p_skey, uin),
          USER_INFO_TIMEOUT_MS,
          '恢复登录态超时'
        )
        if (res?.code !== 0) {
          const error = new Error(res?.message || '登录态校验失败')
          error.code = res?.code
          throw error
        }

        userInfo.value = res.data || {}
        await bindCurrentUser(uin, p_skey, userInfo.value)
      } catch (error) {
        if (isExpiredSessionError(error)) {
          await clearStoredSession()
        } else {
          sessionRestoreError.value = error?.message || '暂时无法验证登录状态'
          console.warn('[UserStore] 暂时无法恢复登录态，保留本地登录信息:', error)
        }
      } finally {
        isRestoringSession.value = false
        restorePromise = null
      }
    })()

    return restorePromise
  }

  // 启动时异步初始化
  initFromLocal().catch((error) => {
    console.warn('[UserStore] 初始化失败:', error)
  })

  // 计算登录状态
  const isLoggedIn = computed(() => !!qzPSkey.value && !!qzUin.value)

  const getUserInfo = async () => {
    try {
      const res = await withTimeout(
        window.QzoneAPI.fetchUserInfo(qzPSkey.value, qzUin.value),
        USER_INFO_TIMEOUT_MS,
        '获取用户信息超时，请重新登录'
      )
      if (res?.code === 0) {
        userInfo.value = res.data
        await bindCurrentUser(qzUin.value, qzPSkey.value, userInfo.value)
      } else {
        const error = new Error(res?.message || '获取用户信息失败')
        error.code = res?.code
        throw error
      }
    } catch (error) {
      console.log('getUserInfo error:>> ', error)
      if (isExpiredSessionError(error)) {
        await logout()
      }
      throw error
    }
  }

  const login = async (jumpUrl) => {
    const { p_skey, uin, cookies } = await window.QzoneAPI.getLoginInfo(jumpUrl)
    if (!p_skey || !uin) throw new Error('登录失败')

    setLocalUserInfo(p_skey, uin, cookies)
    qzPSkey.value = p_skey
    qzUin.value = uin
    qzCookies.value = cookies || {}
    await syncQzoneWindowAuth()
    await getUserInfo()
  }

  const logout = async () => {
    userInfo.value = {}
    qzPSkey.value = ''
    qzUin.value = ''
    qzCookies.value = {}
    await syncQzoneWindowAuth({ clear: true })
    removeLocalUserInfo()

    // 清除下载和上传服务的当前用户
    try {
      await window.QzoneAPI.download.setCurrentUser(null)
    } catch (error) {
      console.warn('[UserStore] 清除下载服务用户失败:', error)
    }

    try {
      await window.QzoneAPI.upload.setCurrentUser(null, null, null)
    } catch (error) {
      console.warn('[UserStore] 清除上传服务用户失败:', error)
    }

    // 先把地址替换为登录页再重载：既彻底释放当前账号相关状态，
    // 又避免重载后先恢复旧页面、再重定向登录页造成多余的进度条闪烁。
    window.history.replaceState(null, '', '#/login')
    window.location.reload()
  }

  return {
    userInfo,
    PSkey: qzPSkey,
    Uin: qzUin,
    isLoggedIn,
    isRestoringSession,
    sessionRestoreError,
    getUserInfo,
    login,
    logout,
    initFromLocal
  }
})
