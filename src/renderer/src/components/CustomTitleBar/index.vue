<template>
  <div class="custom-title-bar drag-region" :class="{ 'is-mac': isMac }">
    <!-- 左侧工具区域 -->
    <div class="title-bar-left">
      <!-- Mac系统留出红绿灯按钮的空间 -->
      <div v-if="isMac" class="mac-traffic-lights-space"></div>

      <!-- Windows/Linux系统：GitHub图标 -->
      <template v-if="!isMac">
        <div v-if="appHomepage" class="github-icon">
          <el-button
            text
            size="small"
            class="github-btn no-drag"
            title="GitHub 项目"
            @click="openGitHub"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
              />
            </svg>
          </el-button>
        </div>
      </template>
    </div>

    <!-- 中间标题区域 -->
    <div class="title-bar-center">
      <div class="title-content">
        <div class="app-logo">
          <Icon icon="qzone" size="large" color="#F15A24" />
        </div>
        <span v-if="appDescription" class="app-title">{{ appDescription }}</span>
        <div v-if="appVersion" class="version-container no-drag" @click="handleVersionClick(false)">
          <span
            class="app-version"
            :class="{
              'has-update': showUpdateBadge,
              checking: updateState.checking
            }"
            :title="getVersionTooltip()"
          >
            {{ appVersion }}
          </span>
          <!-- 检查更新状态指示器 -->
          <transition name="fade">
            <div v-if="updateState.checking" class="checking-indicator" title="正在检查更新...">
              <div class="checking-spinner"></div>
            </div>
          </transition>
          <!-- 新版本提示点 -->
          <transition name="fade">
            <div v-if="showUpdateBadge" class="update-dot" title="发现新版本，点击查看详情"></div>
          </transition>
        </div>
      </div>
    </div>

    <!-- 右侧区域 -->
    <div class="title-bar-right">
      <!-- 下载进度条区域 (仅在对话框关闭时显示) -->
      <transition name="fade">
        <div v-if="updateState.downloading && !dialogVisible" class="download-progress no-drag">
          <ProgressBar
            :percentage="updateState.progress"
            :transferred="updateState.transferred"
            :total="updateState.total"
            :speed="updateState.bytesPerSecond"
            size="small"
            variant="compact"
            :show-text="false"
          />
          <span class="progress-text">{{ progressText }}</span>
          <el-button
            v-if="updateState.canCancel"
            text
            size="small"
            class="cancel-btn"
            @click="cancelUpdate"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </transition>

      <!-- 更新完成提示 -->
      <transition name="fade">
        <div v-if="updateState.downloaded && !updateState.downloading" class="update-ready no-drag">
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

      <!-- GitHub 图标 (Mac系统) -->
      <div v-if="isMac && appHomepage" class="github-icon">
        <el-button
          text
          size="small"
          class="github-btn no-drag"
          title="GitHub 项目"
          @click="openGitHub"
        >
          <Icon icon="github" size="medium" />
        </el-button>
      </div>

      <!-- Windows/Linux窗口控制按钮 -->
      <div v-if="!isMac" class="window-controls">
        <button class="title-bar-button minimize no-drag" title="最小化" @click="minimizeWindow">
          <el-icon><SemiSelect /></el-icon>
        </button>

        <button
          class="title-bar-button maximize no-drag"
          :title="isMaximized ? '还原' : '最大化'"
          @click="maximizeWindow"
        >
          <el-icon v-if="isMaximized"><ArrowDownBold /></el-icon>
          <el-icon v-else><ArrowUpBold /></el-icon>
        </button>

        <button class="title-bar-button close no-drag" title="关闭" @click="closeWindow">
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  Close,
  CircleCheck,
  CloseBold,
  SemiSelect,
  ArrowDownBold,
  ArrowUpBold
} from '@element-plus/icons-vue'
import { isMac as isMacPlatform } from '@renderer/utils/platform'
import { IPC_APP, IPC_SHELL, IPC_WINDOW } from '@shared/ipc-channels'
import UpdateDialog from '@renderer/components/UpdateManager/UpdateDialog.vue'
import Icon from '@renderer/components/Icon/index.vue'
import ProgressBar from '@renderer/components/ProgressBar/index.vue'
import { formatBytes } from '@renderer/utils/formatters'

// 简单的版本号格式化函数
const formatVersion = (version) => {
  if (!version) return ''
  return version.startsWith('v') ? version : `v${version}`
}

// 应用状态
const isMac = ref(isMacPlatform())
const appVersion = ref('')
const appHomepage = ref('')
const appDescription = ref('')
// 窗口状态
const isMaximized = ref(false)

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

// 启动时检查更新
onMounted(() => {
  handleVersionClick(true)
})

// 计算属性
const showUpdateBadge = computed(() => {
  return updateState.hasUpdate && !updateState.downloading && !updateState.downloaded
})

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

// 版本号提示文本
const getVersionTooltip = () => {
  if (updateState.checking) {
    return '正在检查更新...'
  } else if (updateState.hasUpdate) {
    return '发现新版本，点击查看详情'
  } else {
    return '点击检查更新'
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
    if (!background) {
      showUpdateDialog()
    }
  } else if (updateState.checking) {
    // 正在检查中，如果不是后台模式，显示对话框
    if (!background) {
      showUpdateDialog()
    }
  } else {
    // 手动检查更新
    if (window.QzoneAPI?.update) {
      try {
        console.log(background ? '后台检查更新...' : '手动检查更新...')
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
  dialogState.value = 'checking'
}

const handleUpdateAvailable = (info) => {
  updateState.checking = false
  updateState.hasUpdate = true
  updateInfo.value = info
  dialogState.value = 'available'

  // 自动弹出更新对话框
  dialogVisible.value = true

  console.log('发现新版本:', info)
}

const handleUpdateNotAvailable = () => {
  updateState.checking = false
  updateState.hasUpdate = false

  // 如果对话框是打开的，显示无更新状态
  if (dialogVisible.value) {
    dialogState.value = 'no-update'

    // 2秒后自动关闭对话框
    setTimeout(() => {
      if (dialogState.value === 'no-update') {
        dialogVisible.value = false
        dialogState.value = 'idle'
      }
    }, 2000)
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
  updateState.progress = 0
  dialogState.value = 'error'
  errorInfo.value = {
    message: error.message || '更新过程中发生错误',
    canRetry: true
  }
  console.error('更新错误:', error)
}

// 获取应用信息
const loadAppInfo = async () => {
  try {
    const appInfo = await window.api.invoke(IPC_APP.GET_INFO)
    console.log('appInfo', appInfo)
    if (appInfo) {
      if (appInfo.description) {
        appDescription.value = appInfo.description
      }
      if (appInfo.version) {
        appVersion.value = formatVersion(appInfo.version)
      }
      if (typeof appInfo.isMac === 'boolean') {
        isMac.value = appInfo.isMac
      }
      if (appInfo.homepage) {
        appHomepage.value = appInfo.homepage
      }
    }
  } catch (error) {
    console.warn('获取应用信息失败:', error)
    // 不设置任何默认值，让组件根据数据的存在与否决定是否显示
  }
}

// 清理监听器
let removeListeners = []

onMounted(async () => {
  // 获取应用信息
  await loadAppInfo()
  // 获取初始窗口状态
  try {
    isMaximized.value = await window.api.invoke(IPC_WINDOW.IS_MAXIMIZED)
  } catch (error) {
    console.warn('获取窗口状态失败:', error)
  }
  // 监听窗口状态变化
  removeListeners.push(window.api.on(IPC_WINDOW.MAXIMIZED, handleWindowMaximized))
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
  // 移除所有监听器
  removeListeners.forEach((remove) => remove && remove())

  // 移除更新相关监听器
  if (window.QzoneAPI?.update) {
    window.QzoneAPI.update.removeAllListeners()
  }
})
</script>

<style scoped>
.custom-title-bar {
  display: flex;
  align-items: center;
  height: 36px; /* 调整为适中的高度，既美观又不影响内容显示 */
  color: #ffffff;
  font-size: 13px;
  user-select: none;
  position: relative;
  flex-shrink: 0; /* 防止标题栏被压缩 */
}

.drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}

/* 左侧区域 */
.title-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 12px;
  width: 200px;
  flex-shrink: 0;
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

.app-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f15a24;
  filter: drop-shadow(0 2px 4px rgba(241, 90, 36, 0.3));
}

/* 中间区域 - 完全居中 */
.title-bar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  position: relative;
}

.title-content {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.app-title {
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* 下载进度条 */
.download-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0px 6px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.progress-text {
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  font-size: 10px;
  font-weight: 500;
}

/* 右侧区域 */
.title-bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 200px;
  flex-shrink: 0;
  justify-content: flex-end;
}

.github-icon {
  display: flex;
  align-items: center;
}

.github-btn {
  color: rgba(255, 255, 255, 0.8) !important;
  padding: 6px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px; /* 固定高度避免跳动 */
  border-radius: 6px;
  transition: all 0.2s ease;
}

.github-btn:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #ffffff !important;
  transform: translateY(-1px);
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 1px;
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

/* 深色主题优化 */
@media (prefers-color-scheme: dark) {
  .custom-title-bar {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .app-title {
    color: #f7fafc;
  }

  .version-container {
    background: rgba(255, 255, 255, 0.02);
  }

  .version-container:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .app-version {
    color: rgba(247, 250, 252, 0.9);
  }

  .app-version.has-update {
    color: #85ce61;
    text-shadow: 0 0 8px rgba(133, 206, 97, 0.5);
  }

  .app-version.checking {
    color: #79bbff;
    text-shadow: 0 0 8px rgba(121, 187, 255, 0.5);
  }

  .progress-bar {
    background: rgba(255, 255, 255, 0.1);
  }

  .progress-text {
    color: rgba(255, 255, 255, 0.7);
  }

  .github-btn {
    color: rgba(247, 250, 252, 0.8) !important;
  }

  .github-btn:hover {
    background-color: rgba(255, 255, 255, 0.08) !important;
  }

  .title-bar-button {
    color: rgba(247, 250, 252, 0.7);
  }

  .title-bar-button:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: #f7fafc;
  }
}

/* 版本号更新提示样式 */
.version-container {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 4px 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
}

.version-container:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.app-version {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.3px;
}

.app-version.has-update {
  color: #67c23a;
  text-shadow: 0 0 8px rgba(103, 194, 58, 0.4);
}

.app-version.checking {
  color: #409eff;
  text-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}

.checking-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 2px;
}

.checking-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(64, 158, 255, 0.2);
  border-top: 1.5px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.update-dot {
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  border-radius: 50%;
  margin-left: 2px;
  box-shadow:
    0 0 0 2px rgba(103, 194, 58, 0.3),
    0 0 6px rgba(103, 194, 58, 0.6);
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
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
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
