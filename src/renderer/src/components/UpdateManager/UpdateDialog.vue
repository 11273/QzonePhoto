<template>
  <!-- 自定义弹窗遮罩 -->
  <teleport to="body">
    <transition name="dialog-fade">
      <div v-if="dialogVisible" class="dialog-overlay" @click.self="handleOverlayClick">
        <div class="update-container">
          <!-- 头部区域 -->
          <div class="update-header">
            <div class="header-left">
              <div class="update-icon" :class="getIconClass()">
                <div class="icon-content">
                  <svg
                    v-if="updateState === 'checking'"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M21 12c0 1-.9 2-2 2h-3.5c-.5 0-.5-.5-.5-.5s0-.5.5-.5H19c.6 0 1-.4 1-1 0-5-4-9-9-9s-9 4-9 9c0 .6.4 1 1 1h3.5c.5 0 .5.5.5.5s0 .5-.5.5H2c-1.1 0-2-1-2-2C0 5.4 5.4 0 12 0s12 5.4 12 12z"
                    />
                  </svg>
                  <svg
                    v-else-if="updateState === 'available'"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7,10 12,15 17,10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <svg
                    v-else-if="updateState === 'downloading'"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17,8 12,3 7,8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <svg
                    v-else-if="updateState === 'downloaded'"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22,4 12,14.01 9,11.01" />
                  </svg>
                  <svg
                    v-else-if="updateState === 'no-update'"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                  <svg
                    v-else-if="updateState === 'error'"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              </div>
            </div>
            <div class="header-right">
              <div class="update-title">
                {{ getTitle() }}
                <span class="version-info-current">{{ updateInfo.currentVersion }}</span>
                <span v-if="updateState === 'available'" class="version-info-new">
                  <el-icon><Right /></el-icon> {{ updateInfo.version }}
                </span>
              </div>
              <div class="update-subtitle">{{ getSubtitle() }}</div>
            </div>
            <div v-if="canClose()" class="close-btn" @click="$emit('dismiss')">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>

          <!-- 内容区域 -->
          <div class="update-content">
            <!-- 更新检查中 -->
            <div v-if="updateState === 'checking'" class="content-checking">
              <div class="checking-animation">
                <div class="pulse-ring"></div>
                <div class="pulse-ring delay-1"></div>
                <div class="pulse-ring delay-2"></div>
              </div>
              <p class="checking-text">正在检查更新...</p>
            </div>

            <!-- 发现更新 -->
            <div v-if="updateState === 'available'" class="content-available">
              <!-- <div class="version-info">
                <div class="new-version">{{ updateInfo.version }}</div>
                <div class="version-label">新版本可用</div>
              </div> -->
              <div v-if="updateInfo.releaseNotes" class="release-notes">
                <Markdown :content="updateInfo.releaseNotes" />
              </div>
            </div>

            <!-- 下载进度 -->
            <div v-if="updateState === 'downloading'" class="content-downloading">
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: downloadProgress.percent + '%' }">
                    <div class="progress-shine"></div>
                  </div>
                </div>
                <div class="progress-text">{{ downloadProgress.percent }}%</div>
              </div>
              <div class="download-stats">
                <span>{{ getFormattedSize() }}</span>
                <span>{{ getFormattedSpeed() }}</span>
              </div>
            </div>

            <!-- 更新已下载 -->
            <div v-if="updateState === 'downloaded'" class="content-downloaded">
              <div class="ready-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22,4 12,14.01 9,11.01"></polyline>
                </svg>
              </div>
              <p class="ready-text">新版本已准备就绪，是否立即安装？</p>
            </div>

            <!-- 暂无更新 -->
            <div v-if="updateState === 'no-update'" class="content-available">
              <!-- <div class="latest-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"
                  ></path>
                  <polyline points="9,11 12,14 15,11"></polyline>
                  <line x1="12" y1="2" x2="12" y2="14"></line>
                </svg>
              </div>
              <p class="latest-text">您正在使用最新版本 🎉</p> -->
              <div v-if="updateInfo.releaseNotes" class="release-notes">
                <Markdown :content="updateInfo.releaseNotes" />
              </div>
            </div>

            <!-- 更新错误 -->
            <div v-if="updateState === 'error'" class="content-error">
              <div class="error-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <p class="error-message">{{ errorInfo.message }}</p>
            </div>
          </div>

          <!-- 底部操作区域 -->
          <div v-if="showFooter()" class="update-footer">
            <div class="footer-actions">
              <!-- 发现更新 -->
              <template v-if="updateState === 'available'">
                <button class="btn btn-primary" @click="$emit('download')">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7,10 12,15 17,10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  立即下载
                </button>
                <button class="btn btn-secondary" @click="$emit('dismiss')">稍后再说</button>
              </template>

              <!-- 下载中 -->
              <template v-if="updateState === 'downloading'">
                <button class="btn btn-danger" @click="$emit('cancel')">取消下载</button>
                <button class="btn btn-secondary" @click="$emit('backgroundDownload')">
                  后台下载
                </button>
              </template>

              <!-- 下载完成 -->
              <template v-if="updateState === 'downloaded'">
                <button class="btn btn-primary" @click="$emit('install')">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="23,4 23,10 17,10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                  立即重启
                </button>
                <button class="btn btn-secondary" @click="$emit('dismiss')">稍后安装</button>
              </template>

              <!-- 错误状态 -->
              <template v-if="updateState === 'error'">
                <button v-if="errorInfo.canRetry" class="btn btn-primary" @click="$emit('retry')">
                  重试
                </button>
                <button class="btn btn-secondary" @click="openDownloadPage">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  手动下载
                </button>
                <button class="btn btn-secondary" @click="$emit('dismiss')">关闭</button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { formatBytes } from '@renderer/utils/formatters'
import { APP_HOMEPAGE } from '@shared/const'
import { computed } from 'vue'
import Markdown from '@renderer/components/Markdown/index.vue'
import { Right } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  updateState: {
    type: String,
    default: 'idle'
  },
  updateInfo: {
    type: Object,
    default: () => ({})
  },
  downloadProgress: {
    type: Object,
    default: () => ({
      percent: 0,
      downloaded: 0,
      total: 0,
      speed: 0
    })
  },
  errorInfo: {
    type: Object,
    default: () => ({
      message: '',
      canRetry: false,
      retryCount: 0
    })
  }
})

const emit = defineEmits([
  'update:visible',
  'download',
  'install',
  'cancel',
  'retry',
  'dismiss',
  'backgroundDownload'
])

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 获取图标类名
const getIconClass = () => {
  const classes = {
    checking: 'icon-checking',
    available: 'icon-available',
    downloading: 'icon-downloading',
    downloaded: 'icon-downloaded',
    'no-update': 'icon-latest',
    error: 'icon-error'
  }
  return classes[props.updateState] || 'icon-default'
}

// 获取标题
const getTitle = () => {
  const titles = {
    checking: '检查更新',
    available: '发现新版本',
    downloading: '正在下载',
    downloaded: '准备安装',
    'no-update': '已是最新',
    error: '更新失败'
  }
  return titles[props.updateState] || '软件更新'
}

// 获取副标题
const getSubtitle = () => {
  const subtitles = {
    checking: '正在检查是否有新版本...',
    // available: `${props.updateInfo.version} 现已可用，发布于 ${new Date(props.updateInfo.releaseDate).toLocaleString('zh-CN')}`,
    available: `发布于 ${new Date(props.updateInfo.releaseDate).toLocaleString('zh-CN')}`,
    downloading: '正在下载更新文件...',
    downloaded: '更新已下载完成',
    'no-update': '您正在使用最新版本',
    error: getErrorSubtitle()
  }
  return subtitles[props.updateState] || ''
}

// 获取错误副标题
const getErrorSubtitle = () => {
  const message = props.errorInfo.message || ''
  if (message.includes('network') || message.includes('网络')) {
    return '网络连接失败，请检查网络后重试'
  } else if (message.includes('download') || message.includes('下载')) {
    return '下载失败，您可以手动下载安装'
  } else if (message.includes('install') || message.includes('安装')) {
    return '安装失败，请尝试手动下载安装'
  }
  return '更新过程中发生错误'
}

// 是否可以关闭
const canClose = () => {
  return props.updateState !== 'downloading'
}

// 是否显示底部
const showFooter = () => {
  return ['available', 'downloading', 'downloaded', 'error'].includes(props.updateState)
}

// 遮罩点击处理
const handleOverlayClick = () => {
  if (canClose()) {
    emit('dismiss')
  }
}

// 打开下载页面
const openDownloadPage = () => {
  // 获取GitHub releases页面链接
  const downloadUrl = APP_HOMEPAGE

  // 通过主进程打开外部链接
  if (window.api && window.api.invoke) {
    window.api.invoke('shell:openExternal', downloadUrl).catch((error) => {
      console.error('打开下载页面失败:', error)
      // 降级方案：复制链接到剪贴板
      fallbackCopyLink(downloadUrl)
    })
  } else {
    // 降级方案
    fallbackCopyLink(downloadUrl)
  }

  console.log('正在打开下载页面:', downloadUrl)
}

// 降级方案：复制链接到剪贴板
const fallbackCopyLink = (url) => {
  try {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        console.log('下载链接已复制到剪贴板:', url)
        // 可以添加提示消息
      })
      .catch(() => {
        console.warn('无法复制链接，请手动访问:', url)
      })
  } catch {
    console.warn('无法复制链接，请手动访问:', url)
  }
}

// 格式化文件大小显示
const getFormattedSize = () => {
  const progress = props.downloadProgress

  return `${progress.downloaded}MB / ${progress.total}MB`
}

// 格式化下载速度显示
const getFormattedSpeed = () => {
  const progress = props.downloadProgress

  return `${formatBytes(progress.speed * 1024)}/s`
}
</script>

<style scoped>
/* 弹窗遮罩层 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* 弹窗过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.dialog-fade-enter-active .update-container,
.dialog-fade-leave-active .update-container {
  transition: all 0.3s ease;
}

.dialog-fade-enter-from .update-container,
.dialog-fade-leave-to .update-container {
  transform: scale(0.9);
  opacity: 0;
}

/* 更新容器 */
.update-container {
  background: linear-gradient(
    135deg,
    rgba(26, 26, 26, 0.95) 0%,
    rgba(45, 45, 45, 0.95) 50%,
    rgba(26, 26, 26, 0.95) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
}

/* 头部区域 */
.update-header {
  display: flex;
  align-items: center;
  padding: 24px 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.header-left {
  margin-right: 16px;
  flex-shrink: 0;
}

.update-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.update-icon.icon-checking {
  background: linear-gradient(135deg, #409eff 0%, #66b3ff 100%);
  animation: pulse-icon 2s ease-in-out infinite;
}

.update-icon.icon-available {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  animation: glow-green 2s ease-in-out infinite alternate;
}

.update-icon.icon-downloading {
  background: linear-gradient(135deg, #e6a23c 0%, #f7ba2a 100%);
  animation: pulse-icon 1.5s ease-in-out infinite;
}

.update-icon.icon-downloaded {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  animation: success-pulse 1s ease-out;
}

.update-icon.icon-latest {
  background: linear-gradient(135deg, #909399 0%, #b4bccc 100%);
}

.update-icon.icon-error {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
  animation: error-shake 0.5s ease-in-out;
}

.icon-content {
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-right {
  flex: 1;
  min-width: 0;
}

.update-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.version-info-current {
  color: #909399;
  font-weight: 600;
  text-shadow: 0 0 10px rgba(144, 147, 153, 0.3);
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.version-info-new {
  color: #67c23a;
  font-weight: 600;
  text-shadow: 0 0 10px rgba(103, 194, 58, 0.3);
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.update-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.05);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  transform: scale(1.05);
}

/* 内容区域 */
.update-content {
  padding: 24px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 检查状态 */
.content-checking {
  text-align: center;
}

.checking-animation {
  position: relative;
  width: 60px;
  height: 60px;
  margin: 0 auto 20px;
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border: 2px solid #409eff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: pulse-ring 2s ease-out infinite;
}

.pulse-ring.delay-1 {
  animation-delay: 0.5s;
}

.pulse-ring.delay-2 {
  animation-delay: 1s;
}

.checking-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
}

/* 发现更新 */
.content-available {
  text-align: center;
  width: 100%;
}

.new-version {
  font-size: 24px;
  font-weight: 700;
  color: #67c23a;
  margin-bottom: 4px;
  text-shadow: 0 0 10px rgba(103, 194, 58, 0.3);
}

.version-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.update-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.release-notes {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  max-height: 250px;
  overflow-y: auto;
  text-align: left;
}

/* 下载进度 */
.content-downloading {
  width: 100%;
  text-align: center;
}

.progress-container {
  position: relative;
  margin-bottom: 16px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #e6a23c 0%, #f7ba2a 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.progress-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shine 2s ease-in-out infinite;
}

.progress-text {
  position: absolute;
  top: -24px;
  right: 0;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.download-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 下载完成 */
.content-downloaded {
  text-align: center;
}

.ready-icon {
  color: #67c23a;
  margin-bottom: 16px;
  animation: success-bounce 0.8s ease-out;
}

.ready-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin: 0;
}

/* 无更新 */
.content-no-update {
  text-align: center;
}

.latest-icon {
  color: #909399;
  margin-bottom: 16px;
  opacity: 0.8;
}

.latest-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin: 0;
}

/* 错误状态 */
.content-error {
  text-align: center;
}

.error-icon {
  color: #f56c6c;
  margin-bottom: 16px;
  animation: error-pulse 0.6s ease-out;
}

.error-message {
  color: #f56c6c;
  font-size: 14px;
  margin: 0;
  line-height: 1.4;
}

/* 底部操作区域 */
.update-footer {
  padding: 20px 24px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.1);
}

.footer-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* 按钮样式 */
.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  min-width: 100px;
  justify-content: center;
}

.btn-primary {
  background: linear-gradient(135deg, #409eff 0%, #66b3ff 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  background: linear-gradient(135deg, #66b3ff 0%, #409eff 100%);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

.btn-danger {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.3);
}

.btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
  background: linear-gradient(135deg, #f78989 0%, #f56c6c 100%);
}

/* 动画效果 */
@keyframes pulse-icon {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes glow-green {
  from {
    box-shadow: 0 0 10px rgba(103, 194, 58, 0.3);
  }
  to {
    box-shadow: 0 0 20px rgba(103, 194, 58, 0.6);
  }
}

@keyframes success-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes error-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

@keyframes pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
  }
}

@keyframes shine {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

@keyframes success-bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

@keyframes error-pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .update-container {
    margin: 20px;
    border-radius: 12px;
  }

  .update-header {
    padding: 20px 20px 16px;
  }

  .update-content {
    padding: 20px;
  }

  .update-footer {
    padding: 16px 20px 20px;
  }

  .footer-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
