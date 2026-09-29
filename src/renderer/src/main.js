import './assets/main.css'
import '@renderer/styles/design-tokens.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@renderer/styles/index.css'

import './permission' // permission control

import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@renderer/styles/app-dialog.scss'
import '@renderer/styles/timeline-card.scss'
import '@renderer/styles/interaction-polish.css'
import '@renderer/styles/download-batch.css'
import '@renderer/styles/themes/qzone-dark.css'
import '@renderer/styles/themes/festival-dark.css'
import '@renderer/styles/element-theme.css'
import '@renderer/styles/ui-refinement.css'
import { ElMessage } from 'element-plus'
import { startThemeRuntime } from '@renderer/theme/index.mjs'
import { APP_WEBSITE } from '@shared/const'

import router from './router'

import 'virtual:svg-icons-register'
import { useUserStore } from './store/user.store'

const app = createApp(App)
const pinia = createPinia()

const stopThemeRuntime = startThemeRuntime({
  // 开发态直接使用仓库内的共享清单，避免官网尚未发布新清单时污染 DevTools；
  // 生产版再用官网 Date 响应头校准时钟和接收紧急关闭状态。
  manifestUrl: import.meta.env.PROD ? `${APP_WEBSITE}/holiday-theme-manifest.json` : '',
  debugTarget: import.meta.env.DEV ? window : null
})
if (import.meta.env.DEV) {
  console.info(
    '[Theme] 可在控制台使用 QzoneTheme.use("national-day-dark")、QzoneTheme.use("new-year-dark")、QzoneTheme.use("spring-festival-dark")、QzoneTheme.use("qzone-dark") 或 QzoneTheme.auto() 预览主题'
  )
}
window.addEventListener('beforeunload', stopThemeRuntime, { once: true })

app.use(pinia)

// 全局监听认证过期事件
window.api.onAuthExpired((message) => {
  // 显示错误提示
  ElMessage.error(message || '登录已过期，请重新登录')

  // 延迟执行登出，确保提示能够显示
  setTimeout(() => {
    const userStore = useUserStore()
    userStore.logout()
  }, 500)
})

app.use(router)
app.mount('#app')
