import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLocalUserInfo, removeLocalUserInfo, setLocalUserInfo } from '@shared/utils/auth'
import { withTimeout } from '@shared/utils/async-timeout.mjs'

const USER_INFO_TIMEOUT_MS = 15000

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({})
  const qzPSkey = ref('')
  const qzUin = ref('')
  const qzCookies = ref({})

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
  const initFromLocal = async () => {
    const { p_skey, uin, cookies } = getLocalUserInfo()
    qzPSkey.value = p_skey
    qzUin.value = uin
    qzCookies.value = cookies || {}
    await syncQzoneWindowAuth()

    // 如果用户已登录，获取用户信息并通知服务
    if (uin && p_skey) {
      try {
        // 先获取用户详细信息
        const res = await withTimeout(
          window.QzoneAPI.fetchUserInfo(p_skey, uin),
          USER_INFO_TIMEOUT_MS,
          '恢复登录态超时，请重新登录'
        )
        if (res.code === 0) {
          userInfo.value = res.data

          // 通知下载和上传服务当前用户
          try {
            await window.QzoneAPI.download.setCurrentUser(uin)
          } catch (error) {
            console.warn('[UserStore] 设置下载服务用户失败:', error)
          }

          try {
            await window.QzoneAPI.upload.setCurrentUser(uin, p_skey, userInfo.value.uin)
          } catch (error) {
            console.warn('[UserStore] 设置上传服务用户失败:', error)
          }
        } else {
          // 如果获取用户信息失败，清除本地登录信息
          removeLocalUserInfo()
          qzPSkey.value = ''
          qzUin.value = ''
          qzCookies.value = {}
          await syncQzoneWindowAuth({ clear: true })
        }
      } catch (error) {
        console.warn('[UserStore] 恢复登录信息时获取用户信息失败:', error)
        // 如果获取用户信息失败，清除本地登录信息
        removeLocalUserInfo()
        qzPSkey.value = ''
        qzUin.value = ''
        qzCookies.value = {}
        await syncQzoneWindowAuth({ clear: true })
      }
    }
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
      if (res.code === 0) {
        userInfo.value = res.data

        // 通知下载和上传服务当前用户
        try {
          await window.QzoneAPI.download.setCurrentUser(qzUin.value)
        } catch (error) {
          console.warn('[UserStore] 设置下载服务用户失败:', error)
        }

        try {
          await window.QzoneAPI.upload.setCurrentUser(
            qzUin.value,
            qzPSkey.value,
            userInfo.value.uin
          )
        } catch (error) {
          console.warn('[UserStore] 设置上传服务用户失败:', error)
        }
      } else {
        throw new Error('获取用户信息失败')
      }
    } catch (error) {
      console.log('getUserInfo error:>> ', error)
      logout()
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

    location.reload()
  }

  return {
    userInfo,
    PSkey: qzPSkey,
    Uin: qzUin,
    isLoggedIn,
    getUserInfo,
    login,
    logout,
    initFromLocal
  }
})
