<template>
  <div class="login">
    <section class="login-intro" aria-label="企鹅相册">
      <el-image class="login-brand-logo" :src="QZoneLogo" alt="企鹅相册" />
    </section>
    <section class="login-box" aria-label="登录 QQ 空间">
      <div class="content" :class="{ 'has-local-accounts': localAccounts.length }">
        <!-- 全屏登录遮罩 -->
        <div
          v-if="isLoggingIn"
          class="login-progress-overlay"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div class="login-progress-card">
            <div class="login-progress-row">
              <div class="login-progress-icon">
                <el-icon :size="24" class="is-loading">
                  <Loading />
                </el-icon>
              </div>
              <div class="login-progress-main">
                <div class="login-progress-title">{{ loginMessage }}</div>
                <div class="login-progress-desc">正在同步登录状态，请稍等</div>
              </div>
            </div>
            <div class="login-progress-track" aria-hidden="true">
              <i></i>
            </div>
            <div class="login-progress-note">请保持应用开启，完成后将自动进入空间</div>
          </div>
        </div>

        <!-- 标题区域 -->
        <div class="login-header">
          <div class="login-heading-copy">
            <h3>登录 QQ 空间</h3>
            <span>{{
              localAccounts.length ? '扫描二维码，或点击头像快速登录' : '使用手机 QQ 扫描二维码'
            }}</span>
          </div>
          <!-- 刷新按钮（标题右侧） -->
          <transition name="fade">
            <AppActionButton
              v-if="!loading && !isLoggingIn"
              variant="ghost"
              ui-size="compact"
              icon-only
              aria-label="刷新登录二维码"
              :title="scanStatus === 'scanned' ? '换个账号登录' : '刷新二维码'"
              @click="refreshQrcode"
            >
              <template #icon
                ><el-icon :size="14"><Refresh /></el-icon
              ></template>
            </AppActionButton>
          </transition>
        </div>

        <div v-if="loginError" class="login-inline-error" role="alert" aria-live="assertive">
          <span>{{ loginError }}</span>
          <button type="button" :disabled="loading" @click="refreshQrcode">重试</button>
        </div>
        <div class="login-auth-stack" :class="{ 'has-local-accounts': localAccounts.length }">
          <!-- 二维码容器 -->
          <div class="qrcode-stage">
            <div class="qrcode-container">
              <el-image
                v-loading="loading"
                class="qrcode-image"
                :src="qrcodeInfo.img"
                alt="QQ 登录二维码"
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

              <div v-if="scanStatus === 'expired' && !loading" class="qrcode-expired" role="alert">
                <el-icon :size="20"><Refresh /></el-icon>
                <span>二维码已失效</span>
                <button type="button" :disabled="loading" @click="refreshQrcode">重新获取</button>
              </div>
            </div>
            <span class="qrcode-caption">使用手机 QQ 扫描</span>
          </div>

          <div v-if="localAccounts.length" class="local-account-section">
            <!-- 本地账号头像列表 -->
            <div class="local-account-list">
              <button
                v-for="user in localAccounts"
                :key="user.uin"
                class="local-account-item flex flex-col items-center"
                type="button"
                :disabled="isLoggingIn"
                :aria-label="`使用${user.nickname || '本地账号'}登录`"
                :class="{
                  'cursor-pointer': !isLoggingIn,
                  'cursor-not-allowed is-disabled': isLoggingIn
                }"
                @click="loginWithLocalAccount(user)"
              >
                <el-tooltip :content="`${user.uin}`" placement="top" :disabled="isLoggingIn">
                  <el-avatar :src="user.face" :size="44" />
                </el-tooltip>
                <span :class="{ 'opacity-50': isLoggingIn }">{{ user.nickname }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import QZoneLogo from '@renderer/assets/qzone_logo.png'
import { Loading, SuccessFilled, Refresh } from '@element-plus/icons-vue'
import { onBeforeMount, onUnmounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@renderer/store/user.store'
import { ElMessage } from 'element-plus'
import AppActionButton from '@renderer/components/AppActionButton/index.vue'

const userStore = useUserStore()
const router = useRouter()

const loading = ref(false)
const msg = ref('')
const loginError = ref('')
const qrcodeInfo = ref({})
let qrTimer = null // 用于二维码刷新
let scanTimer = null // 用于监听扫码状态
let localAccountsTimer = null // 用于定时刷新本地账号列表
const localAccountsLoading = ref(false)
const localAccounts = ref([]) // 本地账号列表
const isLoggingIn = ref(false) // 专门用于头像登录的等待状态
const loginMessage = ref('正在登录中...')
const scanStatus = ref('waiting') // 扫码状态: waiting(待扫码), scanned(已扫码待确认), expired(已过期)
let previousScanStatus = 'waiting' // 记录上一次的状态，用于检测取消扫码
const LOCAL_FACE_CACHE_KEY = 'qzone.local-login.face-cache'
const LOCAL_ACCOUNT_MISSING_LIMIT = 2
const DEFAULT_LOCAL_FACE = 'https://ui.ptlogin2.qq.com/style/0/images/1.gif'

const readFaceCache = () => {
  try {
    const cache = JSON.parse(localStorage.getItem(LOCAL_FACE_CACHE_KEY) || '{}')
    return cache && typeof cache === 'object' ? cache : {}
  } catch {
    return {}
  }
}

const writeFaceCache = (cache) => {
  try {
    localStorage.setItem(LOCAL_FACE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore storage quota errors
  }
}

const isStableFace = (face) => typeof face === 'string' && face && face !== DEFAULT_LOCAL_FACE

const mergeLocalAccounts = (accounts = []) => {
  const faceCache = readFaceCache()
  const nextByUin = new Map()

  localAccounts.value.forEach((account) => {
    nextByUin.set(account.uin, {
      ...account,
      missingCount: (account.missingCount || 0) + 1
    })
  })

  accounts.forEach((account) => {
    if (!account?.uin) return
    const previous = nextByUin.get(account.uin)
    const cachedFace = faceCache[account.uin]
    const nextFace = isStableFace(account.face)
      ? account.face
      : previous?.face && isStableFace(previous.face)
        ? previous.face
        : cachedFace || account.face || DEFAULT_LOCAL_FACE

    if (isStableFace(account.face)) {
      faceCache[account.uin] = account.face
    }

    nextByUin.set(account.uin, {
      ...previous,
      ...account,
      face: nextFace,
      faceStatus: isStableFace(account.face)
        ? account.faceStatus || 'fresh'
        : previous?.faceStatus === 'fresh' || cachedFace
          ? 'cached'
          : account.faceStatus || 'fallback',
      missingCount: 0
    })
  })

  writeFaceCache(faceCache)
  localAccounts.value = Array.from(nextByUin.values()).filter(
    (account) => (account.missingCount || 0) <= LOCAL_ACCOUNT_MISSING_LIMIT
  )
}

// 获取二维码
const getQrcode = () => {
  if (qrTimer) {
    clearTimeout(qrTimer)
    qrTimer = null
  }
  loading.value = true
  scanStatus.value = 'waiting' // 重置扫码状态
  previousScanStatus = 'waiting'
  msg.value = ''
  loginError.value = ''

  window.QzoneAPI.getAuthQRCode()
    .then((res) => {
      // console.log('getQrcodeImg :>> ', res)
      qrcodeInfo.value = res
      checkScanStatus()
    })
    .catch((err) => {
      // 报错等待3秒重新获取
      console.error(err)
      loginError.value = '暂时无法获取登录二维码，请检查网络后重试。'
      msg.value = ''
      qrTimer = setTimeout(() => getQrcode(), 3000)
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
  loginError.value = ''
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
        isLoggingIn.value = true
        loading.value = true
        loginMessage.value = '登录成功，正在进入空间...'
        msg.value = message || '登录成功，正在进入空间...'
        scanStatus.value = 'success'
        loginError.value = ''
        clearTimers() // 停止所有定时器
        try {
          await userStore.login(data)
          await router.replace('/')
        } catch (error) {
          console.error('扫码登录失败:', error)
          isLoggingIn.value = false
          loading.value = false
          loginMessage.value = '正在登录中...'
          msg.value = '登录失败，请重试'
          loginError.value = '登录没有完成，请重新扫描二维码或选择本机账号。'
          scanStatus.value = 'waiting'
          ElMessage.error('登录失败，请重试')
          qrTimer = setTimeout(() => getQrcode(), 1500)
        }
      } else if (code == 67) {
        // 二维码认证中 - 已扫码，等待用户确认
        msg.value = '请在手机上确认登录'

        // 检测是否从已扫码状态回到待扫码（用户取消了扫码）
        if (previousScanStatus === 'scanned' && scanStatus.value !== 'scanned') {
          ElMessage.warning('检测到取消扫码，请重新扫描')
        }

        scanStatus.value = 'scanned'
        previousScanStatus = 'scanned'
      } else if (code == 66) {
        // 二维码未失效 - 待扫码
        msg.value = '等待扫描二维码'

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
        msg.value = '二维码已失效'
        scanStatus.value = 'expired'
        ElMessage.warning('二维码已失效，正在刷新...')
        qrTimer = setTimeout(() => getQrcode(), 1000)
      } else {
        // 其他错误状态，重新获取二维码
        msg.value = message || '状态异常，正在刷新...'
        scanStatus.value = 'expired'
        qrTimer = setTimeout(() => getQrcode(), 1000)
      }
    })
    .catch((err) => {
      console.error('检查扫码状态失败:', err)
      // 出错时不中断轮询，继续检查
    })
    .finally(() => {
      // 继续轮询
      if (!isLoggingIn.value && scanStatus.value !== 'success') {
        scanTimer = setTimeout(() => checkScanStatus(), 1500)
      }
    })
}

// 获取本地账号列表
const getLocalAccounts = async () => {
  if (localAccountsLoading.value) return
  localAccountsLoading.value = true
  try {
    const accounts = await window.QzoneAPI.getLocalUnis()
    console.debug('getLocalAccounts :>> ', accounts)
    // 代理、网络或本机 QQ 未启动时，保留已展示的账号；空数组才代表本机确实没有账号。
    if (Array.isArray(accounts)) {
      mergeLocalAccounts(accounts)
    }
  } catch (err) {
    console.error('获取本地账号失败:', err)
  } finally {
    localAccountsLoading.value = false
  }
}

// 定时刷新本地账号列表（检测账号切换）
const startLocalAccountsPolling = () => {
  // 清除旧的定时器
  if (localAccountsTimer) {
    clearInterval(localAccountsTimer)
  }

  // 账号切换无需秒级探测；降低对本机 QQ 服务与抓包工具的干扰。
  localAccountsTimer = setInterval(() => {
    getLocalAccounts()
  }, 30000)
}

const handleWindowFocus = () => {
  if (!isLoggingIn.value) getLocalAccounts()
}

// 点击本地头像登录
const loginWithLocalAccount = async (user) => {
  // 防止重复点击
  if (isLoggingIn.value) return

  try {
    isLoggingIn.value = true
    loading.value = true
    loginMessage.value = '正在登录，马上进入空间...'
    msg.value = '正在登录...'
    loginError.value = ''
    scanStatus.value = 'waiting' // 重置扫码状态

    // 停止二维码轮询，避免干扰
    clearTimers()

    const data = await window.QzoneAPI.getLocalLoginJump(toRaw(user))
    console.log('[loginWithLocalAccount] :>> ', data)
    // 假设 userStore.login 支持传入本地账号数据
    await userStore.login(data.url)
    loginMessage.value = '登录成功，正在进入空间...'
    await router.replace('/')
  } catch (err) {
    console.error('本地账号登录失败:', err)
    msg.value = '登录失败，请重试'
    loginError.value = '本机账号登录失败，请重试或改用二维码登录。'
    loginMessage.value = '正在登录中...'
    ElMessage.error('本地账号登录失败，请重试')

    // 登录失败时重新启动二维码轮询
    qrTimer = setTimeout(() => {
      getQrcode()
      startLocalAccountsPolling()
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
  window.addEventListener('focus', handleWindowFocus)
})

onUnmounted(() => {
  clearTimers()
  window.removeEventListener('focus', handleWindowFocus)
})
</script>

<style lang="scss" scoped>
.login {
  position: relative;
  isolation: isolate;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(360px, 420px);
  align-items: safe center;
  min-width: 0;
  padding: clamp(28px, 5vw, 72px);
  gap: clamp(28px, 5vw, 80px);
  overflow-x: hidden;
  overflow-y: auto;
  background:
    radial-gradient(circle at 14% 20%, var(--theme-info-soft), transparent 32%),
    radial-gradient(circle at 84% 78%, var(--theme-brand-soft), transparent 34%),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-canvas) 88%, transparent),
      color-mix(in srgb, var(--theme-surface-overlay) 76%, transparent)
    );

  &::before {
    content: '';
    position: absolute;
    inset: 7% auto auto 8%;
    z-index: -1;
    width: min(42vw, 540px);
    aspect-ratio: 1;
    border: 1px solid color-mix(in srgb, var(--theme-info) 12%, transparent);
    border-radius: 50%;
    box-shadow:
      64px 42px 0 -1px color-mix(in srgb, var(--theme-info) 6%, transparent),
      128px 84px 0 -1px color-mix(in srgb, var(--theme-brand-accent) 5%, transparent);
    opacity: 0.5;
    transform: rotate(-18deg);
    pointer-events: none;
  }

  .login-intro {
    position: relative;
    display: grid;
    place-content: center;
    justify-items: center;
    min-width: 0;
    width: 100%;
    align-self: stretch;
    min-height: 300px;
    padding: 0 clamp(8px, 3vw, 44px);
    transform: translateY(-2vh);

    &::before,
    &::after {
      content: '';
      position: absolute;
      pointer-events: none;
    }

    &::before {
      left: 50%;
      bottom: calc(50% - 92px);
      width: min(32vw, 380px);
      height: 84px;
      border-top: 1px solid color-mix(in srgb, var(--theme-brand-accent) 14%, transparent);
      border-radius: 50%;
      transform: translateX(-50%) rotate(-7deg);
    }

    &::after {
      left: calc(50% + min(12vw, 132px));
      bottom: calc(50% - 46px);
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--theme-brand-accent) 38%, transparent);
      box-shadow:
        18px -9px 0 -1px color-mix(in srgb, var(--theme-brand-accent) 30%, transparent),
        32px 4px 0 -1px color-mix(in srgb, var(--theme-brand-accent) 22%, transparent);
    }
  }

  .login-brand-logo {
    width: auto;
    height: clamp(62px, 6vw, 78px);
    margin-bottom: 0;

    /* 透明品牌素材不继承全局媒体占位底色，避免形成矩形色块。 */
    :deep(.el-image__inner) {
      background-color: transparent;
    }
  }

  // 登录区域
  .login-box {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    justify-self: end;

    .content {
      position: relative;
      width: min(400px, 100%);
      /* 单排头像不会另起一套固定高度，多排时再由内容自然扩展。 */
      min-height: 320px;
      padding: 22px 24px 20px;
      display: flex;
      align-items: stretch;
      justify-content: flex-start;
      gap: 14px;
      flex-direction: column;
      border-radius: var(--ds-radius-xl);
      background:
        linear-gradient(145deg, var(--theme-material-highlight), transparent 34%),
        var(--theme-material-thick);
      border: 1px solid var(--theme-material-border);
      box-shadow:
        inset 0 1px 0 var(--theme-material-highlight),
        var(--ds-shadow-lg);
      -webkit-backdrop-filter: blur(var(--theme-material-blur-strong))
        saturate(var(--theme-material-saturation));
      backdrop-filter: blur(var(--theme-material-blur-strong))
        saturate(var(--theme-material-saturation));
      overflow: hidden;

      &::after {
        content: '';
        position: absolute;
        top: 22px;
        right: 22px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--theme-brand-accent) 72%, transparent);
        box-shadow:
          -12px 0 color-mix(in srgb, var(--theme-brand-accent) 26%, transparent),
          0 12px color-mix(in srgb, var(--theme-brand-accent) 18%, transparent);
        opacity: 0.7;
        pointer-events: none;
      }

      p {
        font-size: 12px;
        color: var(--ds-text-tertiary);
      }
    }

    .login-progress-overlay {
      position: absolute;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: center;
      border-radius: var(--ds-radius-xl);
      background:
        radial-gradient(circle at 50% 36%, var(--theme-brand-soft), transparent 38%),
        color-mix(in srgb, var(--theme-backdrop) 82%, transparent);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }

    .login-progress-card {
      width: min(320px, calc(100% - 56px));
      display: grid;
      gap: 13px;
      padding: 18px;
      border-radius: var(--theme-radius-lg);
      background:
        linear-gradient(145deg, var(--theme-material-highlight), transparent 38%),
        var(--theme-material-regular);
      border: 1px solid var(--theme-material-border);
      box-shadow:
        inset 0 1px 0 var(--theme-material-highlight),
        var(--theme-shadow-lg);
      -webkit-backdrop-filter: blur(var(--theme-material-blur))
        saturate(var(--theme-material-saturation));
      backdrop-filter: blur(var(--theme-material-blur)) saturate(var(--theme-material-saturation));
    }

    .login-progress-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .login-progress-icon {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      color: var(--theme-brand-accent);
      background: var(--theme-brand-soft);
      border: 1px solid var(--theme-brand-border);
    }

    .login-progress-main {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    .login-progress-title {
      color: var(--ds-text-primary);
      font-size: 14px;
      font-weight: 700;
      line-height: 1.35;
    }

    .login-progress-desc {
      color: var(--ds-text-tertiary);
      font-size: 12px;
      line-height: 1.35;
    }

    .login-progress-track {
      position: relative;
      height: 3px;
      overflow: hidden;
      border-radius: var(--theme-radius-pill);
      background: var(--theme-border-subtle);

      i {
        position: absolute;
        inset: 0 auto 0 -42%;
        width: 42%;
        border-radius: inherit;
        background: linear-gradient(
          90deg,
          transparent,
          var(--theme-brand-accent),
          var(--theme-brand-text),
          transparent
        );
        animation: login-progress-flow 1.35s var(--theme-ease) infinite;
      }
    }

    .login-progress-note {
      color: var(--theme-text-subtle);
      font-size: 11px;
      line-height: 1.4;
    }

    // 登录标题区域
    .login-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: relative;

      .login-heading-copy {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      h3 {
        margin: 0;
        font-size: 18px;
        color: var(--ds-text-primary);
        font-weight: 650;
        line-height: 1.3;
      }

      span {
        color: var(--theme-text-muted);
        font-size: 12px;
        line-height: 1.4;
      }
    }

    .qrcode-stage {
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 6px;
      padding: 0 4px;
    }

    .qrcode-caption {
      color: var(--theme-text-subtle);
      font-size: 11px;
      line-height: 1.4;
    }

    // 二维码容器
    .qrcode-container {
      position: relative;
      width: 136px;
      height: 136px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 7px;
      border: 1px solid var(--theme-border);
      border-radius: calc(var(--theme-radius-lg) + 2px);
      background:
        linear-gradient(145deg, var(--theme-material-highlight), transparent 42%),
        var(--theme-surface-soft);
      box-shadow:
        inset 0 1px var(--theme-material-highlight),
        0 12px 30px color-mix(in srgb, var(--theme-backdrop) 50%, transparent);

      .qrcode-image {
        width: 122px;
        height: 122px;
        padding: 6px;
        border-radius: var(--theme-radius-md);
        background: var(--el-color-white);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--theme-text-inverse) 22%, transparent);
      }

      // 已扫码成功的遮罩层
      .scan-success-overlay {
        position: absolute;
        inset: 7px;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--theme-success) 94%, transparent) 0%,
          color-mix(in srgb, var(--theme-success) 76%, var(--theme-canvas)) 100%
        );
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        backdrop-filter: blur(3px);
        box-shadow: var(--ds-shadow-md);

        .success-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 6px;
          width: 100%;

          .success-icon {
            color: var(--theme-text-inverse);
            animation: scaleIn var(--ds-dur-base) var(--ds-ease-out);
            filter: drop-shadow(0 2px 4px var(--theme-backdrop));
          }

          .success-text {
            color: var(--theme-text-inverse);
            font-size: 12px;
            font-weight: 600;
            text-shadow: 0 1px 3px var(--theme-backdrop);
            letter-spacing: 0.5px;
          }

          .waiting-text {
            color: var(--theme-text-inverse);
            font-size: 10px;
            text-align: center;
            line-height: 1.2;
            white-space: nowrap;
            text-shadow: 0 1px 2px var(--theme-backdrop);
            font-weight: 500;
          }
        }
      }

      .qrcode-expired {
        position: absolute;
        inset: 7px;
        z-index: 11;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 8px;
        border-radius: var(--theme-radius-md);
        color: var(--theme-warning-text);
        background: var(--theme-material-regular);
        border: 1px solid var(--theme-warning-border);
        -webkit-backdrop-filter: blur(var(--theme-material-blur));
        backdrop-filter: blur(var(--theme-material-blur));

        span {
          font-size: 11px;
          font-weight: 600;
        }

        button {
          min-height: 26px;
          padding: 0 8px;
          border: 1px solid var(--theme-brand-border);
          border-radius: var(--theme-radius-sm);
          color: var(--theme-brand-text);
          background: var(--theme-brand-soft);
          font: inherit;
          font-size: 11px;
          cursor: pointer;

          &:hover {
            color: var(--theme-text-inverse);
            background: var(--theme-brand);
          }

          &:focus-visible {
            outline: 2px solid var(--theme-focus);
            outline-offset: 2px;
          }
        }
      }
    }

    .content.has-local-accounts {
      .qrcode-container {
        width: 128px;
        height: 128px;

        .qrcode-image {
          width: 114px;
          height: 114px;
        }
      }
    }

    .login-inline-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--theme-space-2);
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--theme-danger-border);
      border-radius: var(--theme-radius-md);
      color: var(--theme-danger-text);
      background: var(--theme-danger-soft);
      font-size: 12px;
      line-height: 1.45;

      button {
        min-height: 28px;
        padding-inline: 9px;
        border: 1px solid var(--theme-danger-border);
        border-radius: var(--theme-radius-sm);
        color: var(--theme-danger-text);
        background: transparent;
        font: inherit;
        white-space: nowrap;
        cursor: pointer;

        &:hover {
          background: var(--theme-danger-soft);
          border-color: var(--theme-danger);
        }

        &:focus-visible {
          outline: 2px solid var(--theme-focus);
          outline-offset: 2px;
        }
      }
    }

    .login-auth-stack {
      width: 100%;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 10px;
    }

    .login-auth-stack.has-local-accounts {
      flex: 0 0 auto;
      gap: 8px;
    }

    .local-account-section {
      min-width: 0;
      display: grid;
      align-content: center;
      gap: 6px;
      animation: accountReveal var(--ds-dur-base) var(--ds-ease-out);
    }

    .local-account-list {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      width: 100%;
      column-gap: 12px;
      row-gap: 8px;
      padding: 0;
    }

    // 平滑过渡效果
    .transition-opacity {
      transition: opacity var(--ds-dur-slow) var(--ds-ease-soft);
    }

    // 本地账号头像
    .local-account-item {
      appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      border-radius: var(--theme-radius-md);
      flex: 0 0 76px;
      min-width: 76px;
      min-height: 68px;
      padding: 2px 4px;
      transition:
        opacity var(--ds-dur-base) var(--ds-ease-soft),
        background-color var(--ds-dur-fast) var(--ds-ease-soft);

      &:not(.is-disabled):hover {
        background: var(--theme-surface-hover);
      }

      &.is-disabled {
        opacity: 0.3;
      }

      :deep(.el-avatar) {
        transition: box-shadow var(--ds-dur-base) var(--ds-ease-soft);
      }

      &:not(.is-disabled):hover :deep(.el-avatar) {
        box-shadow: 0 0 0 2px var(--theme-brand-border);
      }

      span {
        margin-top: 3px;
        font-size: 12px;
        color: var(--ds-text-secondary);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &:focus-visible {
        outline: 2px solid var(--theme-focus);
        outline-offset: 2px;
      }
    }
  }
}

// 动画效果
@keyframes scaleIn {
  0% {
    transform: scale(0.94);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
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

@keyframes login-progress-flow {
  to {
    left: 100%;
  }
}

@keyframes accountReveal {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 过渡动画
.scan-success-enter-active {
  animation: scaleIn var(--ds-dur-base) var(--ds-ease-out);
}

.scan-success-leave-active {
  animation: scaleIn var(--ds-dur-fast) var(--ds-ease-soft) reverse;
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

@media (max-width: 980px) {
  .login {
    grid-template-columns: minmax(190px, 0.58fr) minmax(360px, 410px);
    gap: clamp(24px, 4vw, 52px);
    padding: clamp(24px, 4vw, 44px);

    .login-intro {
      padding: 0;
    }

    .login-brand-logo {
      height: 62px;
    }
  }
}

@media (max-width: 760px) {
  .login {
    grid-template-columns: minmax(0, 1fr);
    justify-content: center;
    gap: var(--theme-space-3);
    padding: var(--theme-space-4);
    overflow: auto;

    .login-intro {
      justify-items: center;
      text-align: center;
      margin-inline: auto;
      min-height: 92px;
      padding-top: 8px;
      transform: none;

      &::before,
      &::after {
        display: none;
      }
    }

    .login-brand-logo {
      height: 52px;
    }

    .login-box {
      .content {
        width: min(400px, 100%);
        min-height: 0;
        padding: var(--theme-space-5);

        &.has-local-accounts {
          min-height: 0;
        }
      }

      .login-auth-stack.has-local-accounts {
        display: flex;
      }

      .local-account-section {
        padding-left: 0;
        border-left: 0;
      }
    }
  }
}

@media (max-height: 680px) and (min-width: 761px) {
  .login {
    padding-block: 22px;

    .login-brand-logo {
      margin-bottom: 20px;
    }

    .login-box .content {
      min-height: min(304px, calc(100vh - 72px));
      padding-block: 18px;
      gap: 10px;
    }

    .qrcode-container {
      width: 132px;
      height: 132px;

      .qrcode-image {
        width: 118px;
        height: 118px;
      }
    }
  }
}

@media (max-width: 460px) {
  .login .login-box .content {
    min-height: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login {
    .local-account-item,
    .local-account-section,
    .scan-success-overlay,
    .success-icon,
    .waiting-text,
    .login-progress-track i,
    .blur-sm {
      animation: none;
      transition: none;
    }

    .local-account-item:hover {
      transform: none;
    }
  }
}
</style>
