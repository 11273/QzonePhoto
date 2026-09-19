<template>
  <div class="video-module">
    <!-- 顶部标题栏 -->
    <div class="module-header">
      <div class="header-content">
        <div class="title-section">
          <h2 class="module-title">{{ isFriendContext ? '好友视频' : '我的视频' }}</h2>
          <span v-if="videoSummary" class="video-summary">{{ videoSummary }}</span>
        </div>
        <div class="header-actions">
          <el-button
            v-if="displayVideos.length > 0"
            text
            class="download-btn qz-primary-action"
            :loading="downloadingAll"
            :disabled="loading || downloadingAll"
            @click="downloadAllVideos"
          >
            <Download :size="14" />
            <span>{{ downloadingAll ? '加入下载…' : `下载全部 ${displayVideos.length}` }}</span>
          </el-button>
          <el-button
            text
            :icon="Refresh"
            :loading="loading && videos.length === 0"
            :disabled="loading"
            class="refresh-btn"
            @click="handleRefresh"
          >
            刷新
          </el-button>
        </div>
      </div>
    </div>

    <!-- 视频内容区 -->
    <div class="module-content">
      <el-scrollbar ref="scrollbarRef" class="video-scrollbar" @scroll="handleScroll">
        <div class="video-container">
          <!-- 加载状态 -->
          <LoadingState v-if="loading && videos.length === 0" text="正在加载视频..." />

          <!-- 空状态 -->
          <EmptyState
            v-else-if="videos.length === 0 && !loading"
            :icon="videoPlaceholderIcon"
            :title="videoPlaceholderState.title"
            :description="videoPlaceholderState.description"
            :semantic-role="loadFailureState ? 'alert' : 'status'"
            :aria-live="loadFailureState ? 'assertive' : 'polite'"
          >
            <el-button
              v-if="videoPlaceholderState.retryable"
              type="primary"
              plain
              @click="handleRefresh"
            >
              重新加载
            </el-button>
          </EmptyState>

          <!-- 视频列表 -->
          <div v-else class="video-list">
            <button
              v-for="video in displayVideos"
              :key="videoKey(video)"
              type="button"
              class="video-card"
              :class="{ 'privacy-mode': privacyStore.privacyMode }"
              :aria-label="`播放视频${videoCardTitle(video) ? `：${videoCardTitle(video)}` : ''}`"
              @mouseenter="scheduleHoverPreview(video)"
              @mouseleave="stopHoverPreview(video)"
              @click="handleVideoClick(video)"
            >
              <!-- 封面：占整张卡片 -->
              <div
                class="video-cover"
                :class="{
                  'is-previewing': hoverPreviewKey === videoKey(video),
                  'is-preview-ready': hoverPreviewReady && hoverPreviewKey === videoKey(video)
                }"
              >
                <el-image :src="video.pre" fit="cover" class="cover-image" loading="lazy">
                  <template #error>
                    <div class="image-error">
                      <el-icon><VideoPlay /></el-icon>
                    </div>
                  </template>
                </el-image>

                <video
                  v-if="hoverPreviewKey === videoKey(video)"
                  :ref="setHoverVideoRef"
                  class="hover-preview-video"
                  muted
                  loop
                  playsinline
                  preload="none"
                  aria-hidden="true"
                ></video>

                <div
                  v-if="hoverPreviewKey === videoKey(video) && hoverPreviewLoading"
                  class="preview-loading"
                  aria-hidden="true"
                >
                  <Loading :size="17" />
                </div>

                <div
                  v-if="hoverPreviewKey === videoKey(video) && hoverPreviewReady"
                  class="preview-badge"
                >
                  <VolumeX :size="12" />
                  <span>静音预览</span>
                </div>

                <div
                  v-if="hoverPreviewKey === videoKey(video) && hoverPreviewReady"
                  class="preview-progress"
                  aria-hidden="true"
                >
                  <span :style="{ width: `${hoverPreviewProgress}%` }"></span>
                </div>

                <!-- 渐变蒙层（hover 时浮起） -->
                <div class="cover-overlay">
                  <div class="play-button">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                </div>

                <!-- 隐私模式遮罩 -->
                <div v-if="privacyStore.privacyMode" class="privacy-overlay qz-privacy-overlay">
                  <el-icon class="qz-privacy-icon"><Hide /></el-icon>
                  <span class="qz-privacy-text">隐私保护</span>
                </div>
              </div>

              <!-- 卡片下方：标题优先，第二行展示稳定可用的媒体信息 -->
              <div class="video-foot">
                <span
                  v-if="videoCardTitle(video)"
                  class="video-card-title"
                  :title="videoCardDescription(video)"
                >
                  {{ videoCardTitle(video) }}
                </span>
                <div class="video-meta-row">
                  <span class="date">{{ formatUploadTime(video.uploadTime) }}</span>
                  <span class="video-meta-items">
                    <span v-if="videoDuration(video)" class="video-meta-item">
                      <Clock3 :size="11" />
                      {{ formatDuration(videoDuration(video)) }}
                    </span>
                    <span v-if="videoCommentCount(video)" class="video-meta-item">
                      <MessageCircle :size="11" />
                      {{ videoCommentCount(video) }}
                    </span>
                    <span v-if="videoFileSize(video)" class="video-meta-item">
                      {{ formatFileSize(videoFileSize(video)) }}
                    </span>
                  </span>
                </div>
              </div>
            </button>

            <!-- 筛选后无结果 -->
            <div v-if="videos.length > 0 && displayVideos.length === 0" class="filter-empty">
              当前筛选下没有视频
            </div>

            <!-- 加载更多提示 -->
            <div v-if="hasMore && !loading && !isLoadingMore" class="load-more-tip">
              下拉加载更多...
            </div>
            <div v-if="isLoadingMore" class="loading-more">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
            <div v-if="!hasMore && videos.length > 0" class="no-more-tip">已加载全部视频</div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 视频播放对话框 -->
    <el-dialog
      v-model="videoDialogVisible"
      width="min(1080px, calc(100vw - 48px))"
      top="3vh"
      class="video-dialog ds-dialog"
      modal-class="ds-dialog-overlay video-dialog-overlay"
      :close-on-click-modal="false"
      @close="handleDialogClose"
    >
      <template #header="{ titleId, titleClass }">
        <div class="player-dialog-header">
          <div class="player-dialog-icon" aria-hidden="true">
            <Clapperboard :size="18" />
          </div>
          <div class="player-dialog-heading">
            <h3 :id="titleId" :class="[titleClass, 'player-dialog-title']">
              {{ videoCardTitle(currentVideo) || '视频播放' }}
            </h3>
            <div v-if="currentVideo" class="player-dialog-meta">
              <span v-if="currentVideo.uploadTime">
                {{ formatUploadTime(currentVideo.uploadTime) }}
              </span>
              <span v-if="videoDuration(currentVideo)">
                {{ formatDuration(videoDuration(currentVideo)) }}
              </span>
              <span v-if="videoCommentCount(currentVideo)">
                {{ videoCommentCount(currentVideo) }} 条评论
              </span>
              <span v-if="videoFileSize(currentVideo)">
                {{ formatFileSize(videoFileSize(currentVideo)) }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <div v-if="currentVideo" class="video-player-wrapper">
        <!-- 视频播放器容器 -->
        <div class="video-player-container">
          <video ref="videoPlayerRef" :poster="currentVideo.pre" controls class="video-player">
            您的浏览器不支持视频播放
          </video>

          <!-- 加载状态 -->
          <div v-if="videoLoading" class="video-loading-overlay" role="status" aria-live="polite">
            <div class="player-state-icon is-loading">
              <el-icon><Loading /></el-icon>
            </div>
            <strong>正在准备视频</strong>
            <span>缓冲完成后会自动开始播放</span>
          </div>

          <!-- 错误提示 -->
          <div v-if="videoError" class="video-error-overlay" role="alert">
            <div class="player-state-icon is-error">
              <el-icon><Warning /></el-icon>
            </div>
            <strong>暂时无法播放</strong>
            <span>{{ videoError }}</span>
            <div class="error-actions">
              <el-button type="primary" size="small" class="qz-primary-action" @click="retryPlay">
                重试
              </el-button>
              <el-button
                v-if="currentVideo && getVideoDownloadUrl(currentVideo)"
                size="small"
                class="qz-secondary-action"
                @click="openVideoInBrowser"
              >
                在浏览器中打开
              </el-button>
            </div>
          </div>
        </div>

        <!-- 移除视频详情区域 -->
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="currentVideo && getVideoDownloadUrl(currentVideo)"
            class="qz-secondary-action"
            @click="openVideoInBrowser"
          >
            <ExternalLink :size="14" />
            浏览器打开
          </el-button>
          <el-button
            v-if="currentVideo && getVideoDownloadUrl(currentVideo)"
            type="primary"
            class="qz-primary-action"
            :loading="downloadingCurrent"
            :disabled="downloadingCurrent"
            @click="downloadCurrentVideo"
          >
            <Download :size="14" />
            {{ downloadingCurrent ? '加入下载…' : '下载当前视频' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, VideoPlay, Loading, Warning, Hide } from '@element-plus/icons-vue'
import {
  Clapperboard,
  Clock3,
  Download,
  ExternalLink,
  MessageCircle,
  ShieldX,
  TriangleAlert,
  VolumeX
} from '@lucide/vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import { useUserStore } from '@renderer/store/user.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import {
  createPaginationGuard,
  isNearScrollEnd,
  normalizePaginationFlag,
  shouldContinuePagination
} from '@renderer/utils/paginationGuard'
import { resolveQzoneHostUin, resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'
import {
  CONTENT_LOAD_STATUS,
  classifyContentLoadFailure,
  createContentLoadState
} from '@shared/content-load-state'
import Hls from 'hls.js'

const userStore = useUserStore()
const privacyStore = usePrivacyStore()

// 支持好友上下文
const hostUinOverride = inject('hostUinOverride', null)
const effectiveHostUin = computed(() => resolveQzoneHostUin(hostUinOverride?.value, userStore))
const isFriendContext = computed(() => !!hostUinOverride?.value)
const friendMeta = computed(() => (isFriendContext.value ? { skipAuthCheck: true } : {}))
const loadFailureState = ref(null)
const videoPlaceholderState = computed(
  () =>
    loadFailureState.value ||
    createContentLoadState(CONTENT_LOAD_STATUS.EMPTY, {
      label: '视频',
      friendMode: isFriendContext.value,
      emptyDescription: isFriendContext.value ? '对方暂时没有向你公开的视频。' : '这里还没有视频。'
    })
)
const videoPlaceholderIcon = computed(() => {
  if (videoPlaceholderState.value.status === CONTENT_LOAD_STATUS.FORBIDDEN) return ShieldX
  if (videoPlaceholderState.value.status === CONTENT_LOAD_STATUS.ERROR) return TriangleAlert
  return Clapperboard
})

const videos = ref([])
const userInfo = ref(null) // { diskUsed, diskTotal, dayCount, dayTotal, ... }
const loading = ref(false)
const total = ref(0)
const currentStart = ref(0)
const pageSize = ref(20)
const hasMore = ref(true)
const pageGuard = createPaginationGuard({ cooldownMs: 1500, maxFailures: 3 })
const scrollbarRef = ref(null)
const isLoadingMore = ref(false)
const videoDialogVisible = ref(false)
const currentVideo = ref(null)
const videoPlayerRef = ref(null)
const videoLoading = ref(false)
const videoError = ref('')
const downloadingAll = ref(false)
const downloadingCurrent = ref(false)
const hoverPreviewKey = ref('')
const hoverPreviewReady = ref(false)
const hoverPreviewLoading = ref(false)
const hoverPreviewProgress = ref(0)
const hoverVideoRef = ref(null)
let hls = null
let previewHls = null
let hoverPreviewTimer = null
let previewRequestId = 0
let currentLoadId = 0
const leftRef = inject('leftRef', null)

// 获取视频列表
const fetchVideoList = async (isLoadMore = false) => {
  if (loading.value || isLoadingMore.value) return
  const pageKey = `${effectiveHostUin.value}:${currentStart.value}:${pageSize.value}`

  if (isLoadMore) {
    if (!hasMore.value) return
    if (!pageGuard.canLoad(pageKey)) return
    isLoadingMore.value = true
  } else {
    pageGuard.reset()
    loading.value = true
    loadFailureState.value = null
  }

  const thisLoadId = ++currentLoadId

  try {
    const params = {
      hostUin: effectiveHostUin.value,
      getMethod: 2,
      start: isLoadMore ? currentStart.value : 0,
      count: pageSize.value,
      need_old: 0,
      // 首次拉取时让服务端返回 UserInfo（磁盘配额等），分页时省掉
      getUserInfo: isLoadMore ? 0 : 1
    }

    const response = await window.QzoneAPI.getVideoList(params, friendMeta.value)
    if (thisLoadId !== currentLoadId) return

    if (response.code === 0 && response.data) {
      loadFailureState.value = null
      const newVideos = Array.isArray(response.data.Videos) ? response.data.Videos : []
      const previousStart = isLoadMore ? currentStart.value : 0

      if (isLoadMore) {
        const existingIds = new Set(videos.value.map((video) => video.vid || video.id))
        videos.value = [
          ...videos.value,
          ...newVideos.filter((video) => !existingIds.has(video.vid || video.id))
        ]
      } else {
        videos.value = newVideos
        currentStart.value = 0
        if (response.data.UserInfo) {
          userInfo.value = response.data.UserInfo
        }
      }

      total.value = response.data.total || 0
      const responseStart = Number(response.data.nextPageStart)
      currentStart.value =
        Number.isFinite(responseStart) && responseStart > previousStart
          ? responseStart
          : previousStart + newVideos.length
      const isLast = normalizePaginationFlag(response.data.isLast)
      const serverHasMore =
        isLast === null ? (response.data.hasMore ?? response.data.hasmore) : !isLast
      hasMore.value = shouldContinuePagination({
        serverHasMore,
        cursorMoved: currentStart.value > previousStart,
        itemCount: newVideos.length,
        pageSize: pageSize.value,
        nextOffset: currentStart.value,
        total: total.value
      })
      pageGuard.succeed()

      updateLeftStats()
    } else {
      if (isLoadMore) {
        pageGuard.fail(pageKey)
        hasMore.value = true
        ElMessage.warning('加载更多视频失败，稍后可继续重试')
      } else {
        hasMore.value = false
        loadFailureState.value = classifyContentLoadFailure(response, {
          label: '视频',
          friendMode: isFriendContext.value
        })
        if (videos.value.length > 0) ElMessage.error('视频刷新失败，请稍后重试')
      }
    }
  } catch (error) {
    if (thisLoadId === currentLoadId) {
      if (isLoadMore) {
        pageGuard.fail(pageKey)
        hasMore.value = true
        ElMessage.warning('加载更多视频失败，稍后可继续重试')
      } else {
        hasMore.value = false
        loadFailureState.value = classifyContentLoadFailure(error, {
          label: '视频',
          friendMode: isFriendContext.value
        })
        if (videos.value.length > 0) ElMessage.error('视频刷新失败，请稍后重试')
      }
    }
  } finally {
    if (thisLoadId === currentLoadId) {
      loading.value = false
      isLoadingMore.value = false
    }
  }
}

// 累计已加载视频的总时长 / 年份集合
const totalDuration = computed(() => videos.value.reduce((sum, v) => sum + (v.duration || 0), 0))
const years = computed(() => {
  const set = new Set()
  videos.value.forEach((v) => {
    if (v.uploadTime) set.add(new Date(v.uploadTime * 1000).getFullYear())
  })
  return [...set].sort((a, b) => b - a)
})

// 应用 sidebar 的筛选 / 排序
const filters = computed(() => leftRef?.value?.videoFilters || {})

const displayVideos = computed(() => {
  let list = videos.value.slice()
  const f = filters.value
  if (f.duration === 'short') list = list.filter((v) => (v.duration || 0) < 30)
  else if (f.duration === 'medium')
    list = list.filter((v) => (v.duration || 0) >= 30 && (v.duration || 0) < 180)
  else if (f.duration === 'long') list = list.filter((v) => (v.duration || 0) >= 180)
  if (f.year && f.year !== 'all') {
    list = list.filter((v) => new Date((v.uploadTime || 0) * 1000).getFullYear() === f.year)
  }
  if (f.sort === 'oldest') list.sort((a, b) => (a.uploadTime || 0) - (b.uploadTime || 0))
  else if (f.sort === 'duration') list.sort((a, b) => (b.duration || 0) - (a.duration || 0))
  else list.sort((a, b) => (b.uploadTime || 0) - (a.uploadTime || 0))
  return list
})

const formatTotalDuration = (seconds) => {
  const value = Number(seconds) || 0
  if (!value) return ''
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  if (hours) return `${hours} 小时 ${minutes} 分钟`
  return `${Math.max(1, minutes)} 分钟`
}

const videoSummary = computed(() => {
  const listed = displayVideos.value.length
  const knownTotal = Math.max(total.value || 0, videos.value.length)
  const countText =
    listed !== videos.value.length
      ? `筛选后 ${listed} 个`
      : knownTotal > videos.value.length
        ? `已加载 ${videos.value.length} / ${knownTotal} 个`
        : `${knownTotal} 个视频`
  const durationText = formatTotalDuration(totalDuration.value)
  return durationText ? `${countText} · 已加载时长 ${durationText}` : countText
})

// 更新左侧统计信息
const updateLeftStats = () => {
  if (leftRef?.value?.updateVideoStats) {
    leftRef.value.updateVideoStats({
      total: total.value,
      loaded: videos.value.length,
      totalDuration: totalDuration.value,
      diskUsed: userInfo.value?.diskUsed ?? 0,
      diskTotal: userInfo.value?.diskTotal ?? 0,
      dayCount: userInfo.value?.dayCount ?? 0,
      dayTotal: userInfo.value?.dayTotal ?? 0,
      years: years.value
    })
  }
}

// 刷新列表
const handleRefresh = () => {
  stopHoverPreview()
  currentStart.value = 0
  hasMore.value = true
  fetchVideoList(false)
}

const resetVideoList = () => {
  stopHoverPreview()
  currentLoadId++
  videos.value = []
  loadFailureState.value = null
  userInfo.value = null
  total.value = 0
  currentStart.value = 0
  hasMore.value = true
  loading.value = false
  isLoadingMore.value = false
  handleDialogClose()
  fetchVideoList(false).then(() => {
    checkAndLoadMore()
  })
}

const getVideoDownloadUrl = (video) =>
  video?.url || video?.raw || video?.videoUrl || video?.downloadUrl || ''

const videoKey = (video) =>
  String(video?.vid || video?.id || getVideoDownloadUrl(video) || video?.pre || '')

const setHoverVideoRef = (element) => {
  hoverVideoRef.value = element || null
}

const destroyPreviewHls = () => {
  if (previewHls) {
    previewHls.destroy()
    previewHls = null
  }
}

const clearHoverPreviewTimer = () => {
  if (hoverPreviewTimer) {
    window.clearTimeout(hoverPreviewTimer)
    hoverPreviewTimer = null
  }
}

const canHoverPreview = (video) => {
  if (!getVideoDownloadUrl(video) || privacyStore.privacyMode || videoDialogVisible.value) {
    return false
  }

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const supportsHover = window.matchMedia?.('(hover: hover)').matches ?? true
  return !reducedMotion && supportsHover
}

const resetHoverVideoElement = () => {
  const element = hoverVideoRef.value
  if (!element) return

  element.onloadeddata = null
  element.oncanplay = null
  element.onwaiting = null
  element.onplaying = null
  element.ontimeupdate = null
  element.onerror = null
  element.pause()
  element.removeAttribute('src')
  element.load()
}

const stopHoverPreview = (video = null) => {
  clearHoverPreviewTimer()
  if (video && hoverPreviewKey.value && hoverPreviewKey.value !== videoKey(video)) return

  previewRequestId += 1
  resetHoverVideoElement()
  destroyPreviewHls()
  hoverPreviewKey.value = ''
  hoverPreviewReady.value = false
  hoverPreviewLoading.value = false
  hoverPreviewProgress.value = 0
}

const setupHoverPreviewEvents = (element, requestId) => {
  const isCurrent = () => requestId === previewRequestId && hoverVideoRef.value === element

  element.onloadeddata = () => {
    if (!isCurrent()) return
    hoverPreviewLoading.value = false
    hoverPreviewReady.value = true
  }
  element.oncanplay = () => {
    if (!isCurrent()) return
    hoverPreviewLoading.value = false
    hoverPreviewReady.value = true
    element.play().catch(() => stopHoverPreview())
  }
  element.onwaiting = () => {
    if (isCurrent()) hoverPreviewLoading.value = true
  }
  element.onplaying = () => {
    if (!isCurrent()) return
    hoverPreviewLoading.value = false
    hoverPreviewReady.value = true
  }
  element.ontimeupdate = () => {
    if (!isCurrent()) return
    hoverPreviewProgress.value = element.duration
      ? Math.min(100, (element.currentTime / element.duration) * 100)
      : 0
  }
  element.onerror = () => {
    if (isCurrent()) stopHoverPreview()
  }
}

const playHoverPreview = (video, requestId) => {
  const element = hoverVideoRef.value
  const url = getVideoDownloadUrl(video)
  if (!element || !url || requestId !== previewRequestId) return

  element.muted = true
  element.volume = 0
  element.loop = true
  element.playsInline = true
  setupHoverPreviewEvents(element, requestId)

  if (url.includes('.m3u8')) {
    if (element.canPlayType('application/vnd.apple.mpegurl')) {
      element.src = url
      element.play().catch(() => stopHoverPreview())
      return
    }

    if (Hls.isSupported()) {
      previewHls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 8,
        maxMaxBufferLength: 12,
        debug: false
      })
      previewHls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && requestId === previewRequestId) stopHoverPreview()
      })
      previewHls.loadSource(url)
      previewHls.attachMedia(element)
      return
    }

    stopHoverPreview()
    return
  }

  element.src = url
  element.play().catch(() => stopHoverPreview())
}

const startHoverPreview = async (video) => {
  if (!canHoverPreview(video)) return

  stopHoverPreview()
  const requestId = previewRequestId
  hoverPreviewKey.value = videoKey(video)
  hoverPreviewLoading.value = true
  await nextTick()

  if (requestId !== previewRequestId || hoverPreviewKey.value !== videoKey(video)) return
  playHoverPreview(video, requestId)
}

const scheduleHoverPreview = (video) => {
  clearHoverPreviewTimer()
  if (!canHoverPreview(video)) return

  hoverPreviewTimer = window.setTimeout(() => {
    hoverPreviewTimer = null
    startHoverPreview(video)
  }, 600)
}

const handleWindowBlur = () => stopHoverPreview()
const handleVisibilityChange = () => {
  if (document.hidden) stopHoverPreview()
}

const compactVideoText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

const videoCardTitle = (video) =>
  compactVideoText(video?.title || video?.desc || video?.name || video?.videoName)

const videoCardDescription = (video) =>
  compactVideoText(video?.desc || video?.title || video?.name || video?.videoName)

const videoDuration = (video) =>
  Math.max(
    0,
    Number(video?.duration || video?.videoDuration || video?.video_time || video?.playTime) || 0
  )

const videoCommentCount = (video) =>
  Math.max(
    0,
    Number(video?.commentCount || video?.comment_count || video?.commentNum || video?.commentnum) ||
      0
  )

const videoFileSize = (video) =>
  Math.max(0, Number(video?.size || video?.fileSize || video?.videoSize || video?.video_size) || 0)

const formatFileSize = (bytes) => {
  const value = Number(bytes) || 0
  if (!value) return ''
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
  if (value >= 1024 ** 2)
    return `${(value / 1024 ** 2).toFixed(value >= 10 * 1024 ** 2 ? 0 : 1)} MB`
  return `${Math.max(1, Math.round(value / 1024))} KB`
}

const rawUin = (uin) => String(uin || '').replace(/^o/, '')

const queueVideoDownloads = async (list) => {
  const downloadable = list.filter((video) => getVideoDownloadUrl(video))
  if (!downloadable.length) return []

  const hostUin = effectiveHostUin.value
  const accountUin = resolveSelfQzoneUin(userStore) || hostUin
  const now = Math.floor(Date.now() / 1000)
  return window.QzoneAPI.download.addFeeds({
    feeds: [
      {
        skey: `video-${hostUin || accountUin || 'self'}`,
        time: now,
        desc: isFriendContext.value ? '好友视频' : '我的视频',
        albumId: 'video',
        albumName: isFriendContext.value ? '好友视频' : '我的视频',
        sourceKey: 'video',
        referer: `https://user.qzone.qq.com/${rawUin(hostUin || accountUin)}`,
        photos: downloadable.map((video, index) => ({
          id: video.vid || video.id || `video_${index + 1}`,
          name: video.title || video.desc || `video_${index + 1}`,
          url: getVideoDownloadUrl(video),
          raw: getVideoDownloadUrl(video),
          pre: video.pre,
          size: video.size || 0,
          is_video: true,
          modifytime: video.uploadTime || now,
          sourceKey: 'video'
        }))
      }
    ],
    uin: accountUin,
    friendUin: isFriendContext.value ? hostUin : null
  })
}

const downloadAllVideos = async () => {
  if (downloadingAll.value) return
  const list = displayVideos.value.filter((video) => getVideoDownloadUrl(video))
  if (!list.length) {
    ElMessage.warning('当前没有可下载的视频')
    return
  }

  downloadingAll.value = true
  try {
    const ids = await queueVideoDownloads(list)
    ElMessage.success(`已添加 ${ids?.length || 0} 个视频下载任务`)
  } catch (e) {
    console.error('[video] 批量下载失败', e)
    ElMessage.error(`下载失败：${e.message || e}`)
  } finally {
    downloadingAll.value = false
  }
}

const downloadCurrentVideo = async () => {
  if (!currentVideo.value || downloadingCurrent.value) return
  downloadingCurrent.value = true
  try {
    const ids = await queueVideoDownloads([currentVideo.value])
    if (!ids?.length) {
      ElMessage.warning('当前视频缺少可用的下载地址')
      return
    }
    ElMessage.success('当前视频已加入下载队列')
  } catch (error) {
    console.error('[video] 下载当前视频失败', error)
    ElMessage.error(`下载失败：${error.message || error}`)
  } finally {
    downloadingCurrent.value = false
  }
}

// 滚动加载更多
const handleScroll = ({ scrollTop }) => {
  stopHoverPreview()
  const wrapElement = scrollbarRef.value?.wrapRef
  if (!wrapElement) return

  if (
    isNearScrollEnd(
      {
        scrollHeight: wrapElement.scrollHeight,
        clientHeight: wrapElement.clientHeight,
        scrollTop
      },
      100
    ) &&
    hasMore.value &&
    !loading.value &&
    !isLoadingMore.value
  ) {
    fetchVideoList(true)
  }
}

// 检查容器是否需要加载更多数据（解决首次加载数据不足以填满容器的问题）
const checkAndLoadMore = async () => {
  for (let page = 0; page < 12; page++) {
    await nextTick()
    const wrapElement = scrollbarRef.value?.wrapRef
    if (!wrapElement || wrapElement.scrollHeight > wrapElement.clientHeight) return
    if (!hasMore.value || loading.value || isLoadingMore.value || videos.value.length === 0) return
    const previousStart = currentStart.value
    await fetchVideoList(true)
    if (currentStart.value === previousStart) return
  }
}

// 格式化上传时间
const formatUploadTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now - date

  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    if (hours < 1) {
      const minutes = Math.floor(diff / (60 * 1000))
      return minutes < 1 ? '刚刚' : `${minutes}分钟前`
    }
    return `${hours}小时前`
  }

  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 格式化视频时长
const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return ''

  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const clock = `${mins}:${secs.toString().padStart(2, '0')}`
  return hours
    ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : clock
}

// 点击视频卡片
const handleVideoClick = (video) => {
  const url = getVideoDownloadUrl(video)
  if (!url) {
    ElMessage.error('视频地址无效')
    return
  }

  stopHoverPreview()
  currentVideo.value = video
  videoDialogVisible.value = true
  videoError.value = ''
  videoLoading.value = true

  nextTick(() => playVideo(url))
}

// 播放视频（自动选择播放方式）
const playVideo = (url) => {
  if (!videoPlayerRef.value) return

  // 清理旧的 HLS 实例
  if (hls) {
    hls.destroy()
    hls = null
  }

  if (url.includes('.m3u8')) {
    if (videoPlayerRef.value.canPlayType('application/vnd.apple.mpegurl')) {
      videoPlayerRef.value.src = url
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        debug: false
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) handleHLSError(data)
      })

      hls.loadSource(url)
      hls.attachMedia(videoPlayerRef.value)
    } else {
      videoLoading.value = false
      videoError.value = '您的浏览器不支持 HLS 视频播放'
      ElMessage.error('您的浏览器不支持 HLS 视频播放')
      return
    }
  } else {
    videoPlayerRef.value.src = url
  }

  setupVideoEvents()
}

// 设置视频事件监听
const setupVideoEvents = () => {
  if (!videoPlayerRef.value) return

  // 移除之前的监听器，避免重复
  videoPlayerRef.value.onloadeddata = null
  videoPlayerRef.value.oncanplay = null
  videoPlayerRef.value.onwaiting = null
  videoPlayerRef.value.onplaying = null
  videoPlayerRef.value.onerror = null

  videoPlayerRef.value.onloadeddata = () => {
    videoLoading.value = false
    videoError.value = ''
  }

  videoPlayerRef.value.oncanplay = () => {
    videoLoading.value = false
    videoPlayerRef.value.play().catch(() => {
      ElMessage.info('请点击播放按钮开始观看')
    })
  }

  videoPlayerRef.value.onwaiting = () => {
    videoLoading.value = true
  }

  videoPlayerRef.value.onplaying = () => {
    videoLoading.value = false
    videoError.value = ''
  }

  videoPlayerRef.value.onerror = () => {
    if (videoDialogVisible.value) {
      videoLoading.value = false
      videoError.value = '视频加载失败'
      ElMessage.error('视频加载失败')
    }
  }
}

// 处理 HLS 错误
const handleHLSError = (data) => {
  videoLoading.value = false

  const errorMap = {
    [Hls.ErrorTypes.NETWORK_ERROR]: { msg: '网络错误，无法加载视频', type: 'warning' },
    [Hls.ErrorTypes.MEDIA_ERROR]: {
      msg: '媒体错误，正在尝试恢复...',
      type: 'warning',
      recover: true
    },
    [Hls.ErrorTypes.MANIFEST_ERROR]: { msg: '视频格式不支持', type: 'error', destroy: true }
  }

  const error = errorMap[data.type] || { msg: '无法播放视频', type: 'error', destroy: true }

  videoError.value = error.msg
  error.type === 'warning' ? ElMessage.warning(error.msg) : ElMessage.error(error.msg)

  if (error.recover && hls) {
    hls.recoverMediaError()
  } else if (error.destroy && hls) {
    hls.destroy()
  }
}

// 重试播放
const retryPlay = () => {
  const url = getVideoDownloadUrl(currentVideo.value)
  if (!url) {
    ElMessage.warning('没有可播放的视频')
    return
  }

  videoError.value = ''
  videoLoading.value = true
  playVideo(url)
}

// 关闭对话框
const handleDialogClose = () => {
  if (videoPlayerRef.value) {
    // 移除所有事件监听器
    videoPlayerRef.value.onloadeddata = null
    videoPlayerRef.value.oncanplay = null
    videoPlayerRef.value.onwaiting = null
    videoPlayerRef.value.onplaying = null
    videoPlayerRef.value.onerror = null

    videoPlayerRef.value.pause()
    videoPlayerRef.value.src = ''
  }

  // 清理 HLS 实例
  if (hls) {
    hls.destroy()
    hls = null
  }

  currentVideo.value = null
  videoLoading.value = false
  videoError.value = ''
}

// 打开视频地址
const openVideoInBrowser = () => {
  const url = getVideoDownloadUrl(currentVideo.value)
  if (!url) {
    ElMessage.error('视频地址无效')
    return
  }

  window.QzoneAPI?.shell
    ?.openExternal?.(url)
    ?.then(() => ElMessage.success('正在打开视频...'))
    ?.catch(() => ElMessage.error('打开视频失败'))
}

// 生命周期
onMounted(() => {
  window.addEventListener('blur', handleWindowBlur)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  fetchVideoList().then(() => {
    // 首次加载完成后，检查是否需要自动加载更多
    checkAndLoadMore()
  })
})

watch(() => effectiveHostUin.value, resetVideoList)
watch(
  () => privacyStore.privacyMode,
  (enabled) => {
    if (enabled) stopHoverPreview()
  }
)

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('blur', handleWindowBlur)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopHoverPreview()
  if (hls) {
    hls.destroy()
    hls = null
  }
})
</script>

<style lang="scss" scoped>
.video-module {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(0, 0, 0, 0.15);
}

.module-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.module-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.video-summary {
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn,
.download-btn {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 13px !important;
  padding: 6px 12px !important;
  transition: all 0.2s ease;

  &:hover {
    color: rgba(255, 255, 255, 0.9) !important;
    background: rgba(255, 255, 255, 0.1) !important;
  }

  .el-icon {
    margin-right: 4px;
  }
}

.module-content {
  flex: 1;
  overflow: hidden;
}

.video-scrollbar {
  height: 100%;
}

.video-container {
  padding: 24px clamp(24px, 4vw, 56px) 36px;
  min-height: 100%;
}

/* 等宽媒体墙：优先保证批量浏览效率和稳定的视觉节奏。 */
.video-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  grid-auto-flow: dense;
  gap: 22px 18px;
  padding-bottom: 20px;
}

.video-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  min-width: 0;

  &:focus-visible {
    outline: none;

    .video-cover {
      box-shadow: 0 0 0 3px var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
    }

    .cover-overlay {
      opacity: 1;
    }
  }

  .video-cover {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 */
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    overflow: hidden;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  &:hover .video-cover {
    transform: translateY(-2px);
    box-shadow:
      0 0 0 1px rgba(251, 146, 60, 0.3),
      0 12px 30px rgba(0, 0, 0, 0.38);
  }

  &:hover .cover-overlay {
    opacity: 1;
  }
}

.cover-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transition: opacity 0.18s ease;
}

.hover-preview-video {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.video-cover.is-preview-ready {
  .hover-preview-video {
    opacity: 1;
  }

  .cover-image {
    opacity: 0;
  }
}

/* 悬停预览一旦开始加载，就不再用播放按钮遮挡画面。 */
.video-card .video-cover.is-previewing .cover-overlay {
  opacity: 0;
}

.preview-loading {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(12, 12, 14, 0.72);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(10px);
  pointer-events: none;

  svg {
    width: 15px;
    height: 15px;
    filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.55));
    animation: video-spin 0.9s linear infinite;
  }
}

.preview-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 7px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(12, 12, 14, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(10px);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
}

.preview-progress {
  position: absolute;
  right: 8px;
  bottom: 6px;
  left: 8px;
  z-index: 3;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.26);
  pointer-events: none;

  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--qz-accent, #f97316);
    box-shadow: 0 0 8px rgba(249, 115, 22, 0.45);
    transition: width 0.12s linear;
  }
}

.image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.25);
  font-size: 28px;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.05) 60%,
    rgba(0, 0, 0, 0.45) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  z-index: 2;
  transition: opacity 0.2s ease;
}

.play-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  border: 1.5px solid rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  backdrop-filter: blur(2px);
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.08);
  }
}

/* 隐私遮罩 */
.privacy-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  pointer-events: none;
}

.video-card.privacy-mode .cover-image :deep(.el-image__inner) {
  filter: blur(var(--qz-privacy-media-blur));
  transition: filter 0.3s ease;
}

/* 卡片信息：有标题时两行，无标题时保持紧凑的一行。 */
.video-foot {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
  padding: 1px 2px 0;
  font-size: 11px;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}

.video-card-title {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.88);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-meta-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: rgba(255, 255, 255, 0.46);

  .date {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.video-meta-items {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 7px;
}

.video-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: rgba(255, 255, 255, 0.56);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .video-list {
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  }
}

@media (max-width: 620px) {
  .video-container {
    padding-inline: 16px;
  }

  .video-list {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .video-card .video-cover,
  .cover-image,
  .hover-preview-video,
  .cover-overlay,
  .play-button,
  .video-card.privacy-mode .cover-image :deep(.el-image__inner) {
    transition: none !important;
  }

  .video-card:hover .video-cover {
    transform: none;
  }
}

.filter-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.load-more-tip,
.loading-more,
.no-more-tip {
  text-align: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  grid-column: 1 / -1;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

// 视频对话框：保留播放器作为视觉焦点，减少无效边框和纵向留白。
:deep(.video-dialog-overlay) {
  background: rgba(6, 6, 8, 0.72);
  backdrop-filter: blur(5px) saturate(92%);
}

:deep(.video-dialog.el-dialog),
:deep(.video-dialog .el-dialog) {
  display: flex;
  max-height: 94vh;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 18px;
  background:
    radial-gradient(circle at 12% -25%, rgba(249, 115, 22, 0.16), transparent 34%),
    rgba(24, 24, 27, 0.97);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.58),
    0 0 0 1px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(24px) saturate(120%);
}

:deep(.video-dialog .el-dialog__header) {
  flex: 0 0 auto;
  margin: 0;
  padding: 14px 56px 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

:deep(.video-dialog .el-dialog__headerbtn) {
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.55);
  transition:
    color 0.18s ease,
    background 0.18s ease;

  &:hover,
  &:focus-visible {
    color: rgba(255, 255, 255, 0.94);
    background: rgba(255, 255, 255, 0.08);
  }
}

:deep(.video-dialog .el-dialog__body) {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  padding: 14px 16px 0;
}

:deep(.video-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 12px 16px 14px;
  border-top: 0;
}

.player-dialog-header {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.player-dialog-icon {
  display: flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(249, 115, 22, 0.3);
  border-radius: 10px;
  color: #fb923c;
  background: rgba(249, 115, 22, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.player-dialog-heading {
  min-width: 0;
}

.player-dialog-title {
  overflow: hidden;
  margin: 0;
  color: rgba(255, 255, 255, 0.94);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-dialog-meta {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 3px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 10.5px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;

  span + span::before {
    margin: 0 6px;
    color: rgba(255, 255, 255, 0.2);
    content: '·';
  }
}

.video-player-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.video-player-container {
  position: relative;
  width: 100%;
  height: min(60.75vw, calc(94vh - 164px), 608px);
  min-height: 280px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.055), transparent 58%), #050506;
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.34),
    inset 0 0 50px rgba(0, 0, 0, 0.2);
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}

.video-loading-overlay,
.video-error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.9);
  gap: 7px;
  z-index: 10;

  strong {
    margin-top: 3px;
    font-size: 14px;
    font-weight: 650;
  }

  > span {
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
  }
}

.video-loading-overlay {
  background: rgba(5, 5, 6, 0.84);
  backdrop-filter: blur(5px);
}

.player-state-icon {
  display: flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  font-size: 19px;

  &.is-loading {
    color: #fb923c;
    background: rgba(249, 115, 22, 0.12);

    .el-icon {
      animation: video-spin 0.9s linear infinite;
    }
  }

  &.is-error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.14);
  }
}

.video-error-overlay {
  background: rgba(5, 5, 6, 0.9);
  backdrop-filter: blur(7px);

  .error-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  :deep(.el-button) {
    min-height: 34px;
    border-radius: 9px;
  }

  svg {
    margin-right: 5px;
  }
}

@media (max-width: 620px) {
  :deep(.video-dialog.el-dialog),
  :deep(.video-dialog .el-dialog) {
    width: calc(100vw - 24px) !important;
    border-radius: 14px;
  }

  :deep(.video-dialog .el-dialog__body) {
    padding-inline: 10px;
  }

  .video-player-container {
    min-height: 210px;
  }

  .player-dialog-meta {
    display: none;
  }
}

@keyframes video-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
