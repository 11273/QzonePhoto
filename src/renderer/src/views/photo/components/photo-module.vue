<template>
  <div class="photo-module">
    <!-- 顶部标题栏 -->
    <div class="module-header">
      <div class="header-content">
        <div class="title-section">
          <h2 class="module-title">{{ isFriendPhotos || isFriendContext ? '好友照片' : '我的照片' }}</h2>
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
            icon="📷"
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
                <div v-if="privacyStore.privacyMode" class="card-privacy-overlay">
                  <el-icon class="privacy-icon"><Hide /></el-icon>
                  <div class="privacy-text">隐私保护</div>
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
          <div v-else class="feeds-container">
            <template v-for="group in groupedFeeds" :key="group.dateKey">
              <!-- 日期分组标题 -->
              <div class="date-group-header">
                <div class="date-line"></div>
                <span class="date-text">{{ group.dateLabel }}</span>
                <div class="date-line"></div>
              </div>

              <!-- 该日期下的动态 -->
              <div
                v-for="(feed, feedIdx) in group.feeds"
                :key="feed.id"
                class="feed-card"
                :class="{
                  'is-first-in-group': feedIdx === 0,
                  'is-last-in-group': feedIdx === group.feeds.length - 1,
                  selected: isSelectionMode && selectedFeeds.has(feed.id)
                }"
                @click="isSelectionMode && toggleFeedSelection(feed)"
              >
                <!-- 左侧时间线 -->
                <div class="feed-timeline">
                  <div class="timeline-dot"></div>
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
                <div class="feed-content-wrapper">
                  <!-- 顶部：时间和删除按钮 -->
                  <div class="feed-header">
                    <span class="feed-time">{{ formatFeedTime(feed.time || feed.date) }}</span>
                    <el-button
                      v-if="!isSelectionMode && !isFriendContext"
                      text
                      size="small"
                      class="delete-btn"
                      @click="deleteFeed(feed)"
                    >
                      <el-icon><Delete /></el-icon>
                      <span>删除</span>
                    </el-button>
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
                      <div class="media-row">
                        <div
                          v-for="(item, idx) in feed.media.slice(0, 8)"
                          :key="idx"
                          class="media-item"
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
                            <div v-if="privacyStore.privacyMode" class="media-privacy-overlay">
                              <el-icon class="privacy-icon"><Hide /></el-icon>
                              <div class="privacy-text">隐私保护</div>
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
                            <div v-if="privacyStore.privacyMode" class="media-privacy-overlay">
                              <el-icon class="privacy-icon"><Hide /></el-icon>
                              <div class="privacy-text">隐私保护</div>
                            </div>
                          </div>
                        </div>
                        <div
                          v-if="feed.photoTotal && feed.photoTotal > 8"
                          class="media-more"
                          @click="previewMedia(feed.media, 8, feed)"
                        >
                          +{{ feed.photoTotal - 8 }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 底部：互动信息 -->
                  <div class="feed-footer">
                    <div class="feed-actions">
                      <div class="action-item" :class="{ active: feed.isLiked }">
                        <span class="action-icon">👍</span>
                        <span v-if="feed.likeCount > 0" class="action-count">{{ feed.likeCount }}</span>
                      </div>
                      <div class="action-item">
                        <span class="action-icon">💬</span>
                        <span v-if="feed.commentCount > 0" class="action-count">{{ feed.commentCount }}</span>
                      </div>
                    </div>

                    <div v-if="feed.likes && feed.likes.length > 0" class="feed-likes">
                      <span class="like-icon">👍</span>
                      <div class="likes-content">
                        <span v-for="(like, idx) in feed.likes" :key="idx" class="like-name">{{ like.name }}</span>
                        <span class="like-suffix">觉得很赞</span>
                      </div>
                    </div>

                    <div v-if="feed.comments && feed.comments.length > 0" class="feed-comments">
                      <div v-for="comment in feed.comments" :key="comment.id" class="comment-item">
                        <div class="comment-row">
                          <el-tooltip :content="`QQ: ${comment.uin}`" placement="top">
                            <img :src="getAvatarUrl(comment.uin)" :alt="comment.author" class="comment-avatar" @error="handleAvatarError" />
                          </el-tooltip>
                          <div class="comment-content">
                            <div class="comment-header">
                              <el-tooltip :content="`QQ: ${comment.uin}`" placement="top">
                                <span class="comment-author">{{ comment.author }}</span>
                              </el-tooltip>
                              <span v-if="comment.time" class="comment-time">{{ comment.time }}</span>
                            </div>
                            <RichText :text="comment.text" class="comment-text-content" />
                          </div>
                        </div>
                        <div v-if="comment.responses && comment.responses.length > 0" class="comment-responses">
                          <div v-for="response in comment.responses" :key="response.id" class="response-row">
                            <el-tooltip :content="`QQ: ${response.uin}`" placement="top">
                              <img :src="getAvatarUrl(response.uin)" :alt="response.author" class="response-avatar" @error="handleAvatarError" />
                            </el-tooltip>
                            <div class="response-content">
                              <div class="response-header">
                                <el-tooltip :content="`QQ: ${response.uin}`" placement="top">
                                  <span class="response-author">{{ response.author }}</span>
                                </el-tooltip>
                                <span v-if="response.time" class="response-time">{{ response.time }}</span>
                              </div>
                              <RichText :text="response.text" class="response-text-content" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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

    <!-- 图片预览 -->
    <el-image-viewer
      v-if="previewVisible"
      :url-list="previewImages"
      :initial-index="previewIndex"
      :hide-on-click-modal="true"
      @close="previewVisible = false"
    />

    <!-- 底部悬浮工具栏 -->
    <Transition name="toolbar" appear>
      <div v-if="isSelectionMode && selectedFeeds.size > 0 && !isFriendContext && !isFriendPhotos" class="floating-toolbar">
        <div class="toolbar-content">
          <span class="selected-count">已选择 {{ selectedFeeds.size }} 条动态</span>
          <div class="toolbar-actions">
            <el-button size="small" @click="clearSelection">取消选择</el-button>
            <el-button size="small" type="danger" @click="deleteSelectedFeeds">
              删除选中
            </el-button>
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
import { ref, computed, inject, onMounted, onUnmounted, nextTick, watch } from 'vue'
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
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { ElImageViewer, ElDialog, ElButton } from 'element-plus'
import { useUserStore } from '@renderer/store/user.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import RichText from '@renderer/components/RichText/index.vue'
import { getQQAvatarUrl } from '@renderer/utils/formatters'
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
const effectiveHostUin = computed(() => hostUinOverride?.value || userStore.userInfo.uin)
const isFriendContext = computed(() => !!hostUinOverride?.value)
const friendMeta = computed(() => (isFriendContext.value ? { skipAuthCheck: true } : {}))

// 动态数据
const feeds = ref([])
const hasMore = ref(true)

// 多选状态
const selectedFeeds = ref(new Set())
const isSelectionMode = ref(false)

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

// 按日期分组动态
const groupedFeeds = computed(() => {
  if (!feeds.value || feeds.value.length === 0) return []

  const groups = new Map()

  feeds.value.forEach((feed) => {
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

// 滚动加载相关
const loadMoreTrigger = ref(null)
let observer = null

// 图片预览
const previewVisible = ref(false)
const previewIndex = ref(0)
const previewImages = ref([])

// 视频预览相关
const videoPreviewVisible = ref(false)
const videoPlayerRef = ref(null)
const currentVideoInfo = ref(null)
const videoLoading = ref(false)
const videoError = ref('')
let hls = null

// 格式化动态时间显示
const formatFeedTime = (timeStr) => {
  if (!timeStr) return ''
  // time 可能是秒级时间戳（字符串或数字）或 ISO 字符串
  let date
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    // ISO 字符串格式
    date = new Date(timeStr)
  } else {
    // 时间戳格式（秒级，需要乘以1000）
    const timestamp = typeof timeStr === 'string' ? parseInt(timeStr) : timeStr
    date = new Date(timestamp * 1000)
  }

  const now = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes().toString().padStart(2, '0')

  // 如果是今年，不显示年份
  if (year === now.getFullYear()) {
    return `${month}月${day}日 ${hour}:${minute}`
  }
  return `${year}年${month}月${day}日 ${hour}:${minute}`
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
          key: photo.videokey
        })
      } else if (photo.url || photo.picsmallurl) {
        // 图片
        media.push({
          type: 'image',
          url: photo.picsmallurl || photo.url,
          bigUrl: photo.picbigurl || photo.url
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

  return {
    id: apiFeed.skey || apiFeed.time,
    date: feedDate.toISOString().split('T')[0],
    time: timestamp.toString(), // 保存时间戳字符串用于格式化
    text: apiFeed.desc || '',
    media,
    photoTotal: parseInt(apiFeed.photo_total || 0), // 保存照片总数
    albumTitle,
    albumId: apiFeed.albumid || null, // 保存相册ID用于跳转
    albumName: apiFeed.albumname || null,
    typeid: apiFeed.typeid || 0, // 保存typeid用于删除
    isLiked: apiFeed.ilike === '1',
    likeCount: parseInt(apiFeed.praiseNum || 0),
    commentCount: parseInt(apiFeed.comment_total || 0),
    likes: parseLikeUsers(apiFeed.like_users),
    comments
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

// 清空选择
const clearSelection = () => {
  selectedFeeds.value.clear()
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
        await window.QzoneAPI.deleteFeed({
          hostUin,
          skey: feed.id,
          time: feed.time,
          typeid: feed.typeid || 0,
          flag: 0
        }, friendMeta.value)
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
      await window.QzoneAPI.deleteFeed({
        hostUin,
        skey: feed.id, // 使用 feed.id (即 skey)
        time: feed.time, // 使用 feed.time
        typeid: feed.typeid || 0, // 使用 feed.typeid
        flag: 0
      }, friendMeta.value)

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

// 预览媒体（图片/视频）
const previewMedia = async (media, index) => {
  if (!media || !Array.isArray(media) || media.length === 0) return

  const targetMedia = media[index]
  if (!targetMedia) return

  // 如果是视频
  if (targetMedia.type === 'video') {
    await previewVideo(targetMedia)
  } else {
    // 如果是图片
    previewImages.value = media.filter((m) => m.type === 'image').map((m) => m.bigUrl || m.url)

    // 计算当前图片在图片列表中的索引
    const imageIndex = media.slice(0, index + 1).filter((m) => m.type === 'image').length - 1

    previewIndex.value = Math.max(0, imageIndex)
    previewVisible.value = true
  }
}

// 预览视频
const previewVideo = async (videoMedia) => {
  if (!videoMedia) {
    ElMessage.error('视频地址无效')
    return
  }

  try {
    // 显示加载状态
    currentVideoInfo.value = { ...videoMedia, video_play_url: null }
    videoPreviewVisible.value = true
    videoError.value = ''
    videoLoading.value = true

    let videoUrl = videoMedia.url

    // 好友照片的视频没有直接 URL，需通过 floatview 接口获取
    if (!videoUrl && videoMedia.lloc && videoMedia.albumId && videoMedia.ownerUin) {
      const info = await window.QzoneAPI.getVideoInfo({
        hostUin: videoMedia.ownerUin,
        topicId: videoMedia.albumId,
        picKey: videoMedia.lloc
      }, { skipAuthCheck: true })

      videoUrl = info?.video_play_url || info?.video_info?.video_url || info?.video_download_url || ''
    }

    if (!videoUrl) {
      videoError.value = '无法获取视频播放地址'
      videoLoading.value = false
      return
    }

    // 等待对话框渲染完成后再播放
    nextTick(() => {
      playVideo(videoUrl)
    })
  } catch (error) {
    console.error('预览视频失败:', error)
    ElMessage.error('预览视频失败')
    closeVideoPreview()
  }
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

// 在浏览器中打开视频
const openVideoInBrowser = () => {
  if (!currentVideoInfo.value || !currentVideoInfo.value.url) {
    ElMessage.error('视频地址无效')
    return
  }

  try {
    if (window.require) {
      const { shell } = window.require('electron')
      shell.openExternal(currentVideoInfo.value.url)
      ElMessage.success('正在浏览器中打开视频...')
    } else {
      window.open(currentVideoInfo.value.url, '_blank')
    }
  } catch {
    window.open(currentVideoInfo.value.url, '_blank')
  }
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

    if (isFriendPhotos.value) {
      // 好友照片模式：使用 feeds2_html_picfeed API
      response = await window.QzoneAPI.getFriendPhotos({
        start: isLoadMore ? feeds.value.length : 0,
        count: 20,
        begintime: currentBegintime
      })

      if (response && response.code === 0 && response.data) {
        const photos = response.data.photos || []
        transformedFeeds = processFriendPhotos(photos)
        // 好友照片用 hasmore 字段判断
        if (!response.data.hasmore) {
          hasMore.value = false
        }
      }
    } else {
      // 我的照片模式：使用 feeds2_html_picfeed_qqtab API
      const hostUin = effectiveHostUin.value
      response = await window.QzoneAPI.getFeeds({
        hostUin,
        begintime: currentBegintime
      }, friendMeta.value)

      if (response && response.code === 0 && response.data) {
        const apiFeeds = response.data.feeds || []
        transformedFeeds = processApiFeeds(apiFeeds)
      }
    }

    if (response && response.code === 0 && response.data && transformedFeeds) {
      if (transformedFeeds.length > 0) {
        if (isLoadMore) {
          // 加载更多时，追加到现有列表
          // 使用 Set 进行高效去重
          const existingIds = new Set(feeds.value.map((f) => f.id))
          const filteredFeeds = transformedFeeds.filter((feed) => !existingIds.has(feed.id))

          if (filteredFeeds.length > 0) {
            feeds.value.push(...filteredFeeds)
          } else {
            // 如果没有新数据（全部重复），说明没有更多了
            hasMore.value = false
          }
        } else {
          // 首次加载或刷新，直接替换
          feeds.value = transformedFeeds
          hasMore.value = true // 重置为 true，允许继续加载
        }
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
      hasMore.value = false
      if (!isLoadMore) {
        ElMessage.error(response?.message || '加载动态失败')
      }
    }
  } catch (error) {
    console.error('加载动态失败:', error)
    hasMore.value = false
    if (!isLoadMore) {
      ElMessage.error('加载动态失败: ' + (error.message || '未知错误'))
    }
  } finally {
    loading.value = false
    loadingMore.value = false
    isScrollLoading.value = false
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
  return photos.filter((p) => p).map((photo) => {
    const media = []
    if (photo.is_video === '1' || photo.is_video === 1) {
      media.push({
        type: 'video',
        url: '', // 需要通过 floatview 接口获取
        cover: photo.small_url || photo.medium_url,
        lloc: photo.lloc,
        albumId: photo.album?.id,
        ownerUin: photo.owner?.uin
      })
    } else {
      media.push({
        type: 'image',
        url: photo.medium_url || photo.small_url,
        bigUrl: photo.large_image?.url || photo.medium_url
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
      owner: photo.owner ? {
        uin: photo.owner.uin,
        nick: photo.owner.nick,
        face: photo.owner.face
      } : null,
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

// 监听关键状态变化，使用防抖设置观察器
watch([loadMoreTrigger, hasMore, loading], () => {
  debouncedSetupObserver()
})

// 切换照片类型时重新加载
watch(() => props.photoType, () => {
  feeds.value = []
  hasMore.value = true
  loadFeeds(false).then(() => {
    debouncedSetupObserver()
  })
})

onMounted(() => {
  loadFeeds().then(() => {
    debouncedSetupObserver()
  })
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
  padding: 20px 40px;
  width: 100%;
  max-width: 100%;
}

.feeds-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 动态卡片 */
.feed-card {
  display: flex;
  position: relative;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  &:last-child {
    border-bottom: none;
  }

  &.selected {
    background: rgba(64, 158, 255, 0.1);
    border-radius: 8px;
    padding-left: 12px;
    padding-right: 12px;
  }
}

/* 左侧时间线 */
.feed-timeline {
  position: relative;
  width: 50px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 4px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  border: 2px solid rgba(59, 130, 246, 0.4);
  box-shadow:
    0 0 0 2px rgba(59, 130, 246, 0.1),
    0 2px 4px rgba(59, 130, 246, 0.2);
  z-index: 2;
  flex-shrink: 0;
  position: relative;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.8);
  }
}

.feed-card:hover .timeline-dot {
  transform: scale(1.15);
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.15),
    0 2px 8px rgba(59, 130, 246, 0.3);
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: linear-gradient(
    to bottom,
    rgba(96, 165, 250, 0.3) 0%,
    rgba(96, 165, 250, 0.15) 30%,
    rgba(255, 255, 255, 0.06) 100%
  );
  margin-top: 6px;
  border-radius: 1px;
}

.feed-card.is-last-in-group .timeline-line {
  display: none;
}

/* 日期分组标题 */
.date-group-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0 16px;
  padding: 0 50px;

  .date-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  }

  .date-text {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    padding: 4px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.feed-card.is-first-in-group {
  padding-top: 8px;
}

.feed-card.is-last-in-group {
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 8px;
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

/* 右侧内容 */
.feed-content-wrapper {
  flex: 1;
  min-width: 0;
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
      filter: blur(15px);
      transition: filter 0.3s ease;
    }

    &:hover {
      transform: none;

      .card-image {
        transform: none;
      }
    }

    &:hover .card-image :deep(.el-image__inner) {
      filter: blur(8px);
    }

    &:hover .card-privacy-overlay {
      background: rgba(0, 0, 0, 0.85);
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
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  .privacy-icon {
    font-size: 24px;
    color: #e6a23c;
    margin-bottom: 4px;
    opacity: 0.9;
  }

  .privacy-text {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
    text-align: center;
  }
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

.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.feed-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
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

.feed-body {
  margin-bottom: 10px;
}

/* 媒体容器 */
.media-container {
  margin-top: 6px;
}

.media-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.media-item {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.85;
    transform: scale(1.05);
  }

  /* 隐私模式下禁用缩放，悬停时减少模糊 */
  &.privacy-mode:hover {
    transform: none;
    opacity: 1;

    .media-thumb :deep(.el-image__inner) {
      filter: blur(8px);
    }

    .media-privacy-overlay {
      opacity: 1;
      background: rgba(0, 0, 0, 0.85);
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
        filter: blur(15px);
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
      filter: blur(15px);
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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  backdrop-filter: blur(2px);

  .privacy-icon {
    font-size: 24px;
    color: #e6a23c;
    margin-bottom: 4px;
    opacity: 0.9;
  }

  .privacy-text {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
    text-align: center;
  }
}

/* 图片包装器 - 用于包裹图片和遮罩 */
.media-image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.media-more {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);

  &:hover {
    background: rgba(0, 0, 0, 0.4);
    border-color: rgba(255, 255, 255, 0.3);
  }
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

/* 隐私模式样式 - 动态卡片中的媒体 */
.feed-card {
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

.feed-footer {
  margin-top: 8px;
}

/* 操作按钮栏 */
.feed-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 6px;
}

.action-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: default;

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

/* 评论列表 */
.feed-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.12);
  border-radius: 4px;
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

/* 底部悬浮工具栏 */
.floating-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px 24px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.toolbar-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-count {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.toolbar-actions {
  display: flex;
  gap: 12px;
}

/* 工具栏动画 */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-enter-from,
.toolbar-leave-to {
  transform: translateY(100%);
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
