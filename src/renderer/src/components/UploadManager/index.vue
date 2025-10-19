<template>
  <el-dialog
    v-model="visible"
    title="上传管理器"
    width="900px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :append-to-body="true"
    :lock-scroll="false"
    :modal-append-to-body="false"
    class="upload-manager-dialog dark-theme"
  >
    <!-- 顶部操作栏 -->
    <div class="header-actions">
      <div class="actions-left">
        <!-- 相册筛选 -->
        <div class="filter-group">
          <label class="filter-label">相册筛选：</label>
          <el-select
            v-model="selectedAlbumId"
            placeholder="选择相册"
            size="small"
            style="width: 200px"
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
        </div>

        <!-- 状态筛选 -->
        <div class="filter-group">
          <label class="filter-label">状态筛选：</label>
          <el-select v-model="statusFilter" size="small" style="width: 120px" @change="loadTasks">
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
        <el-button v-if="hasActiveTasks" size="small" type="warning" @click="pauseAllTasks">
          <el-icon><VideoPause /></el-icon>
          暂停全部
        </el-button>
        <el-button v-if="hasPausedTasks" size="small" type="success" @click="resumeAllTasks">
          <el-icon><VideoPlay /></el-icon>
          恢复全部
        </el-button>
        <el-button v-if="hasFailedTasks" size="small" type="primary" @click="retryAllFailed">
          <el-icon><Refresh /></el-icon>
          重试失败
        </el-button>
        <el-button size="small" type="danger" @click="clearAllTasks">
          <el-icon><Delete /></el-icon>
          清空全部
        </el-button>
      </div>
    </div>

    <!-- 分栏布局 -->
    <div class="layout-columns">
      <!-- 左侧：统计区域 -->
      <div class="left-column">
        <!-- 总体进度卡片 -->
        <div class="progress-card">
          <div class="progress-top">
            <div class="progress-circle">
              <el-progress :percentage="overallProgress" type="circle" :width="60" />
            </div>
            <div class="progress-info">
              <div class="progress-percentage">{{ overallProgress }}%</div>
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
        <div class="task-list-header">
          <span class="list-title">上传任务</span>
          <span class="list-count">共 {{ pagination.total }} 个任务</span>
        </div>

        <!-- 任务列表 -->
        <div v-loading="loading" class="task-list-container">
          <div class="task-list">
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
                    @error="handleImageError"
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
              <div class="task-progress">
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
                  @click="pauseTask(task.id)"
                >
                  <el-icon><VideoPause /></el-icon>
                </el-button>
                <el-button
                  v-if="task.status === 'paused'"
                  size="small"
                  type="success"
                  text
                  @click="resumeTask(task.id)"
                >
                  <el-icon><VideoPlay /></el-icon>
                </el-button>
                <el-button
                  v-if="task.status === 'error'"
                  size="small"
                  type="primary"
                  text
                  @click="retryTask(task.id)"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
                <el-button size="small" type="danger" text @click="deleteTask(task.id)">
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
  InfoFilled
} from '@element-plus/icons-vue'

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

// 预览图缓存（避免重复加载）
const previewCache = new Map()

// 计算属性
const overallProgress = computed(() => {
  if (taskStats.value.total === 0) return 0
  return Math.round((taskStats.value.completed / taskStats.value.total) * 100)
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

const handleImageError = (event) => {
  // 图片加载失败时的处理
  console.warn('缩略图加载失败:', event.target.src)
  // 可以设置一个默认图标或隐藏图片
}

const getProgressColor = (status) => {
  switch (status) {
    case 'uploading':
      return '#409eff'
    case 'completed':
      return '#67c23a'
    case 'error':
      return '#f56c6c'
    case 'paused':
      return '#e6a23c'
    default:
      return '#909399'
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
  if (!errorMessage) return Warning

  const lowerError = errorMessage.toLowerCase()
  if (lowerError.includes('文件') && (lowerError.includes('删除') || lowerError.includes('移动'))) {
    return FolderDelete
  } else if (
    lowerError.includes('网络') ||
    lowerError.includes('超时') ||
    lowerError.includes('连接')
  ) {
    return Connection
  } else if (
    lowerError.includes('权限') ||
    lowerError.includes('认证') ||
    lowerError.includes('登录')
  ) {
    return Lock
  } else if (lowerError.includes('信息') || lowerError.includes('参数')) {
    return InfoFilled
  } else {
    return Warning
  }
}

const getErrorIconClass = (errorMessage) => {
  if (!errorMessage) return 'error-icon-general'

  const lowerError = errorMessage.toLowerCase()
  if (lowerError.includes('文件') && (lowerError.includes('删除') || lowerError.includes('移动'))) {
    return 'error-icon-file'
  } else if (
    lowerError.includes('网络') ||
    lowerError.includes('超时') ||
    lowerError.includes('连接')
  ) {
    return 'error-icon-network'
  } else if (
    lowerError.includes('权限') ||
    lowerError.includes('认证') ||
    lowerError.includes('登录')
  ) {
    return 'error-icon-auth'
  } else if (lowerError.includes('信息') || lowerError.includes('参数')) {
    return 'error-icon-info'
  } else {
    return 'error-icon-general'
  }
}

const getErrorDisplayText = (errorMessage) => {
  if (!errorMessage) return '未知错误'

  // 如果错误信息过长，截取主要部分
  if (errorMessage.length > 30) {
    return truncateText(errorMessage, 30)
  }
  return errorMessage
}

const getFullErrorMessage = (task) => {
  let message = task.error || '未知错误'

  // 添加额外的上下文信息
  const contextInfo = []

  if (task.retryCount && task.retryCount > 0) {
    contextInfo.push(`已重试 ${task.retryCount} 次`)
  }

  if (task.lastRetryTime) {
    const retryTime = new Date(task.lastRetryTime).toLocaleString()
    contextInfo.push(`最后重试时间: ${retryTime}`)
  }

  if (task.create_time) {
    const createTime = new Date(task.create_time).toLocaleString()
    contextInfo.push(`创建时间: ${createTime}`)
  }

  if (contextInfo.length > 0) {
    message += '\n\n' + contextInfo.join('\n')
  }

  // 添加建议的解决方案
  const lowerError = message.toLowerCase()
  let suggestions = []

  if (lowerError.includes('文件') && (lowerError.includes('删除') || lowerError.includes('移动'))) {
    suggestions.push('建议: 请检查文件是否存在，或重新选择文件')
  } else if (lowerError.includes('网络') || lowerError.includes('超时')) {
    suggestions.push('建议: 请检查网络连接，或稍后重试')
  } else if (lowerError.includes('权限') || lowerError.includes('认证')) {
    suggestions.push('建议: 请检查登录状态，可能需要重新登录')
  }

  if (suggestions.length > 0) {
    message += '\n\n' + suggestions.join('\n')
  }

  return message
}

// API调用
const loadAlbums = async () => {
  try {
    const albums = await window.QzoneAPI.upload.getAlbumsWithStats()
    albumOptions.value = albums
  } catch (error) {
    console.error('加载相册列表失败:', error)
  }
}

const loadTasks = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value === 'all' ? null : statusFilter.value,
      albumId: selectedAlbumId.value === 'all' ? null : selectedAlbumId.value
    }

    const result = await window.QzoneAPI.upload.getTasks(params)
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
    console.error('加载任务列表失败:', error)
    ElMessage.error('加载任务列表失败')
    loading.value = false
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
  await window.QzoneAPI.upload.setManagerOpen(false)
  // 只在组件销毁时才清理监听器
  cleanupEventListeners()
  console.log('[UploadManager] 组件销毁，清理监听器')
})
</script>

<style lang="scss" scoped>
:deep(.upload-manager-dialog) {
  &.dark-theme {
    .el-dialog {
      background: #1a1a1a;
      color: #e0e0e0;

      .el-dialog__header {
        background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
        border-bottom: 1px solid #333;

        .el-dialog__title {
          color: #e0e0e0;
          font-weight: 600;
        }
      }

      .el-dialog__body {
        background: #1a1a1a;
        padding: 0;
      }
    }
  }
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .actions-left {
    display: flex;
    gap: 16px;
    align-items: center;

    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .filter-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        white-space: nowrap;
      }
    }
  }

  .actions-right {
    display: flex;
    gap: 8px;

    :deep(.el-button) {
      background: #2a2a2a;
      border-color: #444;
      color: #ccc;

      &:hover {
        background: #333;
        border-color: #555;
        color: #fff;
      }

      &.el-button--success {
        background: #67c23a;
        border-color: #67c23a;
        color: #fff;

        &:hover {
          background: #85ce61;
          border-color: #85ce61;
        }
      }

      &.el-button--warning {
        background: #e6a23c;
        border-color: #e6a23c;
        color: #fff;

        &:hover {
          background: #ebb563;
          border-color: #ebb563;
        }
      }

      &.el-button--primary {
        background: #409eff;
        border-color: #409eff;
        color: #fff;

        &:hover {
          background: #66b1ff;
          border-color: #66b1ff;
        }
      }

      &.el-button--danger {
        background: #f56c6c;
        border-color: #f56c6c;
        color: #fff;

        &:hover {
          background: #f78989;
          border-color: #f78989;
        }
      }
    }
  }
}

.layout-columns {
  display: flex;
  height: 465px;

  .left-column {
    width: 200px;
    flex-shrink: 0;
    padding: 15px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    overflow-y: auto;

    .progress-card,
    .stats-card,
    .speed-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;

      .card-title {
        margin: 0 0 12px 0;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        gap: 4px;
      }
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
            color: #67c23a;
            line-height: 1;
          }

          .progress-text {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 2px;
          }
        }
      }
    }

    .stats-card {
      .stats-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .stat-label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
          }

          .stat-value {
            font-size: 12px;
            font-weight: 600;

            &.total {
              color: #909399;
            }
            &.uploading {
              color: #409eff;
            }
            &.waiting {
              color: #e6a23c;
            }
            &.completed {
              color: #67c23a;
            }
            &.error {
              color: #f56c6c;
            }
            &.paused {
              color: #e6a23c;
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
          color: #67c23a;
          line-height: 1;
          margin-bottom: 4px;
        }

        .speed-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);

      .list-title {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
      }

      .list-count {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
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
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          transition: all 0.2s ease;

          &:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.1);
          }

          &.is-uploading {
            border-color: rgba(64, 158, 255, 0.3);
            background: rgba(64, 158, 255, 0.05);
          }

          &.is-error {
            border-color: rgba(245, 108, 108, 0.3);
            background: rgba(245, 108, 108, 0.05);
          }

          &.is-completed {
            border-color: rgba(103, 194, 58, 0.3);
            background: rgba(103, 194, 58, 0.05);
          }

          &.is-paused {
            border-color: rgba(230, 162, 60, 0.3);
            background: rgba(230, 162, 60, 0.05);
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
              background: rgba(255, 255, 255, 0.05);
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;

              .thumbnail-image,
              .thumbnail-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 2px;
              }

              .file-icon {
                color: rgba(255, 255, 255, 0.6);

                &.video-icon {
                  color: #409eff;
                }

                &.document-icon {
                  color: rgba(255, 255, 255, 0.6);
                }
              }

              .type-badge {
                position: absolute;
                top: 2px;
                right: 2px;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 2px;
                padding: 1px 2px;
                font-size: 10px;
                color: #fff;
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
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 4px;
                word-break: break-word;
              }

              .task-meta {
                display: flex;
                gap: 8px;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 2px;
                align-items: center;
                flex-wrap: wrap;

                .album-name {
                  color: #409eff;
                  background: rgba(64, 158, 255, 0.12);
                  padding: 1px 4px;
                  border-radius: 3px;
                  font-size: 9px;
                  font-weight: 500;
                  border: 1px solid rgba(64, 158, 255, 0.2);
                }

                .file-size {
                  background: rgba(103, 194, 58, 0.12);
                  color: rgba(103, 194, 58, 0.9);
                  padding: 1px 4px;
                  border-radius: 3px;
                  font-size: 9px;
                  font-weight: 500;
                  border: 1px solid rgba(103, 194, 58, 0.2);
                  flex-shrink: 0;
                }

                .create-time {
                  background: rgba(255, 255, 255, 0.08);
                  color: rgba(255, 255, 255, 0.7);
                  padding: 1px 4px;
                  border-radius: 3px;
                  font-size: 9px;
                  font-weight: 500;
                  border: 1px solid rgba(255, 255, 255, 0.1);
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
                    color: #f56c6c;
                    flex: 1;
                  }

                  .retry-count {
                    color: rgba(245, 108, 108, 0.7);
                    font-size: 9px;
                  }

                  // 不同类型错误图标的样式
                  .error-icon-file {
                    color: #e6a23c;
                  }

                  .error-icon-network {
                    color: #909399;
                  }

                  .error-icon-auth {
                    color: #f56c6c;
                  }

                  .error-icon-info {
                    color: #409eff;
                  }

                  .error-icon-general {
                    color: #f56c6c;
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
                color: rgba(255, 255, 255, 0.7);
              }

              .speed-text {
                color: #67c23a;
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
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      justify-content: center;
    }
  }
}
</style>
