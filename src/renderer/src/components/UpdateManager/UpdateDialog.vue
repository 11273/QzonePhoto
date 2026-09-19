<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div v-if="dialogVisible" class="dialog-overlay" @click.self="handleOverlayClick">
        <section
          ref="dialogRef"
          class="update-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-dialog-title"
          aria-describedby="update-dialog-subtitle"
          tabindex="-1"
        >
          <header class="update-header">
            <div class="update-icon" :class="getIconClass()" aria-hidden="true">
              <svg
                v-if="updateState === 'checking'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v5h-5" />
              </svg>
              <svg
                v-else-if="updateState === 'available'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              <svg
                v-else-if="updateState === 'downloading'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m17 8-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
              <svg
                v-else-if="updateState === 'downloaded' || updateState === 'no-update'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9" />
                <path d="m15 9-6 6m0-6 6 6" />
              </svg>
            </div>

            <div class="header-copy">
              <h2 id="update-dialog-title" class="update-title">{{ getTitle() }}</h2>
              <p v-if="versionLabel" class="update-version">{{ versionLabel }}</p>
              <p id="update-dialog-subtitle" class="update-subtitle">{{ getSubtitle() }}</p>
            </div>

            <button
              v-if="canClose()"
              class="close-btn"
              type="button"
              aria-label="关闭更新窗口"
              title="关闭"
              @click="$emit('dismiss')"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <main class="update-content">
            <div v-if="updateState === 'checking'" class="status-copy">
              <span class="status-spinner" aria-hidden="true"></span>
              <p>正在确认是否有新版本</p>
            </div>

            <div v-else-if="updateState === 'available'" class="update-summary">
              <section
                v-if="updatePresentation.releaseNotes.hasNotes"
                class="release-notes-section"
                aria-label="更新说明"
              >
                <div
                  id="update-release-notes"
                  class="release-notes-scroll"
                  role="region"
                  tabindex="0"
                  aria-label="更新内容"
                >
                  <Markdown :content="updatePresentation.releaseNotes.content" />
                </div>
              </section>

              <p v-else class="update-reassurance">本次更新包含体验优化和问题修复。</p>
            </div>

            <div v-else-if="updateState === 'downloading'" class="download-panel">
              <div class="download-progress-heading">
                <span>{{ downloadStatusText }}</span>
                <strong>{{ downloadPercent }}%</strong>
              </div>
              <div
                class="progress-bar"
                role="progressbar"
                aria-label="更新下载进度"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="downloadPercent"
              >
                <div class="progress-fill" :style="{ width: downloadPercent + '%' }"></div>
              </div>
              <div class="download-stats">
                <span>{{ formattedDownloadSize }}</span>
                <span>{{ formattedDownloadSpeed }}</span>
                <span>{{ downloadRemainingText }}</span>
              </div>
            </div>

            <div v-else-if="updateState === 'downloaded'" class="status-copy success-copy">
              <span class="status-primary">重启应用后将自动完成安装。</span>
              <span>也可以选择稍后安装。</span>
            </div>

            <div v-else-if="updateState === 'no-update'" class="status-copy success-copy">
              <span class="status-primary">无需更新</span>
              <span>继续记录和整理你的空间回忆吧。</span>
            </div>

            <div v-else-if="updateState === 'error'" class="error-panel">
              <p>{{ errorPresentation.title }}</p>
              <span>{{ errorPresentation.detail }}</span>
              <span class="error-reassurance">{{ errorPresentation.reassurance }}</span>
            </div>
          </main>

          <footer v-if="showFooter()" class="update-footer">
            <div class="footer-actions">
              <template v-if="updateState === 'available'">
                <button class="btn btn-secondary" type="button" @click="$emit('dismiss')">
                  稍后再说
                </button>
                <button class="btn btn-primary" type="button" @click="$emit('download')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M12 15V3" />
                  </svg>
                  立即下载
                </button>
              </template>

              <template v-else-if="updateState === 'downloading'">
                <button class="btn btn-secondary" type="button" @click="$emit('cancel')">
                  取消下载
                </button>
                <button class="btn btn-primary" type="button" @click="$emit('backgroundDownload')">
                  转到后台
                </button>
              </template>

              <template v-else-if="updateState === 'downloaded'">
                <button class="btn btn-secondary" type="button" @click="$emit('dismiss')">
                  稍后安装
                </button>
                <button class="btn btn-primary" type="button" @click="$emit('install')">
                  立即重启更新
                </button>
              </template>

              <template v-else-if="updateState === 'error'">
                <div class="error-manual-actions">
                  <button
                    class="text-action"
                    type="button"
                    @click="openExternal(manualDownloadChoices.officialUrl)"
                  >
                    前往官网下载
                  </button>
                  <button
                    class="text-action"
                    type="button"
                    title="打开备用下载页面"
                    @click="openExternal(manualDownloadChoices.fallbackUrl)"
                  >
                    备用下载
                  </button>
                </div>
                <div class="error-footer-actions">
                  <button class="btn btn-secondary" type="button" @click="$emit('dismiss')">
                    关闭
                  </button>
                  <button
                    v-if="errorPresentation.canRetry"
                    class="btn btn-primary"
                    type="button"
                    @click="$emit('retry')"
                  >
                    {{ errorPresentation.retryLabel }}
                  </button>
                </div>
              </template>
            </div>
          </footer>
        </section>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { formatBytes } from '@renderer/utils/formatters'
import { APP_DOWNLOAD_PAGE, APP_HOMEPAGE } from '@shared/const'
import Markdown from '@renderer/components/Markdown/index.vue'
import {
  buildUpdatePresentation,
  getManualDownloadChoices,
  getUpdateErrorPresentation
} from './update-presentation'

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
      speed: 0,
      remainingTime: '',
      sourceHint: ''
    })
  },
  errorInfo: {
    type: Object,
    default: () => ({
      message: '',
      detail: '',
      canRetry: false
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

const dialogRef = ref(null)
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})
const updatePresentation = computed(() => buildUpdatePresentation(props.updateInfo))
const versionLabel = computed(() => updatePresentation.value.versionLabel)
const errorPresentation = computed(() => getUpdateErrorPresentation(props.errorInfo))
const manualDownloadChoices = computed(() =>
  getManualDownloadChoices({
    officialUrl: APP_DOWNLOAD_PAGE,
    fallbackUrl: APP_HOMEPAGE + '/releases/latest'
  })
)
const downloadPercent = computed(() => {
  const percent = Number(props.downloadProgress.percent)
  return Math.max(0, Math.min(100, Math.round((Number.isFinite(percent) ? percent : 0) * 10) / 10))
})
const downloadStatusText = computed(
  () => props.downloadProgress.sourceHint || '正在下载 ' + (props.updateInfo.version || '更新文件')
)
const formattedDownloadSize = computed(() => {
  const downloaded = Number(props.downloadProgress.downloaded)
  const total = Number(props.downloadProgress.total)
  if (downloaded > 0 || total > 0) {
    return (
      (Number.isFinite(downloaded) ? downloaded.toFixed(1) : '0.0') +
      ' MB / ' +
      (Number.isFinite(total) ? total.toFixed(1) : '0.0') +
      ' MB'
    )
  }
  return '正在准备下载'
})
const formattedDownloadSpeed = computed(() => {
  const speed = Number(props.downloadProgress.speed)
  return speed > 0 ? formatBytes(speed * 1024) + '/s' : '正在连接'
})
const downloadRemainingText = computed(() =>
  props.downloadProgress.remainingTime
    ? '预计还需 ' + props.downloadProgress.remainingTime
    : '正在计算剩余时间'
)

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

const getTitle = () => {
  const titles = {
    checking: '检查更新',
    available: '发现新版本',
    downloading: '正在下载更新',
    downloaded: '更新已准备好',
    'no-update': '已经是最新版本',
    error: '更新没有完成'
  }
  return titles[props.updateState] || '软件更新'
}

const getSubtitle = () => {
  const subtitles = {
    checking: '请稍候',
    available: updatePresentation.value.releaseDateLabel
      ? '发布于 ' + updatePresentation.value.releaseDateLabel
      : '新版本已准备好',
    downloading: '下载可在后台继续进行',
    downloaded: '新版本已下载到本机',
    'no-update': '你正在使用最新版本',
    error: '当前版本仍可正常使用'
  }
  return subtitles[props.updateState] || ''
}

const canClose = () => props.updateState !== 'downloading'
const showFooter = () =>
  ['available', 'downloading', 'downloaded', 'error'].includes(props.updateState)

const handleOverlayClick = () => {
  if (canClose()) emit('dismiss')
}

const fallbackCopyLink = (url) => {
  navigator.clipboard?.writeText(url).catch(() => {
    console.warn('无法复制下载链接:', url)
  })
}

const openExternal = (url) => {
  if (window.api?.invoke) {
    window.api.invoke('shell:openExternal', url).catch(() => fallbackCopyLink(url))
    return
  }
  fallbackCopyLink(url)
}

const handleEscape = (event) => {
  if (event.key === 'Escape' && props.visible && canClose()) emit('dismiss')
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      nextTick(() => dialogRef.value?.focus())
    }
  }
)

onMounted(() => window.addEventListener('keydown', handleEscape))
onUnmounted(() => window.removeEventListener('keydown', handleEscape))
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--ds-bg-overlay);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 180ms ease;
}

.dialog-fade-enter-active .update-container,
.dialog-fade-leave-active .update-container {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .update-container,
.dialog-fade-leave-to .update-container {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
}

.update-container {
  display: flex;
  flex-direction: column;
  width: min(496px, calc(100vw - 48px));
  max-height: min(600px, calc(100vh - 48px));
  overflow: hidden;
  color: var(--ds-text-primary);
  background: var(--ds-bg-1);
  border: 1px solid var(--ds-border-light);
  border-radius: 18px;
  box-shadow: var(--ds-shadow-xl);
  outline: none;
}

.update-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px 18px;
  border-bottom: 1px solid var(--ds-border-light);
}

.update-icon {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 48px;
  height: 48px;
  color: #fff;
  border-radius: 14px;
}

.update-icon svg {
  width: 26px;
  height: 26px;
}

.update-icon.icon-checking,
.update-icon.icon-available,
.update-icon.icon-downloading {
  background: linear-gradient(135deg, var(--ds-accent-blue), #67a7ff);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--ds-accent-blue) 24%, transparent);
}

.update-icon.icon-downloaded,
.update-icon.icon-latest {
  color: var(--ds-state-success);
  background: var(--ds-accent-green-soft);
}

.update-icon.icon-error {
  color: var(--ds-state-error);
  background: var(--ds-accent-red-soft);
}

.header-copy {
  flex: 1;
  min-width: 0;
}

.update-title,
.update-version,
.update-subtitle {
  margin: 0;
}

.update-title {
  color: var(--ds-text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.update-version {
  margin-top: 4px;
  color: var(--ds-accent-blue);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.35;
}

.update-subtitle {
  margin-top: 6px;
  color: var(--ds-text-tertiary);
  font-size: 13px;
  line-height: 1.45;
}

.close-btn {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--ds-text-tertiary);
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.close-btn:hover {
  color: var(--ds-text-primary);
  background: var(--ds-bg-3);
  border-color: var(--ds-border-light);
}

.update-content {
  display: flex;
  flex: 1;
  align-items: stretch;
  min-height: 152px;
  padding: 20px 22px;
  overflow: auto;
}

.update-summary,
.download-panel,
.error-panel,
.status-copy {
  width: 100%;
}

.update-summary {
  display: grid;
  align-content: start;
}

.download-progress-heading,
.download-stats,
.error-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.update-reassurance {
  margin: 0;
  color: var(--ds-text-tertiary);
  font-size: 13px;
  line-height: 1.55;
}

.release-notes-scroll {
  max-height: min(260px, calc(100dvh - 260px));
  padding: 4px 14px 12px;
  overflow: auto;
  overscroll-behavior: contain;
  background: color-mix(in srgb, var(--ds-bg-3) 72%, transparent);
  border: 1px solid var(--ds-border-light);
  border-radius: 12px;
  scrollbar-color: color-mix(in srgb, var(--ds-text-tertiary) 50%, transparent) transparent;
}

.release-notes-scroll :deep(.markdown-content) {
  color: var(--ds-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.release-notes-scroll :deep(.markdown-content h3) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
  margin: 10px 0 7px;
  color: var(--ds-text-primary);
  font-size: 13px;
  font-weight: 700;
  background: color-mix(in srgb, var(--ds-bg-2) 72%, transparent);
  border: 1px solid var(--ds-border-light);
  border-radius: 9px;
}

.release-notes-scroll :deep(.markdown-content h3::before) {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
  content: '';
  background-color: color-mix(in srgb, var(--ds-accent-blue) 16%, transparent);
  background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2367a7ff' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m12 3-1.7 5.3L5 10l5.3 1.7L12 17l1.7-5.3L19 10l-5.3-1.7L12 3Z'/%3E%3Cpath d='m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15Z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  border: 1px solid color-mix(in srgb, var(--ds-accent-blue) 30%, transparent);
  border-radius: 5px;
}

.release-notes-scroll :deep(.markdown-content h3:nth-of-type(2)::before) {
  background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%234bd7a5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='m20 6-11 11-5-5'/%3E%3C/svg%3E");
  background-color: color-mix(in srgb, var(--ds-state-success) 14%, transparent);
  border-color: color-mix(in srgb, var(--ds-state-success) 28%, transparent);
}

.release-notes-scroll :deep(.markdown-content h3:nth-of-type(3)::before) {
  background-image: url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23b093ff' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 3v18M5 10l7-7 7 7M5 21h14'/%3E%3C/svg%3E");
  background-color: rgba(176, 147, 255, 0.13);
  border-color: rgba(176, 147, 255, 0.3);
}

.release-notes-scroll :deep(.markdown-content p),
.release-notes-scroll :deep(.markdown-content ul),
.release-notes-scroll :deep(.markdown-content ol) {
  margin: 7px 0;
}

.release-notes-scroll :deep(.markdown-content ul),
.release-notes-scroll :deep(.markdown-content ol) {
  padding-left: 22px;
}

.release-notes-scroll :deep(.markdown-content li) {
  padding-left: 2px;
  margin: 6px 0;
}

.release-notes-scroll :deep(.markdown-content li::marker) {
  color: var(--ds-accent-blue);
}

.release-notes-scroll::-webkit-scrollbar {
  width: 6px;
}

.release-notes-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.release-notes-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--ds-text-tertiary) 48%, transparent);
  border-radius: 999px;
}

.status-copy {
  display: grid;
  align-self: center;
  justify-items: center;
  gap: 9px;
  color: var(--ds-text-secondary);
  text-align: center;
}

.status-copy p,
.error-panel p {
  margin: 0;
  color: var(--ds-text-primary);
  font-size: 16px;
  font-weight: 650;
}

.status-copy span,
.error-panel span {
  color: var(--ds-text-tertiary);
  font-size: 13px;
  line-height: 1.55;
}

.status-copy .status-primary {
  color: var(--ds-text-primary);
  font-size: 15px;
  font-weight: 650;
}

.status-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid color-mix(in srgb, var(--ds-accent-blue) 25%, transparent);
  border-top-color: var(--ds-accent-blue);
  border-radius: 50%;
  animation: update-spin 800ms linear infinite;
}

.success-copy {
  min-height: 96px;
  align-content: center;
}

.download-panel {
  display: grid;
  align-self: center;
  gap: 12px;
}

.download-progress-heading {
  color: var(--ds-text-secondary);
  font-size: 14px;
}

.download-progress-heading strong {
  color: var(--ds-text-primary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  height: 10px;
  overflow: hidden;
  background: var(--ds-bg-3);
  border-radius: 999px;
}

.progress-fill {
  height: 100%;
  min-width: 2px;
  background: linear-gradient(90deg, var(--ds-accent-blue), #70adff);
  border-radius: inherit;
  transition: width 180ms ease;
}

.download-stats {
  color: var(--ds-text-tertiary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.error-panel {
  display: grid;
  align-self: center;
  justify-items: center;
  gap: 9px;
  text-align: center;
}

.error-panel p {
  color: var(--ds-state-error);
}

.error-reassurance {
  max-width: 320px;
}

.update-footer {
  padding: 14px 22px 16px;
  border-top: 1px solid var(--ds-border-light);
}

.footer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 19px;
  color: var(--ds-text-primary);
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  background: var(--ds-bg-3);
  border: 1px solid var(--ds-border-light);
  border-radius: 10px;
  transition:
    transform 160ms ease,
    background 160ms ease,
    border-color 160ms ease;
}

.btn svg {
  width: 17px;
  height: 17px;
}

.btn-primary {
  color: #fff;
  background: var(--qz-action, #c2410c);
  border-color: var(--qz-action, #c2410c);
  box-shadow: 0 6px 16px rgba(194, 65, 12, 0.24);
}

.btn:hover {
  transform: translateY(-1px);
  background: var(--ds-bg-hover);
}

.btn-primary:hover {
  background: var(--qz-action-hover, #ea580c);
  border-color: var(--qz-active, #fb923c);
}

.btn:active {
  transform: translateY(0);
}

.btn:focus-visible,
.close-btn:focus-visible,
.text-action:focus-visible,
.release-notes-scroll:focus-visible {
  outline: 2px solid var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
  outline-offset: 2px;
}

.error-manual-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 22px;
  margin-bottom: 6px;
}

.error-footer-actions {
  width: 100%;
  justify-content: flex-end;
}

.text-action {
  padding: 0;
  color: var(--ds-accent-blue);
  font-size: 13px;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.text-action:hover {
  text-decoration: underline;
}

@keyframes update-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active,
  .dialog-fade-leave-active,
  .dialog-fade-enter-active .update-container,
  .dialog-fade-leave-active .update-container,
  .progress-fill,
  .btn,
  .close-btn {
    transition: none;
  }

  .status-spinner {
    animation: none;
  }
}

@media (max-width: 520px) {
  .dialog-overlay {
    padding: 16px;
  }

  .update-container {
    width: min(100%, calc(100vw - 32px));
  }

  .update-header,
  .update-content,
  .update-footer {
    padding-right: 18px;
    padding-left: 18px;
  }

  .download-stats {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .footer-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .error-manual-actions {
    justify-content: center;
  }

  .error-footer-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
