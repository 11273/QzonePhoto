import { createRouter, createWebHashHistory } from 'vue-router'

// 静态路由
export const constantRoutes = [
  {
    path: '/login',
    component: () => import('@renderer/views/login/index.vue'),
    meta: { hidden: true }
  },

  {
    path: '/',
    redirect: '/index',
    children: [
      {
        path: 'index',
        component: () => import('@renderer/views/photo/index.vue'),
        name: 'Photo',
        meta: { title: '相册' }
      }
    ]
  }
]

/**
 * 创建路由
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes
})

export default router
