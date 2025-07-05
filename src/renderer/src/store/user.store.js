import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLocalUserInfo, removeLocalUserInfo, setLocalUserInfo } from '@shared/utils/auth'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref({})
  const qzPSkey = ref('')
  const qzUin = ref('')

  // 初始化时从本地存储恢复
  const initFromLocal = async () => {
    const { p_skey, uin } = getLocalUserInfo()
    qzPSkey.value = p_skey
    qzUin.value = uin

    // 如果用户已登录，通知下载服务当前用户
    if (uin) {
      try {
        await window.QzoneAPI.download.setCurrentUser(uin)
      } catch (error) {
        console.warn('[UserStore] 设置下载服务用户失败:', error)
      }
    }
  }

  // 启动时异步初始化
  initFromLocal().catch((error) => {
    console.warn('[UserStore] 初始化时设置下载服务用户失败:', error)
  })

  // 计算登录状态
  const isLoggedIn = computed(() => !!qzPSkey.value && !!qzUin.value)

  const getUserInfo = async () => {
    try {
      const res = await window.QzoneAPI.fetchUserInfo(qzPSkey.value, qzUin.value)
      if (res.code === 0) {
        userInfo.value = res.data
      } else {
        throw new Error('获取用户信息失败')
      }
    } catch (error) {
      logout()
      throw error
    }
  }

  const login = async (jumpUrl) => {
    const { p_skey, uin } = await window.QzoneAPI.getLoginInfo(jumpUrl)
    if (!p_skey || !uin) throw new Error('登录失败')

    setLocalUserInfo(p_skey, uin)
    qzPSkey.value = p_skey
    qzUin.value = uin
    await getUserInfo()

    // 通知下载服务当前用户
    try {
      await window.QzoneAPI.download.setCurrentUser(uin)
    } catch (error) {
      console.warn('[UserStore] 设置下载服务用户失败:', error)
    }
  }

  const logout = async () => {
    userInfo.value = {}
    qzPSkey.value = ''
    qzUin.value = ''
    removeLocalUserInfo()

    // 清除下载服务的当前用户
    try {
      await window.QzoneAPI.download.setCurrentUser(null)
    } catch (error) {
      console.warn('[UserStore] 清除下载服务用户失败:', error)
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
