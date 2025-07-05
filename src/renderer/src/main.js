import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@renderer/styles/index.css'

import './permission' // permission control

import 'element-plus/theme-chalk/dark/css-vars.css'

import router from './router'

import 'virtual:svg-icons-register'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
