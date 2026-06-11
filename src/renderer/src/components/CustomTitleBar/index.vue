<template>
  <div
    ref="titleBarRef"
    class="custom-title-bar drag-region"
    :class="{ 'is-mac': isMac, 'is-compact-actions': compactActions }"
  >
    <!-- 左侧工具区域 -->
    <div ref="titleLeftRef" class="title-bar-left">
      <!-- Mac系统留出红绿灯按钮的空间 -->
      <div v-if="isMac" class="mac-traffic-lights-space"></div>

      <el-tooltip v-if="!isMac && appHomepage" content="GitHub 项目" placement="bottom">
        <button class="title-github-btn no-drag" type="button" tabindex="-1" @click="openGitHub">
          <Icon icon="github" size="small" class="github-action-icon" />
        </button>
      </el-tooltip>

      <div v-if="!isMac && apiBaseUrl" class="title-side-actions">
        <el-tooltip :content="feedbackTooltip" placement="bottom">
          <button
            class="title-feedback-btn no-drag"
            type="button"
            tabindex="-1"
            @click="openFeedback"
          >
            <span class="feedback-text">反馈</span>
          </button>
        </el-tooltip>
      </div>

      <div v-if="appVersion" class="version-download-group">
        <button
          class="version-container no-drag"
          :class="versionStateClass"
          type="button"
          tabindex="-1"
          :title="getVersionTooltip()"
          @click="handleVersionClick(false)"
          @contextmenu.prevent="copyToClipboard(appVersion, '版本号')"
        >
          <template v-if="showUpdateStatusBlock">
            <div class="version-update-block">
              <div class="version-update-row">
                <div class="version-update-title-wrap">
                  <span class="version-update-title">{{ versionStatusTitle }}</span>
                  <span
                    v-if="updateState.checking"
                    class="checking-indicator"
                    title="正在检查更新..."
                  >
                    <span class="checking-spinner"></span>
                  </span>
                </div>
                <div class="version-update-actions">
                  <span class="version-update-detail">{{ versionStatusDetail }}</span>
                  <button
                    v-if="updateState.downloading && updateState.canCancel"
                    class="version-progress-cancel"
                    type="button"
                    tabindex="-1"
                    title="取消更新"
                    @click.stop="cancelUpdate"
                  >
                    <el-icon><Close /></el-icon>
                  </button>
                </div>
              </div>
              <ProgressBar
                v-if="updateState.downloading"
                :percentage="Math.min(100, Math.max(0, updateState.progress || 0))"
                :transferred="updateState.transferred"
                :total="updateState.total"
                :speed="updateState.bytesPerSecond"
                size="small"
                variant="compact"
                :show-text="false"
                class="version-progress-track"
              />
            </div>
          </template>
          <template v-else>
            <span class="app-version-content" :class="{ checking: updateState.checking }">
              <span
                class="app-version"
                :class="{
                  'has-update': showUpdateBadge,
                  checking: updateState.checking
                }"
              >
                {{ versionChipText }}
              </span>
              <span
                v-if="updateState.checking"
                class="checking-indicator inline-checking-indicator"
                title="正在检查更新..."
              >
                <span class="checking-spinner"></span>
              </span>
            </span>
            <transition name="fade">
              <span
                v-if="showUpdateBadge"
                class="update-dot"
                title="发现新版本，点击查看详情"
              ></span>
            </transition>
          </template>
        </button>
      </div>
    </div>

    <!-- 中间标题区域 -->
    <div ref="titleCenterRef" class="title-bar-center">
      <div class="title-content">
        <div class="app-logo">
          <Icon icon="qzone" size="large" color="#F15A24" />
        </div>
        <span v-if="appDescription" class="app-title">{{ appDescription }}</span>
      </div>
    </div>

    <!-- 右侧区域 -->
    <div ref="titleRightRef" class="title-bar-right">
      <!-- 更新完成提示 -->
      <transition name="fade">
        <div v-if="showUpdateReady" class="update-ready no-drag">
          <el-button
            type="success"
            size="small"
            class="ready-btn"
            title="更新已下载完成，点击重启安装"
            @click="showUpdateDialog"
          >
            <el-icon><CircleCheck /></el-icon>
            <span>重启安装</span>
          </el-button>
        </div>
      </transition>

      <!-- 全局控制按钮组 -->
      <div ref="globalControlsRef" class="global-controls">
        <!-- 全局隐私模式切换 -->
        <el-tooltip
          v-if="isLoggedIn"
          :content="
            privacyStore.privacyMode ? '关闭隐私模式，显示照片内容' : '开启隐私模式，模糊照片内容'
          "
          placement="bottom"
        >
          <el-button
            class="global-privacy-btn no-drag"
            size="small"
            text
            tabindex="-1"
            :type="privacyStore.privacyMode ? 'warning' : 'info'"
            @click="privacyStore.togglePrivacyMode()"
          >
            <el-icon class="privacy-icon">
              <Hide v-if="privacyStore.privacyMode" />
              <View v-else />
            </el-icon>
            <span class="privacy-text">{{ privacyStore.privacyMode ? '隐私' : '公开' }}</span>
          </el-button>
        </el-tooltip>

        <!-- 系统刷新按钮 -->
        <el-tooltip content="刷新当前页面" placement="bottom">
          <el-button
            class="global-refresh-btn no-drag"
            size="small"
            text
            tabindex="-1"
            @click="refreshSystem"
          >
            <el-icon class="refresh-icon">
              <Refresh />
            </el-icon>
            <span class="privacy-text">刷新</span>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="isMac" :content="feedbackTooltip" placement="bottom">
          <el-button
            class="global-feedback-btn no-drag"
            size="small"
            text
            tabindex="-1"
            @click="openFeedback"
          >
            <el-icon class="feedback-icon">
              <ChatDotRound />
            </el-icon>
            <span class="privacy-text">反馈</span>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="showNoticeEntry" content="公告" placement="bottom">
          <el-button
            class="global-notice-btn no-drag"
            size="small"
            text
            tabindex="-1"
            @click="openNoticeCenter"
          >
            <span class="notice-icon-wrap">
              <Bell :size="14" class="notice-icon" />
              <span v-if="hasUnreadNotice" class="notice-dot"></span>
            </span>
            <span class="privacy-text">公告</span>
          </el-button>
        </el-tooltip>

        <el-tooltip v-if="isMac && appHomepage" content="GitHub 项目" placement="bottom">
          <el-button
            class="global-github-btn no-drag"
            size="small"
            text
            tabindex="-1"
            @click="openGitHub"
          >
            <Icon icon="github" size="small" class="github-action-icon" />
          </el-button>
        </el-tooltip>
      </div>

      <div
        ref="globalControlsMeasureRef"
        class="global-controls global-controls-measure"
        aria-hidden="true"
      >
        <span v-if="isLoggedIn" class="measure-action">
          <span class="measure-icon"></span>
          <span>{{ privacyStore.privacyMode ? '隐私' : '公开' }}</span>
        </span>
        <span class="measure-action">
          <span class="measure-icon"></span>
          <span>刷新</span>
        </span>
        <span v-if="isMac" class="measure-action">
          <span class="measure-icon"></span>
          <span>反馈</span>
        </span>
        <span v-if="showNoticeEntry" class="measure-action">
          <span class="measure-icon"></span>
          <span>公告</span>
        </span>
        <span v-if="isMac && appHomepage" class="measure-action">
          <span class="measure-icon"></span>
        </span>
      </div>

      <!-- Windows/Linux窗口控制按钮 -->
      <div v-if="!isMac" ref="windowControlsRef" class="window-controls">
        <button
          class="title-bar-button minimize no-drag"
          title="最小化"
          type="button"
          tabindex="-1"
          @click="minimizeWindow"
        >
          <el-icon><SemiSelect /></el-icon>
        </button>

        <button
          class="title-bar-button maximize no-drag"
          :title="isMaximized ? '还原' : '最大化'"
          type="button"
          tabindex="-1"
          @click="maximizeWindow"
        >
          <el-icon v-if="isMaximized"><ArrowDownBold /></el-icon>
          <el-icon v-else><ArrowUpBold /></el-icon>
        </button>

        <button
          class="title-bar-button close no-drag"
          title="关闭"
          type="button"
          tabindex="-1"
          @click="closeWindow"
        >
          <el-icon><CloseBold /></el-icon>
        </button>
      </div>
    </div>

    <!-- 更新对话框 -->
    <UpdateDialog
      v-model:visible="dialogVisible"
      :update-state="dialogState"
      :update-info="updateInfo"
      :download-progress="downloadProgress"
      :error-info="errorInfo"
      @background-download="handleBackgroundDownload"
      @download="handleDownloadUpdate"
      @install="handleInstallUpdate"
      @cancel="handleCancelUpdate"
      @retry="handleRetryUpdate"
      @dismiss="handleDismissDialog"
    />

    <FeedbackDialog
      v-if="apiBaseUrl"
      v-model:visible="feedbackVisible"
      :app-version="appVersion"
      :app-homepage="appHomepage"
      :runtime-info="runtimeInfo"
      :api-base-url="apiBaseUrl"
    />

    <NoticeCenter
      v-if="apiBaseUrl"
      v-model:visible="noticeVisible"
      :notices="notices"
      :active-notice="activeNotice"
      @dismiss="dismissNotice"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import {
  Close,
  CircleCheck,
  CloseBold,
  SemiSelect,
  ArrowDownBold,
  ArrowUpBold,
  View,
  Hide,
  Refresh,
  ChatDotRound
} from '@element-plus/icons-vue'
import { isMac as isMacPlatform } from '@renderer/utils/platform'
import { IPC_APP, IPC_SHELL, IPC_WINDOW } from '@shared/ipc-channels'
import { APP_DESCRIPTION, APP_HOMEPAGE } from '@shared/const'
import { Bell } from '@lucide/vue'
import UpdateDialog from '@renderer/components/UpdateManager/UpdateDialog.vue'
import FeedbackDialog from '@renderer/components/FeedbackDialog/index.vue'
import NoticeCenter from '@renderer/components/NoticeCenter/index.vue'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { useUserStore } from '@renderer/store/user.store'
import Icon from '@renderer/components/Icon/index.vue'
import ProgressBar from '@renderer/components/ProgressBar/index.vue'
import { formatBytes } from '@renderer/utils/formatters'
import { copyToClipboard } from '@renderer/utils'

// 简单的版本号格式化函数
const formatVersion = (version) => {
  if (!version) return ''
  return version.startsWith('v') ? version : `v${version}`
}

// 应用状态
const isMac = ref(isMacPlatform())
const appVersion = ref('')
const appHomepage = ref(APP_HOMEPAGE)
const appDescription = ref(APP_DESCRIPTION)
const runtimeInfo = ref({})
const apiConfig = ref({
  apiBaseUrl: '',
  fallbackBaseUrls: [],
  version: '',
  ttlSeconds: 86400,
  fetchedAt: '',
  remoteConfigUrl: '',
  source: 'disabled'
})
const apiBaseUrl = computed(() => apiConfig.value?.apiBaseUrl || '')
const titleBarRef = ref(null)
const titleLeftRef = ref(null)
const titleCenterRef = ref(null)
const titleRightRef = ref(null)
const globalControlsRef = ref(null)
const globalControlsMeasureRef = ref(null)
const windowControlsRef = ref(null)
const compactActions = ref(false)
// 窗口状态
const isMaximized = ref(false)

// Store
const privacyStore = usePrivacyStore()
const userStore = useUserStore()

// 判断用户是否已登录
const isLoggedIn = computed(() => {
  return !!userStore.userInfo?.uin
})

// 更新状态
const updateState = reactive({
  checking: false,
  downloading: false,
  downloaded: false,
  progress: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  canCancel: true,
  hasUpdate: false
})

// 对话框状态
const dialogVisible = ref(false)
const dialogState = ref('idle')
const updateInfo = ref({})
const errorInfo = ref({})
const feedbackVisible = ref(false)
const noticeVisible = ref(false)
const notices = ref([])
const activeNotice = ref(null)
const noticeReadVersion = ref(0)
let appNoticeChecked = false
const silentChecking = ref(false)
const pendingNoticeAutoOpen = ref(false)
const pendingUpdateDialogOpen = ref(false)

// 计算属性
const showUpdateBadge = computed(() => {
  return updateState.hasUpdate && !updateState.downloading && !updateState.downloaded
})

const showInlineDownloadProgress = computed(() => {
  return updateState.downloading && !dialogVisible.value
})

const showUpdateReady = computed(() => {
  return updateState.downloaded && !updateState.downloading
})

const showUpdateStatusBlock = computed(() => {
  return updateState.downloading || updateState.downloaded
})

const versionChipText = computed(() => {
  if (updateState.downloading) return appVersion.value || '更新'
  if (updateState.downloaded) return '已就绪'
  if (updateState.checking) return '检查中'
  if (showUpdateBadge.value) return '新版本'
  return appVersion.value
})

const versionStatusTitle = computed(() => {
  if (updateState.checking) return '检查更新'
  if (updateState.downloading) return `下载 ${appVersion.value || ''}`.trim()
  if (updateState.downloaded) return `已就绪 ${appVersion.value || ''}`.trim()
  return appVersion.value
})

const versionStateClass = computed(() => ({
  checking: updateState.checking,
  downloading: updateState.downloading,
  downloaded: updateState.downloaded,
  'has-update': showUpdateBadge.value
}))

const downloadProgress = computed(() => ({
  percent: updateState.progress,
  downloaded: Math.round((updateState.transferred / 1024 / 1024) * 100) / 100,
  total: Math.round((updateState.total / 1024 / 1024) * 100) / 100,
  speed: Math.round(updateState.bytesPerSecond / 1024)
}))

const progressText = computed(() => {
  if (updateState.total > 0 && updateState.transferred > 0) {
    const transferred = formatBytes(updateState.transferred)
    const total = formatBytes(updateState.total)
    const speed = updateState.bytesPerSecond > 0 ? formatBytes(updateState.bytesPerSecond) : '0 B'
    return `${transferred} / ${total} (${speed}/s)`
  }
  return `${updateState.progress?.toFixed(1) || 0}%`
})

const progressDetailText = computed(() => {
  if (updateState.total > 0 && updateState.transferred > 0) {
    const transferredMb = updateState.transferred / 1024 / 1024
    const totalMb = updateState.total / 1024 / 1024
    if (totalMb >= 1) {
      return `${transferredMb.toFixed(1)} / ${totalMb.toFixed(1)} MB`
    }

    const transferredKb = updateState.transferred / 1024
    const totalKb = updateState.total / 1024
    return `${transferredKb.toFixed(0)} / ${totalKb.toFixed(0)} KB`
  }
  if (updateState.bytesPerSecond > 0) {
    return `${formatBytes(updateState.bytesPerSecond)}/s`
  }
  return `${Math.round(updateState.progress || 0)}%`
})

const versionStatusDetail = computed(() => {
  if (updateState.checking) return '正在获取最新版本信息'
  if (updateState.downloading) return progressDetailText.value
  if (updateState.downloaded) return '点击查看并完成安装'
  return appVersion.value
})

const feedbackTooltip = computed(() => {
  return apiBaseUrl.value ? '快捷反馈问题或建议' : '打开 GitHub 反馈页'
})

const hasUnreadNotice = computed(() =>
  notices.value.some((notice) => notice.dismissible !== false && !isNoticeDismissed(notice))
)
const showNoticeEntry = computed(() => !!apiBaseUrl.value && notices.value.length > 0)

// 版本号提示文本
const getVersionTooltip = () => {
  const suffix = '\n右键复制版本号'
  if (updateState.checking) {
    return '正在检查更新...' + suffix
  } else if (updateState.hasUpdate) {
    return '发现新版本，点击查看详情' + suffix
  } else {
    return '点击检查更新' + suffix
  }
}

// 窗口控制方法
const minimizeWindow = async () => {
  await window.api.invoke(IPC_WINDOW.MINIMIZE)
}

const maximizeWindow = async () => {
  const newState = await window.api.invoke(IPC_WINDOW.MAXIMIZE)
  isMaximized.value = newState
}

const closeWindow = async () => {
  await window.api.invoke(IPC_WINDOW.CLOSE)
}

// GitHub项目链接
const openGitHub = () => {
  if (appHomepage.value) {
    window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, appHomepage.value)
  }
}

const buildFallbackFeedbackIssue = () => {
  const appInfo = runtimeInfo.value || {}
  const homepage = (appHomepage.value || 'https://github.com/11273/QzonePhoto').replace(/\/$/, '')
  const version = appVersion.value || formatVersion(appInfo.version) || 'unknown'
  const platform = appInfo.platform || (isMac.value ? 'darwin' : 'unknown')
  const title = `[反馈][${version}][${platform}] 用户反馈`
  const body = [
    '### 反馈内容',
    '',
    '请在这里描述遇到的问题，或者想建议优化的地方。',
    '',
    '### 附带信息',
    '',
    `- 版本：${version}`,
    `- 系统：${platform}${appInfo.arch ? ` / ${appInfo.arch}` : ''}`,
    `- 安装：${appInfo.isPackaged ? '安装包' : '开发模式'}`,
    `- 页面：${window.location.hash || '#/index'}`
  ].join('\n')

  return `${homepage}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}

const openFeedback = async () => {
  if (!apiBaseUrl.value) {
    await window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, buildFallbackFeedbackIssue())
    return
  }
  reportAppEvent('feedback_opened', { source: 'titlebar' })
  feedbackVisible.value = true
}

const getNoticeStorageKey = (notice) =>
  notice?.id ? `qzone.notice.dismissed.${notice.id}.${notice.updatedAt || ''}` : ''

const isNoticeDismissed = (notice) => {
  noticeReadVersion.value
  const key = getNoticeStorageKey(notice)
  return !!key && localStorage.getItem(key) === '1'
}

const dismissNotice = (notice) => {
  if (!notice || notice.dismissible === false) return
  const key = getNoticeStorageKey(notice)
  if (key) localStorage.setItem(key, '1')
  noticeReadVersion.value += 1
  reportAppEvent('notice_dismissed', { target: notice.id || notice.slug || '' })
}

const openNoticeCenter = async () => {
  pendingNoticeAutoOpen.value = false
  noticeVisible.value = true
  if (activeNotice.value) {
    reportAppEvent('notice_shown', { source: 'manual', target: activeNotice.value.id || '' })
  }
  await fetchAppNotice({ force: true, openWhenUnread: false })
}

// 系统刷新
const refreshSystem = () => {
  window.location.reload()
}

// 版本号点击事件
const handleVersionClick = async (background = false) => {
  // 如果正在下载或已下载完成，直接显示对话框
  if (updateState.downloading || updateState.downloaded) {
    if (!background) {
      showUpdateDialog()
    }
    return
  }

  if (updateState.hasUpdate) {
    silentChecking.value = false
    if (!background) {
      showUpdateDialog()
    }
  } else if (updateState.checking) {
    if (!background) {
      silentChecking.value = false
    }
    // 正在检查中，如果不是后台模式，显示对话框
    if (!background) {
      showUpdateDialog()
    }
  } else {
    // 手动检查更新
    if (window.QzoneAPI?.update) {
      try {
        console.log(background ? '后台检查更新...' : '手动检查更新...')
        silentChecking.value = background
        updateState.checking = true

        // 只有非后台模式才显示对话框
        if (!background) {
          dialogState.value = 'checking'
          dialogVisible.value = true
        }

        // 调用检查更新
        await window.QzoneAPI.update.checkForUpdates()

        // 如果3秒后还在检查状态，显示无更新提示
        setTimeout(() => {
          if (updateState.checking && !updateState.hasUpdate) {
            updateState.checking = false
            silentChecking.value = false

            // 只有非后台模式才更新对话框状态
            if (!background) {
              dialogState.value = 'no-update'

              // 2秒后自动关闭对话框
              setTimeout(() => {
                if (dialogState.value === 'no-update') {
                  dialogVisible.value = false
                  dialogState.value = 'idle'
                }
              }, 2000)
            }
          }
        }, 3000)
      } catch (error) {
        console.error('检查更新失败:', error)
        updateState.checking = false
        silentChecking.value = false

        // 只有非后台模式才显示错误
        if (!background) {
          dialogState.value = 'error'
          errorInfo.value = {
            message: error.message || '检查更新失败',
            canRetry: true
          }
        }
      }
    } else {
      // 没有更新API，显示提示
      console.warn('更新API不可用')
    }
  }
}

// 更新对话框方法
const showUpdateDialog = () => {
  // 根据当前状态设置对话框状态
  if (updateState.downloaded) {
    dialogState.value = 'downloaded'
  } else if (updateState.downloading) {
    dialogState.value = 'downloading'
  } else if (updateState.hasUpdate) {
    dialogState.value = 'available'
  } else if (updateState.checking) {
    dialogState.value = 'checking'
  }

  dialogVisible.value = true
}

const tryOpenPendingOverlay = () => {
  if (dialogVisible.value || noticeVisible.value) return

  if (pendingUpdateDialogOpen.value) {
    pendingUpdateDialogOpen.value = false
    showUpdateDialog()
    return
  }

  if (pendingNoticeAutoOpen.value && activeNotice.value && !isNoticeDismissed(activeNotice.value)) {
    pendingNoticeAutoOpen.value = false
    noticeVisible.value = true
  }
}

const handleBackgroundDownload = async () => {
  console.log('用户点击后台下载，开始下载更新...')
  // 隐藏对话框
  dialogVisible.value = false
}

const handleDownloadUpdate = async () => {
  try {
    console.log('用户点击立即下载，开始下载更新...')
    // 重置状态
    updateState.downloaded = false
    updateState.downloading = true
    updateState.progress = 0
    dialogState.value = 'downloading'
    await window.QzoneAPI.update.downloadUpdate()
    console.log('下载更新API调用完成')
  } catch (error) {
    console.error('下载更新失败:', error)
    dialogState.value = 'error'
    errorInfo.value = {
      message: error.message || '下载更新失败',
      canRetry: true
    }
  }
}

const handleInstallUpdate = async () => {
  try {
    console.log('用户点击立即重启，开始安装更新...')
    await window.QzoneAPI.update.installUpdate()
  } catch (error) {
    console.error('安装更新失败:', error)
    dialogState.value = 'error'
    errorInfo.value = {
      message: error.message || '安装更新失败',
      canRetry: false
    }
  }
}

const handleCancelUpdate = async () => {
  dialogVisible.value = false
  await cancelUpdate()
}

const handleRetryUpdate = async () => {
  if (errorInfo.value.canRetry) {
    await handleDownloadUpdate()
  }
}

const handleDismissDialog = () => {
  dialogVisible.value = false
}

// 取消更新下载
const cancelUpdate = async () => {
  try {
    await window.QzoneAPI.update.cancelDownload()
    updateState.downloading = false
    updateState.downloaded = false // 确保重置已下载状态
    updateState.progress = 0
    dialogState.value = 'available'
    updateState.progress = 0
    updateState.bytesPerSecond = 0
    updateState.transferred = 0
    updateState.total = 0
  } catch (error) {
    console.error('取消更新失败:', error)
  }
}

// 监听窗口状态变化
const handleWindowMaximized = (maximized) => {
  isMaximized.value = maximized
}

// 更新事件处理
const handleUpdateChecking = () => {
  updateState.checking = true
  if (!silentChecking.value) {
    dialogState.value = 'checking'
  }
}

const handleUpdateAvailable = (info) => {
  updateState.checking = false
  silentChecking.value = false
  updateState.hasUpdate = true
  updateInfo.value = info
  dialogState.value = 'available'

  // 自动弹出更新对话框，但避免与公告叠在一起
  if (noticeVisible.value) {
    pendingUpdateDialogOpen.value = true
  } else {
    pendingUpdateDialogOpen.value = false
    dialogVisible.value = true
  }

  console.log('发现新版本:', info)
}

const handleUpdateNotAvailable = (info) => {
  console.log('没有更新:', info)
  updateState.checking = false
  silentChecking.value = false
  updateState.hasUpdate = false

  // 如果对话框是打开的，显示无更新状态
  if (dialogVisible.value) {
    updateInfo.value = info
    dialogState.value = 'no-update'
  } else {
    dialogState.value = 'idle'
  }
}

const handleDownloadProgress = (progressObj) => {
  updateState.downloading = true
  updateState.downloaded = false // 重置已下载状态
  updateState.progress = progressObj.percent || 0
  updateState.bytesPerSecond = progressObj.bytesPerSecond || 0
  updateState.transferred = progressObj.transferred || 0
  updateState.total = progressObj.total || 0
  dialogState.value = 'downloading'
}

const handleUpdateDownloaded = () => {
  updateState.downloading = false
  updateState.downloaded = true
  updateState.progress = 100
  updateState.hasUpdate = false
  dialogState.value = 'downloaded'
  console.log('更新下载完成，等待用户确认安装')
}

const handleUpdateError = (error) => {
  updateState.checking = false
  updateState.downloading = false
  silentChecking.value = false
  updateState.progress = 0
  dialogState.value = 'error'
  errorInfo.value = error
  console.error('更新错误:', error)
}

// 获取应用信息
const loadAppInfo = async () => {
  try {
    const response = await window.api.invoke(IPC_APP.GET_INFO)
    const appInfo = response?.data || response
    if (appInfo) {
      runtimeInfo.value = appInfo
      appDescription.value =
        appInfo.description || appInfo.appDescription || appInfo.displayName || APP_DESCRIPTION
      appVersion.value = formatVersion(appInfo.version || appInfo.appVersion)
      if (typeof appInfo.isMac === 'boolean') {
        isMac.value = appInfo.isMac
      }
      appHomepage.value = appInfo.homepage || APP_HOMEPAGE
    }
  } catch (error) {
    console.warn('获取应用信息失败:', error)
    appDescription.value = APP_DESCRIPTION
    appHomepage.value = APP_HOMEPAGE
  }
}

const loadApiConfig = async (forceRefresh = false) => {
  try {
    const result = await window.api.invoke(IPC_APP.GET_API_CONFIG, { forceRefresh })
    apiConfig.value = {
      apiBaseUrl: String(result?.apiBaseUrl || '').replace(/\/$/, ''),
      fallbackBaseUrls: Array.isArray(result?.fallbackBaseUrls) ? result.fallbackBaseUrls : [],
      version: result?.version || '',
      ttlSeconds: Number(result?.ttlSeconds || 86400),
      fetchedAt: result?.fetchedAt || '',
      remoteConfigUrl: result?.remoteConfigUrl || '',
      source: result?.source || 'unknown'
    }
  } catch (error) {
    console.warn('获取动态 API 配置失败:', error)
    apiConfig.value = {
      apiBaseUrl: '',
      fallbackBaseUrls: [],
      version: '',
      ttlSeconds: 86400,
      fetchedAt: '',
      remoteConfigUrl: '',
      source: 'error'
    }
  }
}

const fetchAppNotice = async ({ force = false, openWhenUnread = true } = {}) => {
  if ((appNoticeChecked && !force) || !apiBaseUrl.value) return
  appNoticeChecked = true

  try {
    const payload = await window.QzoneAPI.app.fetchNotices({
      forceRefresh: force,
      page: window.location.hash || '#/index'
    })
    const nextNotices = Array.isArray(payload?.notices)
      ? payload.notices.filter((notice) => notice?.id && notice.title && notice.content)
      : []
    const currentNotice = payload?.notice

    notices.value = nextNotices.length ? nextNotices : currentNotice?.id ? [currentNotice] : []
    activeNotice.value = currentNotice?.id ? currentNotice : notices.value[0] || null

    if (openWhenUnread && activeNotice.value && !isNoticeDismissed(activeNotice.value)) {
      reportAppEvent('notice_shown', { source: 'auto', target: activeNotice.value.id || '' })
      if (dialogVisible.value || pendingUpdateDialogOpen.value) {
        pendingNoticeAutoOpen.value = true
      } else {
        pendingNoticeAutoOpen.value = false
        noticeVisible.value = true
      }
    }
  } catch (error) {
    console.debug('[AppNotice] check skipped:', error)
  }
}

const reportAppEvent = (event, properties = {}) => {
  if (!window.QzoneAPI?.app?.reportHealth) return
  window.QzoneAPI.app
    .reportHealth({
      event,
      page: window.location.hash || '#/index',
      success: true,
      properties
    })
    .catch(() => {})
}

// 清理监听器
let removeListeners = []
let resizeObserver = null
let densityFrame = 0

const measureActionDensity = () => {
  const bar = titleBarRef.value
  const left = titleLeftRef.value
  const center = titleCenterRef.value
  const right = titleRightRef.value
  if (!bar || !left || !right) return

  const sumChildrenWidth = (el) =>
    Array.from(el.children).reduce((sum, child) => {
      const style = window.getComputedStyle(child)
      if (style.display === 'none') return sum
      if (child === globalControlsMeasureRef.value) return sum
      if (child === globalControlsRef.value && globalControlsMeasureRef.value) {
        const rect = globalControlsMeasureRef.value.getBoundingClientRect()
        return (
          sum + rect.width + parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0)
        )
      }
      const rect = child.getBoundingClientRect()
      return (
        sum + rect.width + parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0)
      )
    }, 0)

  const barWidth = bar.clientWidth
  const centerWidth = center?.getBoundingClientRect().width || 0
  const leftWidth = sumChildrenWidth(left)
  const rightWidth = sumChildrenWidth(right)
  const sideLimit = Math.max(isMac.value ? 220 : 240, (barWidth - centerWidth - 64) / 2)
  compactActions.value = rightWidth > sideLimit || leftWidth > sideLimit
}

const scheduleActionDensity = async () => {
  if (densityFrame) cancelAnimationFrame(densityFrame)
  await nextTick()
  densityFrame = requestAnimationFrame(() => {
    densityFrame = 0
    measureActionDensity()
  })
}

const clearInitialTitlebarFocus = async () => {
  await nextTick()
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !titleBarRef.value?.contains(active)) return
  if (active.matches('button, [role="button"]')) {
    active.blur()
  }
}

const handleTitlebarFocusIn = (event) => {
  const target = event.target
  if (!(target instanceof HTMLElement) || !titleBarRef.value?.contains(target)) return
  if (target.matches('button, [role="button"], .el-button')) {
    target.blur()
  }
}

onMounted(async () => {
  // 获取应用信息
  await Promise.all([loadAppInfo(), loadApiConfig()])
  fetchAppNotice()
  scheduleActionDensity()
  clearInitialTitlebarFocus()
  handleVersionClick(true)
  // 获取初始窗口状态
  try {
    isMaximized.value = await window.api.invoke(IPC_WINDOW.IS_MAXIMIZED)
  } catch (error) {
    console.warn('获取窗口状态失败:', error)
  }
  // 监听窗口状态变化
  removeListeners.push(window.api.on(IPC_WINDOW.MAXIMIZED, handleWindowMaximized))
  resizeObserver = new ResizeObserver(() => scheduleActionDensity())
  if (titleBarRef.value) resizeObserver.observe(titleBarRef.value)
  titleBarRef.value?.addEventListener('focusin', handleTitlebarFocusIn)
  // 监听更新相关事件
  if (window.QzoneAPI?.update) {
    window.QzoneAPI.update.onUpdateChecking(handleUpdateChecking)
    window.QzoneAPI.update.onUpdateAvailable(handleUpdateAvailable)
    window.QzoneAPI.update.onUpdateNotAvailable(handleUpdateNotAvailable)
    window.QzoneAPI.update.onDownloadProgress(handleDownloadProgress)
    window.QzoneAPI.update.onUpdateDownloaded(handleUpdateDownloaded)
    window.QzoneAPI.update.onUpdateError(handleUpdateError)

    // 注意：自动检查更新已在主进程启动时执行
    // 这里只需要监听更新事件即可
  }
})

onUnmounted(() => {
  if (densityFrame) cancelAnimationFrame(densityFrame)
  resizeObserver?.disconnect?.()
  titleBarRef.value?.removeEventListener('focusin', handleTitlebarFocusIn)
  // 移除所有监听器
  removeListeners.forEach((remove) => remove && remove())

  // 移除更新相关监听器
  if (window.QzoneAPI?.update) {
    window.QzoneAPI.update.removeAllListeners()
  }
})

watch(
  [
    isLoggedIn,
    showNoticeEntry,
    appVersion,
    appDescription,
    appHomepage,
    versionChipText,
    showInlineDownloadProgress,
    progressText
  ],
  () => {
    scheduleActionDensity()
  },
  { flush: 'post' }
)

watch([dialogVisible, noticeVisible], () => {
  if (!dialogVisible.value && !noticeVisible.value) {
    tryOpenPendingOverlay()
  }
})
</script>

<style scoped>
.custom-title-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  column-gap: 10px;
  align-items: center;
  height: 36px;
  color: #ffffff;
  font-size: 13px;
  user-select: none;
  position: relative;
  flex-shrink: 0;
}

.drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}

/* 左侧区域 */
.title-bar-left {
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  flex: 1;
  flex-shrink: 0;
  min-width: 0;
  z-index: 2;
  overflow: hidden;
}

.is-mac .title-bar-left {
  padding-left: 0;
}

.mac-traffic-lights-space {
  width: 78px; /* 精确匹配Mac系统按钮区域 */
  height: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.title-github-btn {
  appearance: none;
  border: 1px solid transparent;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  color: rgba(255, 255, 255, 0.78);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.18s var(--ds-ease-soft),
    border-color 0.18s var(--ds-ease-soft),
    color 0.18s var(--ds-ease-soft);
}

.title-github-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.065);
  border-color: rgba(255, 255, 255, 0.075);
}

.title-github-btn :deep(.github-action-icon) {
  transition: transform 0.18s var(--ds-ease-soft);
}

.title-github-btn:hover :deep(.github-action-icon) {
  transform: translateY(-1px);
}

.title-github-btn:focus,
.title-feedback-btn:focus,
.title-bar-button:focus {
  outline: none;
}

.title-github-btn:focus-visible,
.title-feedback-btn:focus-visible,
.title-bar-button:focus-visible {
  outline: none;
  border-color: rgba(96, 165, 250, 0.42);
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.24);
}

.title-side-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.version-download-group {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 0 1 auto;
}

.title-feedback-btn {
  appearance: none;
  border: 1px solid transparent;
  height: 24px;
  padding: 0 6px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: rgba(255, 255, 255, 0.66);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.18s var(--ds-ease-soft),
    border-color 0.18s var(--ds-ease-soft),
    color 0.18s var(--ds-ease-soft);
}

.title-feedback-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.feedback-text {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
}

.app-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f15a24;
  filter: drop-shadow(0 2px 4px rgba(241, 90, 36, 0.3));
}

/* 中间标题区域：不抢占左右命令区空间 */
.title-bar-center {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: min(360px, 34vw);
  pointer-events: none;
}

.title-content {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  max-width: 100%;
  min-width: 0;
  pointer-events: auto;
}

.app-title {
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  max-width: min(320px, 28vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右侧区域 */
.title-bar-right {
  grid-column: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  flex-shrink: 0;
  justify-content: flex-end;
  min-width: 0;
  z-index: 2;
}

.global-controls {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0;
  gap: 4px;
  margin-right: 8px;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.global-controls-measure {
  position: absolute;
  right: 0;
  top: 0;
  z-index: -1;
  margin: 0;
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

.measure-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.measure-icon {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
}

.global-controls :deep(.el-button > span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
}

.global-controls :deep(.el-button + .el-button) {
  margin-left: 0;
}

.global-privacy-btn,
.global-refresh-btn,
.global-feedback-btn,
.global-notice-btn,
.global-github-btn {
  color: rgba(255, 255, 255, 0.8);
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  height: 28px;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;

  &:deep(.el-icon) {
    width: 14px;
    height: 14px;
    margin: 0;
    flex: 0 0 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &:deep(.refresh-icon) {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.68);
    transition: all 0.3s ease;
  }

  &:deep(.feedback-icon) {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.68);
    transition: all 0.3s ease;
  }

  &:deep(.github-action-icon) {
    color: rgba(255, 255, 255, 0.78);
    transition: all 0.3s ease;
  }

  .notice-icon-wrap {
    position: relative;
    display: inline-flex;
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.68);
    transition: all 0.3s ease;
  }

  .notice-icon {
    width: 14px;
    height: 14px;
    display: block;
  }

  .notice-dot {
    position: absolute;
    right: -1px;
    top: -1px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fb7185;
    box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.9);
  }

  &:hover {
    background: rgba(255, 255, 255, 0.065);
    border-color: rgba(255, 255, 255, 0.075);
    color: rgba(255, 255, 255, 0.95);
    transform: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);

    &:deep(.refresh-icon) {
      color: #34d399;
      transform: rotate(180deg);
    }

    &:deep(.feedback-icon) {
      color: #93c5fd;
      transform: translateY(-1px);
    }

    .notice-icon-wrap {
      color: #fbbf24;
      transform: translateY(-1px);
    }

    &:deep(.github-action-icon) {
      color: #ffffff;
      transform: translateY(-1px);
    }
  }

  &:active {
    transform: translateY(0);
  }
}

.global-github-btn {
  width: 30px;
  padding: 0;
}

.global-privacy-btn {
  cursor: pointer;

  &:deep(.privacy-icon) {
    font-size: 14px;
    cursor: pointer;
  }

  &.el-button--info {
    &:deep(.privacy-icon) {
      color: rgba(255, 255, 255, 0.68);
    }

    &:hover {
      background: rgba(52, 211, 153, 0.075);
      border-color: rgba(52, 211, 153, 0.16);
      color: rgba(255, 255, 255, 0.95);

      &:deep(.privacy-icon) {
        color: #85ce61;
      }
    }
  }

  &.el-button--warning {
    color: #f6c56d;
    background: transparent;
    border-color: transparent;

    &:deep(.privacy-icon) {
      color: #e6a23c;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.065);
      border-color: rgba(255, 255, 255, 0.075);
      color: rgba(255, 255, 255, 0.95);

      &:deep(.privacy-icon) {
        color: #ebb563;
      }
    }
  }
}

.global-controls :deep(.privacy-text) {
  margin: 0;
  max-width: 66px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 15px;
  white-space: nowrap;
  cursor: pointer;
  opacity: 1;
  transition:
    max-width 0.22s ease,
    opacity 0.18s ease,
    margin 0.22s ease;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 1px;
  position: relative;
  margin-left: 4px;
  padding-left: 10px;
}

.window-controls::before {
  content: '';
  position: absolute;
  left: 1px;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: rgba(255, 255, 255, 0.075);
}

.custom-title-bar:not(.is-mac) {
  .title-bar-left {
    padding-left: 8px;
    gap: 4px;
  }

  .title-bar-right {
    grid-column: 3;
    gap: 6px;
  }

  .title-github-btn {
    width: 24px;
    height: 24px;
    flex-basis: 24px;
    border-radius: 8px;
  }

  .version-container {
    width: 54px;
    min-width: 54px;
    flex-basis: 54px;
    justify-content: flex-start;
    padding: 0 4px 0 2px;
  }

  .version-container.downloading,
  .version-container.downloaded {
    width: clamp(160px, 21vw, 214px);
    min-width: clamp(160px, 21vw, 214px);
    flex-basis: clamp(160px, 21vw, 214px);
    padding: 3px 7px 3px 8px;
  }

  .app-version {
    justify-content: flex-start;
    min-width: 0;
    font-size: 10.5px;
  }
}

.custom-title-bar.is-compact-actions {
  .global-controls {
    margin-right: 6px;
  }

  .global-privacy-btn,
  .global-refresh-btn,
  .global-feedback-btn,
  .global-notice-btn,
  .global-github-btn {
    width: 26px;
    padding: 0;

    &:hover {
      transform: none;
    }
  }

  .global-controls :deep(.privacy-text) {
    max-width: 0;
    margin-left: -4px;
    opacity: 0;
  }
}

@media (max-width: 1360px) {
  .custom-title-bar:not(.is-mac) {
    .title-bar-center {
      max-width: min(320px, 30vw);
    }
  }
}

@media (max-width: 980px) {
  .custom-title-bar:not(.is-mac) {
    .global-controls {
      margin-right: 6px;
    }

    .global-privacy-btn,
    .global-refresh-btn,
    .global-feedback-btn,
    .global-notice-btn,
    .global-github-btn {
      width: 26px;
      padding: 0;
    }

    .global-controls :deep(.privacy-text) {
      max-width: 0;
      margin-left: -4px;
      opacity: 0;
    }
  }
}

@media (max-width: 1160px) {
  .custom-title-bar.is-mac {
    .title-bar-center {
      max-width: min(300px, 30vw);
    }
  }
}

@media (max-width: 980px) {
  .custom-title-bar.is-mac {
    .global-controls {
      margin-right: 6px;
    }

    .global-privacy-btn,
    .global-refresh-btn,
    .global-feedback-btn,
    .global-notice-btn,
    .global-github-btn {
      width: 26px;
      padding: 0;
    }

    .global-controls :deep(.privacy-text) {
      max-width: 0;
      margin-left: -4px;
      opacity: 0;
    }
  }
}

@media (max-width: 1040px) {
  .custom-title-bar:not(.is-mac) {
    .title-bar-center {
      max-width: min(260px, 28vw);
    }
  }
}

.title-bar-button {
  width: 46px;
  height: 32px; /* 匹配新的标题栏高度 */
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 4px;
}

.title-bar-button:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.title-bar-button.close:hover {
  background-color: #ff5252;
  color: white;
}

.title-bar-button svg {
  opacity: 0.8;
}

.title-bar-button:hover svg {
  opacity: 1;
}

/* 版本号更新提示样式 */
.version-container {
  appearance: none;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  height: 20px;
  width: 66px;
  min-width: 66px;
  flex: 0 0 66px;
  position: relative;
  cursor: pointer;
  transition:
    background-color 0.18s var(--ds-ease-soft),
    border-color 0.18s var(--ds-ease-soft);
  padding: 0 6px;
  border-radius: 7px;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: var(--ds-text-secondary);
  font: inherit;
  overflow: hidden;
  box-shadow: none;
}

.version-container.downloading,
.version-container.downloaded {
  min-width: clamp(166px, 19vw, 222px);
  width: clamp(166px, 19vw, 222px);
  flex-basis: clamp(166px, 19vw, 222px);
  height: 26px;
  justify-content: flex-start;
  padding: 3px 8px 3px 9px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.032);
  border-color: rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.018);
}

.app-version-content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.app-version-content.checking {
  gap: 5px;
}

.version-container:hover {
  background: transparent;
  border-color: transparent;
}

.version-container.checking {
  background: transparent;
  border-color: transparent;
}

.version-container.has-update {
  border-color: transparent;
  background: transparent;
}

.version-container.downloading {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.07);
}

.version-container.downloaded {
  background: rgba(52, 211, 153, 0.055);
  border-color: rgba(52, 211, 153, 0.1);
}

.version-update-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  width: 100%;
  min-width: 0;
}

.version-update-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  width: 100%;
  min-width: 0;
}

.version-update-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.version-update-title {
  min-width: 0;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.84);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.version-update-actions {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 0 0 auto;
}

.version-update-detail {
  min-width: 0;
  max-width: 84px;
  font-size: 9px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.52);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.version-progress-track {
  width: 100%;
  min-width: 0;
}

.version-progress-track:deep(.progress-container) {
  gap: 0;
  width: 100%;
}

.version-progress-track:deep(.progress-bar) {
  height: 2px !important;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.version-progress-track:deep(.progress-fill) {
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(96, 165, 250, 0.94), rgba(45, 212, 191, 0.9)) !important;
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.1);
  transition: width 0.2s linear !important;
}

.version-progress-cancel {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.34);
  cursor: pointer;
  flex: 0 0 14px;
  transition:
    color 0.18s var(--ds-ease-soft),
    transform 0.18s var(--ds-ease-soft);
}

.version-progress-cancel:hover {
  color: rgba(255, 255, 255, 0.78);
  transform: scale(1.02);
}

.version-progress-cancel :deep(svg) {
  width: 9px;
  height: 9px;
}

.app-version {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  transition:
    color 0.18s var(--ds-ease-soft),
    text-shadow 0.18s var(--ds-ease-soft),
    opacity 0.18s var(--ds-ease-soft);
  letter-spacing: 0;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.app-version.has-update {
  color: var(--ds-state-success);
  text-shadow: 0 0 8px rgba(52, 211, 153, 0.32);
}

.app-version.checking {
  color: var(--ds-state-info);
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.32);
}

.checking-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  pointer-events: none;
  flex: 0 0 12px;
}

.inline-checking-indicator {
  width: 11px;
  height: 11px;
  flex-basis: 11px;
}

.checking-spinner {
  width: 9px;
  height: 9px;
  border: 1.5px solid rgba(96, 165, 250, 0.2);
  border-top: 1.5px solid var(--ds-state-info);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.update-dot {
  position: absolute;
  right: 6px;
  top: 50%;
  z-index: 1;
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg, var(--ds-state-success) 0%, #85ce61 100%);
  border-radius: 50%;
  margin-left: 0;
  transform: translateY(-50%);
  box-shadow:
    0 0 0 2px rgba(52, 211, 153, 0.3),
    0 0 6px rgba(52, 211, 153, 0.6);
  animation: pulse-dot 2s ease-in-out infinite;
}

/* 更新完成按钮样式 */
.update-ready {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.ready-btn {
  background: linear-gradient(90deg, #67c23a, #85ce61) !important;
  border-color: #67c23a !important;
  color: white !important;
  padding: 4px 12px !important;
  border-radius: 12px !important;
  font-size: 11px !important;
  height: 24px !important;
  animation: glow 2s ease-in-out infinite alternate;
}

.ready-btn:hover {
  background: linear-gradient(90deg, #85ce61, #67c23a) !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.4) !important;
}

/* 动画效果 */
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes glow {
  from {
    box-shadow: 0 0 10px rgba(103, 194, 58, 0.3);
  }
  to {
    box-shadow:
      0 0 20px rgba(103, 194, 58, 0.6),
      0 0 30px rgba(103, 194, 58, 0.4);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: translateY(-50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateY(-50%) scale(1.2);
    opacity: 0.8;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.version-progress-expand-enter-active,
.version-progress-expand-leave-active {
  transition:
    opacity 0.22s var(--ds-ease-soft),
    transform 0.22s var(--ds-ease-soft),
    max-width 0.22s var(--ds-ease-soft);
  transform-origin: left center;
  overflow: hidden;
}

.version-progress-expand-enter-from,
.version-progress-expand-leave-to {
  opacity: 0;
  transform: translateX(-8px) scaleX(0.96);
  max-width: 0;
}

.version-progress-expand-enter-to,
.version-progress-expand-leave-from {
  opacity: 1;
  transform: translateX(0) scaleX(1);
  max-width: 260px;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
