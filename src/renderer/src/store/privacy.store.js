import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const usePrivacyStore = defineStore('privacy', () => {
  // 隐私模式状态
  const privacyMode = ref(false)

  // 初始化时从sessionStorage恢复状态
  const initPrivacyMode = () => {
    const saved = sessionStorage.getItem('global-privacy-mode')
    if (saved !== null) {
      privacyMode.value = saved === 'true'
    } else {
      // 默认开启隐私模式
      privacyMode.value = true
      sessionStorage.setItem('global-privacy-mode', 'true')
    }
  }

  // 切换隐私模式
  const togglePrivacyMode = () => {
    privacyMode.value = !privacyMode.value
  }

  // 设置隐私模式
  const setPrivacyMode = (mode) => {
    privacyMode.value = mode
  }

  // 监听变化并保存到sessionStorage
  watch(
    privacyMode,
    (newMode) => {
      sessionStorage.setItem('global-privacy-mode', newMode.toString())
    },
    { immediate: false }
  )

  // 初始化
  initPrivacyMode()

  return {
    privacyMode,
    togglePrivacyMode,
    setPrivacyMode
  }
})
