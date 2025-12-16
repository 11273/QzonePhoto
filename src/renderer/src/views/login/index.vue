<template>
  <div className="login">
    <div className="logo">
      <el-image style="height: 60px" :src="QZoneLogo" />
    </div>
    <div className="login-box">
      <div className="content">
        <!-- 全屏登录遮罩 -->
        <div
          v-if="isLoggingIn"
          class="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg"
        >
          <div class="flex flex-col items-center gap-3">
            <el-icon :size="40" class="is-loading">
              <Loading />
            </el-icon>
            <span class="text-white text-lg">正在登录中...</span>
          </div>
        </div>

        <!-- 标题区域 -->
        <div class="login-header">
          <h3>快捷登录</h3>
          <!-- 刷新按钮（标题右侧） -->
          <transition name="fade">
            <div
              v-if="!loading && !isLoggingIn"
              class="refresh-title-btn"
              :title="scanStatus === 'scanned' ? '换个账号登录' : '刷新二维码'"
              @click="refreshQrcode"
            >
              <el-icon :size="14">
                <Refresh />
              </el-icon>
            </div>
          </transition>
        </div>

        <!-- 二维码容器 -->
        <div class="qrcode-container">
          <el-image
            v-loading="loading"
            style="width: 100px; height: 100px"
            :src="qrcodeInfo.img"
            :class="{ 'opacity-30': isLoggingIn, 'blur-sm': scanStatus === 'scanned' }"
          />

          <!-- 已扫码等待确认的遮罩 -->
          <transition name="scan-success">
            <div v-if="scanStatus === 'scanned'" class="scan-success-overlay">
              <div class="success-content">
                <el-icon :size="28" class="success-icon">
                  <SuccessFilled />
                </el-icon>
                <div class="success-text">扫码成功</div>
                <div class="waiting-text">请在手机确认</div>
              </div>
            </div>
          </transition>
        </div>

        <el-text v-if="msg" type="info" size="small">{{ msg }}</el-text>
        <p :class="{ 'opacity-50': isLoggingIn }">使用QQ手机版扫码登录，或点击头像授权登录。</p>
        <!-- 本地账号头像列表 -->
        <div class="w-full">
          <el-scrollbar>
            <div v-if="localAccounts.length" class="flex justify-center">
              <div
                v-for="user in localAccounts"
                :key="user.uin"
                class="p-1.5 flex flex-col items-center transition-opacity"
                :class="{
                  'cursor-pointer': !isLoggingIn,
                  'cursor-not-allowed opacity-30': isLoggingIn
                }"
              >
                <el-tooltip :content="`${user.uin}`" placement="top" :disabled="isLoggingIn">
                  <el-avatar
                    :src="user.face"
                    size="large"
                    @click="!isLoggingIn && loginWithLocalAccount(user)"
                  />
                </el-tooltip>
                <span :class="{ 'opacity-50': isLoggingIn }">{{ user.nickname }}</span>
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
import { Loading, SuccessFilled, Refresh } from '@element-plus/icons-vue'
import { onBeforeMount, onUnmounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@renderer/store/user.store'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const router = useRouter()

const loading = ref(false)
const msg = ref('')
const qrcodeInfo = ref({})
let qrTimer = null // 用于二维码刷新
let scanTimer = null // 用于监听扫码状态
let localAccountsTimer = null // 用于定时刷新本地账号列表
const localAccounts = ref([]) // 本地账号列表
const isLoggingIn = ref(false) // 专门用于头像登录的等待状态
const scanStatus = ref('waiting') // 扫码状态: waiting(待扫码), scanned(已扫码待确认), expired(已过期)
let previousScanStatus = 'waiting' // 记录上一次的状态，用于检测取消扫码

// 获取二维码
const getQrcode = () => {
  loading.value = true
  scanStatus.value = 'waiting' // 重置扫码状态
  previousScanStatus = 'waiting'
  msg.value = ''

  window.QzoneAPI.getAuthQRCode()
    .then((res) => {
      // console.log('getQrcodeImg :>> ', res)
      qrcodeInfo.value = res
      checkScanStatus()
    })
    .catch((err) => {
      // 报错等待3秒重新获取
      console.error(err)
      msg.value = '二维码获取失败，正在重试...'
      setTimeout(() => getQrcode(), 3000)
    })
    .finally(() => {
      loading.value = false
    })
}

// 手动刷新二维码
const refreshQrcode = () => {
  if (loading.value) return

  ElMessage.info('正在刷新二维码...')
  clearTimers()
  getQrcode()
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

      if (code == 0) {
        // 登录成功
        msg.value = message || '登录成功'
        scanStatus.value = 'success'
        clearTimers() // 停止所有定时器
        userStore.login(data).then(() => {
          router.replace('/')
        })
      } else if (code == 67) {
        // 二维码认证中 - 已扫码，等待用户确认
        msg.value = message || '请在手机上确认登录'

        // 检测是否从已扫码状态回到待扫码（用户取消了扫码）
        if (previousScanStatus === 'scanned' && scanStatus.value !== 'scanned') {
          ElMessage.warning('检测到取消扫码，请重新扫描')
        }

        scanStatus.value = 'scanned'
        previousScanStatus = 'scanned'
      } else if (code == 66) {
        // 二维码未失效 - 待扫码
        msg.value = message || '等待扫描二维码'

        // 检测取消扫码：从已扫码回到待扫码状态
        if (previousScanStatus === 'scanned') {
          ElMessage.warning('检测到取消扫码，请重新扫描')
          scanStatus.value = 'waiting'
          previousScanStatus = 'waiting'
        } else {
          scanStatus.value = 'waiting'
        }
      } else if (code == 65) {
        // 二维码已失效
        msg.value = message || '二维码已失效'
        scanStatus.value = 'expired'
        ElMessage.warning('二维码已失效，正在刷新...')
        setTimeout(() => getQrcode(), 1000)
      } else {
        // 其他错误状态，重新获取二维码
        msg.value = message || '状态异常，正在刷新...'
        scanStatus.value = 'expired'
        setTimeout(() => getQrcode(), 1000)
      }
    })
    .catch((err) => {
      console.error('检查扫码状态失败:', err)
      // 出错时不中断轮询，继续检查
    })
    .finally(() => {
      // 继续轮询
      scanTimer = setTimeout(() => checkScanStatus(), 1500)
    })
}

// 获取本地账号列表
const getLocalAccounts = async () => {
  try {
    const accounts = await window.QzoneAPI.getLocalUnis()
    console.log('getLocalAccounts :>> ', accounts)
    localAccounts.value = accounts || []
  } catch (err) {
    console.error('获取本地账号失败:', err)
  }
}

// 定时刷新本地账号列表（检测账号切换）
const startLocalAccountsPolling = () => {
  // 清除旧的定时器
  if (localAccountsTimer) {
    clearInterval(localAccountsTimer)
  }

  // 每5秒刷新一次本地账号列表
  localAccountsTimer = setInterval(() => {
    getLocalAccounts()
  }, 1500)
}

// 点击本地头像登录
const loginWithLocalAccount = async (user) => {
  // 防止重复点击
  if (isLoggingIn.value) return

  try {
    isLoggingIn.value = true
    loading.value = true
    msg.value = '正在登录...'
    scanStatus.value = 'waiting' // 重置扫码状态

    // 停止二维码轮询，避免干扰
    clearTimers()

    const data = await window.QzoneAPI.getLocalLoginJump(toRaw(user))
    console.log('[loginWithLocalAccount] :>> ', data)
    // 假设 userStore.login 支持传入本地账号数据
    await userStore.login(data.url)
    router.replace('/')
  } catch (err) {
    console.error('本地账号登录失败:', err)
    msg.value = '登录失败，请重试'
    ElMessage.error('本地账号登录失败，请重试')

    // 登录失败时重新启动二维码轮询
    setTimeout(() => {
      getQrcode()
    }, 1500)
  } finally {
    loading.value = false
    isLoggingIn.value = false
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
  if (localAccountsTimer) {
    clearInterval(localAccountsTimer)
    localAccountsTimer = null
  }
}

onBeforeMount(() => {
  getQrcode()
  getLocalAccounts()
  startLocalAccountsPolling() // 启动定时刷新本地账号列表
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
      position: relative;
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

    // 登录标题区域
    .login-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      position: relative;

      h3 {
        margin: 0;
        font-size: 18px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 600;
      }

      // 标题右侧的刷新按钮（朴素样式）
      .refresh-title-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        color: rgba(255, 255, 255, 0.5);
        padding: 2px;

        &:hover {
          color: rgba(255, 255, 255, 0.8);
          transform: rotate(180deg);
        }

        &:active {
          color: rgba(255, 255, 255, 0.6);
          transform: rotate(180deg) scale(0.95);
        }
      }
    }

    // 二维码容器
    .qrcode-container {
      position: relative;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;

      // 已扫码成功的遮罩层
      .scan-success-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          135deg,
          rgba(103, 194, 58, 0.96) 0%,
          rgba(67, 160, 71, 0.96) 100%
        );
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        backdrop-filter: blur(3px);
        box-shadow: 0 4px 16px rgba(103, 194, 58, 0.4);

        .success-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 6px;
          width: 100%;

          .success-icon {
            color: white;
            animation: scaleIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
          }

          .success-text {
            color: white;
            font-size: 12px;
            font-weight: 600;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
            letter-spacing: 0.5px;
          }

          .waiting-text {
            color: rgba(255, 255, 255, 0.95);
            font-size: 10px;
            text-align: center;
            line-height: 1.2;
            white-space: nowrap;
            animation: pulse 2s ease-in-out infinite;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            font-weight: 500;
          }
        }
      }
    }

    // 平滑过渡效果
    .transition-opacity {
      transition: opacity 0.3s ease;
    }
  }
}

// 动画效果
@keyframes scaleIn {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(0deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes slideUp {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

// 过渡动画
.scan-success-enter-active {
  animation: scaleIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.scan-success-leave-active {
  animation: scaleIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) reverse;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 模糊效果
.blur-sm {
  filter: blur(4px);
  transition: filter 0.3s ease;
}
</style>
