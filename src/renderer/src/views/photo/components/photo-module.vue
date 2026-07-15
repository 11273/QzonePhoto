<template>
  <div class="photo-module">
    <!-- 顶部标题栏 -->
    <div class="module-header">
      <div class="header-content">
        <div class="title-section">
          <h2 class="module-title">
            {{ isFriendPhotos || isFriendContext ? '好友照片' : '我的照片' }}
          </h2>
        </div>
        <div class="header-actions">
          <template v-if="!isFriendContext && !isFriendPhotos">
            <el-button v-if="!isSelectionMode" text class="action-btn" @click="enterSelectionMode">
              <el-icon><Select /></el-icon>
              <span>多选</span>
            </el-button>
            <template v-else>
              <el-button text class="action-btn" @click="toggleSelectAll">
                <el-icon><Check /></el-icon>
                <span>{{ isAllSelected ? '取消全选' : '全选' }}</span>
              </el-button>
              <el-button text class="action-btn" @click="exitSelectionMode">
                <el-icon><Close /></el-icon>
                <span>取消</span>
              </el-button>
            </template>
          </template>
          <el-button
            v-if="downloadableMediaCount > 0"
            text
            class="action-btn download-page-btn"
            :loading="downloadingPage"
            :disabled="loading || downloadingPage"
            @click="downloadCurrentPageFeeds"
          >
            <LucideDownload :size="14" />
            <span>{{ downloadingPage ? '加入下载…' : `下载全部 ${downloadableMediaCount}` }}</span>
          </el-button>
          <el-button
            text
            :icon="Refresh"
            :loading="loading"
            :disabled="loading"
            class="refresh-btn"
            @click="handleRefresh"
          >
            刷新
          </el-button>
        </div>
      </div>
    </div>

    <!-- 动态时间线内容 -->
    <div class="module-content">
      <el-scrollbar class="timeline-scrollbar">
        <div class="timeline-container">
          <LoadingState v-if="loading" text="正在加载动态..." />

          <EmptyState
            v-else-if="feeds.length === 0"
            :icon="ImageIcon"
            :title="isFriendPhotos ? '好友照片' : '我的照片'"
            :description="isFriendPhotos ? '好友还没有发布照片~' : '还没有动态，快去发表一条吧~'"
          />

          <!-- ========== 好友照片：网格卡片布局 ========== -->
          <div v-else-if="isFriendPhotos" class="friend-photos-grid">
            <div
              v-for="feed in feeds"
              :key="feed.id"
              class="friend-photo-card"
              :class="{ 'privacy-mode': privacyStore.privacyMode }"
              @click="previewMedia(feed.media, 0, feed)"
            >
              <!-- 照片主体 -->
              <div class="card-image-wrapper">
                <el-image
                  v-if="feed.media && feed.media[0]"
                  :src="feed.media[0].url || feed.media[0].cover"
                  fit="cover"
                  lazy
                  class="card-image"
                >
                  <template #error>
                    <div class="card-image-error">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <!-- 视频标记 -->
                <div v-if="feed.media && feed.media[0]?.type === 'video'" class="card-video-badge">
                  <el-icon><VideoPlay /></el-icon>
                </div>
                <!-- 隐私遮罩 -->
                <div
                  v-if="privacyStore.privacyMode"
                  class="card-privacy-overlay qz-privacy-overlay"
                >
                  <el-icon class="privacy-icon qz-privacy-icon"><Hide /></el-icon>
                  <span class="privacy-text qz-privacy-text">隐私保护</span>
                </div>
              </div>
              <!-- 底部信息 -->
              <div class="card-info">
                <div class="card-owner">
                  <img
                    v-if="feed.owner"
                    :src="feed.owner.face || getAvatarUrl(feed.owner.uin)"
                    class="card-avatar"
                    @error="handleAvatarError"
                  />
                  <span class="card-nick">{{ feed.owner?.nick || '未知' }}</span>
                </div>
                <div class="card-meta">
                  <span v-if="feed.albumName" class="card-album">{{ feed.albumName }}</span>
                  <span class="card-time">{{ formatFeedTime(feed.time) }}</span>
                </div>
                <button
                  v-if="getDownloadableMedia(feed).length"
                  class="card-download-btn"
                  :disabled="isFeedDownloading(feed.id)"
                  title="下载这条动态"
                  @click.stop="downloadSingleFeed(feed)"
                >
                  <LucideDownload :size="13" />
                  <span>{{ isFeedDownloading(feed.id) ? '加入中' : '下载' }}</span>
                </button>
              </div>
            </div>

            <!-- 加载更多 -->
            <div v-if="loadingMore" class="loading-more grid-loading">
              <el-icon class="loading-icon"><Loading /></el-icon>
              <span>正在加载更多...</span>
            </div>
            <div v-else-if="!hasMore && feeds.length > 0" class="no-more grid-no-more">
              <span>已加载全部好友照片</span>
            </div>
            <div
              v-if="hasMore && !loading && !loadingMore"
              ref="loadMoreTrigger"
              class="load-more-trigger"
            ></div>
          </div>

          <!-- ========== 我的照片：时间线布局 ========== -->
          <div v-else class="feeds-container tl-container">
            <template v-for="group in groupedFeeds" :key="group.dateKey">
              <!-- 日期分组标题 -->
              <div class="date-group-header tl-date-header">
                <div class="date-line"></div>
                <span class="date-text tl-date-text">{{ group.dateLabel }}</span>
                <div class="date-line"></div>
              </div>

              <!-- 该日期下的动态 -->
              <div
                v-for="(feed, feedIdx) in group.feeds"
                :key="feed.id"
                class="feed-card tl-card"
                :class="{
                  'is-first-in-group': feedIdx === 0,
                  'is-last-in-group': feedIdx === group.feeds.length - 1,
                  selected: isSelectionMode && selectedFeeds.has(feed.id)
                }"
                @click="isSelectionMode && toggleFeedSelection(feed)"
              >
                <!-- 左侧时间线 -->
                <div class="feed-timeline tl-dot-wrap">
                  <div class="timeline-dot tl-dot"></div>
                  <div v-if="feedIdx < group.feeds.length - 1" class="timeline-line"></div>
                </div>

                <!-- 多选模式：选择框 -->
                <div
                  v-if="isSelectionMode"
                  class="selection-checkbox"
                  @click.stop="toggleFeedSelection(feed)"
                >
                  <el-icon v-if="selectedFeeds.has(feed.id)" class="selected-icon">
                    <Check />
                  </el-icon>
                </div>

                <!-- 右侧内容 -->
                <div class="feed-content-wrapper tl-body">
                  <!-- 顶部：时间和删除按钮 -->
                  <div class="feed-header tl-header">
                    <span class="feed-time tl-time">{{
                      formatFeedTime(feed.time || feed.date)
                    }}</span>
                    <div v-if="!isSelectionMode" class="feed-header-actions">
                      <el-button
                        v-if="getDownloadableMedia(feed).length"
                        text
                        size="small"
                        class="feed-download-btn tl-action-btn"
                        :loading="isFeedDownloading(feed.id)"
                        :disabled="isFeedDownloading(feed.id)"
                        @click.stop="downloadSingleFeed(feed)"
                      >
                        <LucideDownload :size="13" />
                        <span>下载</span>
                      </el-button>
                      <el-button
                        v-if="!isFriendContext"
                        text
                        size="small"
                        class="delete-btn"
                        @click="deleteFeed(feed)"
                      >
                        <el-icon><Delete /></el-icon>
                        <span>删除</span>
                      </el-button>
                    </div>
                  </div>

                  <!-- 动态内容 -->
                  <div class="feed-body">
                    <!-- 相册标题（上传到相册类型） -->
                    <div
                      v-if="feed.albumTitle"
                      class="feed-album-title"
                      @click="handleAlbumClick(feed)"
                    >
                      <el-icon class="album-icon"><Folder /></el-icon>
                      <span class="album-title-text">{{ feed.albumTitle }}</span>
                      <el-icon class="link-icon"><ArrowRight /></el-icon>
                    </div>

                    <!-- 文本内容 -->
                    <div v-if="feed.text" class="feed-text">
                      <RichText :text="feed.text" />
                    </div>

                    <!-- 媒体内容 -->
                    <div v-if="feed.media && feed.media.length > 0" class="media-container">
                      <div class="media-row tl-media">
                        <div
                          v-for="(item, idx) in feed.media.slice(0, 8)"
                          :key="idx"
                          class="media-item tl-media-item"
                          :class="{
                            'is-video': item.type === 'video',
                            'privacy-mode': privacyStore.privacyMode
                          }"
                          @click="previewMedia(feed.media, idx, feed)"
                        >
                          <!-- 视频 -->
                          <div v-if="item.type === 'video'" class="media-video">
                            <el-icon class="video-play-icon"><VideoPlay /></el-icon>
                            <el-image
                              v-if="item.cover"
                              :src="item.cover"
                              fit="cover"
                              class="media-thumb"
                            />
                            <div v-else class="media-placeholder">
                              <el-icon><VideoPlay /></el-icon>
                            </div>
                            <div
                              v-if="privacyStore.privacyMode"
                              class="media-privacy-overlay tl-privacy-overlay qz-privacy-overlay"
                            >
                              <el-icon class="privacy-icon qz-privacy-icon"><Hide /></el-icon>
                              <span class="privacy-text qz-privacy-text">隐私保护</span>
                            </div>
                          </div>
                          <!-- 图片 -->
                          <div v-else class="media-image-wrapper">
                            <el-image :src="item.url" fit="cover" lazy class="media-thumb">
                              <template #error>
                                <div class="media-error">
                                  <el-icon><Picture /></el-icon>
                                </div>
                              </template>
                            </el-image>
                            <div
                              v-if="privacyStore.privacyMode"
                              class="media-privacy-overlay tl-privacy-overlay qz-privacy-overlay"
                            >
                              <el-icon class="privacy-icon qz-privacy-icon"><Hide /></el-icon>
                              <span class="privacy-text qz-privacy-text">隐私保护</span>
                            </div>
                          </div>
                        </div>
                        <div
                          v-if="feed.photoTotal && feed.photoTotal > 8"
                          class="media-more tl-media-more"
                          @click="previewMedia(feed.media, 8, feed)"
                        >
                          +{{ feed.photoTotal - 8 }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 底部：互动信息 -->
                  <div class="feed-footer tl-footer">
                    <div class="feed-footer-main">
                      <!-- 浏览量 + 设备 chip：与动态 tab 同一套 .tl-chip 设计语言 -->
                      <div v-if="feed.visitorCount > 0 || feed.sourceName" class="feed-meta-tags">
                        <span v-if="feed.visitorCount > 0" class="tl-chip" title="浏览量">
                          <Eye :size="12" class="tl-chip-icon" />{{ feed.visitorCount }}
                        </span>
                        <span
                          v-if="feed.sourceName"
                          class="tl-chip"
                          :title="`来自 ${feed.sourceName}`"
                        >
                          <Smartphone :size="12" class="tl-chip-icon" />{{ feed.sourceName }}
                        </span>
                      </div>
                      <div v-else class="feed-meta-tags-placeholder"></div>

                      <div class="feed-actions">
                        <div class="action-item tl-stat" :class="{ active: feed.isLiked }">
                          <ThumbsUp :size="14" class="action-icon" />
                          <span v-if="feed.likeCount > 0" class="action-count">{{
                            feed.likeCount
                          }}</span>
                        </div>
                        <div class="action-item tl-stat">
                          <MessageCircle :size="14" class="action-icon" />
                          <span v-if="feed.commentCount > 0" class="action-count">{{
                            feed.commentCount
                          }}</span>
                        </div>
                      </div>
                    </div>

                    <div v-if="feed.likes && feed.likes.length > 0" class="feed-likes">
                      <ThumbsUp :size="14" class="like-icon" />
                      <div class="likes-content">
                        <template v-if="feed.likes.length <= 5 || expandedLikes.has(feed.id)">
                          <span v-for="like in feed.likes" :key="like.uin" class="like-name">{{
                            like.name
                          }}</span>
                          <button
                            v-if="feed.likes.length > 5"
                            class="like-toggle"
                            @click="expandedLikes.delete(feed.id)"
                          >
                            收起
                          </button>
                        </template>
                        <template v-else>
                          <span
                            v-for="like in feed.likes.slice(0, 5)"
                            :key="like.uin"
                            class="like-name"
                            >{{ like.name }}</span
                          >
                          <button class="like-toggle" @click="expandedLikes.add(feed.id)">
                            等 {{ feed.likes.length }} 人
                          </button>
                        </template>
                        <span class="like-suffix">觉得很赞</span>
                      </div>
                    </div>

                    <FeedComment
                      :comments="feed.comments"
                      @author-click="onCommentAuthorClick"
                      @mention-click="onCommentAuthorClick"
                    />
                  </div>
                </div>
              </div>
            </template>

            <!-- 加载更多指示器 -->
            <div v-if="loadingMore" class="loading-more">
              <el-icon class="loading-icon"><Loading /></el-icon>
              <span>正在加载更多动态...</span>
            </div>

            <!-- 没有更多数据提示 -->
            <div v-else-if="!hasMore && feeds.length > 0" class="no-more">
              <span>已加载全部动态</span>
            </div>

            <!-- 加载触发器（隐藏，仅用于触发加载） -->
            <div
              v-if="hasMore && !loading && !loadingMore"
              ref="loadMoreTrigger"
              class="load-more-trigger"
            ></div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 媒体预览（图片+视频混合） -->
    <MediaPreview
      :visible="previewVisible"
      :items="previewItems"
      :initial-index="previewIndex"
      :resolve-item="resolvePreviewItem"
      @update:visible="previewVisible = $event"
    />

    <!-- 底部悬浮工具栏：进入多选模式即出现（即便 0 选中也显示空状态，避免来回闪动） -->
    <Transition name="toolbar" appear>
      <div v-if="isSelectionMode && !isFriendContext && !isFriendPhotos" class="floating-toolbar">
        <div class="toolbar-pill">
          <div class="toolbar-left">
            <CircleCheckBig :size="18" class="check-icon" />
            <span class="selected-count">
              <strong>{{ selectedFeeds.size }}</strong>
              <span class="dim"> / {{ feeds.length }}</span> 已选
            </span>
          </div>
          <div class="toolbar-actions">
            <button class="tb-btn" @click="toggleSelectAll">
              <CheckSquare :size="14" />{{ isAllSelected ? '取消全选' : '全选' }}
            </button>
            <button
              class="tb-btn tb-btn-primary"
              :disabled="!selectedFeeds.size || downloadingSelected"
              @click="downloadSelectedFeeds"
            >
              <LucideDownload :size="14" />
              {{
                downloadingSelected
                  ? '加入下载…'
                  : `下载选中${selectedFeeds.size ? ' ' + selectedFeeds.size : ''}`
              }}
            </button>
            <el-tooltip
              content="仅复制图片链接，不会下载图片。链接是否可在网页中打开取决于 QQ 空间权限和链接有效期。"
              placement="top"
            >
              <button
                class="tb-btn"
                :disabled="selectedImageLinks.length === 0"
                :aria-label="`复制 ${selectedImageLinks.length} 条图片链接`"
                @click="copySelectedImageLinks"
              >
                <Link2 :size="14" />复制图片链接{{
                  selectedImageLinks.length ? ` ${selectedImageLinks.length}` : ''
                }}
              </button>
            </el-tooltip>
            <button
              class="tb-btn tb-btn-danger"
              :disabled="!selectedFeeds.size"
              @click="deleteSelectedFeeds"
            >
              <Trash2 :size="14" />删除选中
            </button>
            <div class="tb-divider"></div>
            <button class="tb-btn tb-btn-close" title="退出多选 (Esc)" @click="exitSelectionMode">
              <X :size="16" />
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 删除进度对话框 -->
    <el-dialog
      v-model="deleteProgressVisible"
      title="批量删除动态"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="delete-progress-dialog"
    >
      <div class="delete-progress-content">
        <div class="progress-info">
          <span class="progress-text">
            正在删除：{{ deleteProgress.current }} / {{ deleteProgress.total }}
          </span>
          <span class="progress-percentage">
            {{
              deleteProgress.total > 0
                ? Math.round((deleteProgress.current / deleteProgress.total) * 100)
                : 0
            }}%
          </span>
        </div>
        <el-progress
          :percentage="
            deleteProgress.total > 0
              ? Math.round((deleteProgress.current / deleteProgress.total) * 100)
              : 0
          "
          :status="deleteProgress.status"
        />
        <div v-if="deleteProgress.failed > 0" class="progress-failed">
          失败：{{ deleteProgress.failed }} 条
        </div>
        <div v-if="deleteProgress.currentItem" class="progress-current">
          当前：{{ deleteProgress.currentItem }}
        </div>
      </div>
      <template #footer>
        <el-button
          v-if="deleteProgress.status === 'success' || deleteProgress.status === 'exception'"
          type="primary"
          @click="closeDeleteProgress"
        >
          完成
        </el-button>
      </template>
    </el-dialog>

    <!-- 视频预览对话框 -->
    <el-dialog
      v-model="videoPreviewVisible"
      :title="currentVideoInfo?.title || '视频预览'"
      width="800px"
      top="5vh"
      class="video-preview-dialog"
      :close-on-click-modal="false"
      @close="closeVideoPreview"
    >
      <div v-if="currentVideoInfo" class="video-player-wrapper">
        <!-- 视频播放器容器 -->
        <div class="video-player-container">
          <video
            ref="videoPlayerRef"
            :poster="currentVideoInfo.cover"
            controls
            class="video-player"
          >
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
                v-if="currentVideoInfo?.url"
                type="success"
                size="small"
                @click="openVideoInBrowser"
              >
                在浏览器中打开
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="videoPreviewVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  VideoPlay,
  Picture,
  Delete,
  Loading,
  Folder,
  ArrowRight,
  Refresh,
  Hide,
  Warning
} from '@element-plus/icons-vue'
import { Select, Close, Check } from '@element-plus/icons-vue'
// 真 SVG 图标库（替换 emoji 用），按需 tree-shake
import {
  ThumbsUp,
  MessageCircle,
  Image as ImageIcon,
  Eye,
  Smartphone,
  CircleCheckBig,
  CheckSquare,
  Trash2,
  X,
  Download as LucideDownload,
  Link2
} from '@lucide/vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { ElDialog, ElButton } from 'element-plus'
import MediaPreview from '@renderer/components/MediaPreview/index.vue'
import { useUserStore } from '@renderer/store/user.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import RichText from '@renderer/components/RichText/index.vue'
import FeedComment from '@renderer/components/FeedComment/index.vue'
import { copyToClipboard } from '@renderer/utils'
import { getQQAvatarUrl } from '@renderer/utils/formatters'
import { createPaginationGuard } from '@renderer/utils/paginationGuard'
import { cacheFeedDescriptions } from '@renderer/utils/feed-description-cache'
import Hls from 'hls.js'

const privacyStore = usePrivacyStore()

const props = defineProps({
  photoType: {
    type: String,
    default: 'my-photos'
  }
})

const emit = defineEmits(['album-click'])

const isFriendPhotos = computed(() => props.photoType === 'friend-photos')

const loading = ref(false)
const loadingMore = ref(false)
const isScrollLoading = ref(false) // 防止重复加载
const userStore = useUserStore()

// 支持好友上下文
const hostUinOverride = inject('hostUinOverride', null)
const leftRef = inject('leftRef', null)
const effectiveHostUin = computed(() => hostUinOverride?.value || userStore.userInfo.uin)
const isFriendContext = computed(() => !!hostUinOverride?.value)
const friendMeta = computed(() => (isFriendContext.value ? { skipAuthCheck: true } : {}))

// 动态数据
const feeds = ref([])
const hasMore = ref(true)
const pageGuard = createPaginationGuard({ cooldownMs: 1500, maxFailures: 3 })

// 多选状态
const selectedFeeds = ref(new Set())
const isSelectionMode = ref(false)
const downloadingSelected = ref(false)
const downloadingPage = ref(false)
const feedDownloadingIds = ref(new Set())

// 点赞列表展开状态：点赞 > 5 个时折叠成前 5 + "等 N 人"
const expandedLikes = reactive(new Set())

// 是否全选
const isAllSelected = computed(() => {
  if (feeds.value.length === 0) return false
  return feeds.value.every((feed) => selectedFeeds.value.has(feed.id))
})

// 删除进度
const deleteProgressVisible = ref(false)
const deleteProgress = ref({
  current: 0,
  total: 0,
  failed: 0,
  status: '', // success, exception, ''
  currentItem: ''
})

// 格式化日期标签
const formatDateLabel = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const feedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffTime = today - feedDate
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  if (diffDays < 7) return `${diffDays}天前`

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (year === now.getFullYear()) {
    return `${month}月${day}日`
  }
  return `${year}年${month}月${day}日`
}

// 媒体类型判定（all / photo / video / text）
const detectFeedMedia = (feed) => {
  if (!feed.media || feed.media.length === 0) return 'text'
  const hasVideo = feed.media.some((m) => m.type === 'video')
  if (hasVideo && feed.media.length === 1) return 'video'
  return 'photo'
}

// 应用 sidebar 筛选（仅 my-photos 时生效）
const filteredFeeds = computed(() => {
  if (isFriendPhotos.value) return feeds.value
  const f = leftRef?.value?.photoFilters || {}
  let list = feeds.value
  if (f.media && f.media !== 'all') {
    list = list.filter((feed) => detectFeedMedia(feed) === f.media)
  }
  if (f.year && f.year !== 'all') {
    list = list.filter((feed) => {
      const t = feed.date ? new Date(feed.date).getFullYear() : null
      return t === f.year
    })
  }
  return list
})

// 按日期分组动态（使用筛选后的 list）
const groupedFeeds = computed(() => {
  const src = filteredFeeds.value
  if (!src || src.length === 0) return []

  const groups = new Map()

  src.forEach((feed) => {
    const dateKey = feed.date // 使用 YYYY-MM-DD 格式作为 key
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        dateKey,
        dateLabel: formatDateLabel(feed.date),
        feeds: []
      })
    }
    groups.get(dateKey).feeds.push(feed)
  })

  // 按日期降序排序（最新的在前）
  return Array.from(groups.values()).sort((a, b) => {
    return new Date(b.dateKey) - new Date(a.dateKey)
  })
})

const getDownloadableMedia = (feed) => {
  return (feed?.media || [])
    .map((media, index) => {
      const isVideo = media.type === 'video' || media.is_video
      const url = media.raw || media.bigUrl || media.url || media.src || ''
      const pre = media.thumb || media.pre || media.cover || media.url || media.bigUrl || ''
      const picKey = media.picKey || media.lloc || media.key || media.id || ''

      if (!url && !pre && !picKey) return null

      return {
        id: media.id || picKey || `${feed.id}_${index}`,
        name: media.name || `${isVideo ? 'video' : 'photo'}_${index + 1}`,
        url,
        raw: media.raw || media.bigUrl || '',
        pre,
        picKey,
        lloc: media.lloc || picKey,
        is_video: isVideo,
        modifytime: media.modifytime || Number(feed.time) || 0,
        uploadTime: media.uploadTime || '',
        size: media.size || 0
      }
    })
    .filter(Boolean)
}

const downloadableFeeds = computed(() => {
  return filteredFeeds.value.filter((feed) => getDownloadableMedia(feed).length > 0)
})

const downloadableMediaCount = computed(() => {
  return downloadableFeeds.value.reduce(
    (total, feed) => total + getDownloadableMedia(feed).length,
    0
  )
})

const isCopyableImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const selectedImageLinks = computed(() => {
  const links = new Set()
  feeds.value
    .filter((feed) => selectedFeeds.value.has(feed.id))
    .forEach((feed) => {
      getDownloadableMedia(feed).forEach((media) => {
        if (media.is_video || !isCopyableImageUrl(media.url)) return
        links.add(media.url)
      })
    })
  return [...links]
})

const buildDownloadPayload = (feedList) => {
  return feedList
    .map((feed) => ({
      skey: feed.id,
      time: feed.time,
      desc: feed.text || feed.albumTitle || '',
      authorName: feed.owner?.nick || userStore.userInfo?.nickname || '',
      authorUin: feed.owner?.uin || effectiveHostUin.value || '',
      albumId: feed.albumId || '',
      albumName: feed.albumName || '动态',
      referer: `https://user.qzone.qq.com/${feed.owner?.uin || effectiveHostUin.value || ''}`,
      photos: getDownloadableMedia(feed)
    }))
    .filter((feed) => feed.photos.length > 0)
}

const isFeedDownloading = (feedId) => feedDownloadingIds.value.has(feedId)

const setFeedDownloading = (feedId, downloading) => {
  const next = new Set(feedDownloadingIds.value)
  if (downloading) {
    next.add(feedId)
  } else {
    next.delete(feedId)
  }
  feedDownloadingIds.value = next
}

// 推送聚合统计到 sidebar
const updateLeftPhotoStats = () => {
  if (!leftRef?.value?.updatePhotoStats || isFriendPhotos.value) return
  const yearsSet = new Set()
  let commentSum = 0
  let likeSum = 0
  feeds.value.forEach((feed) => {
    if (feed.date) yearsSet.add(new Date(feed.date).getFullYear())
    commentSum += feed.commentCount || 0
    likeSum += feed.likeCount || 0
  })
  leftRef.value.updatePhotoStats({
    feedsCount: feeds.value.length,
    commentSum,
    likeSum,
    years: [...yearsSet].sort((a, b) => b - a)
  })
}

watch(feeds, updateLeftPhotoStats, { deep: false })
watch(() => props.photoType, updateLeftPhotoStats)

// 滚动加载相关
const loadMoreTrigger = ref(null)
let observer = null

// 图片预览
const previewVisible = ref(false)
const previewIndex = ref(0)
const previewItems = ref([])

// 视频预览相关
const videoPreviewVisible = ref(false)
const videoPlayerRef = ref(null)
const currentVideoInfo = ref(null)
const videoLoading = ref(false)
const videoError = ref('')
let hls = null

// 格式化动态时间显示（精确到秒，与 feeds 一致）
const formatFeedTime = (timeStr) => {
  if (!timeStr) return ''
  let date
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    date = new Date(timeStr)
  } else {
    const timestamp = typeof timeStr === 'string' ? parseInt(timeStr) : timeStr
    date = new Date(timestamp * 1000)
  }

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())

  if (y === now.getFullYear()) {
    return `${m}-${d} ${hh}:${mm}:${ss}`
  }
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

// 解析点赞用户信息
const parseLikeUsers = (likeUsersStr) => {
  if (!likeUsersStr || !likeUsersStr.trim()) return []
  const users = []
  const regex = /@\{uin:(\d+),\s*nick:([^,]+),\s*who:(\d+)\}/g
  let match
  while ((match = regex.exec(likeUsersStr)) !== null) {
    users.push({
      uin: match[1],
      name: match[2],
      who: match[3]
    })
  }
  return users
}

// 格式化评论时间
const formatCommentTime = (timestamp) => {
  if (!timestamp) return ''
  const time = parseInt(timestamp) * 1000
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()

  if (year === now.getFullYear()) {
    return `${month}月${day}日 ${hour}:${minute.toString().padStart(2, '0')}`
  }
  return `${year}年${month}月${day}日`
}

// 转换API数据为组件数据格式
const transformFeedData = (apiFeed) => {
  const media = []
  if (apiFeed.photos && Array.isArray(apiFeed.photos)) {
    apiFeed.photos.forEach((photo) => {
      if (!photo) return
      if (photo.is_video === '1' || photo.videourl) {
        // 视频
        media.push({
          type: 'video',
          url: photo.videourl,
          cover: photo.picsmallurl || photo.url,
          key: photo.videokey,
          picKey: photo.picKey || photo.lloc || photo.videokey,
          lloc: photo.lloc || photo.picKey || photo.videokey,
          name: photo.name || photo.desc || '',
          modifytime: parseInt(apiFeed.time) || 0
        })
      } else if (photo.url || photo.picsmallurl) {
        // 图片
        media.push({
          type: 'image',
          url: photo.picsmallurl || photo.url,
          bigUrl: photo.picbigurl || photo.url,
          raw: photo.raw || photo.picrawurl || '',
          picKey: photo.picKey || photo.lloc || photo.id,
          lloc: photo.lloc || photo.picKey || photo.id,
          name: photo.name || photo.desc || '',
          modifytime: parseInt(apiFeed.time) || 0
        })
      }
    })
  }

  // 解析评论
  const comments = []
  if (apiFeed.comments && Array.isArray(apiFeed.comments)) {
    apiFeed.comments.forEach((comment) => {
      if (!comment || !comment.content) return

      // 解析回复
      const responses = []
      if (comment.responses && Array.isArray(comment.responses)) {
        comment.responses.forEach((response) => {
          if (!response || !response.content) return
          responses.push({
            id: response.id,
            uin: response.uin,
            author: response.nick,
            text: response.content,
            targetUin: response.target_uin || '',
            targetNick: response.target_nick || '',
            time: formatCommentTime(response.time)
          })
        })
      }

      comments.push({
        id: comment.id,
        uin: comment.uin,
        author: comment.nick,
        text: comment.content,
        time: formatCommentTime(comment.time),
        responses: responses,
        respnum: parseInt(comment.respnum || 0)
      })
    })
  }

  // 处理时间（秒级时间戳）
  const timestamp = parseInt(apiFeed.time) || 0
  const feedDate = new Date(timestamp * 1000)

  // 处理上传到相册类型的标题
  let albumTitle = null
  if (apiFeed.type === 'upload_photo' && apiFeed.albumname && apiFeed.albumid) {
    albumTitle = `上传到相册：${apiFeed.albumname}`
  }

  // 提取隐藏数据：浏览量、设备来源（API字段名可能有尾部空格）
  const visitorCount = parseInt(apiFeed.visitorCount || apiFeed['visitorCount '] || 0)
  const sourceName = apiFeed.source_name || ''

  return {
    id: apiFeed.skey || apiFeed.time,
    date: feedDate.toISOString().split('T')[0],
    time: timestamp.toString(),
    text: apiFeed.desc || '',
    media,
    photoTotal: parseInt(apiFeed.photo_total || 0),
    albumTitle,
    albumId: apiFeed.albumid || null,
    albumName: apiFeed.albumname || null,
    typeid: apiFeed.typeid || 0,
    isLiked: apiFeed.ilike === '1',
    likeCount: parseInt(apiFeed.praiseNum || 0),
    commentCount: parseInt(apiFeed.comment_total || 0),
    likes: parseLikeUsers(apiFeed.like_users),
    comments,
    visitorCount,
    sourceName
  }
}

// 进入多选模式
const enterSelectionMode = () => {
  isSelectionMode.value = true
  selectedFeeds.value.clear()
}

// 退出多选模式
const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedFeeds.value.clear()
}

// 切换动态选择状态
const toggleFeedSelection = (feed) => {
  if (selectedFeeds.value.has(feed.id)) {
    selectedFeeds.value.delete(feed.id)
  } else {
    selectedFeeds.value.add(feed.id)
  }
  // 触发响应式更新
  selectedFeeds.value = new Set(selectedFeeds.value)
}

const addFeedDownloadTasks = async (feedList) => {
  const groups = new Map()
  const accountUin = userStore.userInfo?.uin || effectiveHostUin.value

  feedList.forEach((feed) => {
    const friendUin = isFriendPhotos.value
      ? feed.owner?.uin || null
      : isFriendContext.value
        ? effectiveHostUin.value
        : null
    const key = friendUin || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(feed)
  })

  const taskIds = []
  for (const [friendUin, list] of groups.entries()) {
    const payload = buildDownloadPayload(list)
    if (!payload.length) continue
    const ids = await window.QzoneAPI.download.addFeeds({
      feeds: payload,
      uin: accountUin,
      friendUin: friendUin || null
    })
    taskIds.push(...(ids || []))
  }

  return taskIds
}

const downloadSingleFeed = async (feed) => {
  if (!feed || isFeedDownloading(feed.id)) return
  setFeedDownloading(feed.id, true)
  try {
    const ids = await addFeedDownloadTasks([feed])
    if (!ids.length) {
      ElMessage.warning('这条动态没有可下载的照片')
      return
    }
    ElMessage.success(`已添加 ${ids.length} 个下载任务`)
  } catch (e) {
    console.error('[photo] 下载动态失败', e)
    ElMessage.error(`下载失败：${e.message || e}`)
  } finally {
    setFeedDownloading(feed.id, false)
  }
}

const downloadCurrentPageFeeds = async () => {
  if (downloadingPage.value) return
  downloadingPage.value = true
  try {
    const ids = await addFeedDownloadTasks(downloadableFeeds.value)
    if (!ids.length) {
      ElMessage.warning('当前页没有可下载的照片')
      return
    }
    ElMessage.success(`已添加 ${ids.length} 个下载任务（${downloadableFeeds.value.length} 条动态）`)
  } catch (e) {
    console.error('[photo] 下载当前页失败', e)
    ElMessage.error(`下载当前页失败：${e.message || e}`)
  } finally {
    downloadingPage.value = false
  }
}

// 批量下载选中的动态：调 addFeeds 把每条动态的全部媒体加入下载队列
const downloadSelectedFeeds = async () => {
  if (selectedFeeds.value.size === 0) return
  downloadingSelected.value = true
  try {
    const selected = feeds.value.filter((f) => selectedFeeds.value.has(f.id))
    const selectedWithMedia = selected.filter((feed) => getDownloadableMedia(feed).length > 0)
    if (!selectedWithMedia.length) {
      ElMessage.warning('选中的动态都没有可下载的媒体')
      return
    }
    const ids = await addFeedDownloadTasks(selectedWithMedia)
    ElMessage.success(`已添加 ${ids?.length || 0} 个下载任务`)
  } catch (e) {
    console.error('[photo] 批量下载失败', e)
    ElMessage.error(`批量下载失败：${e.message || e}`)
  } finally {
    downloadingSelected.value = false
  }
}

const copySelectedImageLinks = async () => {
  const links = selectedImageLinks.value
  if (!links.length) {
    ElMessage.warning('选中的动态没有可复制的图片链接')
    return
  }

  try {
    await navigator.clipboard.writeText(links.join('\n'))
    ElMessage.success(`已复制 ${links.length} 条图片链接`)
  } catch (error) {
    console.error('[photo] 批量复制图片链接失败', error)
    ElMessage.error('复制失败，请检查系统剪贴板权限')
  }
}

// 全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消全选
    selectedFeeds.value.clear()
  } else {
    // 全选
    const allFeedIds = feeds.value.map((feed) => feed.id)
    selectedFeeds.value = new Set(allFeedIds)
  }
}

// 批量删除选中的动态
const deleteSelectedFeeds = async () => {
  if (selectedFeeds.value.size === 0) {
    ElMessage.warning('请先选择要删除的动态')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedFeeds.value.size} 条动态吗？删除后无法恢复。`,
      '批量删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        distinguishCancelAndClose: true
      }
    )

    // 获取选中的动态对象
    const selectedFeedList = feeds.value.filter((feed) => selectedFeeds.value.has(feed.id))

    if (selectedFeedList.length === 0) {
      ElMessage.error('未找到选中的动态')
      return
    }

    // 初始化删除进度
    deleteProgress.value = {
      current: 0,
      total: selectedFeedList.length,
      failed: 0,
      status: '',
      currentItem: ''
    }
    deleteProgressVisible.value = true

    const hostUin = effectiveHostUin.value
    let successCount = 0
    let failedCount = 0

    // 逐个删除
    for (let i = 0; i < selectedFeedList.length; i++) {
      const feed = selectedFeedList[i]
      deleteProgress.value.currentItem = feed.text || feed.albumTitle || `动态 ${i + 1}`

      try {
        await window.QzoneAPI.deleteFeed(
          {
            hostUin,
            skey: feed.id,
            time: feed.time,
            typeid: feed.typeid || 0,
            flag: 0
          },
          friendMeta.value
        )
        successCount++
      } catch (error) {
        console.error(`删除动态失败 (${feed.id}):`, error)
        failedCount++
      }

      deleteProgress.value.current = i + 1
      deleteProgress.value.failed = failedCount
    }

    // 删除完成，设置状态
    if (failedCount === 0) {
      deleteProgress.value.status = 'success'
    } else if (successCount === 0) {
      deleteProgress.value.status = 'exception'
    } else {
      deleteProgress.value.status = 'warning'
    }

    // 重新加载数据（从头开始）
    hasMore.value = true
    await loadFeeds(false)

    // 重新设置观察器（使用防抖）
    debouncedSetupObserver()

    // 清空选择并退出多选模式
    selectedFeeds.value.clear()
    isSelectionMode.value = false

    // 显示结果消息
    if (failedCount === 0) {
      ElMessage.success(`成功删除 ${successCount} 条动态`)
    } else if (successCount === 0) {
      ElMessage.error('删除失败')
    } else {
      ElMessage.warning(`删除完成：成功 ${successCount} 条，失败 ${failedCount} 条`)
    }
  } catch (error) {
    // 用户取消
    if (error !== 'cancel' && error !== 'close') {
      console.error('批量删除确认失败:', error)
    }
  }
}

// 关闭删除进度对话框
const closeDeleteProgress = () => {
  deleteProgressVisible.value = false
  deleteProgress.value = {
    current: 0,
    total: 0,
    failed: 0,
    status: '',
    currentItem: ''
  }
}

// 删除单个动态
const deleteFeed = async (feed) => {
  try {
    await ElMessageBox.confirm('确定要删除这条动态吗？删除后无法恢复。', '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true
    })

    // 显示加载状态
    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在删除...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      // 调用删除接口
      const hostUin = effectiveHostUin.value
      await window.QzoneAPI.deleteFeed(
        {
          hostUin,
          skey: feed.id, // 使用 feed.id (即 skey)
          time: feed.time, // 使用 feed.time
          typeid: feed.typeid || 0, // 使用 feed.typeid
          flag: 0
        },
        friendMeta.value
      )

      // 删除后重新拉取最新数据以确保数据一致性
      // 因为接口可能不准确，所以通过重新加载来验证删除结果
      hasMore.value = true
      await loadFeeds(false) // 重新加载数据（从头开始）

      loadingInstance.close()
      ElMessage.success('删除成功')

      // 重新设置观察器（使用防抖）
      debouncedSetupObserver()
    } catch (error) {
      loadingInstance.close()
      console.error('删除动态失败:', error)
      ElMessage.error('删除失败：' + (error.message || '未知错误'))
    }
  } catch (error) {
    // 用户取消
    if (error !== 'cancel' && error !== 'close') {
      console.error('删除确认失败:', error)
    }
  }
}

// 预览媒体（图片/视频）—— 统一走 MediaPreview，图视频混合切换
const previewMedia = async (media, index) => {
  if (!media || !Array.isArray(media) || media.length === 0) return
  previewItems.value = media.map((m) => ({
    type: m.type === 'video' ? 'video' : 'image',
    src: m.type === 'video' ? '' : m.bigUrl || m.url,
    thumb: m.thumb || m.url,
    title: m.title || '',
    needsResolve: m.type === 'video',
    _media: m
  }))
  previewIndex.value = Math.max(0, index)
  previewVisible.value = true
}

// 视频 src 异步解析（feeds 列表里的视频通常已经有 url，直接返回即可；好友视频需走 floatview）
const resolvePreviewItem = async (item, idx) => {
  if (item.type !== 'video' || item.src) return item
  const m = item._media
  if (m?.url) {
    previewItems.value[idx] = { ...item, src: m.url, needsResolve: false }
    return previewItems.value[idx]
  }
  return item
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
    if (videoPreviewVisible.value) {
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
  if (!currentVideoInfo.value || !currentVideoInfo.value.url) {
    ElMessage.warning('没有可播放的视频')
    return
  }

  videoError.value = ''
  videoLoading.value = true
  playVideo(currentVideoInfo.value.url)
}

// 关闭视频预览
const closeVideoPreview = () => {
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

  currentVideoInfo.value = null
  videoPreviewVisible.value = false
  videoLoading.value = false
  videoError.value = ''
}

// 打开视频地址
const openVideoInBrowser = () => {
  if (!currentVideoInfo.value || !currentVideoInfo.value.url) {
    ElMessage.error('视频地址无效')
    return
  }

  window.QzoneAPI?.shell
    ?.openExternal?.(currentVideoInfo.value.url)
    ?.then(() => ElMessage.success('正在打开视频...'))
    ?.catch(() => ElMessage.error('打开视频失败'))
}

// 获取头像URL
const getAvatarUrl = (uin) => {
  return getQQAvatarUrl(uin, 30)
}

// 处理头像加载失败
const handleAvatarError = (event) => {
  // 头像加载失败时,使用默认头像
  const img = event.target
  // 使用一个纯色背景作为默认头像
  img.src =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="%2360a5fa"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif"%3E?%3C/text%3E%3C/svg%3E'
}

// 点击评论作者 / @mention：复制对方 QQ 号
const onCommentAuthorClick = (target) => {
  if (target?.uin) copyToClipboard(target.uin, 'QQ 号')
}

// 处理相册标题点击
const handleAlbumClick = (feed) => {
  if (feed.albumId) {
    emit('album-click', {
      albumId: feed.albumId,
      albumName: feed.albumName
    })
  }
}

// 加载动态数据
// 用说说API增强feeds数据（设备型号、评论IP等）
const enrichFeedsWithShuoshuo = async () => {
  try {
    const hostUin = effectiveHostUin.value
    const res = await window.QzoneAPI.getShuoshuo(
      {
        targetUin: hostUin,
        pos: 0,
        num: 20
      },
      { skipAuthCheck: true }
    )

    if (res?.msglist) {
      // 用时间戳匹配feeds和说说
      const shuoshuoMap = new Map()
      for (const msg of res.msglist) {
        if (msg.created_time) {
          shuoshuoMap.set(String(msg.created_time), msg)
        }
      }

      feeds.value = feeds.value.map((feed) => {
        const matched = shuoshuoMap.get(feed.time)
        if (!matched) return feed

        // 用「uin + content 前 30 字」匹配同一条评论 —— 顺序可能因私密评论不一致，
        // 不能纯按 index；这个 key 在同一作者短时间内的同一条说说里足够稳。
        const cmtDeviceMap = new Map()
        for (const c of matched.commentlist || []) {
          if (c.uin && c.source_name) {
            const key = `${c.uin}|${(c.content || '').slice(0, 30)}`
            cmtDeviceMap.set(key, c.source_name)
          }
        }

        return {
          ...feed,
          sourceName: matched.source_name || feed.sourceName,
          visitorCount:
            feed.visitorCount || parseInt(matched.visitorCount || matched['visitorCount '] || 0),
          comments: (feed.comments || []).map((cmt) => {
            const key = `${cmt.uin}|${(cmt.text || '').slice(0, 30)}`
            const device = cmtDeviceMap.get(key)
            return device ? { ...cmt, deviceName: device } : cmt
          })
        }
      })
    }
  } catch {
    /* silent - enrichment is optional */
  }
}

let currentLoadId = 0

const getFeedPageKey = () => {
  const lastFeed = feeds.value[feeds.value.length - 1]
  const begintime = lastFeed ? parseInt(lastFeed.time) || 0 : 0
  return `${props.photoType}:${effectiveHostUin.value}:${feeds.value.length}:${begintime}`
}

const loadFeeds = async (isLoadMore = false) => {
  console.log('[loadFeeds] 开始加载', {
    isLoadMore,
    loading: loading.value,
    loadingMore: loadingMore.value,
    feedsCount: feeds.value.length
  })

  if (loading.value || (isLoadMore && loadingMore.value)) {
    console.log('[loadFeeds] 已在加载中，跳过')
    return
  }

  const pageKey = getFeedPageKey()
  if (isLoadMore && !pageGuard.canLoad(pageKey)) return
  if (!isLoadMore) pageGuard.reset()

  const thisLoadId = ++currentLoadId

  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
  }

  try {
    let currentBegintime = 0
    if (isLoadMore && feeds.value.length > 0) {
      // 获取当前列表中最后一条动态的 time
      const lastFeed = feeds.value[feeds.value.length - 1]
      currentBegintime = parseInt(lastFeed.time) || 0
    }

    let response
    let transformedFeeds
    let responseHasMore = null

    if (isFriendPhotos.value) {
      // 好友照片模式：使用 feeds2_html_picfeed API
      response = await window.QzoneAPI.getFriendPhotos(
        {
          start: isLoadMore ? feeds.value.length : 0,
          count: 20,
          begintime: currentBegintime
        },
        { skipAuthCheck: true }
      )

      if (response && response.code === 0 && response.data) {
        const photos = response.data.photos || []
        transformedFeeds = processFriendPhotos(photos)
        // 好友照片用 hasmore 字段判断；等过时请求校验后再落状态。
        responseHasMore = !!response.data.hasmore
      }
    } else {
      // 我的照片模式：使用 feeds2_html_picfeed_qqtab API
      const hostUin = effectiveHostUin.value
      response = await window.QzoneAPI.getFeeds(
        {
          hostUin,
          begintime: currentBegintime
        },
        friendMeta.value
      )

      if (response && response.code === 0 && response.data) {
        const apiFeeds = response.data.feeds || []
        transformedFeeds = processApiFeeds(apiFeeds)
      }
    }

    // 请求已过时（用户切换了类型），丢弃结果
    if (thisLoadId !== currentLoadId) return

    if (response && response.code === 0 && response.data && transformedFeeds) {
      pageGuard.succeed()
      if (transformedFeeds.length > 0) {
        if (isLoadMore) {
          const existingIds = new Set(feeds.value.map((f) => f.id))
          const filteredFeeds = transformedFeeds.filter((feed) => !existingIds.has(feed.id))

          if (filteredFeeds.length > 0) {
            feeds.value.push(...filteredFeeds)
            if (responseHasMore === false) hasMore.value = false
          } else {
            hasMore.value = false
          }
        } else {
          feeds.value = transformedFeeds
          hasMore.value = responseHasMore ?? true
        }
        cacheFeedDescriptions(effectiveHostUin.value, feeds.value)
        // 异步加载说说数据来增强feeds（设备信息、浏览量等）
        enrichFeedsWithShuoshuo()
      } else {
        // 返回的数据为空，说明没有更多数据了
        hasMore.value = false
        if (!isLoadMore) {
          // 首次加载就没数据，显示空状态
          feeds.value = []
        }
      }
    } else {
      // API 调用失败
      if (isLoadMore) {
        const failure = pageGuard.fail(pageKey)
        hasMore.value = !failure.shouldStop
        ElMessage.warning(response?.message || '加载更多失败，稍后可继续重试')
      } else {
        hasMore.value = false
        ElMessage.error(response?.message || '加载动态失败')
      }
    }
  } catch (error) {
    console.error('加载动态失败:', error)
    if (isLoadMore) {
      const failure = pageGuard.fail(pageKey)
      hasMore.value = !failure.shouldStop
      ElMessage.warning('加载更多失败，稍后可继续重试')
    } else {
      hasMore.value = false
      ElMessage.error('加载动态失败: ' + (error.message || '未知错误'))
    }
  } finally {
    if (thisLoadId === currentLoadId) {
      loading.value = false
      loadingMore.value = false
      isScrollLoading.value = false
    }
  }
}

// 加载更多动态
const loadMoreFeeds = async () => {
  if (isScrollLoading.value || !hasMore.value || loading.value) {
    return
  }

  isScrollLoading.value = true
  try {
    await loadFeeds(true)
  } finally {
    // 延迟解锁，防止快速滚动时重复触发
    setTimeout(() => {
      isScrollLoading.value = false
    }, 300)
  }
}

// 处理刷新按钮点击
const handleRefresh = async () => {
  if (loading.value) {
    return // 如果正在加载，不执行刷新
  }

  try {
    // 重置状态
    hasMore.value = true
    // 重新加载数据（从头开始）
    await loadFeeds(false)
    // 重新设置观察器（使用防抖）
    debouncedSetupObserver()
    ElMessage.success('刷新成功')
  } catch (error) {
    console.error('刷新失败:', error)
    ElMessage.error('刷新失败')
  }
}

// 设置 Intersection Observer
const setupIntersectionObserver = () => {
  // 先断开旧的观察器
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // 如果没有更多数据或正在加载，不设置观察器
  if (!hasMore.value || loading.value || !loadMoreTrigger.value) {
    return
  }

  // 创建新的观察器
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && hasMore.value && !isScrollLoading.value && !loading.value) {
          loadMoreFeeds()
        }
      })
    },
    {
      root: null, // 使用视口作为根
      rootMargin: '100px', // 提前100px触发加载
      threshold: 0.1
    }
  )

  // 开始观察
  if (loadMoreTrigger.value) {
    observer.observe(loadMoreTrigger.value)
  }
}

// 处理API返回的动态数据（供外部调用）
const processApiFeeds = (apiFeeds) => {
  if (!apiFeeds || !Array.isArray(apiFeeds)) return []
  return apiFeeds.filter((feed) => feed).map(transformFeedData)
}

// 处理好友照片 API 返回的数据
const processFriendPhotos = (photos) => {
  if (!photos || !Array.isArray(photos)) return []
  return photos
    .filter((p) => p)
    .map((photo) => {
      const media = []
      if (photo.is_video === '1' || photo.is_video === 1) {
        media.push({
          type: 'video',
          url: '', // 需要通过 floatview 接口获取
          cover: photo.small_url || photo.medium_url,
          lloc: photo.lloc,
          picKey: photo.lloc,
          name: photo.name || photo.desc || '',
          modifytime: parseInt(photo.uploadtime) || 0,
          albumId: photo.album?.id,
          ownerUin: photo.owner?.uin
        })
      } else {
        media.push({
          type: 'image',
          url: photo.medium_url || photo.small_url,
          bigUrl: photo.large_image?.url || photo.medium_url,
          raw: photo.raw || '',
          lloc: photo.lloc,
          picKey: photo.lloc,
          name: photo.name || photo.desc || '',
          modifytime: parseInt(photo.uploadtime) || 0
        })
      }

      const timestamp = parseInt(photo.uploadtime) || 0
      const feedDate = new Date(timestamp * 1000)

      return {
        id: photo.lloc || `${photo.owner?.uin}_${timestamp}_${photo.number}`,
        date: feedDate.toISOString().split('T')[0],
        time: timestamp.toString(),
        text: photo.desc || '',
        media,
        photoTotal: 1,
        albumTitle: photo.album?.title ? `${photo.album.title}` : null,
        albumId: photo.album?.id || null,
        albumName: photo.album?.title || null,
        owner: photo.owner
          ? {
              uin: photo.owner.uin,
              nick: photo.owner.nick,
              face: photo.owner.face
            }
          : null,
        isLiked: false,
        likeCount: parseInt(photo.praiseNum || 0),
        commentCount: parseInt(photo.comment_total || 0),
        likes: [],
        comments: []
      }
    })
}

// 导出供外部使用
defineExpose({
  loadFeeds,
  processApiFeeds,
  transformFeedData
})

// 检查容器是否需要加载更多数据（解决首次加载数据不足以填满容器的问题）
const checkAndLoadMore = async () => {
  // 等待 DOM 更新
  await nextTick()

  const scrollbarEl = document.querySelector('.timeline-scrollbar .el-scrollbar__wrap')
  if (!scrollbarEl) return

  const hasScrollbar = scrollbarEl.scrollHeight > scrollbarEl.clientHeight

  // 如果没有滚动条且还有更多数据可以加载，则自动加载
  if (
    !hasScrollbar &&
    hasMore.value &&
    !loading.value &&
    !isScrollLoading.value &&
    feeds.value.length > 0
  ) {
    console.log('检测到内容未填满容器，自动加载更多...')
    await loadMoreFeeds()
    // 递归检查是否还需要继续加载
    if (hasMore.value) {
      await checkAndLoadMore()
    }
  }
}

// 使用防抖优化观察器设置
let setupObserverTimer = null
const debouncedSetupObserver = () => {
  if (setupObserverTimer) {
    clearTimeout(setupObserverTimer)
  }
  setupObserverTimer = setTimeout(() => {
    nextTick(() => {
      setupIntersectionObserver()
      // 在设置观察器后，检查是否需要自动加载更多
      checkAndLoadMore()
    })
  }, 100)
}

const resetFeedsAndLoad = () => {
  // 切换照片来源或好友 host 时，旧分页结果必须作废，避免把上一个人的数据拼进来。
  currentLoadId++
  feeds.value = []
  hasMore.value = true
  pageGuard.reset()
  loading.value = false
  loadingMore.value = false
  isScrollLoading.value = false
  loadFeeds(false).then(() => {
    debouncedSetupObserver()
  })
}

// 监听关键状态变化，使用防抖设置观察器
watch([loadMoreTrigger, hasMore, loading], () => {
  debouncedSetupObserver()
})

// 切换照片类型或进入/退出好友空间时重新加载当前列表。
watch([() => props.photoType, () => effectiveHostUin.value], resetFeedsAndLoad)

// 多选模式按 Esc 退出
const handleEscKey = (e) => {
  if (e.key === 'Escape' && isSelectionMode.value) {
    exitSelectionMode()
  }
}

onMounted(() => {
  loadFeeds().then(() => {
    debouncedSetupObserver()
  })
  window.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  // 清理观察器
  if (observer) {
    observer.disconnect()
    observer = null
  }
  // 清理定时器
  if (setupObserverTimer) {
    clearTimeout(setupObserverTimer)
    setupObserverTimer = null
  }
  window.removeEventListener('keydown', handleEscKey)
})
</script>

<style lang="scss" scoped>
.photo-module {
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
  align-items: center;
  justify-content: space-between;
}

.title-section {
  display: flex;
  align-items: center;
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

.module-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.module-content {
  flex: 1;
  overflow: hidden;
}

.timeline-scrollbar {
  height: 100%;

  :deep(.el-scrollbar__wrap) {
    padding-right: 6px;
  }
}

.timeline-container {
  padding: 16px 24px 24px;
  width: 100%;
  max-width: 100%;
}

.feeds-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 老的 timeline-line 不再用（tl-container::before 替代） */
.timeline-line {
  display: none;
}

/* 日期分组标题：保留 date-line 隐藏（视觉走 .tl-date-header） */
.date-group-header {
  .date-line {
    display: none;
  }
}

/* 加载更多指示器 */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;

  .loading-icon {
    font-size: 16px;
    animation: loading-spin 1s linear infinite;
  }
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.load-more-trigger {
  height: 1px;
  margin: 20px 0;
  pointer-events: none;
  visibility: hidden;
}

@keyframes loading-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

// ========== 好友照片网格布局 ==========
.friend-photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding: 4px;
}

.friend-photo-card {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);

    .card-image {
      transform: scale(1.03);
    }
  }

  /* 隐私模式 */
  &.privacy-mode {
    .card-image :deep(.el-image__inner) {
      filter: blur(var(--qz-privacy-media-blur));
      transition: filter 0.3s ease;
    }

    &:hover {
      transform: none;

      .card-image {
        transform: none;
      }
    }
  }
}

.card-image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
}

.card-image {
  width: 100%;
  height: 100%;
  transition: transform 0.3s ease;
}

.card-image-error {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.2);
  font-size: 32px;
}

.card-video-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.card-privacy-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.card-info {
  padding: 10px 12px;
}

.card-owner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.card-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.card-nick {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.card-download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 28px;
  margin-top: 8px;
  padding: 0 10px;
  color: rgba(96, 165, 250, 0.9);
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    color: #fff;
    background: rgba(96, 165, 250, 0.18);
    border-color: rgba(96, 165, 250, 0.32);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.card-album {
  font-size: 11px;
  color: rgba(96, 165, 250, 0.7);
  background: rgba(96, 165, 250, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.card-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
}

.grid-loading,
.grid-no-more {
  grid-column: 1 / -1;
}

.delete-btn {
  color: rgba(245, 108, 108, 0.8) !important;
  padding: 2px 6px !important;
  font-size: 12px !important;
  height: auto !important;
  min-height: unset !important;

  &:hover {
    color: #f56c6c !important;
    background: rgba(245, 108, 108, 0.1) !important;
  }

  .el-icon {
    font-size: 13px;
    margin-right: 3px;
  }
}

.feed-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.feed-download-btn {
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
}

.feed-body {
  margin-bottom: 10px;
}

/* 媒体容器 */
.media-container {
  margin-top: 6px;
}

/* .media-row / .media-item 基础视觉由全局 .tl-media / .tl-media-item 提供 */
.media-row {
  align-items: center;
}

.media-item {
  width: 60px;
  height: 60px;
  flex-shrink: 0;

  /* 隐私模式下禁用缩放 */
  &.privacy-mode:hover {
    transform: none;
    opacity: 1;

    .media-privacy-overlay {
      opacity: 1;
    }
  }

  &.is-video {
    .media-video {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .video-play-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 18px;
      color: rgba(255, 255, 255, 0.9);
      z-index: 2;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    /* 隐私模式样式 - 视频 */
    &.privacy-mode {
      .media-thumb :deep(.el-image__inner) {
        filter: blur(var(--qz-privacy-media-blur));
        transition: filter 0.3s ease;
      }

      .media-privacy-overlay {
        opacity: 1;
      }

      .video-play-icon {
        opacity: 0; /* 隐私模式下隐藏播放图标 */
      }
    }
  }

  /* 隐私模式样式 - 图片 */
  &.privacy-mode {
    .media-thumb :deep(.el-image__inner) {
      filter: blur(var(--qz-privacy-media-blur));
      transition: filter 0.3s ease;
    }

    .media-privacy-overlay {
      opacity: 1;
    }
  }
}

/* 隐私模式遮罩 - 媒体项 */
.media-privacy-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

/* 图片包装器 - 用于包裹图片和遮罩 */
.media-image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

/* .media-more 基础视觉由 .tl-media-more 提供，这里仅锁定尺寸 */
.media-more {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.media-thumb {
  width: 100%;
  height: 100%;

  :deep(.el-image__inner) {
    transition: transform 0.3s ease;
  }
}

.media-item:hover :deep(.el-image__inner) {
  transform: scale(1.05);
}

.media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.4);
  font-size: 24px;
}

.media-error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-size: 20px;
}

.media-more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  backdrop-filter: blur(2px);
}

/* 隐私模式样式 + 多选状态 - 动态卡片 */
.feed-card {
  /* 多选选中态：蓝色高亮（覆盖 .tl-card 默认背景） */
  &.selected {
    background: rgba(96, 165, 250, 0.1);
    border-color: var(--ds-accent-blue-border);
  }

  /* 隐私模式下确保选择框可见 */
  &.privacy-mode {
    .selection-checkbox {
      opacity: 1;
      background: rgba(255, 255, 255, 0.9);
    }
  }
}

/* 文本内容 */
.feed-album-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    transform: translateX(2px);
  }

  .album-icon {
    font-size: 14px;
    color: #60a5fa;
    flex-shrink: 0;
  }

  .album-title-text {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: #93c5fd;
    line-height: 1.4;
  }

  .link-icon {
    font-size: 12px;
    color: rgba(96, 165, 250, 0.6);
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  &:hover .link-icon {
    transform: translateX(2px);
    color: #60a5fa;
  }
}

.feed-text {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-word;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

/* .feed-footer 基础视觉由 .tl-footer 提供 */
.feed-footer {
  align-items: stretch;
  gap: 8px;
}

.feed-footer-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 24px;
}

/* 浏览量 / 设备 chip 容器：chip 本身由 .tl-chip 提供视觉 */
.feed-meta-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;

  .tl-chip {
    height: 22px;
    line-height: 1;
  }

  .tl-chip-icon {
    width: 12px;
    height: 12px;
    flex: 0 0 12px;
    stroke-width: 2;
  }

  /* 设备 chip 内容偶尔很长，限制宽度避免撑爆 footer */
  .tl-chip[title^='来自'] {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.feed-meta-tags-placeholder {
  flex: 1;
  min-width: 0;
}

/* 操作按钮栏：基础 chip 视觉由 .tl-stat 提供，这里只补 active 状态和图标尺寸 */
.feed-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  min-height: 22px;
  flex-shrink: 0;
}

.action-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  line-height: 1;

  &.active {
    color: rgba(255, 255, 255, 0.85);

    .action-icon {
      filter: brightness(1.2);
    }
  }

  .action-icon {
    font-size: 14px;
    line-height: 1;
  }

  .action-count {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
  }
}

/* 点赞列表 */
.feed-likes {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
  background: rgba(59, 130, 246, 0.08);
  border-radius: 4px;
  border-left: 2px solid #60a5fa;
}

.like-icon {
  font-size: 13px;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 1px;
}

.likes-content {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}

.like-name {
  color: #60a5fa;
  font-weight: 500;
  margin-right: 3px;

  &.is-me {
    color: #85ce61;
  }
}

.like-suffix {
  color: rgba(255, 255, 255, 0.65);
  margin-left: 3px;
}

/* 点赞列表的「等 N 人」/「收起」按钮 */
.like-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  margin-left: 2px;
  height: 18px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(96, 165, 250, 0.85);
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: #93c5fd;
    background: rgba(96, 165, 250, 0.15);
  }
}

/* 评论列表：作为 .tl-footer 的 flex 子项需要强占满整行，否则会被推到右侧错位 */
.feed-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  width: 100%;
  flex-basis: 100%;
  margin-top: 6px;
}

.comment-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.comment-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s ease;
  border: 2px solid rgba(96, 165, 250, 0.3);
}

.comment-avatar:hover {
  transform: scale(1.1);
  border-color: rgba(96, 165, 250, 0.6);
}

.comment-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.comment-author {
  color: #60a5fa;
  font-weight: 500;
  font-size: 12px;
  cursor: help;
  transition: color 0.2s ease;
}

.comment-author:hover {
  color: #93c5fd;
}

.comment-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* 评论者设备：从 shuoshuo API 富化得到，仅匹配上时才显示 */
.comment-device {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-text-content {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  line-height: 1.5;
}

.comment-text {
  color: rgba(255, 255, 255, 0.8);
}

/* 评论回复列表 */
.comment-responses {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 40px;
  margin-top: 4px;
}

.response-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.response-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.2s ease;
  border: 1.5px solid rgba(147, 197, 253, 0.3);
}

.response-avatar:hover {
  transform: scale(1.1);
  border-color: rgba(147, 197, 253, 0.6);
}

.response-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.response-author {
  color: #93c5fd;
  font-weight: 500;
  font-size: 11px;
  cursor: help;
  transition: color 0.2s ease;
}

.response-author:hover {
  color: #bfdbfe;
}

.response-time {
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}

.response-text-content {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  line-height: 1.5;
}

.reply-btn {
  padding: 0 3px !important;
  height: auto !important;
  min-height: unset !important;
  font-size: 10px !important;
  color: rgba(255, 255, 255, 0.5) !important;

  &:hover {
    color: rgba(255, 255, 255, 0.8) !important;
  }
}

/* 评论输入框 */
.comment-input-wrapper {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.comment-input {
  margin-bottom: 6px;

  :deep(.el-textarea__inner) {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    padding: 6px 8px;
    min-height: 50px !important;

    &:focus {
      border-color: #3b82f6;
      background: rgba(0, 0, 0, 0.4);
    }

    &::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }
  }
}

.comment-input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .timeline-container {
    padding: 16px;
  }

  .feed-card {
    padding: 16px;
  }

  .images-grid.single-image {
    max-width: 100%;
  }
}

/* 多选相关样式 */
.selection-checkbox {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  margin-right: 12px;
  margin-top: 2px;

  &:hover {
    border-color: rgba(64, 158, 255, 0.8);
    background: rgba(64, 158, 255, 0.2);
  }

  .selected-icon {
    color: #409eff;
    font-size: 18px;
  }
}

/* 底部悬浮 pill 工具栏：玻璃 + 蓝色 ring，居中浮在底部 */
.floating-toolbar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none; // 容器透传，pill 自己接事件

  .toolbar-pill {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 18px;
    padding: 8px 8px 8px 16px;
    background: rgba(20, 22, 30, 0.78);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(96, 165, 250, 0.18);
    border-radius: 999px;
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.45),
      0 0 0 1px rgba(96, 165, 250, 0.08),
      0 0 24px rgba(96, 165, 250, 0.12);
  }
}

.toolbar-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  .check-icon {
    color: #60a5fa;
  }
}

.selected-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;

  strong {
    color: #fff;
    font-size: 14px;
    font-weight: 700;
  }

  .dim {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 400;
  }
}

.toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  height: 30px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.78);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.tb-btn-primary:not(:disabled) {
    color: #60a5fa;
    background: rgba(96, 165, 250, 0.12);
    border-color: rgba(96, 165, 250, 0.22);

    &:hover {
      color: #93c5fd;
      background: rgba(96, 165, 250, 0.2);
    }
  }

  &.tb-btn-danger:not(:disabled) {
    color: #f87171;

    &:hover {
      color: #fca5a5;
      background: rgba(248, 113, 113, 0.12);
    }
  }

  &.tb-btn-close {
    padding: 6px;
    width: 30px;
  }
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
}

/* 工具栏动画 */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-enter-from,
.toolbar-leave-to {
  transform: translate(-50%, 30px);
  opacity: 0;
}

/* 删除进度对话框 */
.delete-progress-dialog {
  :deep(.el-dialog) {
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  :deep(.el-dialog__header) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  :deep(.el-dialog__footer) {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
}

.delete-progress-content {
  padding: 20px 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.progress-text {
  font-weight: 500;
}

.progress-percentage {
  font-size: 18px;
  font-weight: 600;
  color: #409eff;
}

.progress-failed {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(245, 108, 108, 0.1);
  border-left: 3px solid #f56c6c;
  border-radius: 4px;
  color: #f56c6c;
  font-size: 13px;
}

.progress-current {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.1);
  border-left: 3px solid #409eff;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.2s ease;

  &:hover {
    color: #409eff;
  }
}

/* 视频预览对话框样式 */
:deep(.video-preview-dialog) {
  .el-dialog {
    background: rgba(30, 30, 30, 0.95);
    border-radius: 12px;
    backdrop-filter: blur(20px);
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

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
