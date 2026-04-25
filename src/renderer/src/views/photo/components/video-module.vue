<template>
  <div class="video-module">
    <!-- 顶部标题栏 -->
    <div class="module-header">
      <div class="header-content">
        <div class="title-section">
          <h2 class="module-title">{{ isFriendContext ? '好友视频' : '我的视频' }}</h2>
        </div>
        <div class="header-actions">
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
            icon="🎬"
            title="暂无视频"
            description="还没有上传过视频哦~"
          />

          <!-- 视频列表 -->
          <div v-else class="video-list">
            <div
              v-for="video in displayVideos"
              :key="video.vid"
              class="video-card"
              :class="{ 'privacy-mode': privacyStore.privacyMode }"
              @click="handleVideoClick(video)"
            >
              <!-- 封面：占整张卡片 -->
              <div class="video-cover">
                <el-image
                  :src="video.pre"
                  fit="cover"
                  class="cover-image"
                  loading="lazy"
                >
                  <template #error>
                    <div class="image-error">
                      <el-icon><VideoPlay /></el-icon>
                    </div>
                  </template>
                </el-image>

                <!-- 渐变蒙层（hover 时浮起） -->
                <div class="cover-overlay">
                  <div class="play-button">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                </div>

                <!-- 隐私模式遮罩 -->
                <div v-if="privacyStore.privacyMode" class="privacy-overlay">
                  <el-icon><Hide /></el-icon>
                  <span>隐私保护</span>
                </div>

                <!-- 左下：评论数 -->
                <div v-if="video.commentCount > 0" class="cover-comment">
                  💬 {{ video.commentCount }}
                </div>
                <!-- 右下：时长 -->
                <div v-if="video.duration" class="cover-duration">
                  {{ formatDuration(video.duration) }}
                </div>
              </div>

              <!-- 卡片下方：仅一行日期 + 描述（如有） -->
              <div class="video-foot">
                <span class="date">{{ formatUploadTime(video.uploadTime) }}</span>
                <span v-if="video.desc" class="desc" :title="video.desc">{{ video.desc }}</span>
              </div>
            </div>

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
      :title="currentVideo?.title || currentVideo?.desc || '视频播放'"
      width="800px"
      top="5vh"
      class="video-dialog ds-dialog"
      :close-on-click-modal="false"
      @close="handleDialogClose"
    >
      <div v-if="currentVideo" class="video-player-wrapper">
        <!-- 视频播放器容器 -->
        <div class="video-player-container">
          <video ref="videoPlayerRef" :poster="currentVideo.pre" controls class="video-player">
            您的浏览器不支持视频播放
          </video>

          <!-- 加载状态 -->
          <div v-if="videoLoading" class="video-loading-overlay">
            <el-icon class="loading-spinner"><Loading /></el-icon>
            <span>正在加载视频...</span>
          </div>

          <!-- 错误提示 -->
          <div v-if="videoError" class="video-error-overlay">
            <el-icon><Warning /></el-icon>
            <span>{{ videoError }}</span>
            <div class="error-actions">
              <el-button type="primary" size="small" @click="retryPlay">重试</el-button>
              <el-button
                v-if="currentVideo?.url"
                type="success"
                size="small"
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
          <el-button @click="videoDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, VideoPlay, Loading, Warning, Hide } from '@element-plus/icons-vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import { useUserStore } from '@renderer/store/user.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import Hls from 'hls.js'

const userStore = useUserStore()
const privacyStore = usePrivacyStore()

// 支持好友上下文
const hostUinOverride = inject('hostUinOverride', null)
const effectiveHostUin = computed(() => hostUinOverride?.value || userStore.userInfo.uin)
const isFriendContext = computed(() => !!hostUinOverride?.value)
const friendMeta = computed(() => (isFriendContext.value ? { skipAuthCheck: true } : {}))

const videos = ref([])
const userInfo = ref(null) // { diskUsed, diskTotal, dayCount, dayTotal, ... }
const loading = ref(false)
const total = ref(0)
const currentStart = ref(0)
const pageSize = ref(20)
const hasMore = ref(true)
const scrollbarRef = ref(null)
const isLoadingMore = ref(false)
const videoDialogVisible = ref(false)
const currentVideo = ref(null)
const videoPlayerRef = ref(null)
const videoLoading = ref(false)
const videoError = ref('')
let hls = null
const leftRef = inject('leftRef', null)

// 获取视频列表
const fetchVideoList = async (isLoadMore = false) => {
  if (loading.value || isLoadingMore.value) return

  if (isLoadMore) {
    if (!hasMore.value) return
    isLoadingMore.value = true
  } else {
    loading.value = true
  }

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

    if (response.code === 0 && response.data) {
      const newVideos = response.data.Videos || []

      if (isLoadMore) {
        videos.value = [...videos.value, ...newVideos]
      } else {
        videos.value = newVideos
        currentStart.value = 0
        if (response.data.UserInfo) {
          userInfo.value = response.data.UserInfo
        }
      }

      total.value = response.data.total || 0
      currentStart.value = response.data.nextPageStart || 0
      hasMore.value = response.data.isLast !== 'true' && newVideos.length > 0

      updateLeftStats()
    } else {
      ElMessage.error(response.message || '获取视频列表失败')
    }
  } catch {
    ElMessage.error('获取视频列表失败，请重试')
  } finally {
    loading.value = false
    isLoadingMore.value = false
  }
}

// 累计已加载视频的总时长 / 年份集合
const totalDuration = computed(() =>
  videos.value.reduce((sum, v) => sum + (v.duration || 0), 0)
)
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
  currentStart.value = 0
  hasMore.value = true
  fetchVideoList(false)
}

// 滚动加载更多
const handleScroll = ({ scrollTop }) => {
  const wrapElement = scrollbarRef.value?.wrapRef
  if (!wrapElement) return

  const distanceToBottom = wrapElement.scrollHeight - scrollTop - wrapElement.clientHeight

  if (distanceToBottom < 100 && hasMore.value && !loading.value && !isLoadingMore.value) {
    fetchVideoList(true)
  }
}

// 检查容器是否需要加载更多数据（解决首次加载数据不足以填满容器的问题）
const checkAndLoadMore = async () => {
  // 等待 DOM 更新
  await nextTick()

  const wrapElement = scrollbarRef.value?.wrapRef
  if (!wrapElement) return

  const hasScrollbar = wrapElement.scrollHeight > wrapElement.clientHeight

  // 如果没有滚动条且还有更多数据可以加载，则自动加载
  if (
    !hasScrollbar &&
    hasMore.value &&
    !loading.value &&
    !isLoadingMore.value &&
    videos.value.length > 0
  ) {
    console.log('检测到视频内容未填满容器，自动加载更多...')
    await fetchVideoList(true)
    // 递归检查是否还需要继续加载
    if (hasMore.value) {
      await checkAndLoadMore()
    }
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

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
}

// 点击视频卡片
const handleVideoClick = (video) => {
  if (!video?.url) {
    ElMessage.error('视频地址无效')
    return
  }

  currentVideo.value = video
  videoDialogVisible.value = true
  videoError.value = ''
  videoLoading.value = true

  nextTick(() => playVideo(video.url))
}

// 播放视频（自动选择播放方式）
const playVideo = (url) => {
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
  if (!currentVideo.value?.url) {
    ElMessage.warning('没有可播放的视频')
    return
  }

  videoError.value = ''
  videoLoading.value = true
  playVideo(currentVideo.value.url)
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

// 在浏览器中打开视频
const openVideoInBrowser = () => {
  if (!currentVideo.value?.url) {
    ElMessage.error('视频地址无效')
    return
  }

  try {
    if (window.require) {
      const { shell } = window.require('electron')
      shell.openExternal(currentVideo.value.url)
      ElMessage.success('正在浏览器中打开视频...')
    } else {
      window.open(currentVideo.value.url, '_blank')
    }
  } catch {
    window.open(currentVideo.value.url, '_blank')
  }
}

// 生命周期
onMounted(() => {
  fetchVideoList().then(() => {
    // 首次加载完成后，检查是否需要自动加载更多
    checkAndLoadMore()
  })
})

// 组件卸载时清理
onUnmounted(() => {
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
  align-items: center;
}

.module-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-btn {
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
  padding: 20px 40px;
  min-height: 100%;
}

/* 极简视频网格：5-6 列自适应，无重边框 */
.video-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px 14px;
  padding-bottom: 20px;
}

.video-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;

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
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
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

.cover-duration,
.cover-comment {
  position: absolute;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.6);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.cover-duration {
  right: 6px;
}

.cover-comment {
  left: 6px;
}

/* 隐私遮罩 */
.privacy-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  gap: 4px;
  pointer-events: none;
  backdrop-filter: blur(8px);

  .el-icon {
    font-size: 22px;
    color: #e6a23c;
  }

  span {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.75);
  }
}

.video-card.privacy-mode .cover-image :deep(.el-image__inner) {
  filter: blur(15px);
  transition: filter 0.3s ease;
}

.video-card.privacy-mode:hover .cover-image :deep(.el-image__inner) {
  filter: blur(8px);
}

/* 卡片下方一行轻文字 */
.video-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.75);
  font-variant-numeric: tabular-nums;

  .date {
    flex-shrink: 0;
  }

  .desc {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: rgba(255, 255, 255, 0.4);
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

// 视频对话框样式
:deep(.video-dialog) {
  .el-dialog {
    background: rgba(30, 30, 30, 0.95);
    border-radius: 12px;
  }

  .el-dialog__header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px 20px;

    .el-dialog__title {
      color: #ffffff;
      font-weight: 600;
    }
  }

  .el-dialog__body {
    padding: 16px 20px;
  }

  .el-dialog__footer {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 12px 20px;
  }
}

.video-player-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.video-player-container {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  max-height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-player {
  width: 100%;
  max-height: 500px;
  background: #000;
  display: block;
}

.video-loading-overlay,
.video-error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  gap: 12px;
  z-index: 10;
}

.video-loading-overlay {
  background: rgba(0, 0, 0, 0.8);
}

.loading-spinner {
  font-size: 32px;
  animation: rotate 1s linear infinite;
}

.video-error-overlay {
  background: rgba(200, 0, 0, 0.6);

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
}
</style>
