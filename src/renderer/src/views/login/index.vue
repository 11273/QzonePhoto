<template>
  <div className="login">
    <div className="logo">
      <el-image style="height: 60px" :src="QZoneLogo" />
    </div>
    <div className="login-box">
      <div className="content">
        <h3>快捷登录</h3>
        <!-- 二维码 -->
        <el-image v-loading="loading" style="width: 100px; height: 100px" :src="qrcodeInfo.img" />
        <el-text v-if="msg" type="info" size="small">{{ msg }}</el-text>
        <p>使用QQ手机版扫码登录，或点击头像授权登录。</p>
        <!-- 本地账号头像列表 -->
        <div class="w-full">
          <el-scrollbar>
            <div v-if="localAccounts.length" class="flex justify-center">
              <div
                v-for="user in localAccounts"
                :key="user.uin"
                class="cursor-pointer p-1.5 flex flex-col items-center"
              >
                <el-tooltip :content="`${user.uin}`" placement="top">
                  <el-avatar :src="user.face" size="large" @click="loginWithLocalAccount(user)" />
                </el-tooltip>
                <span>{{ user.nickname }}</span>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import QZoneLogo from '@renderer/assets/qzone_logo.png'
import { onBeforeMount, onUnmounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@renderer/store/user.store'

const userStore = useUserStore()
const router = useRouter()

const loading = ref(false)
const msg = ref('')
const qrcodeInfo = ref({})
let qrTimer = null // 用于二维码刷新
let scanTimer = null // 用于监听扫码状态
const localAccounts = ref([]) // 本地账号列表

// 获取二维码
const getQrcode = () => {
  loading.value = true
  window.QzoneAPI.getAuthQRCode()
    .then((res) => {
      // console.log('getQrcodeImg :>> ', res)
      qrcodeInfo.value = res
      checkScanStatus()
    })
    .catch((err) => {
      // 报错等待3秒重新获取
      console.error(err)
      setTimeout(() => getQrcode(), 3000)
    })
    .finally(() => {
      loading.value = false
    })
}
// 监听扫码情况
const checkScanStatus = () => {
  if (scanTimer) {
    clearTimeout(scanTimer)
    scanTimer = null
  }

  window.QzoneAPI.checkLoginState({
    qrsig: qrcodeInfo.value.qrsig,
    pt_login_sig: qrcodeInfo.value.pt_login_sig
  })
    .then(async (res) => {
      // console.log('listenScanResult :>> ', res)
      const { code, data, message } = res
      msg.value = message
      if (code == 0) {
        // 登录成功
        clearTimers() // 停止所有定时器
        userStore.login(data).then(() => {
          router.replace('/')
        })
      } else if (code == 67) {
        // 二维码认证中
      } else if (code == 66) {
        // 二维码未失效
      } else {
        getQrcode()
      }
    })
    .finally(() => {
      scanTimer = setTimeout(() => checkScanStatus(), 1500)
    })
}

// 获取本地账号列表
const getLocalAccounts = async () => {
  try {
    const accounts = await window.QzoneAPI.getLocalUnis()
    if (accounts && Array.isArray(accounts)) {
      localAccounts.value = accounts || []
    }
  } catch (err) {
    console.error('获取本地账号失败:', err)
  }
}

// 点击本地头像登录
const loginWithLocalAccount = async (user) => {
  try {
    loading.value = true
    msg.value = '正在登录...'
    const data = await window.QzoneAPI.getLocalLoginJump(toRaw(user))
    console.log('[loginWithLocalAccount] :>> ', data)
    // 假设 userStore.login 支持传入本地账号数据
    await userStore.login(data.url)
    router.replace('/')
  } catch (err) {
    console.error('本地账号登录失败:', err)
    msg.value = '登录失败'
  } finally {
    loading.value = false
  }
}

// 清除所有定时器
const clearTimers = () => {
  if (qrTimer) {
    clearTimeout(qrTimer)
    qrTimer = null
  }
  if (scanTimer) {
    clearTimeout(scanTimer)
    scanTimer = null
  }
}

onBeforeMount(() => {
  getQrcode()
  getLocalAccounts()
})

onUnmounted(() => {
  clearTimers()
})
</script>

<style lang="scss" scoped>
.login {
  height: 100vh;
  display: flex;
  // logo
  .logo {
    margin-top: 100px;
    text-align: center;
    flex: 3;
  }
  // 登录区域
  .login-box {
    flex: 4;
    display: flex;
    align-items: center;
    justify-content: center;

    .content {
      width: 460px;
      height: 320px;
      display: flex;
      align-items: center;
      justify-content: space-evenly;
      flex-direction: column;
      border-radius: 10px;
      background-color: rgba(0, 0, 0, 0.5);
      p {
        font-size: 14px;
      }
    }
  }
}
</style>
