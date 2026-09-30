<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :append-to-body="true"
    :lock-scroll="false"
    :modal-append-to-body="false"
    class="upload-manager-dialog dark-theme"
    :class="{ 'is-empty-manager': !hasTaskWorkspace }"
  >
    <template #header="{ close }">
      <AppDialogHeader
        title="上传管理"
        :subtitle="uploadManagerSummary"
        close-label="关闭上传管理"
        @close="close"
      />
    </template>
    <!-- 顶部操作栏 -->
    <div v-if="hasTaskWorkspace" class="header-actions">
      <div class="actions-left">
        <!-- 相册筛选 -->
        <div class="filter-group">
          <label class="filter-label">相册筛选：</label>
          <el-select
            v-model="selectedAlbumId"
            placeholder="选择相册"
            size="small"
            class="album-filter-select"
            :loading="albumsLoading"
            :no-data-text="albumLoadError || '暂无相册'"
            @change="handleAlbumChange"
          >
            <el-option label="全部相册" value="all" />
            <el-option
              v-for="album in albumOptions"
              :key="album.id"
              :label="`${album.name} (${album.active}/${album.total})`"
              :value="album.id"
            />
          </el-select>
          <AppActionButton
            v-if="albumLoadError"
            class="album-filter-retry"
            variant="ghost"
            ui-size="compact"
            icon-only
            title="相册筛选加载失败，点击重试"
            aria-label="重新加载相册筛选"
            :loading="albumsLoading"
            :disabled="albumsLoading"
            @click="loadAlbums"
          >
            <template #icon
              ><el-icon><Refresh /></el-icon
            ></template>
          </AppActionButton>
        </div>

        <!-- 状态筛选 -->
        <div class="filter-group">
          <label class="filter-label">状态筛选：</label>
          <el-select
            v-model="statusFilter"
            size="small"
            class="status-filter-select"
            @change="loadTasks"
          >
            <el-option label="全部" value="all" />
            <el-option label="上传中" value="uploading" />
            <el-option label="等待中" value="waiting" />
            <el-option label="已暂停" value="paused" />
            <el-option label="失败" value="error" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </div>
      </div>

      <div class="actions-right">
        <!-- 批量操作 -->
        <AppActionButton
          v-if="hasActiveTasks"
          variant="warning"
          ui-size="compact"
          @click="pauseAllTasks"
        >
          <template #icon
            ><el-icon><VideoPause /></el-icon
          ></template>
          暂停全部
        </AppActionButton>
        <AppActionButton
          v-if="hasPausedTasks"
          variant="primary"
          ui-size="compact"
          @click="resumeAllTasks"
        >
          <template #icon
            ><el-icon><VideoPlay /></el-icon
          ></template>
          恢复全部
        </AppActionButton>
        <AppActionButton
          v-if="hasFailedTasks"
          variant="primary"
          ui-size="compact"
          @click="retryAllFailed"
        >
          <template #icon
            ><el-icon><Refresh /></el-icon
          ></template>
          重试失败
        </AppActionButton>
        <AppActionButton
          variant="danger"
          ui-size="compact"
          :disabled="currentTasks.length === 0"
          @click="clearAllTasks"
        >
          <template #icon
            ><el-icon><Delete /></el-icon
          ></template>
          清空全部
        </AppActionButton>
      </div>
    </div>

    <!-- 分栏布局 -->
    <div class="layout-columns" :class="{ 'is-compact-state': !hasTaskWorkspace }">
      <!-- 左侧：统计区域 -->
      <div v-if="hasTaskWorkspace" class="left-column">
        <!-- 总体进度卡片 -->
        <div
          class="progress-card"
          role="status"
          aria-live="polite"
          :aria-label="`上传总体进度 ${overallProgress}%，已完成 ${taskStats.completed} 个，共 ${taskStats.total} 个任务`"
        >
          <div class="progress-top">
            <div class="progress-circle">
              <el-progress
                :percentage="overallProgress"
                type="circle"
                :width="50"
                :color="overallProgressColor"
              />
            </div>
            <div class="progress-info">
              <div class="progress-percentage" :style="{ color: overallProgressColor }">
                {{ overallProgress }}%
              </div>
              <div class="progress-text">整体进度</div>
            </div>
          </div>
        </div>

        <!-- 任务统计卡片 -->
        <div class="stats-card">
          <h5 class="card-title">
            <el-icon><DataAnalysis /></el-icon>
            任务状态
          </h5>
          <div class="stats-list">
            <div class="stat-row">
              <span class="stat-label">总任务</span>
              <span class="stat-value total">{{ taskStats.total }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">上传中</span>
              <span class="stat-value uploading">{{ taskStats.uploading }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">等待中</span>
              <span class="stat-value waiting">{{ taskStats.waiting }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">已完成</span>
              <span class="stat-value completed">{{ taskStats.completed }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">失败</span>
              <span class="stat-value error">{{ taskStats.error }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">暂停</span>
              <span class="stat-value paused">{{ taskStats.paused }}</span>
            </div>
          </div>
        </div>

        <!-- 上传速度卡片 -->
        <div class="speed-card">
          <h5 class="card-title">
            <el-icon><Timer /></el-icon>
            上传速度
          </h5>
          <div class="speed-info">
            <div class="current-speed">{{ formatSpeed(currentSpeed) }}</div>
            <div class="speed-label">当前速度</div>
          </div>
        </div>
      </div>

      <!-- 右侧：任务列表 -->
      <div class="right-column">
        <div v-if="hasTaskWorkspace" class="task-list-header">
          <span class="list-title">上传任务</span>
          <span class="list-count">共 {{ pagination.total }} 个任务</span>
        </div>

        <!-- 任务列表 -->
        <div v-loading="loading" class="task-list-container" :aria-busy="loading">
          <EmptyState
            v-if="!loading && currentTasks.length === 0"
            :icon="loadError ? Warning : Archive"
            :title="loadError ? '上传任务加载失败' : '暂无上传任务'"
            :description="
              loadError ||
              (statusFilter !== 'all' || selectedAlbumId !== 'all'
                ? '当前筛选条件下没有任务'
                : '在相册详情里点上传，任务会出现在这里')
            "
            :semantic-role="loadError ? 'alert' : 'status'"
            :aria-live="loadError ? 'assertive' : 'polite'"
            size="medium"
          >
            <el-button v-if="loadError" type="primary" plain size="small" @click="loadTasks">
              重试
            </el-button>
          </EmptyState>
          <div v-else class="task-list">
            <div
              v-for="task in currentTasks"
              :key="task.id"
              class="task-item"
              :class="{
                'is-uploading': task.status === 'uploading',
                'is-error': task.status === 'error',
                'is-completed': task.status === 'completed',
                'is-paused': task.status === 'paused'
              }"
            >
              <!-- 任务信息 -->
              <div class="task-info">
                <!-- 文件缩略图 -->
                <div class="file-thumbnail">
                  <div v-if="privacyStore.privacyMode" class="privacy-overlay">
                    <el-icon class="privacy-icon"><Hide /></el-icon>
                  </div>
                  <img
                    v-if="isImageFile(task.filename) && task.previewUrl"
                    :src="task.previewUrl"
                    :alt="task.filename"
                    class="thumbnail-image"
                    @error="handleImageError"
                  />
                  <video
                    v-else-if="isVideoFile(task.filename) && task.videoPreviewUrl"
                    :src="task.videoPreviewUrl"
                    class="thumbnail-video"
                    preload="metadata"
                    muted
                    loop
                    playsinline
                    @mouseenter="startLocalVideoPreview"
                    @mouseleave="stopLocalVideoPreview"
                    @error="handleVideoPreviewError($event, task)"
                  />
                  <div v-else-if="isVideoFile(task.filename)" class="file-icon video-icon">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                  <div v-else class="file-icon document-icon">
                    <el-icon><Document /></el-icon>
                  </div>
                  <!-- 视频类型标识 -->
                  <div v-if="isVideoFile(task.filename) && task.videoPreviewUrl" class="type-badge">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                </div>

                <!-- 文件详情 -->
                <div class="task-details">
                  <div class="task-name" :title="task.filename">
                    {{ truncateText(task.filename, 25) }}
                  </div>
                  <div class="task-meta">
                    <span class="album-name">{{ task.albumName }}</span>
                    <span class="file-size">{{ formatFileSize(task.total) }}</span>
                    <span class="create-time">{{ formatTime(task.create_time) }}</span>
                  </div>
                  <div v-if="task.error" class="error-message">
                    <el-tooltip
                      :content="getFullErrorMessage(task)"
                      placement="top"
                      :show-after="300"
                    >
                      <div class="error-content">
                        <el-icon :class="getErrorIconClass(task.error)">
                          <component :is="getErrorIcon(task.error)" />
                        </el-icon>
                        <span class="error-text">{{ getErrorDisplayText(task.error) }}</span>
                        <span v-if="task.retryCount && task.retryCount > 0" class="retry-count">
                          (已重试 {{ task.retryCount }} 次)
                        </span>
                      </div>
                    </el-tooltip>
                  </div>
                </div>
              </div>

              <!-- 进度和状态 -->
              <div
                class="task-progress"
                role="progressbar"
                :aria-label="`${task.filename}：${getStatusText(task)}`"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="task.progress"
              >
                <div class="progress-bar-container">
                  <el-progress
                    :percentage="task.progress"
                    :show-text="false"
                    :stroke-width="4"
                    :color="getProgressColor(task.status)"
                  />
                </div>
                <div class="progress-info">
                  <span class="progress-text">{{ getStatusText(task) }}</span>
                  <span v-if="task.status === 'uploading'" class="speed-text">
                    {{ formatSpeed(task.speed) }}
                  </span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="task-actions">
                <el-button
                  v-if="task.status === 'uploading' || task.status === 'waiting'"
                  size="small"
                  type="warning"
                  text
                  title="暂停上传"
                  aria-label="暂停上传"
                  @click="pauseTask(task.id)"
                >
                  <el-icon><VideoPause /></el-icon>
                </el-button>
                <el-button
                  v-if="task.status === 'paused'"
                  size="small"
                  type="success"
                  text
                  title="继续上传"
                  aria-label="继续上传"
                  @click="resumeTask(task.id)"
                >
                  <el-icon><VideoPlay /></el-icon>
                </el-button>
                <el-button
                  v-if="task.status === 'error'"
                  size="small"
                  type="primary"
                  text
                  title="重试上传"
                  aria-label="重试上传"
                  @click="retryTask(task.id)"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  text
                  title="删除上传任务"
                  aria-label="删除上传任务"
                  @click="deleteTask(task.id)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="pagination.totalPages > 1" class="pagination-wrapper">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="pagination.total"
            size="small"
            :background="true"
            layout="total, prev, pager, next"
            @current-change="loadTasks"
          />
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  DataAnalysis,
  Timer,
  Document,
  Warning,
  VideoPlay,
  VideoPause,
  Refresh,
  Delete,
  FolderDelete,
  Connection,
  Lock,
  InfoFilled,
  Hide
} from '@element-plus/icons-vue'
import { Archive } from '@lucide/vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import AppActionButton from '@renderer/components/AppActionButton/index.vue'
import AppDialogHeader from '@renderer/components/AppDialogHeader/index.vue'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { describeUploadError, uploadErrorDetail } from '@renderer/utils/upload-error'

const privacyStore = usePrivacyStore()

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 数据状态
const loading = ref(false)
const loadError = ref('')
const currentTasks = ref([])
const taskStats = ref({
  total: 0,
  waiting: 0,
  uploading: 0,
  completed: 0,
  error: 0,
  paused: 0,
  cancelled: 0
})
const currentSpeed = ref(0)

// 筛选和分页
const selectedAlbumId = ref('all')
const statusFilter = ref('all')
const currentPage = ref(1)
const pageSize = ref(15)
const pagination = ref({
  page: 1,
  pageSize: 15,
  total: 0,
  totalPages: 0
})

// 相册选项
const albumOptions = ref([])
const albumsLoading = ref(false)
const albumLoadError = ref('')
let taskLoadSequence = 0

// 预览图缓存（避免重复加载）
const previewCache = new Map()
const videoPreviewRetryUrls = new WeakMap()

// 计算属性
const overallProgress = computed(() => {
  if (taskStats.value.total === 0) return 0
  return Math.round((taskStats.value.completed / taskStats.value.total) * 100)
})

const overallProgressColor = computed(() => {
  if (taskStats.value.total > 0 && taskStats.value.completed === taskStats.value.total) {
    return 'var(--theme-success)'
  }
  if (taskStats.value.uploading > 0 || taskStats.value.waiting > 0) return 'var(--theme-info)'
  if (taskStats.value.error > 0 || taskStats.value.paused > 0) return 'var(--theme-warning)'
  if (taskStats.value.completed > 0) return 'var(--theme-success)'
  return 'var(--theme-info)'
})

const hasPausedTasks = computed(() => {
  return taskStats.value.paused > 0
})

const hasFailedTasks = computed(() => {
  return taskStats.value.error > 0
})

const hasActiveTasks = computed(() => {
  return taskStats.value.uploading + taskStats.value.waiting > 0
})

// 没有任何任务时只呈现可操作的空状态，避免用 0% 仪表盘和无效筛选占满弹窗。
const hasTaskWorkspace = computed(() => {
  return taskStats.value.total > 0 || pagination.value.total > 0 || currentTasks.value.length > 0
})

const uploadManagerSummary = computed(() => {
  if (!hasTaskWorkspace.value) return ''
  const activeCount = taskStats.value.uploading + taskStats.value.waiting
  if (activeCount > 0)
    return `${activeCount} 个进行中 · ${taskStats.value.completed}/${taskStats.value.total} 已完成`
  return `${taskStats.value.completed}/${taskStats.value.total} 已完成`
})

// 工具函数
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
  return formatFileSize(bytesPerSecond) + '/s'
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  // 小于1分钟
  if (diff < 60000) return '刚刚'
  // 小于1小时
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  // 小于1天
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  // 其他情况显示具体日期
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

const isImageFile = (filename) => {
  const imageExt = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  const ext = filename.split('.').pop().toLowerCase()
  return imageExt.includes(ext)
}

const isVideoFile = (filename) => {
  const videoExt = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv']
  const ext = filename.split('.').pop().toLowerCase()
  return videoExt.includes(ext)
}
const startLocalVideoPreview = (event) => {
  const video = event.currentTarget
  if (
    !(video instanceof HTMLVideoElement) ||
    privacyStore.privacyMode ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }
  video.muted = true
  video.play().catch(() => {})
}
const stopLocalVideoPreview = (event) => {
  const video = event.currentTarget
  if (!(video instanceof HTMLVideoElement)) return
  video.pause()
  video.currentTime = 0
}

const handleImageError = (event) => {
  // 图片加载失败时的处理
  console.warn('缩略图加载失败:', event.target.src)
  // 可以设置一个默认图标或隐藏图片
}

const refreshVideoPreview = async (task) => {
  const previewResponse = await window.QzoneAPI.getVideoPreview({ filePath: task.filePath })
  const previewUrl = previewResponse?.dataUrl
  if (!previewUrl) throw new Error('未获取到视频预览地址')

  previewCache.set(`video_${task.filePath}`, previewUrl)
  task.videoPreviewUrl = previewUrl

  const currentTask = currentTasks.value.find((item) => item.id === task.id)
  if (currentTask && currentTask !== task) {
    currentTask.videoPreviewUrl = previewUrl
  }

  return previewUrl
}

// 本地媒体令牌过期后自动申请新地址；同一地址只重试一次，避免失败循环。
const handleVideoPreviewError = async (event, task) => {
  const video = event?.target
  const failedUrl = video?.currentSrc || video?.src || task?.videoPreviewUrl
  if (!task?.filePath || !failedUrl || videoPreviewRetryUrls.get(task) === failedUrl) {
    handleImageError(event)
    return
  }

  videoPreviewRetryUrls.set(task, failedUrl)
  try {
    const previewUrl = await refreshVideoPreview(task)
    if (video) {
      video.src = previewUrl
      video.load()
    }
  } catch (error) {
    console.warn('刷新视频预览地址失败:', task.filename, error)
    handleImageError(event)
  }
}

const getProgressColor = (status) => {
  switch (status) {
    case 'uploading':
      return 'var(--theme-info)'
    case 'completed':
      return 'var(--theme-success)'
    case 'error':
      return 'var(--theme-danger)'
    case 'paused':
      return 'var(--theme-warning)'
    default:
      return 'var(--theme-text-muted)'
  }
}

const getStatusText = (task) => {
  switch (task.status) {
    case 'uploading':
      return `上传中 ${task.progress}%`
    case 'waiting':
      return '等待上传'
    case 'completed':
      return '上传完成'
    case 'error':
      return '上传失败'
    case 'paused':
      return '已暂停'
    case 'cancelled':
      return '已取消'
    default:
      return '未知状态'
  }
}

// 错误处理相关方法
const getErrorIcon = (errorMessage) => {
  const { category } = describeUploadError(errorMessage)
  if (category === 'file') return FolderDelete
  if (['network', 'service', 'rate'].includes(category)) return Connection
  if (['auth', 'permission'].includes(category)) return Lock
  if (['format', 'size', 'duration', 'data', 'quota'].includes(category)) return InfoFilled
  return Warning
}

const getErrorIconClass = (errorMessage) => {
  const { category } = describeUploadError(errorMessage)
  if (category === 'file') return 'error-icon-file'
  if (['network', 'service', 'rate'].includes(category)) return 'error-icon-network'
  if (['auth', 'permission'].includes(category)) return 'error-icon-auth'
  if (['format', 'size', 'duration', 'data', 'quota'].includes(category)) {
    return 'error-icon-info'
  }
  return 'error-icon-general'
}

const getErrorDisplayText = (errorMessage) => {
  return describeUploadError(errorMessage).summary
}

const getFullErrorMessage = (task) => {
  let message = uploadErrorDetail(task.error)

  // 添加额外的上下文信息
  const contextInfo = []

  if (task.retryCount && task.retryCount > 0) {
    contextInfo.push(`已重试 ${task.retryCount} 次`)
  }

  if (task.lastRetryTime) {
    const retryTime = new Date(task.lastRetryTime).toLocaleString('zh-CN')
    contextInfo.push(`最后重试：${retryTime}`)
  }

  if (task.create_time) {
    const createTime = new Date(task.create_time).toLocaleString('zh-CN')
    contextInfo.push(`创建时间：${createTime}`)
  }

  if (contextInfo.length > 0) {
    message += '\n\n' + contextInfo.join('\n')
  }

  return message
}

// API调用
const loadAlbums = async () => {
  albumsLoading.value = true
  albumLoadError.value = ''
  try {
    const albums = await window.QzoneAPI.upload.getAlbumsWithStats()
    albumOptions.value = albums
  } catch (error) {
    console.error('加载相册列表失败:', error)
    albumOptions.value = []
    albumLoadError.value = '相册列表加载失败，请重新打开后重试'
  } finally {
    albumsLoading.value = false
  }
}

const loadTasks = async () => {
  const loadSequence = ++taskLoadSequence
  loading.value = true
  loadError.value = ''
  currentTasks.value = []
  pagination.value = { ...pagination.value, total: 0, totalPages: 0 }
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value === 'all' ? null : statusFilter.value,
      albumId: selectedAlbumId.value === 'all' ? null : selectedAlbumId.value
    }

    const result = await window.QzoneAPI.upload.getTasks(params)
    if (loadSequence !== taskLoadSequence) return
    const tasks = result.tasks || []

    // 先从缓存中快速填充预览URL
    for (const task of tasks) {
      if (task.filePath) {
        if (isImageFile(task.filename)) {
          if (previewCache.has(task.filePath)) {
            task.previewUrl = previewCache.get(task.filePath)
          }
        } else if (isVideoFile(task.filename)) {
          const videoCacheKey = `video_${task.filePath}`
          if (previewCache.has(videoCacheKey)) {
            task.videoPreviewUrl = previewCache.get(videoCacheKey)
          }
        }
      }
    }

    // 立即显示任务列表（使用缓存的预览）
    currentTasks.value = tasks
    pagination.value = result.pagination
    loading.value = false

    // 异步并行加载未缓存的预览（不阻塞UI）
    loadTaskPreviews(tasks)
  } catch (error) {
    if (loadSequence !== taskLoadSequence) return
    console.error('加载任务列表失败:', error)
    loadError.value = '暂时无法读取上传任务，请检查网络或稍后重试。'
    ElMessage.error('加载上传任务失败')
  } finally {
    if (loadSequence === taskLoadSequence) loading.value = false
  }
}

// 异步加载任务预览（并行加载，不阻塞UI）
const loadTaskPreviews = async (tasks) => {
  const previewPromises = []

  for (const task of tasks) {
    if (!task.filePath) continue

    // 为图片生成预览
    if (isImageFile(task.filename) && !previewCache.has(task.filePath)) {
      const promise = window.QzoneAPI.getImagePreview({ filePath: task.filePath })
        .then((previewResponse) => {
          if (previewResponse?.dataUrl) {
            previewCache.set(task.filePath, previewResponse.dataUrl)
            // 更新当前显示的任务
            const currentTask = currentTasks.value.find((t) => t.id === task.id)
            if (currentTask) {
              currentTask.previewUrl = previewResponse.dataUrl
            }
          }
        })
        .catch((error) => {
          console.warn('生成图片预览失败:', task.filename, error)
        })
      previewPromises.push(promise)
    }
    // 为视频生成预览（并行加载，不阻塞UI）
    else if (isVideoFile(task.filename)) {
      const videoCacheKey = `video_${task.filePath}`
      if (!previewCache.has(videoCacheKey)) {
        const promise = window.QzoneAPI.getVideoPreview({ filePath: task.filePath })
          .then((previewResponse) => {
            if (previewResponse?.dataUrl) {
              previewCache.set(videoCacheKey, previewResponse.dataUrl)
              const currentTask = currentTasks.value.find((t) => t.id === task.id)
              if (currentTask) {
                currentTask.videoPreviewUrl = previewResponse.dataUrl
              }
            }
          })
          .catch((error) => {
            console.warn('生成视频预览失败:', task.filename, error)
          })
        previewPromises.push(promise)
      }
    }
  }

  // 并行加载所有预览，但不等待完成
  if (previewPromises.length > 0) {
    await Promise.allSettled(previewPromises)
  }
}

const loadStats = async () => {
  try {
    const stats = await window.QzoneAPI.upload.getStats()
    taskStats.value = stats
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

// 任务操作
const pauseTask = async (taskId) => {
  try {
    await window.QzoneAPI.upload.pauseTask(taskId)
    ElMessage.success('任务已暂停')
  } catch (error) {
    console.error('暂停任务失败:', error)
    ElMessage.error('暂停任务失败')
  }
}

const resumeTask = async (taskId) => {
  try {
    await window.QzoneAPI.upload.resumeTask(taskId)
    ElMessage.success('任务已恢复')
    await loadTasks()
  } catch (error) {
    console.error('恢复任务失败:', error)
    ElMessage.error('恢复任务失败')
  }
}

const retryTask = async (taskId) => {
  try {
    await window.QzoneAPI.upload.retryTask(taskId)
    ElMessage.success('任务已重试')
    await loadTasks()
  } catch (error) {
    console.error('重试任务失败:', error)
    ElMessage.error('重试任务失败')
  }
}

const deleteTask = async (taskId) => {
  try {
    await ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', {
      type: 'warning'
    })
    await window.QzoneAPI.upload.deleteTask(taskId)
    ElMessage.success('任务已删除')
    await loadTasks()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除任务失败:', error)
      ElMessage.error('删除任务失败')
    }
  }
}

// 批量操作
const pauseAllTasks = async () => {
  try {
    await window.QzoneAPI.upload.pauseAll()
    ElMessage.success('已暂停所有任务')
    await loadTasks()
  } catch (error) {
    console.error('暂停全部任务失败:', error)
    ElMessage.error('暂停全部任务失败')
  }
}

const resumeAllTasks = async () => {
  try {
    await window.QzoneAPI.upload.resumeAll()
    ElMessage.success('已恢复所有暂停的任务')
    await loadTasks()
  } catch (error) {
    console.error('恢复全部任务失败:', error)
    ElMessage.error('恢复全部任务失败')
  }
}

const retryAllFailed = async () => {
  try {
    await ElMessageBox.confirm('确定要重试所有失败的任务吗？', '确认重试', {
      type: 'warning'
    })
    const albumId = selectedAlbumId.value === 'all' ? null : selectedAlbumId.value
    const result = await window.QzoneAPI.upload.retryAllFailed(albumId)
    ElMessage.success(`已开始重试 ${result.count} 个失败的任务`)
    await loadTasks()
    await loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重试失败任务失败:', error)
      ElMessage.error('重试失败任务失败')
    }
  }
}

const clearAllTasks = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有任务吗？这会删除所有状态的任务记录。', '确认清空', {
      type: 'warning',
      confirmButtonText: '确定清空',
      cancelButtonText: '取消'
    })
    await window.QzoneAPI.upload.clearTasks()
    ElMessage.success('已清空所有任务')
    await loadTasks()
    await loadStats()
    await loadAlbums()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清空所有任务失败:', error)
      ElMessage.error('清空所有任务失败')
    }
  }
}

// 事件处理
const handleAlbumChange = () => {
  currentPage.value = 1
  loadTasks()
}

// 事件监听器清理函数
const listenerCleanups = []

const setupEventListeners = () => {
  cleanupEventListeners()
  const statsUpdateListener = (stats) => {
    taskStats.value = stats
  }

  const detailedStatusListener = (status) => {
    // 更新当前速度
    if (status && typeof status.currentSpeed === 'number') {
      currentSpeed.value = status.currentSpeed
    }
  }

  const taskChangeListener = (changedTasks) => {
    // 更新统计信息
    loadStats()

    // 如果有变化的任务，直接更新currentTasks中的对应项，避免重新加载整个列表
    if (changedTasks && Array.isArray(changedTasks) && changedTasks.length > 0) {
      changedTasks.forEach((changedTask) => {
        const index = currentTasks.value.findIndex((t) => t.id === changedTask.id)

        if (changedTask.deleted) {
          // 如果任务被删除，从列表中移除
          if (index !== -1) {
            currentTasks.value.splice(index, 1)
          }
        } else if (index !== -1) {
          // 如果任务存在，更新它
          // 保留原有的previewUrl和videoPreviewUrl（避免闪烁）
          const existingPreviewUrl = currentTasks.value[index].previewUrl
          const existingVideoPreviewUrl = currentTasks.value[index].videoPreviewUrl
          currentTasks.value[index] = {
            ...changedTask,
            previewUrl: existingPreviewUrl || changedTask.previewUrl || '',
            videoPreviewUrl: existingVideoPreviewUrl || changedTask.videoPreviewUrl || ''
          }

          // 更新当前速度（从正在上传的任务中获取）
          if (changedTask.status === 'uploading' && changedTask.speed) {
            currentSpeed.value = changedTask.speed
          }
        }
      })

      // 重新排序：与后端保持一致
      // uploading -> waiting -> paused -> error -> completed -> cancelled
      currentTasks.value.sort((a, b) => {
        const statusPriority = {
          uploading: 1,
          waiting: 2,
          paused: 3,
          error: 4,
          completed: 5,
          cancelled: 6
        }

        const aPriority = statusPriority[a.status] || 7
        const bPriority = statusPriority[b.status] || 7

        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        // 同状态内按创建时间排序
        const timeA = a.create_time || a.createTime || 0
        const timeB = b.create_time || b.createTime || 0

        if (a.status === 'uploading' || a.status === 'waiting') {
          return timeA - timeB // FIFO
        } else {
          return timeB - timeA // 新的在前
        }
      })

      // 调试日志
      // if (currentTasks.value.length > 0) {
      //   console.log(
      //     '[UploadManager] 任务变化后顺序:',
      //     currentTasks.value.slice(0, 5).map((t) => ({
      //       filename: t.filename,
      //       status: t.status
      //     }))
      //   )
      // }
    }
  }

  const cleanup1 = window.QzoneAPI.upload.onStatsUpdate(statsUpdateListener)
  const cleanup2 = window.QzoneAPI.upload.onDetailedStatusUpdate(detailedStatusListener)
  const cleanup3 = window.QzoneAPI.upload.onTaskChanges(taskChangeListener)

  listenerCleanups.push(cleanup1, cleanup2, cleanup3)
  console.log('[UploadManager] 事件监听器已设置')
}

const cleanupEventListeners = () => {
  console.log('[UploadManager] 清理事件监听器')
  listenerCleanups.forEach((cleanup) => cleanup())
  listenerCleanups.length = 0
}

// 生命周期
watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal) {
      await window.QzoneAPI.upload.setManagerOpen(true)
      await loadAlbums()
      await loadTasks()
      await loadStats()
    } else {
      await window.QzoneAPI.upload.setManagerOpen(false)
      // 关闭对话框时不清理监听器，保持后台更新
      console.log('[UploadManager] 关闭弹窗，保持监听器活跃以接收后台更新')
    }
  }
)

onMounted(async () => {
  // 只在组件挂载时设置一次监听器
  setupEventListeners()
  console.log('[UploadManager] 已设置事件监听器')

  if (props.modelValue) {
    await window.QzoneAPI.upload.setManagerOpen(true)
    await loadAlbums()
    await loadTasks()
    await loadStats()
  }
})

onUnmounted(async () => {
  // 先同步移除监听，避免卸载期间的异步 IPC 让热更新/重挂载叠加监听器。
  cleanupEventListeners()
  await window.QzoneAPI.upload.setManagerOpen(false)
  console.log('[UploadManager] 组件销毁，清理监听器')
})
</script>

<style lang="scss" scoped>
:deep(.upload-manager-dialog) {
  &.dark-theme {
    .el-dialog {
      background: var(--theme-surface);
      color: var(--theme-text-secondary);

      .el-dialog__header {
        background: var(--theme-surface);
        border-bottom: 1px solid var(--theme-border-subtle);

        .el-dialog__title {
          color: var(--theme-text-primary);
          font-weight: 600;
        }
      }

      .el-dialog__body {
        background: var(--theme-surface);
        padding: 0;
      }
    }
  }
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--theme-space-3);
  padding: 12px 16px;
  background: transparent;
  border-bottom: 1px solid var(--theme-border-subtle);

  .actions-left {
    display: flex;
    flex: 1 1 420px;
    gap: 16px;
    align-items: center;
    min-width: 0;

    .album-filter-select {
      width: 200px;
    }

    .status-filter-select {
      width: 120px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .filter-label {
        font-size: 12px;
        color: var(--theme-text-secondary);
        white-space: nowrap;
      }
    }
  }

  .actions-right {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;

    :deep(.el-button) {
      background: var(--theme-surface-soft);
      border-color: var(--theme-border);
      color: var(--theme-text-secondary);

      &:hover {
        background: var(--theme-surface-hover);
        border-color: var(--theme-border-strong);
        color: var(--theme-text-primary);
      }

      &.el-button--success {
        background: var(--theme-success);
        border-color: var(--theme-success);
        color: var(--theme-text-inverse);

        &:hover {
          filter: brightness(1.08);
        }
      }

      &.el-button--warning {
        background: var(--theme-warning-soft);
        border-color: var(--theme-warning-border);
        color: var(--theme-warning-text);

        &:hover {
          background: color-mix(in srgb, var(--theme-warning-soft) 75%, var(--theme-warning) 25%);
          border-color: var(--theme-warning);
        }
      }

      &.el-button--primary {
        background: var(--theme-brand);
        border-color: var(--theme-brand);
        color: var(--theme-text-inverse);

        &:hover {
          background: var(--theme-brand-hover);
          border-color: var(--theme-brand-accent);
        }
      }

      &.el-button--danger {
        background: var(--theme-danger-soft);
        border-color: var(--theme-danger-border);
        color: var(--theme-danger-text);

        &:hover {
          background: color-mix(in srgb, var(--theme-danger-soft) 70%, var(--theme-danger) 30%);
          border-color: var(--theme-danger);
        }
      }
    }
  }

  @media (max-width: 860px) {
    flex-wrap: wrap;

    .actions-left {
      flex-basis: 100%;
      flex-wrap: wrap;

      .filter-group {
        flex: 1 1 180px;
      }

      .album-filter-select,
      .status-filter-select {
        width: 100%;
      }
    }

    .actions-right {
      width: 100%;
    }
  }
}

.layout-columns {
  display: flex;
  height: 100%;
  min-height: 0;

  &.is-compact-state {
    min-height: 240px;

    .right-column {
      min-height: 240px;
    }

    .task-list-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
  }

  /* 1024px 以下：左右双列改成上下，左列卡片横向铺开 */
  @media (max-width: 1024px) {
    flex-direction: column;
    height: auto;
    max-height: 80vh;

    .left-column {
      width: 100% !important;
      border-right: none !important;
      border-bottom: 1px solid var(--ds-border-light);
      max-height: 200px;
      flex-shrink: 0;

      .progress-card,
      .stats-card,
      .speed-card {
        display: inline-block;
        width: calc(33.33% - 8px);
        margin-right: 6px;
        vertical-align: top;
      }
    }

    .right-column {
      flex: 1;
      min-height: 300px;
    }
  }

  /* 480px 以下：堆叠 + 紧凑 */
  @media (max-width: 480px) {
    .left-column {
      max-height: none;
      .progress-card,
      .stats-card,
      .speed-card {
        display: block;
        width: 100%;
        margin-right: 0;
      }
    }
  }

  .left-column {
    width: 200px;
    flex-shrink: 0;
    padding: 8px 10px;
    border-right: 1px solid var(--theme-border-subtle);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .progress-card,
    .stats-card,
    .speed-card {
      background: var(--theme-surface-soft);
      border: 1px solid var(--theme-border-subtle);
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 0; // 用容器的 gap 撑开间距
      flex: 1 1 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;

      .card-title {
        margin: 0 0 6px 0;
        font-size: 11px;
        font-weight: 500;
        color: var(--theme-text-secondary);
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }

    // 任务状态有 6 行内容，份额更大一些
    .stats-card {
      flex: 1.6 1 0;
    }

    .progress-card {
      .progress-top {
        display: flex;
        align-items: center;
        gap: 12px;

        .progress-info {
          .progress-percentage {
            font-size: 18px;
            font-weight: 700;
            color: var(--theme-success);
            line-height: 1;
          }

          .progress-text {
            font-size: 10px;
            color: var(--theme-text-muted);
            margin-top: 2px;
          }
        }
      }
    }

    .stats-card {
      .stats-list {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .stat-label {
            font-size: 11px;
            color: var(--theme-text-muted);
          }

          .stat-value {
            font-size: 12px;
            font-weight: 600;

            &.total {
              color: var(--theme-text-muted);
            }
            &.uploading {
              color: var(--theme-info);
            }
            &.waiting {
              color: var(--theme-warning);
            }
            &.completed {
              color: var(--theme-success);
            }
            &.error {
              color: var(--theme-danger);
            }
            &.paused {
              color: var(--theme-warning);
            }
          }
        }
      }
    }

    .speed-card {
      text-align: center;

      .speed-info {
        .current-speed {
          font-size: 16px;
          font-weight: 700;
          color: var(--theme-success);
          line-height: 1;
          margin-bottom: 4px;
        }

        .speed-label {
          font-size: 10px;
          color: var(--theme-text-muted);
        }
      }
    }
  }

  .right-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .task-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--theme-border-subtle);

      .list-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text-primary);
      }

      .list-count {
        font-size: 12px;
        color: var(--theme-text-muted);
      }
    }

    .task-list-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;

      .task-list {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .task-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--theme-surface-soft);
          border: 1px solid var(--theme-border-subtle);
          border-radius: 6px;
          transition:
            background-color var(--theme-duration-fast) var(--theme-ease),
            border-color var(--theme-duration-fast) var(--theme-ease);

          &:hover {
            background: var(--theme-surface-hover);
            border-color: var(--theme-border);
          }

          &.is-uploading {
            border-color: var(--theme-info-border);
            background: var(--theme-info-soft);
          }

          &.is-error {
            border-color: var(--theme-danger-border);
            background: var(--theme-danger-soft);
          }

          &.is-completed {
            border-color: var(--theme-success-border);
            background: var(--theme-success-soft);
          }

          &.is-paused {
            border-color: var(--theme-warning-border);
            background: var(--theme-warning-soft);
          }

          .task-info {
            flex: 1;
            min-width: 0;
            display: flex;
            gap: 8px;
            align-items: flex-start;

            .file-thumbnail {
              width: 32px;
              height: 32px;
              flex-shrink: 0;
              border-radius: 4px;
              overflow: hidden;
              background: var(--theme-surface-hover);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;

              .privacy-overlay {
                position: absolute;
                inset: 0;
                z-index: 3;
                background: var(--theme-privacy-backdrop);
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(2px);
                pointer-events: none;
                border-radius: inherit; /* 跟随父 .file-thumbnail 圆角 */

                .privacy-icon {
                  font-size: 14px;
                  color: var(--theme-privacy-icon);
                }
              }

              .thumbnail-image,
              .thumbnail-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 2px;
              }

              .file-icon {
                color: var(--theme-text-muted);

                &.video-icon {
                  color: var(--theme-info);
                }

                &.document-icon {
                  color: var(--theme-text-muted);
                }
              }

              .type-badge {
                position: absolute;
                top: 2px;
                right: 2px;
                background: var(--theme-backdrop);
                border-radius: 2px;
                padding: 1px 2px;
                font-size: 10px;
                color: var(--theme-text-inverse);
                display: flex;
                align-items: center;
                justify-content: center;

                .el-icon {
                  font-size: 8px;
                }
              }
            }

            .task-details {
              flex: 1;
              min-width: 0;

              .task-name {
                font-size: 12px;
                font-weight: 500;
                color: var(--theme-text-primary);
                margin-bottom: 4px;
                word-break: break-word;
              }

              .task-meta {
                display: flex;
                gap: 8px;
                font-size: 10px;
                color: var(--theme-text-muted);
                margin-bottom: 2px;
                align-items: center;
                flex-wrap: wrap;

                .album-name {
                  color: var(--theme-info-text);
                  background: var(--theme-info-soft);
                  padding: 1px 4px;
                  border-radius: 3px;
                  font-size: 9px;
                  font-weight: 500;
                  border: 1px solid var(--theme-info-border);
                }

                .file-size {
                  background: var(--theme-success-soft);
                  color: var(--theme-success-text);
                  padding: 1px 4px;
                  border-radius: 3px;
                  font-size: 9px;
                  font-weight: 500;
                  border: 1px solid var(--theme-success-border);
                  flex-shrink: 0;
                }

                .create-time {
                  background: var(--theme-surface-hover);
                  color: var(--theme-text-secondary);
                  padding: 1px 4px;
                  border-radius: 3px;
                  font-size: 9px;
                  font-weight: 500;
                  border: 1px solid var(--theme-border);
                  flex-shrink: 0;
                  white-space: nowrap;
                }
              }

              .error-message {
                margin-top: 4px;

                .error-content {
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 10px;
                  cursor: help;

                  .error-text {
                    color: var(--theme-danger);
                    flex: 1;
                  }

                  .retry-count {
                    color: var(--theme-danger-text);
                    font-size: 9px;
                  }

                  // 不同类型错误图标的样式
                  .error-icon-file {
                    color: var(--theme-warning);
                  }

                  .error-icon-network {
                    color: var(--theme-text-muted);
                  }

                  .error-icon-auth {
                    color: var(--theme-danger);
                  }

                  .error-icon-info {
                    color: var(--theme-info);
                  }

                  .error-icon-general {
                    color: var(--theme-danger);
                  }
                }
              }
            }
          }

          .task-progress {
            width: 120px;
            flex-shrink: 0;

            .progress-bar-container {
              margin-bottom: 4px;
            }

            .progress-info {
              display: flex;
              justify-content: space-between;
              font-size: 10px;

              .progress-text {
                color: var(--theme-text-secondary);
              }

              .speed-text {
                color: var(--theme-success);
              }
            }
          }

          .task-actions {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
          }
        }
      }
    }

    .pagination-wrapper {
      padding: 12px 16px;
      border-top: 1px solid var(--theme-border-subtle);
      display: flex;
      justify-content: center;
    }
  }
}
</style>
