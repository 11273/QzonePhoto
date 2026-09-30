import router from './router'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css' // progress bar style
import { useUserStore } from './store/user.store'
import { APP_DESCRIPTION } from '@shared/const'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ['/login'] // no redirect whitelist

router.beforeEach((to, from, next) => {
  // 登录页通常来自启动或退出登录，不显示一闪而过的路由进度条。
  if (to.path === '/login') NProgress.remove()
  else NProgress.start()

  // set page title
  document.title = APP_DESCRIPTION

  const userStore = useUserStore()

  if (userStore.isLoggedIn) {
    if (to.path === '/login') {
      next({ path: '/' })
      NProgress.done()
    } else {
      // 只要本地仍有登录态，就先进入应用。网络校验会在后台完成；
      // 不能让 QQ 接口、系统代理或抓包软件的超时把整个 RouterView 卡成空白。
      void userStore.initFromLocal()
      next()
    }
  } else {
    if (whiteList.indexOf(to.path) !== -1) {
      next()
    } else {
      next(`/login`)
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  // finish progress bar
  NProgress.done()
})
