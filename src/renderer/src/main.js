import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@renderer/styles/index.css'

import './permission' // permission control

import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { ElMessage } from 'element-plus'

import router from './router'

import 'virtual:svg-icons-register'
import { useUserStore } from './store/user.store'

const app = createApp(App)
const pinia = createPinia()

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
