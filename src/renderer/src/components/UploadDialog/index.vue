<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :append-to-body="true"
    :lock-scroll="false"
    :modal-append-to-body="false"
    class="upload-manager-dialog dark-theme ds-dialog"
    @update:model-value="handleDialogChange"
  >
    <!-- 紧凑工具栏：相册信息 + 并发 | 主操作 -->
    <div class="ud-toolbar">
      <!-- 左：上下文 chip（相册 + 并发） -->
      <div class="ud-toolbar-left">
        <el-popover
          v-model:visible="albumPickerVisible"
          placement="bottom-start"
          :width="320"
          trigger="click"
          popper-class="upload-album-picker-popper"
          :show-arrow="false"
        >
          <template #reference>
            <div
              class="album-chip"
              :class="{ clickable: true, overridden: !!targetAlbumOverride }"
              :title="
                effectiveAlbumId
                  ? `当前上传到相册：${effectiveAlbumName}（ID: ${effectiveAlbumId}）\n点击切换`
                  : '请选择相册'
              "
            >
              <el-icon><FolderOpened /></el-icon>
              <span class="album-chip-name">{{ effectiveAlbumName }}</span>
              <el-icon class="album-chip-arrow"><ArrowDown /></el-icon>
            </div>
          </template>

          <div class="album-picker">
            <div class="album-picker-header">
              <el-input
                v-model="albumPickerQuery"
                placeholder="搜索相册名 / ID"
                size="small"
                clearable
              />
            </div>
            <div class="album-picker-list">
              <div v-if="!availableAlbums.length" class="album-picker-empty">
                未找到相册列表（请等待左侧加载完成或刷新）
              </div>
              <div
                v-for="a in filteredAlbums"
                :key="a.id"
                class="album-picker-item"
                :class="{ active: a.id === effectiveAlbumId }"
                :title="`${a.name} · ${a.total || 0} 张 · ${a.className || ''}`"
                @click="pickTargetAlbum(a)"
              >
                <el-icon class="item-icon"><FolderOpened /></el-icon>
                <div class="item-info">
                  <span class="item-name">{{ a.name }}</span>
                  <span class="item-meta">{{ a.total || 0 }}张 · {{ a.className || '其他' }}</span>
                </div>
                <el-icon v-if="a.id === effectiveAlbumId" class="item-check">
                  <CircleCheck />
                </el-icon>
              </div>
              <div v-if="availableAlbums.length && !filteredAlbums.length" class="album-picker-empty">
                没有匹配「{{ albumPickerQuery }}」的相册
              </div>
            </div>
          </div>
        </el-popover>

        <el-tooltip placement="bottom" :show-after="300">
          <template #content>
            <div style="line-height: 1.5">
              同时上传几个文件<br />
              <span style="color: #fbbf24">≥2 时上传完成顺序会乱</span><br />
              单文件带宽充足建议 1，小文件批量建议 3-5
            </div>
          </template>
          <div class="concurrency-chip">
            <span class="chip-label">并发</span>
            <el-input-number
              v-model="uploadConcurrency"
              :min="1"
              :max="10"
              size="small"
              controls-position="right"
              class="chip-input"
              @change="handleConcurrencyChange"
            />
          </div>
        </el-tooltip>

        <!-- 卡片大小选择器：默认最小，文件多时不会出现外层滚动 -->
        <el-tooltip content="调整文件卡片大小" placement="bottom" :show-after="300">
          <div class="size-chip">
            <span class="chip-label">大小</span>
            <el-radio-group v-model="cardSize" size="small" class="size-radio">
              <el-radio-button label="mini">最小</el-radio-button>
              <el-radio-button label="sm">小</el-radio-button>
              <el-radio-button label="md">中</el-radio-button>
              <el-radio-button label="lg">大</el-radio-button>
            </el-radio-group>
          </div>
        </el-tooltip>
      </div>

      <!-- 右：主操作（根据状态切换） -->
      <div class="ud-toolbar-right">
        <!-- 空状态：单个主 CTA -->
        <el-button
          v-if="localFiles.length === 0"
          type="primary"
          size="default"
          @click="triggerFileSelect"
        >
          <el-icon><Plus /></el-icon>
          选择文件
        </el-button>

        <!-- 有文件未锁定 -->
        <template v-else-if="!uploadLocked">
          <el-button size="small" plain @click="triggerFileSelect">
            <el-icon><Plus /></el-icon>
            添加
          </el-button>
          <el-button size="small" plain type="danger" @click="clearAllFiles">
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
          <el-button type="success" size="default" :disabled="uploading" @click="startUploadAll">
            <el-icon><Upload /></el-icon>
            开始上传
          </el-button>
        </template>

        <!-- 上传中 / 暂停 -->
        <template v-else-if="uploadLocked && !batchCompleted">
          <el-button
            v-if="hasActiveTasks"
            type="warning"
            size="default"
            plain
            @click="pauseAllTasks"
          >
            <el-icon><VideoPause /></el-icon>
            暂停全部
          </el-button>
          <el-button
            v-if="hasPausedTasks"
            type="success"
            size="default"
            @click="resumeAllTasks"
          >
            <el-icon><VideoPlay /></el-icon>
            继续全部
          </el-button>
          <el-button size="small" plain type="danger" @click="clearAllFiles">
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
        </template>

        <!-- 批次完成 -->
        <el-button
          v-else-if="batchCompleted"
          type="primary"
          size="default"
          @click="startNewBatch"
        >
          <el-icon><Plus /></el-icon>
          新建批次
        </el-button>
      </div>
    </div>

    <!-- 分栏布局 -->
    <div class="layout-columns" :class="{ 'has-files': localFiles.length > 0 }">
      <!-- 左侧：文件列表区域 -->
      <div class="left-column">
        <!-- 拖拽上传区域 -->
        <div
          v-if="localFiles.length === 0"
          class="upload-drop-area"
          :class="{ 'is-dragover': isDragging }"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
          @click="triggerFileSelect"
        >
          <div class="drop-icon">
            <el-icon :size="40"><Upload /></el-icon>
          </div>
          <p class="drop-text">将文件拖到此处 或 点击「选择文件」</p>
          <div class="drop-formats">
            <span>JPG</span><span>PNG</span><span>GIF</span><span>WEBP</span><span>MP4</span><span>MOV</span><span>AVI</span>
          </div>
          <div class="drop-rules">
            <el-icon><InfoFilled /></el-icon>
            <span>图片 ≤ 500MB · 视频 ≤ 1GB · 视频时长 ≤ 10 分钟</span>
          </div>
        </div>

        <!-- 文件列表 -->
        <div v-else class="file-list">
          <!-- 文件网格 -->
          <div class="file-grid-container">
            <div class="file-grid" :class="`size-${cardSize}`">
              <div
                v-for="(file, index) in currentPageFiles"
                :key="file.uid"
                class="file-card"
                :class="{
                  'upload-failed': file.uploadStatus === 'failed' || file.uploadStatus === 'error',
                  'upload-uploading': file.uploadStatus === 'uploading',
                  'upload-waiting': file.uploadStatus === 'waiting',
                  'upload-completed': file.uploadStatus === 'completed'
                }"
                @click="handleCardClick(file)"
              >
                <!-- 缩略图（隐私模式打码） -->
                <div class="file-thumbnail">
                  <!-- 隐私遮罩 —— 与相册列表风格一致 -->
                  <div v-if="privacyStore.privacyMode" class="privacy-overlay">
                    <el-icon class="privacy-icon"><Hide /></el-icon>
                    <span class="privacy-text">隐私保护</span>
                  </div>
                  <el-image
                    v-if="isImageFile(file.name) && file.preview"
                    :src="file.preview"
                    :alt="file.name"
                    class="thumbnail-image"
                    fit="cover"
                    :preview-src-list="[file.preview]"
                    :initial-index="0"
                    :hide-on-click-modal="true"
                    :append-to-body="true"
                    :z-index="9999"
                    preview-teleported
                    @load="onImageLoad(file)"
                    @error="(event) => handleImageError(event, file)"
                  >
                    <template #error>
                      <div class="image-error">
                        <el-icon :size="24"><Picture /></el-icon>
                        <div class="error-text">无预览</div>
                      </div>
                    </template>
                  </el-image>
                  <!-- 视频缩略图：优先用 videoCover（真实视频帧 JPEG）显示，不去解码整个视频文件 -->
                  <img
                    v-else-if="isVideoFile(file.name) && file.videoCover"
                    :src="file.videoCover"
                    :alt="file.name"
                    class="thumbnail-image"
                  />
                  <video
                    v-else-if="isVideoFile(file.name) && file.preview"
                    :src="file.preview"
                    class="thumbnail-video"
                    preload="metadata"
                    @error="(event) => handleVideoError(event, file)"
                  ></video>
                  <div v-else-if="isVideoFile(file.name)" class="video-icon">
                    <el-icon :size="32"><VideoPlay /></el-icon>
                  </div>
                  <div v-else class="file-icon">
                    <el-icon :size="32"><Document /></el-icon>
                  </div>

                  <!-- Loading 状态：预览加载中 -->
                  <div
                    v-if="(isImageFile(file.name) || isVideoFile(file.name)) && file.previewLoading"
                    class="preview-loading"
                  >
                    <el-icon class="is-loading" :size="24"><Loading /></el-icon>
                    <div class="loading-text">加载中...</div>
                  </div>

                  <!-- 状态图标 -->
                  <div
                    v-if="file.uploadStatus === 'failed' || file.uploadStatus === 'error'"
                    class="status-container-top-left"
                  >
                    <div class="status-icon failed">
                      <el-tooltip
                        :content="getFileErrorTooltip(file)"
                        placement="top"
                        :show-after="300"
                      >
                        <el-icon :size="16"><Warning /></el-icon>
                      </el-tooltip>
                    </div>
                    <!-- 重试按钮 -->
                    <div class="retry-btn-top" @click.stop="retryUpload(file)">
                      <el-tooltip content="重试上传" placement="top">
                        <el-icon :size="14"><Refresh /></el-icon>
                      </el-tooltip>
                    </div>
                  </div>
                  <div
                    v-else-if="file.uploadStatus === 'uploading'"
                    class="status-icon uploading top-left"
                  >
                    <el-icon :size="16"><Upload /></el-icon>
                  </div>
                  <div
                    v-else-if="file.uploadStatus === 'waiting'"
                    class="status-icon waiting top-left"
                  >
                    <el-tooltip content="等待上传" placement="top">
                      <el-icon :size="16"><Clock /></el-icon>
                    </el-tooltip>
                  </div>
                  <div
                    v-else-if="file.uploadStatus === 'paused'"
                    class="status-icon paused top-left"
                  >
                    <el-tooltip content="已暂停" placement="top">
                      <el-icon :size="16"><VideoPause /></el-icon>
                    </el-tooltip>
                  </div>
                  <div
                    v-else-if="file.uploadStatus === 'completed'"
                    class="status-icon completed top-left"
                  >
                    <el-icon :size="16"><CircleCheck /></el-icon>
                  </div>

                  <!-- 暂停/继续按钮 -->
                  <div
                    v-if="file.uploadStatus === 'uploading' || file.uploadStatus === 'waiting'"
                    class="pause-btn-top"
                    @click.stop="pauseFileUpload(file)"
                  >
                    <el-tooltip content="暂停上传" placement="top">
                      <el-icon :size="14"><VideoPause /></el-icon>
                    </el-tooltip>
                  </div>
                  <div
                    v-else-if="file.uploadStatus === 'paused'"
                    class="resume-btn-top"
                    @click.stop="resumeFileUpload(file)"
                  >
                    <el-tooltip content="继续上传" placement="top">
                      <el-icon :size="14"><VideoPlay /></el-icon>
                    </el-tooltip>
                  </div>

                  <!-- 上传进度显示 -->
                  <div
                    v-if="file.uploadStatus === 'uploading' && file.progress >= 0"
                    class="upload-progress-overlay"
                  >
                    <div class="progress-bar">
                      <div class="progress-fill" :style="{ width: file.progress + '%' }"></div>
                    </div>
                    <div class="progress-text">{{ file.progress }}%</div>
                  </div>

                  <!-- 失败时在卡片底部显示醒目错误信息 -->
                  <div
                    v-if="
                      (file.uploadStatus === 'failed' || file.uploadStatus === 'error') &&
                      file.errorMessage
                    "
                    class="error-message-overlay"
                  >
                    <el-icon :size="14"><Warning /></el-icon>
                    <span class="error-text" :title="file.errorMessage">{{
                      file.errorMessage
                    }}</span>
                  </div>

                  <!-- 删除按钮 -->
                  <div class="delete-btn" @click.stop="removeFile(index)">
                    <el-icon :size="16"><Close /></el-icon>
                  </div>
                </div>

                <!-- 文件信息 -->
                <div class="file-info">
                  <el-input v-model="file.title" size="small" placeholder="输入标题" @click.stop />
                  <div class="file-meta">
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                    <span v-if="file.createTime" class="create-time">
                      {{ formatTime(file.createTime) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 分页控制 -->
          <div v-if="totalPages > 1" class="pagination-wrapper">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="localFiles.length"
              layout="total, prev, pager, next"
              size="small"
              background
            />
          </div>
        </div>

      </div>

      <!-- 右侧：统计区域 —— 空状态下隐藏整列（目标相册信息已经在顶部 tip 显示） -->
      <div v-if="localFiles.length > 0" class="right-column">
        <!-- 任务统计卡片 —— 空状态下隐藏（没文件时显示一堆 0 没意义） -->
        <div v-if="localFiles.length > 0" class="stat-card">
          <h5 class="card-title">
            <el-icon><DataAnalysis /></el-icon>
            任务统计
          </h5>
          <div class="stat-list">
            <div class="stat-row">
              <span class="stat-label">待上传</span>
              <span class="stat-value">{{ localFiles.length }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">总大小</span>
              <span class="stat-value">{{ truncateFileSize(formatFileSize(totalSize)) }}</span>
            </div>
          </div>
        </div>

        <!-- 上传进度卡片 —— 空状态下隐藏 -->
        <div v-if="localFiles.length > 0" class="progress-card">
          <h5 class="card-title">
            <el-icon><Upload /></el-icon>
            上传进度
          </h5>
          <div class="progress-content">
            <div class="progress-circle-wrapper">
              <el-progress :percentage="overallProgress" type="circle" :width="56" />
            </div>
            <div class="progress-stats">
              <div class="stat-row">
                <span class="stat-label">已完成</span>
                <span class="stat-value primary">{{ uploadStats.completed }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">上传中</span>
                <span class="stat-value warning">{{ uploadStats.uploading }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">等待中</span>
                <span class="stat-value info">{{ uploadStats.waiting }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">失败</span>
                <span class="stat-value danger">{{ uploadStats.error }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 上传速度卡片 —— 空状态下隐藏 -->
        <div v-if="localFiles.length > 0" class="speed-card">
          <h5 class="card-title">
            <el-icon><Timer /></el-icon>
            上传速度
          </h5>
          <div class="speed-display">
            <div class="speed-row">
              <span class="speed-label">实时速度</span>
              <span class="speed-value-wrapper">
                <span class="speed-value" :class="{ uploading: uploading }">
                  {{ formatSpeed(currentSpeed) }}
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- 相册信息卡片 -->
        <div class="album-card">
          <h5 class="card-title">
            <el-icon><FolderOpened /></el-icon>
            目标相册
          </h5>
          <div class="album-content">
            <div v-if="!effectiveAlbumId" class="album-select-hint">
              <span class="hint-text">请选择目标相册</span>
              <el-button class="album-btn" size="small" type="primary" @click="selectTargetAlbum">
                <el-icon><FolderOpened /></el-icon>
                选择相册
              </el-button>
            </div>
            <div v-else class="album-selected">
              <div class="album-name" :title="effectiveAlbumName">
                {{ truncateText(effectiveAlbumName, 20) }}
                <span v-if="targetAlbumOverride" class="album-override-tag">已切换</span>
              </div>
              <div class="album-meta">
                <span
                  class="meta-item ds-copyable"
                  :title="`点击复制相册 ID: ${effectiveAlbumId}`"
                  @click="copyToClipboard(effectiveAlbumId, '相册 ID')"
                  >ID: {{ truncateText(effectiveAlbumId, 15) }}</span
                >
                <el-button
                  class="album-change-btn"
                  size="small"
                  type="primary"
                  text
                  @click="selectTargetAlbum"
                >
                  <el-icon><Refresh /></el-icon>
                  更换
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getVideoMetadata } from '@renderer/utils/video-helper'
import { copyToClipboard } from '@renderer/utils'
import { usePrivacyStore } from '@renderer/store/privacy.store'

const privacyStore = usePrivacyStore()
import {
  Plus,
  Upload,
  VideoPlay,
  VideoPause,
  Clock,
  Document,
  Close,
  DataAnalysis,
  Timer,
  FolderOpened,
  Warning,
  Refresh,
  Delete,
  CircleCheck,
  Loading,
  Picture,
  InfoFilled,
  ArrowDown,
  Hide
} from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  albumId: {
    type: String,
    required: false,
    default: ''
  },
  albumName: {
    type: String,
    default: '未命名相册'
  },
  // 可选：完整相册列表，用于在弹窗内切换上传目标相册
  availableAlbums: {
    type: Array,
    default: () => []
  },
  // 添加上下文模式支持
  contextMode: {
    type: String,
    default: 'album', // 'album' | 'global'
    validator: (value) => ['album', 'global'].includes(value)
  }
})

const emit = defineEmits(['close'])

// 文件类型
const acceptFileTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mov', 'avi']

// 本地文件列表（待上传）
const localFiles = ref([])

// 上传统计信息（来自主进程，仅全局模式使用）
const globalUploadStats = ref({
  total: 0,
  waiting: 0,
  uploading: 0,
  completed: 0,
  error: 0,
  paused: 0,
  cancelled: 0
})

// 当前统计信息（相册模式基于localFiles计算，全局模式使用globalUploadStats）
const uploadStats = computed(() => {
  if (props.contextMode === 'album') {
    // 相册模式：基于localFiles计算当前会话的统计
    const stats = {
      total: localFiles.value.length,
      waiting: 0,
      uploading: 0,
      completed: 0,
      error: 0,
      paused: 0,
      cancelled: 0
    }

    localFiles.value.forEach((file) => {
      const status = file.uploadStatus || 'normal'
      if (status === 'waiting') {
        stats.waiting++
      } else if (status === 'uploading') {
        stats.uploading++
      } else if (status === 'completed') {
        stats.completed++
      } else if (status === 'failed' || status === 'error') {
        stats.error++
      } else if (status === 'paused') {
        stats.paused++
      } else if (status === 'cancelled') {
        stats.cancelled++
      }
    })

    return stats
  } else {
    // 全局模式：使用后端推送的统计信息
    return globalUploadStats.value
  }
})

// 当前上传速度（计算属性，从正在上传的文件中获取）
const currentSpeed = computed(() => {
  if (props.contextMode === 'album') {
    // 相册模式：从localFiles中正在上传的文件获取速度
    const uploadingFile = localFiles.value.find((file) => file.uploadStatus === 'uploading')
    return uploadingFile?.speed || 0
  } else {
    // 全局模式：使用全局速度（从后端推送）
    return globalCurrentSpeed.value
  }
})

// 全局上传速度（仅全局模式使用）
const globalCurrentSpeed = ref(0)

// 失败任务映射 (用于在网格中显示失败状态) - 已移至UploadManager组件

// 是否正在上传
const uploading = computed(() => uploadStats.value.uploading > 0)

// 上传是否锁定（锁定后不允许添加新文件到当前批次）
const uploadLocked = ref(false)

// 多文件并发上传数（1-10），默认 1（逐个上传，保证完成顺序）
const uploadConcurrency = ref(1)

// 卡片大小：mini/sm/md/lg，默认 sm —— 兼顾「能看清缩略图」与「单页放得下」
const cardSize = ref('sm')

// 目标相册（默认 = 当前 props 相册，用户可在弹窗内切换为其他相册上传）
const targetAlbumOverride = ref(null) // { id, name } | null
const effectiveAlbumId = computed(() => targetAlbumOverride.value?.id || props.albumId)
const effectiveAlbumName = computed(
  () => targetAlbumOverride.value?.name || props.albumName || '默认相册'
)
// 外部 props 相册切换时清掉本地 override（用户在主视图切了其他相册）
// 必须监听 props.albumId 而不是 effectiveAlbumId，否则会立刻把自己设置的 override 清空
watch(
  () => props.albumId,
  (newId, oldId) => {
    if (oldId && newId !== oldId) {
      targetAlbumOverride.value = null
    }
  }
)

// 相册选择 popover
const albumPickerVisible = ref(false)
const albumPickerQuery = ref('')
const filteredAlbums = computed(() => {
  const q = albumPickerQuery.value.trim().toLowerCase()
  const list = props.availableAlbums || []
  if (!q) return list
  return list.filter(
    (a) => (a.name || '').toLowerCase().includes(q) || (a.id || '').toLowerCase().includes(q)
  )
})
const handleConcurrencyChange = async (n) => {
  try {
    const updated = await window.QzoneAPI.upload.setConcurrency(n)
    uploadConcurrency.value = updated
    if (updated > 1) {
      ElMessage.info({
        message: `并发 ${updated}：将同时上传 ${updated} 个文件，完成顺序可能与添加顺序不一致`,
        duration: 4000
      })
    } else {
      ElMessage.success('已切换为逐个上传')
    }
  } catch (e) {
    console.error('设置并发数失败:', e)
    ElMessage.error('设置并发数失败')
  }
}

// 当前批次是否全部完成
const batchCompleted = computed(() => {
  if (localFiles.value.length === 0) return false

  const hasActiveTask = localFiles.value.some(
    (file) =>
      file.uploadStatus === 'uploading' ||
      file.uploadStatus === 'waiting' ||
      file.uploadStatus === 'paused'
  )

  return !hasActiveTask
})

// 是否有活跃任务（正在上传或等待中）
const hasActiveTasks = computed(() => {
  return localFiles.value.some(
    (file) => file.uploadStatus === 'uploading' || file.uploadStatus === 'waiting'
  )
})

// 是否有暂停的任务
const hasPausedTasks = computed(() => {
  return localFiles.value.some((file) => file.uploadStatus === 'paused')
})

// ==================== 会话管理 ====================
// 当前会话ID（用于分组管理上传任务）
const currentSessionId = ref(null)
// 当前会话关联的相册ID（用于检测相册切换）
const sessionAlbumId = ref(null)
// 会话模式：'new'=新会话，'continue'=继续会话
const sessionMode = ref('new')
// 是否正在检查会话
const checkingSession = ref(false)
// 弹窗打开时的完成数（用于判断是否有新的上传成功）
const initialCompletedCount = ref(0)

// 整体进度
const overallProgress = computed(() => {
  const total = uploadStats.value.total
  if (total === 0) return 0
  return Math.round((uploadStats.value.completed / total) * 100)
})

// 选中的文件
const selectedFile = ref(null)

// 拖拽状态
const isDragging = ref(false)

// 分页相关
const currentPage = ref(1)
const pageSize = 20 // 减小分页大小，提升性能

// 计算属性
const dialogTitle = computed(() => '上传管理器')

const totalPages = computed(() => Math.ceil(localFiles.value.length / pageSize))
const currentPageFiles = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return localFiles.value.slice(start, end)
})

const totalSize = computed(() => {
  return localFiles.value.reduce((sum, file) => sum + file.size, 0)
})

// 格式化函数
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
  return formatFileSize(bytesPerSecond) + '/s'
}

// 格式化时间
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

// 获取文件错误详细提示
const getFileErrorTooltip = (file) => {
  let tooltip = `错误: ${file.errorMessage}`
  if (file.retryCount > 0) {
    tooltip += `\n已重试 ${file.retryCount} 次`
  }
  if (file.createTime) {
    tooltip += `\n时间: ${new Date(file.createTime).toLocaleString('zh-CN')}`
  }
  return tooltip
}

const truncateFileSize = (sizeStr) => {
  if (sizeStr.length <= 10) return sizeStr
  return sizeStr.replace('Bytes', 'B').replace('KiB', 'K').replace('MiB', 'M').replace('GiB', 'G')
}

const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

const getMimeType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase()
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// 文件类型判断辅助函数
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

// 改进的图片加载错误处理
const handleImageError = (event, file) => {
  console.warn('缩略图加载失败:', file.name, event.target.src)
  // 可以设置一个默认图标或隐藏图片
  if (file) {
    file.previewError = true
  }
}

// 视频加载错误处理
const handleVideoError = (event, file) => {
  console.warn('视频预览加载失败:', file.name, event.target.src)
  if (file) {
    file.previewError = true
  }
}

// 文件选择
const triggerFileSelect = async () => {
  try {
    const response = await window.QzoneAPI.openFileDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: '图片和视频',
          extensions: acceptFileTypes
        }
      ]
    })

    if (!response?.canceled && response.filePaths?.length > 0) {
      const fileCount = response.filePaths.length

      // 显示加载提示
      if (fileCount > 10) {
        ElMessage.info(`正在添加 ${fileCount} 个文件，请稍候...`)
      }

      // 批量并行处理文件（不阻塞 UI）
      const addPromises = response.filePaths.map((filePath) => addFileByPath(filePath))
      await Promise.all(addPromises)

      ElMessage.success(`成功添加 ${fileCount} 个文件`)

      // 添加完成后，为当前页生成预览
      setTimeout(() => {
        generatePreviewsForCurrentPage()
      }, 200)
    }
  } catch (error) {
    console.error('文件选择失败:', error)
    ElMessage.error(`文件选择失败：${error.message}`)
  }
}

// 开始新批次（清空后重新选择）
const startNewBatch = async () => {
  try {
    // 先清空当前列表
    await clearAllFiles()
    // 然后触发文件选择
    await triggerFileSelect()
  } catch (error) {
    console.error('新建批次失败:', error)
    ElMessage.error(`新建批次失败：${error.message}`)
  }
}

// 通过文件路径添加文件
const addFileByPath = async (filePath) => {
  try {
    const response = await window.QzoneAPI.getFileInfo({ filePath })
    const fileInfo = response

    if (!fileInfo) {
      ElMessage.error(`无法获取文件信息：${filePath}`)
      return
    }

    // 检查文件类型
    const ext = fileInfo.fileName.split('.').pop().toLowerCase()
    if (!acceptFileTypes.includes(ext)) {
      ElMessage.error(`不支持的文件格式：${fileInfo.fileName}`)
      return
    }

    // 检查文件大小：视频 1GB / 图片 500MB（对齐 QQ 空间网页版上限）
    const isVideo = isVideoFile(fileInfo.fileName)
    const maxSize = isVideo ? 1024 * 1024 * 1024 : 500 * 1024 * 1024
    if (fileInfo.fileSize > maxSize) {
      const label = isVideo ? '视频最大支持 1GB' : '图片最大支持 500MB'
      ElMessage.error(`文件过大：${fileInfo.fileName}，${label}`)
      return
    }

    const mimeType = getMimeType(fileInfo.fileName)

    // 创建文件对象
    const fileItem = {
      uid: Date.now() + Math.random(),
      name: fileInfo.fileName,
      title: fileInfo.fileName.replace(/\.[^/.]+$/, ''),
      size: fileInfo.fileSize,
      type: mimeType,
      path: filePath,
      preview: '',
      previewLoading: false, // 预览加载状态
      previewError: false, // 预览错误状态
      lastModified: fileInfo.modifiedTime,
      createTime: Date.now(), // 添加创建时间
      uploadStatus: 'normal', // 初始状态
      progress: 0, // 初始进度
      speed: 0, // 初始速度
      errorMessage: '', // 错误信息
      retryCount: 0, // 重试次数
      taskId: null, // 任务ID
      // 视频元数据（如果是视频文件）
      videoDuration: null, // 视频时长（毫秒）
      videoCover: null // 视频封面（Base64）
    }

    // 先添加文件到列表，不立即生成预览（避免阻塞 UI）
    // 注意：push 之后必须从 localFiles.value 拿回引用，那才是 Vue 包装的 reactive proxy；
    // 直接用本地变量 fileItem 改字段不会触发 UI 响应式更新
    localFiles.value.push(fileItem)
    const reactiveFile = localFiles.value[localFiles.value.length - 1]

    // 如果是视频文件，异步提取元数据；把 promise 挂在 reactive 引用上以便上传前 await
    if (isVideo) {
      reactiveFile.metadataPromise = getVideoMetadata(filePath)
        .then((metadata) => {
          reactiveFile.videoDuration = metadata.duration
          reactiveFile.videoCover = metadata.cover
          // QQ 空间视频时长上限 10 分钟（600000ms），服务端硬卡（ret=-530）
          // 把文件留在列表里标记错误状态，让用户看到具体原因，不要静默移除
          if (metadata.duration > 600000) {
            const minutes = (metadata.duration / 60000).toFixed(1)
            reactiveFile.uploadStatus = 'failed'
            reactiveFile.errorMessage = `视频时长 ${minutes} 分钟，超过 QQ 空间 10 分钟上限`
            ElMessage.error({
              message: `${fileInfo.fileName}:${reactiveFile.errorMessage}`,
              duration: 6000
            })
            return
          }
          console.log(`[UploadDialog] 视频元数据提取成功:`, {
            file: fileInfo.fileName,
            duration: metadata.duration,
            hasCover: !!metadata.cover
          })
        })
        .catch((error) => {
          console.error(`[UploadDialog] 提取视频元数据失败:`, error)
        })
    }

    // 如果是第一个文件，自动选中（用 reactive proxy）
    if (localFiles.value.length === 1) {
      selectedFile.value = reactiveFile
    }

    // 预览将在需要时按需生成（见 generatePreviewsForCurrentPage）
    // 不在这里立即生成，避免大量文件时卡顿
  } catch (error) {
    console.error('添加文件失败:', error)
    ElMessage.error(`添加文件失败：${error.message}`)
  }
}

// 为当前页的文件生成预览（按需加载，提升性能）
const generatePreviewsForCurrentPage = async () => {
  const currentFiles = currentPageFiles.value

  for (let i = 0; i < currentFiles.length; i++) {
    const file = currentFiles[i]

    // 跳过已经生成预览或正在加载的文件
    if (file.preview || file.previewLoading || file.previewError) {
      continue
    }

    // 为图片生成预览
    if (isImageFile(file.name)) {
      // 标记为加载中
      file.previewLoading = true

      try {
        const previewResponse = await window.QzoneAPI.getImagePreview({ filePath: file.path })
        if (previewResponse?.dataUrl) {
          file.preview = previewResponse.dataUrl
          file.previewLoading = false
        } else {
          file.previewLoading = false
          file.previewError = true
        }
      } catch (error) {
        console.error('生成图片预览失败:', file.name, error)
        file.previewLoading = false
        file.previewError = true
      }
    }
    // 为视频生成预览
    else if (isVideoFile(file.name)) {
      // 标记为加载中
      file.previewLoading = true

      try {
        const previewResponse = await window.QzoneAPI.getVideoPreview({ filePath: file.path })
        if (previewResponse?.dataUrl) {
          file.preview = previewResponse.dataUrl
          file.previewLoading = false
        } else {
          file.previewLoading = false
          file.previewError = true
        }
      } catch (error) {
        console.error('生成视频预览失败:', file.name, error)
        file.previewLoading = false
        file.previewError = true
      }
    }
  }
}

// 拖拽处理
const handleDragOver = () => {
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = async (event) => {
  isDragging.value = false
  const files = Array.from(event.dataTransfer.files)

  if (files.length > 0) {
    // 显示加载提示
    if (files.length > 10) {
      ElMessage.info(`正在添加 ${files.length} 个文件，请稍候...`)
    }

    // 批量并行处理
    const addPromises = files.filter((file) => file.path).map((file) => addFileByPath(file.path))

    await Promise.all(addPromises)

    ElMessage.success(`成功添加 ${files.length} 个文件`)

    // 添加完成后，为当前页生成预览
    setTimeout(() => {
      generatePreviewsForCurrentPage()
    }, 200)
  }
}

// 文件操作
const handleCardClick = (file) => {
  selectedFile.value = file
}

const removeFile = async (index) => {
  const actualIndex = (currentPage.value - 1) * pageSize + index
  const removedFile = localFiles.value[actualIndex]

  // 如果文件已创建后台任务，先删除后台任务
  if (removedFile.taskId) {
    try {
      await window.QzoneAPI.upload.deleteTask(removedFile.taskId)
      // console.log(`[UploadDialog] 已删除后台任务: ${removedFile.taskId}`)
    } catch (error) {
      console.error(`[UploadDialog] 删除后台任务失败: ${removedFile.taskId}`, error)
    }
  }

  // 从列表中移除
  localFiles.value.splice(actualIndex, 1)

  if (selectedFile.value === removedFile) {
    selectedFile.value = localFiles.value[0] || null
  }

  // 如果当前页没有文件了，切换到前一页
  if (currentPageFiles.value.length === 0 && currentPage.value > 1) {
    currentPage.value--
  }
}

// 强制清空所有文件
const clearAllFiles = async () => {
  try {
    // 1. 收集所有需要删除的任务ID
    const taskIdsToDelete = localFiles.value
      .filter((file) => file.taskId) // 只删除已创建后台任务的文件
      .map((file) => file.taskId)

    // 2. 逐个删除后台任务（确保数据库和内存都被清理）
    if (taskIdsToDelete.length > 0) {
      await Promise.all(taskIdsToDelete.map((taskId) => window.QzoneAPI.upload.deleteTask(taskId)))
      // console.log(`[UploadDialog] 已删除 ${taskIdsToDelete.length} 个后台上传任务`)
    }

    // 3. 清空前端文件列表
    localFiles.value = []
    selectedFile.value = null
    currentPage.value = 1

    // 4. 重置会话信息
    currentSessionId.value = null
    sessionAlbumId.value = null
    sessionMode.value = 'new'

    // 5. 解除上传锁定
    uploadLocked.value = false

    // console.log('[UploadDialog] 已清空所有文件和会话信息，解除上传锁定')
    ElMessage.success(`已清空列表并删除 ${taskIdsToDelete.length} 个上传任务`)
  } catch (error) {
    console.error('[UploadDialog] 清空文件列表失败:', error)
    // 即使删除后台任务失败，也要清空前端列表
    localFiles.value = []
    selectedFile.value = null
    currentPage.value = 1
    currentSessionId.value = null
    sessionAlbumId.value = null
    sessionMode.value = 'new'
    uploadLocked.value = false
    ElMessage.error(`清空列表失败：${error.message}`)
  }
}

// 上传操作
const startUploadAll = async () => {
  if (localFiles.value.length === 0) return

  if (!effectiveAlbumId.value) {
    ElMessage.error('请先选择目标相册')
    return
  }

  try {
    // 等所有视频的元数据提取完成（拿真实时长 + cover），否则 fileItem.videoDuration
    // 还是 null，主进程会走降级估算（按文件大小×码率估），fMP4 等格式会估超 10 分钟被服务端 -530 拒
    const pendingMetadata = localFiles.value
      .filter((f) => f.metadataPromise && (!f.uploadStatus || f.uploadStatus === 'normal'))
      .map((f) => f.metadataPromise)
    if (pendingMetadata.length > 0) {
      console.log(`[UploadDialog] 等待 ${pendingMetadata.length} 个视频元数据提取完成...`)
      await Promise.all(pendingMetadata)
    }

    // 准备文件数据（排除已经失败的任务，只上传正常状态的文件）
    // 视频任务必须传 videoDuration —— 主进程用它做 iPlayTime 校验
    const filesToUpload = localFiles.value
      .filter((file) => !file.uploadStatus || file.uploadStatus === 'normal')
      .map((file) => ({
        path: file.path,
        name: file.name,
        title: file.title,
        size: file.size,
        type: file.type,
        videoDuration: file.videoDuration || null
      }))

    if (filesToUpload.length === 0) {
      ElMessage.warning('没有可上传的文件')
      return
    }

    // 锁定当前批次，不允许继续添加文件
    uploadLocked.value = true
    // console.log('[UploadDialog] 批次已锁定，开始上传')

    // 调用主进程上传API，获取任务ID列表（传递会话ID）
    const taskIds = await window.QzoneAPI.upload.addBatchTasks(
      filesToUpload,
      effectiveAlbumId.value,
      effectiveAlbumName.value,
      currentSessionId.value // 传递当前会话ID
    )

    // 标记正在上传的文件并保存任务ID
    let taskIdIndex = 0
    localFiles.value.forEach((file) => {
      if (!file.uploadStatus || file.uploadStatus === 'normal') {
        file.uploadStatus = 'waiting' // 初始状态为等待
        file.progress = 0
        file.speed = 0
        // 保存任务ID，用于后续状态同步
        if (taskIds && taskIdIndex < taskIds.length) {
          file.taskId = taskIds[taskIdIndex]
          taskIdIndex++
        }
      }
    })

    ElMessage.success(`已添加 ${filesToUpload.length} 个上传任务，批次已锁定`)

    // 不再自动清空文件列表，让 handleTaskChanges 处理完成的文件
    // 用户可以看到实时的上传进度，完成后会自动移除
  } catch (error) {
    console.error('添加上传任务失败:', error)
    ElMessage.error(`添加上传任务失败：${error.message}`)

    // 恢复文件状态并解除锁定
    uploadLocked.value = false
    localFiles.value.forEach((file) => {
      if (file.uploadStatus === 'uploading') {
        file.uploadStatus = 'normal'
      }
    })
  }
}

// 任务操作方法已移至UploadManager组件

// 切换目标相册（在弹窗内挑选一个不同于当前页相册的目标）
const pickTargetAlbum = (album) => {
  if (!album?.id) return
  if (uploadLocked.value) {
    ElMessage.warning('已锁定上传批次，无法切换相册；请先清空当前批次')
    return
  }
  // 如果选回当前 props 相册 → 清掉 override；否则记录
  if (album.id === effectiveAlbumId.value) {
    targetAlbumOverride.value = null
  } else {
    targetAlbumOverride.value = { id: album.id, name: album.name }
  }
  albumPickerVisible.value = false
  ElMessage.success(`已切换目标相册：${album.name}`)
}
// 兼容老的调用名：右侧空状态卡片上的「选择相册」按钮（global 模式）
const selectTargetAlbum = () => {
  albumPickerVisible.value = !albumPickerVisible.value
}

// 图片加载调试方法
const onImageLoad = () => {
  // console.log('图片加载成功:', file.name)
}

// 重试单个文件上传
const retryUpload = async (file) => {
  if (!effectiveAlbumId.value) {
    ElMessage.error('请先选择目标相册')
    return
  }

  try {
    if (file.taskId) {
      // 如果有任务ID，使用API重试现有任务
      await window.QzoneAPI.upload.retryTask(file.taskId)
      ElMessage.success('已重新开始上传')

      // 重置文件状态
      file.uploadStatus = 'waiting'
      file.errorMessage = ''
    } else {
      // 没有任务ID，重新创建上传任务

      // 重置文件状态
      file.uploadStatus = 'uploading'
      file.errorMessage = ''

      // 重新添加上传任务
      const taskResult = await window.QzoneAPI.upload.addTask(
        {
          path: file.path,
          name: file.name,
          title: file.title,
          size: file.size,
          type: file.type
        },
        effectiveAlbumId.value,
        effectiveAlbumName.value
      )

      // 保存新的任务ID
      if (taskResult?.taskId) {
        file.taskId = taskResult.taskId
      }

      ElMessage.success('已重新开始上传')
    }
  } catch (error) {
    console.error('重试上传失败:', error)
    file.uploadStatus = 'failed'
    file.errorMessage = error.message || '重试失败'
    ElMessage.error('重试上传失败')
  }
}

// 暂停单个文件上传
const pauseFileUpload = async (file) => {
  if (!file.taskId) {
    return
  }

  try {
    await window.QzoneAPI.upload.pauseTask(file.taskId)
    file.uploadStatus = 'paused'
    ElMessage.success('已暂停上传')
  } catch (error) {
    console.error('暂停上传失败:', error)
    ElMessage.error('暂停上传失败')
  }
}

// 继续单个文件上传
const resumeFileUpload = async (file) => {
  if (!file.taskId) {
    return
  }

  try {
    await window.QzoneAPI.upload.resumeTask(file.taskId)
    file.uploadStatus = 'waiting'
    ElMessage.success('已继续上传')
  } catch (error) {
    console.error('继续上传失败:', error)
    ElMessage.error('继续上传失败')
  }
}

// 暂停所有任务
const pauseAllTasks = async () => {
  try {
    await window.QzoneAPI.upload.pauseAll()
    localFiles.value.forEach((file) => {
      if (file.uploadStatus === 'uploading' || file.uploadStatus === 'waiting') {
        file.uploadStatus = 'paused'
      }
    })
    ElMessage.success('已暂停所有任务')
  } catch (error) {
    console.error('暂停所有任务失败:', error)
    ElMessage.error('暂停所有任务失败')
  }
}

// 继续所有任务
const resumeAllTasks = async () => {
  try {
    await window.QzoneAPI.upload.resumeAll()
    localFiles.value.forEach((file) => {
      if (file.uploadStatus === 'paused') {
        file.uploadStatus = 'waiting'
      }
    })
    ElMessage.success('已继续所有任务')
  } catch (error) {
    console.error('继续所有任务失败:', error)
    ElMessage.error('继续所有任务失败')
  }
}

// 事件处理
const handleDialogChange = (value) => {
  if (!value) {
    handleClose()
  }
}

const handleClose = () => {
  // 关闭时不清空 localFiles，保留会话数据
  // 下次打开时会根据 sessionId 判断是否继续会话

  // 只有在当前会话有新的上传成功时才刷新相册
  const currentCompleted = uploadStats.value.completed
  const hasNewSuccess = currentCompleted > initialCompletedCount.value

  // console.log(
  //   `[UploadDialog] 关闭弹窗 - 初始完成数: ${initialCompletedCount.value}, 当前完成数: ${currentCompleted}, 需要刷新: ${hasNewSuccess}`
  // )

  emit('close', hasNewSuccess)
}

// ==================== 会话管理函数 ====================
/**
 * 生成会话ID
 */
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 检查并处理未完成任务
 */
const checkAndHandlePendingTasks = async () => {
  // 只在相册模式下检查
  if (props.contextMode !== 'album' || !effectiveAlbumId.value) {
    if (!currentSessionId.value) {
      currentSessionId.value = generateSessionId()
      sessionAlbumId.value = null
    }
    return
  }

  try {
    checkingSession.value = true

    // 检测相册是否切换了
    const albumChanged = sessionAlbumId.value && sessionAlbumId.value !== effectiveAlbumId.value
    if (albumChanged) {
      // console.log(
      //   `[UploadDialog] 检测到相册切换: ${sessionAlbumId.value} -> ${effectiveAlbumId.value}，清空本地会话`
      // )
      // 相册切换了，清空之前的本地会话数据
      localFiles.value = []
      currentSessionId.value = null
      sessionAlbumId.value = null
      uploadLocked.value = false
      sessionMode.value = 'new'
    }

    // 1. 先检查是否有本地会话数据（关闭后重新打开的情况）
    // 只有在相同相册下才恢复本地会话
    if (
      currentSessionId.value &&
      localFiles.value.length > 0 &&
      sessionAlbumId.value === effectiveAlbumId.value
    ) {
      // console.log(`[UploadDialog] 恢复本地会话: ${currentSessionId.value} (相册: ${effectiveAlbumId.value})`)
      sessionMode.value = 'continue'

      // 重新加载预览图（关闭时预览图可能丢失）
      await reloadLocalFilePreviews()

      checkingSession.value = false
      return
    }

    // 2. 检查后端是否有未完成任务
    const pendingTasks = await window.QzoneAPI.upload.getPendingTasksByAlbum(effectiveAlbumId.value)

    if (pendingTasks && pendingTasks.length > 0) {
      // 有后端未完成任务，获取该会话的所有任务（包括已完成的）
      sessionMode.value = 'continue'
      const detectedSessionId = pendingTasks[0].sessionId || generateSessionId()
      currentSessionId.value = detectedSessionId
      sessionAlbumId.value = effectiveAlbumId.value // 记录会话关联的相册ID
      uploadLocked.value = true // 恢复锁定状态

      // 获取该会话的所有任务（包括已完成的）
      const allSessionTasks = await window.QzoneAPI.upload.getTasksBySession(detectedSessionId)
      // console.log(
      //   `[UploadDialog] 获取会话 ${detectedSessionId} 的所有任务: ${allSessionTasks.length} 个`
      // )

      await loadPendingTasksToLocal(allSessionTasks)
      // console.log(
      //   `[UploadDialog] 自动恢复 ${allSessionTasks.length} 个任务 (会话: ${currentSessionId.value}, 相册: ${effectiveAlbumId.value})`
      // )
    } else {
      // 没有后端未完成任务，重置所有状态
      sessionMode.value = 'new'
      currentSessionId.value = generateSessionId()
      sessionAlbumId.value = effectiveAlbumId.value // 记录会话关联的相册ID
      uploadLocked.value = false // 重置锁定状态
      localFiles.value = [] // 清空本地文件列表
      // console.log(`[UploadDialog] 开始新会话: ${currentSessionId.value} (相册: ${effectiveAlbumId.value})`)
    }
  } catch (error) {
    console.error('[UploadDialog] 检查未完成任务失败:', error)
    // 失败时保持现有会话或创建新会话
    if (!currentSessionId.value) {
      sessionMode.value = 'new'
      currentSessionId.value = generateSessionId()
      sessionAlbumId.value = effectiveAlbumId.value
    }
  } finally {
    checkingSession.value = false
  }
}

/**
 * 重新加载本地文件的预览图
 */
const reloadLocalFilePreviews = async () => {
  // console.log(`[UploadDialog] 重新加载 ${localFiles.value.length} 个文件的预览`)

  for (let i = 0; i < localFiles.value.length; i++) {
    const file = localFiles.value[i]
    try {
      if (file.path && !file.preview) {
        if (isImageFile(file.name)) {
          localFiles.value[i].previewLoading = true // 开始加载
          const previewResponse = await window.QzoneAPI.getImagePreview({ filePath: file.path })
          if (previewResponse?.dataUrl && localFiles.value[i]) {
            localFiles.value[i].preview = previewResponse.dataUrl
            localFiles.value[i].previewLoading = false
          } else {
            localFiles.value[i].previewLoading = false
            localFiles.value[i].previewError = true
          }
        } else if (isVideoFile(file.name)) {
          localFiles.value[i].previewLoading = true // 开始加载
          const previewResponse = await window.QzoneAPI.getVideoPreview({ filePath: file.path })
          if (previewResponse?.dataUrl && localFiles.value[i]) {
            localFiles.value[i].preview = previewResponse.dataUrl
            localFiles.value[i].previewLoading = false
          } else {
            localFiles.value[i].previewLoading = false
            localFiles.value[i].previewError = true
          }
        }
      }
    } catch (error) {
      console.error(`[UploadDialog] 重新加载预览失败: ${file.name}`, error)
      if (localFiles.value[i]) {
        localFiles.value[i].previewLoading = false
        localFiles.value[i].previewError = true
      }
    }
  }
}

/**
 * 加载未完成任务到本地列表
 */
const loadPendingTasksToLocal = async (pendingTasks) => {
  try {
    // 先创建文件列表（不含预览图）
    localFiles.value = pendingTasks.map((task) => ({
      id: task.id,
      taskId: task.id,
      name: task.filename || task.name,
      size: task.total || 0,
      type: getFileTypeFromName(task.filename || task.name),
      path: task.filePath,
      preview: '', // 稍后异步加载
      previewLoading: false, // 预览加载状态
      previewError: false, // 预览错误状态
      title: task.picTitle || '',
      desc: task.picDesc || '',
      uploadStatus: task.status || 'waiting',
      progress: task.progress || 0,
      speed: task.speed || 0,
      errorMessage: task.error || '',
      retryCount: task.retryCount || 0
    }))

    // console.log(`[UploadDialog] 已加载 ${localFiles.value.length} 个未完成任务`)

    // 异步加载预览
    for (let i = 0; i < localFiles.value.length; i++) {
      const file = localFiles.value[i]
      try {
        if (file.path) {
          if (isImageFile(file.name)) {
            if (localFiles.value[i]) {
              localFiles.value[i].previewLoading = true // 开始加载
            }
            const previewResponse = await window.QzoneAPI.getImagePreview({ filePath: file.path })
            if (previewResponse?.dataUrl && localFiles.value[i]) {
              localFiles.value[i].preview = previewResponse.dataUrl
              localFiles.value[i].previewLoading = false
            } else {
              if (localFiles.value[i]) {
                localFiles.value[i].previewLoading = false
                localFiles.value[i].previewError = true
              }
            }
          } else if (isVideoFile(file.name)) {
            if (localFiles.value[i]) {
              localFiles.value[i].previewLoading = true // 开始加载
            }
            const previewResponse = await window.QzoneAPI.getVideoPreview({ filePath: file.path })
            if (previewResponse?.dataUrl && localFiles.value[i]) {
              localFiles.value[i].preview = previewResponse.dataUrl
              localFiles.value[i].previewLoading = false
            } else {
              if (localFiles.value[i]) {
                localFiles.value[i].previewLoading = false
                localFiles.value[i].previewError = true
              }
            }
          }
        }
      } catch (error) {
        console.error(`[UploadDialog] 加载预览失败: ${file.name}`, error)
        if (localFiles.value[i]) {
          localFiles.value[i].previewLoading = false
          localFiles.value[i].previewError = true
        }
      }
    }
  } catch (error) {
    console.error('[UploadDialog] 加载未完成任务失败:', error)
    ElMessage.error('加载未完成任务失败')
  }
}

/**
 * 根据文件名获取文件类型
 */
const getFileTypeFromName = (filename) => {
  const ext = filename.split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
    return 'image'
  }
  if (['mp4', 'mov', 'avi'].includes(ext)) {
    return 'video'
  }
  return 'unknown'
}

// 设置事件监听器
const setupEventListeners = () => {
  window.QzoneAPI.upload.onStatsUpdate(handleStatsUpdate)
  window.QzoneAPI.upload.onDetailedStatusUpdate(handleDetailedStatusUpdate)
  window.QzoneAPI.upload.onTaskChanges(handleTaskChanges)
}

// 清理事件监听器
const cleanupEventListeners = () => {
  window.QzoneAPI.upload.removeAllListeners()
}

// 处理统计信息更新（仅全局模式使用）
const handleStatsUpdate = (stats) => {
  if (props.contextMode === 'global') {
    // 全局模式：更新全局统计信息
    globalUploadStats.value = stats || globalUploadStats.value
  }
  // 相册模式：统计信息由localFiles计算，无需更新
}

// 加载相册的失败任务到localFiles
const loadAlbumFailedTasks = async () => {
  if (!effectiveAlbumId.value) return

  try {
    // 获取当前相册的失败任务
    const result = await window.QzoneAPI.upload.getTasks({
      page: 1,
      pageSize: 100, // 一次加载最多100个失败任务
      status: 'error',
      albumId: effectiveAlbumId.value
    })

    const failedTasks = result.tasks || []
    // console.log('加载到的失败任务:', failedTasks)

    // 将失败任务转换为localFiles格式
    for (const task of failedTasks) {
      // 检查是否已经存在于localFiles中（优先通过 taskId 匹配）
      const existingFile = localFiles.value.find((file) => {
        // 优先通过 taskId 精确匹配
        if (file.taskId && task.id && file.taskId === task.id) {
          return true
        }
        // 如果没有 taskId，使用文件名、大小和状态匹配（已经过滤了相册）
        return (
          file.name === task.filename && file.size === task.total && file.uploadStatus === 'failed'
        )
      })

      if (!existingFile) {
        const failedFile = {
          uid: `failed_${task.id}_${Date.now()}`,
          name: task.filename || task.picTitle,
          title: task.picTitle || '',
          size: task.total || 0,
          type: task.type || 'image/jpeg',
          path: task.filePath,
          uploadStatus: 'failed',
          errorMessage: task.error || '上传失败',
          preview: null,
          previewLoading: false, // 预览加载状态
          previewError: false, // 预览错误状态
          createTime: task.create_time || Date.now(),
          retryCount: task.retryCount || 0,
          taskId: task.id // 保存任务ID，用于重试等操作
        }

        // 为失败的文件生成预览（如果文件仍然存在）
        if (task.filePath) {
          const fileName = task.filename || task.picTitle
          if (isImageFile(fileName)) {
            failedFile.previewLoading = true // 开始加载
            try {
              const previewResponse = await window.QzoneAPI.getImagePreview({
                filePath: task.filePath
              })
              if (previewResponse?.dataUrl) {
                failedFile.preview = previewResponse.dataUrl
                failedFile.previewLoading = false
                // console.log('失败任务预览生成成功:', task.filename)
              } else {
                console.warn('失败任务预览生成失败，无dataUrl:', task.filename)
                failedFile.previewLoading = false
                failedFile.previewError = true
              }
            } catch (error) {
              console.warn('生成失败任务预览失败:', task.filename, error)
              // 如果预览生成失败，标记预览错误避免显示调试信息
              failedFile.previewLoading = false
              failedFile.previewError = true
              failedFile.preview = null
            }
          } else if (isVideoFile(fileName)) {
            failedFile.previewLoading = true // 开始加载
            try {
              const previewResponse = await window.QzoneAPI.getVideoPreview({
                filePath: task.filePath
              })
              if (previewResponse?.dataUrl) {
                failedFile.preview = previewResponse.dataUrl
                failedFile.previewLoading = false
              } else {
                console.warn('失败任务视频预览生成失败，无dataUrl:', task.filename)
                failedFile.previewLoading = false
                failedFile.previewError = true
              }
            } catch (error) {
              console.warn('生成失败任务视频预览失败:', task.filename, error)
              failedFile.previewLoading = false
              failedFile.previewError = true
              failedFile.preview = null
            }
          }
        }

        localFiles.value.push(failedFile)
      }
    }

    // console.log('合并后的localFiles:', localFiles.value)
  } catch (error) {
    console.error('加载相册失败任务失败:', error)
  }
}

// 处理详细状态更新
const handleDetailedStatusUpdate = (status) => {
  if (!status) return

  // 更新全局速度（仅全局模式使用）
  globalCurrentSpeed.value = status?.currentSpeed || 0

  // 只有在上传管理器打开时才处理失败任务同步
  if (!props.visible) return

  // 处理失败任务，将其同步回localFiles（只处理当前相册的任务）
  if (status?.failedTasks && status.failedTasks.length > 0) {
    const processedIds = new Set()

    status.failedTasks
      .filter((failedTask) => {
        // 在相册模式下，只处理当前相册的失败任务
        return props.contextMode === 'global' || failedTask.albumId === effectiveAlbumId.value
      })
      .forEach((failedTask) => {
        // 避免重复处理同一个任务
        if (processedIds.has(failedTask.id)) return
        processedIds.add(failedTask.id)

        // 寻找对应的本地文件（优先通过 taskId 匹配，确保准确性）
        const existingFile = localFiles.value.find((file) => {
          // 优先通过 taskId 精确匹配
          if (file.taskId && failedTask.id && file.taskId === failedTask.id) {
            return true
          }
          // 如果没有 taskId，使用文件名和大小匹配（已经过滤了相册）
          return file.name === failedTask.filename && file.size === failedTask.total
        })

        if (!existingFile) {
          // 如果本地文件列表中没有，创建一个失败的文件项
          const failedFile = {
            uid: `failed_${failedTask.id}_${Date.now()}`,
            name: failedTask.filename || failedTask.picTitle,
            title: failedTask.picTitle || '',
            size: failedTask.total || 0,
            type: failedTask.type || 'image/jpeg',
            path: failedTask.filePath,
            uploadStatus: 'failed',
            errorMessage: failedTask.error || '上传失败',
            preview: null,
            previewLoading: false, // 预览加载状态
            previewError: false, // 预览错误状态
            createTime: failedTask.create_time || Date.now(),
            retryCount: failedTask.retryCount || 0
          }

          // 为失败的文件生成预览（如果文件仍然存在）
          if (failedTask.filePath) {
            const fileName = failedTask.filename || failedTask.picTitle
            if (isImageFile(fileName)) {
              failedFile.previewLoading = true // 开始加载
              window.QzoneAPI.getImagePreview({ filePath: failedTask.filePath })
                .then((previewResponse) => {
                  if (previewResponse?.dataUrl) {
                    failedFile.preview = previewResponse.dataUrl
                    failedFile.previewLoading = false
                    // console.log('动态失败任务预览生成成功:', failedTask.filename)
                  } else {
                    console.warn('动态失败任务预览生成失败，无dataUrl:', failedTask.filename)
                    failedFile.previewLoading = false
                    failedFile.previewError = true
                    failedFile.preview = null
                  }
                })
                .catch((error) => {
                  console.warn('动态失败任务预览生成失败:', failedTask.filename, error)
                  failedFile.previewLoading = false
                  failedFile.previewError = true
                  failedFile.preview = null
                })
            } else if (isVideoFile(fileName)) {
              failedFile.previewLoading = true // 开始加载
              window.QzoneAPI.getVideoPreview({ filePath: failedTask.filePath })
                .then((previewResponse) => {
                  if (previewResponse?.dataUrl) {
                    failedFile.preview = previewResponse.dataUrl
                    failedFile.previewLoading = false
                  } else {
                    console.warn('动态失败任务视频预览生成失败，无dataUrl:', failedTask.filename)
                    failedFile.previewLoading = false
                    failedFile.previewError = true
                    failedFile.preview = null
                  }
                })
                .catch((error) => {
                  console.warn('动态失败任务视频预览生成失败:', failedTask.filename, error)
                  failedFile.previewLoading = false
                  failedFile.previewError = true
                  failedFile.preview = null
                })
            }
          }

          // 检查是否已经存在相同的失败文件（避免重复添加）
          const existingFailedFile = localFiles.value.find(
            (f) =>
              f.uploadStatus === 'failed' &&
              f.name === failedFile.name &&
              f.size === failedFile.size
          )

          if (!existingFailedFile) {
            localFiles.value.push(failedFile)
          }
        } else if (existingFile.uploadStatus !== 'failed') {
          // 更新现有文件的状态（只有在状态不是已失败时才更新）
          existingFile.uploadStatus = 'failed'
          existingFile.errorMessage = failedTask.error || '上传失败'
          existingFile.createTime = failedTask.create_time || existingFile.createTime
          existingFile.retryCount = failedTask.retryCount || 0
        }
      })
  }
}

// 处理任务状态变化
const handleTaskChanges = (tasks) => {
  if (!tasks || !Array.isArray(tasks)) {
    console.warn('[UploadDialog] handleTaskChanges: 无效的任务数据')
    return
  }

  try {
    // 遍历变化的任务，更新 localFiles 中对应的状态
    tasks.forEach((task) => {
      if (!task || !task.id) {
        console.warn('[UploadDialog] handleTaskChanges: 任务缺少ID')
        return
      }

      // 查找对应的本地文件
      const fileIndex = localFiles.value.findIndex((file) => {
        // 优先通过 taskId 精确匹配
        if (file.taskId && file.taskId === task.id) {
          return true
        }

        // 如果没有 taskId，通过文件名和大小匹配（但必须确保是同一相册）
        // 这种情况主要发生在：任务刚创建，前端还没收到 taskId 时
        if (!file.taskId && file.name === task.filename && file.size === task.total) {
          // 再次确认是同一相册（防止不同相册的同名文件被误匹配）
          if (props.contextMode === 'album' && effectiveAlbumId.value && task.albumId === effectiveAlbumId.value) {
            return true
          }
          // 全局模式下，没有相册限制，可以匹配
          if (props.contextMode === 'global') {
            return true
          }
        }

        return false
      })

      // 如果是删除操作，从 localFiles 中移除
      // 删除操作不检查 albumId，因为删除事件可能不包含完整的任务信息
      if (task.deleted) {
        if (fileIndex !== -1) {
          localFiles.value.splice(fileIndex, 1)
          // console.log(`[UploadDialog] 任务 ${task.id} 已被删除，从本地列表移除`)
        }
        return
      }

      // 相册模式：只处理当前相册的任务更新（非删除操作）
      if (props.contextMode === 'album' && effectiveAlbumId.value && task.albumId !== effectiveAlbumId.value) {
        // console.log(
        //   `[UploadDialog] 跳过非当前相册的任务: ${task.filename} (任务相册: ${task.albumId}, 当前相册: ${effectiveAlbumId.value})`
        // )
        return
      }

      if (fileIndex !== -1) {
        const file = localFiles.value[fileIndex]

        // 保存任务ID，用于后续匹配
        if (!file.taskId && task.id) {
          file.taskId = task.id
        }

        // 更新状态（只更新有效的字段）
        if (task.status) {
          file.uploadStatus = task.status
        }
        if (typeof task.progress === 'number') {
          file.progress = Math.max(0, Math.min(100, task.progress))
        }
        if (typeof task.speed === 'number') {
          file.speed = Math.max(0, task.speed)
        }
        if (task.error !== undefined) {
          file.errorMessage = task.error || ''
        }
        if (typeof task.retryCount === 'number') {
          file.retryCount = task.retryCount
        }

        // 不再自动移除完成或取消的任务，保留在列表中供用户查看
        // 用户可以手动点击"清空列表"来清除
      }
    })

    // 如果所有任务都被删除了（列表为空），重置会话状态
    if (localFiles.value.length === 0 && uploadLocked.value) {
      currentSessionId.value = null
      sessionAlbumId.value = null
      sessionMode.value = 'new'
      uploadLocked.value = false
      // console.log('[UploadDialog] 所有任务已删除，重置会话状态')
    }
  } catch (error) {
    console.error('[UploadDialog] handleTaskChanges 处理失败:', error)
  }
}

// 监听当前页变化，按需生成预览
watch(currentPage, async () => {
  // 延迟生成预览，避免切换页面时卡顿
  await new Promise((resolve) => setTimeout(resolve, 100))
  generatePreviewsForCurrentPage()
})

// 监听弹窗打开
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await window.QzoneAPI.upload.setManagerOpen(true)

      // 会话管理：检查未完成任务
      await checkAndHandlePendingTasks()

      // 加载当前统计信息和任务列表
      try {
        // 根据上下文模式加载不同的统计信息
        if (props.contextMode === 'global') {
          // 全局模式：从后端加载统计信息
          const stats = await window.QzoneAPI.upload.getStats()
          globalUploadStats.value = stats
        }
        // 相册模式：统计信息由localFiles计算，无需从后端加载

        // 记录弹窗打开时的完成数
        initialCompletedCount.value = uploadStats.value.completed
        // console.log(`[UploadDialog] 打开弹窗 - 初始完成数: ${initialCompletedCount.value}`)

        // 在相册模式下，如果不是继续会话，则加载失败任务到localFiles
        if (props.contextMode === 'album' && effectiveAlbumId.value && sessionMode.value !== 'continue') {
          await loadAlbumFailedTasks()
        }

        // 为当前页生成预览
        setTimeout(() => {
          generatePreviewsForCurrentPage()
        }, 200)
      } catch (error) {
        console.error('加载上传数据失败:', error)
      }
    } else {
      await window.QzoneAPI.upload.setManagerOpen(false)
      // 关闭弹窗时不移除监听器，保持后台任务进度更新
      // console.log('[UploadDialog] 关闭弹窗，保持监听器活跃以接收后台更新')
    }
  }
)

// 组件挂载时初始化（只设置一次监听器）
onMounted(async () => {
  // 设置事件监听器（组件生命周期内一直保持）
  setupEventListeners()
  // console.log('[UploadDialog] 已设置事件监听器')

  if (props.visible) {
    await window.QzoneAPI.upload.setManagerOpen(true)
  }

  // 加载当前并发数（持久化在主进程的 settings 里）
  try {
    const c = await window.QzoneAPI.upload.getConcurrency()
    if (c) uploadConcurrency.value = c
  } catch (e) {
    console.warn('获取并发数失败:', e)
  }
})

// 组件销毁时清理
onUnmounted(async () => {
  await window.QzoneAPI.upload.setManagerOpen(false)
  // 只在组件销毁时才移除监听器
  cleanupEventListeners()
  // console.log('[UploadDialog] 组件销毁，清理监听器')
})
</script>

<style lang="scss">
/* 相册选择 popover —— teleport 到 body，故不能放在 scoped 块里 */
.upload-album-picker-popper.el-popover {
  background: #1c1f24 !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  padding: 8px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;

  .album-picker {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .album-picker-header {
    .el-input__wrapper {
      background: rgba(255, 255, 255, 0.06);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset !important;
    }
    .el-input__inner {
      color: rgba(255, 255, 255, 0.9);
    }
    .el-input__inner::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }
  }

  .album-picker-list {
    max-height: 280px;
    overflow-y: auto;
    margin-top: 2px;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
    }
  }

  .album-picker-empty {
    padding: 16px 8px;
    text-align: center;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12px;
  }

  .album-picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;

    .item-icon {
      color: #60a5fa;
      flex-shrink: 0;
    }
    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .item-name {
      color: rgba(255, 255, 255, 0.9);
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-meta {
      color: rgba(255, 255, 255, 0.45);
      font-size: 11px;
    }
    .item-check {
      color: #34d399;
      flex-shrink: 0;
    }

    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    &.active {
      background: rgba(96, 165, 250, 0.14);
      .item-name {
        color: #60a5fa;
      }
    }
  }
}
</style>

<style lang="scss" scoped>
// dialog 容器尺寸 / header / body 共用样式已抽到 styles/app-dialog.scss

/* ==================== 紧凑工具栏 ==================== */
.ud-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0; // 关键：工具栏定高，不挤压下方文件区

  .ud-toolbar-left,
  .ud-toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  /* 相册 chip */
  .album-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    height: 32px;
    background: rgba(96, 165, 250, 0.1);
    border: 1px solid rgba(96, 165, 250, 0.25);
    border-radius: 16px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
    max-width: 240px;
    transition: all 0.2s ease;

    &.clickable {
      cursor: pointer;

      &:hover {
        background: rgba(96, 165, 250, 0.18);
        border-color: rgba(96, 165, 250, 0.45);
      }
    }

    &.overridden {
      background: rgba(251, 191, 36, 0.12);
      border-color: rgba(251, 191, 36, 0.45);

      .el-icon,
      .album-chip-name {
        color: #fbbf24;
      }
    }

    .el-icon {
      color: #60a5fa;
      flex-shrink: 0;
    }

    .album-chip-name {
      font-weight: 600;
      color: #60a5fa;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .album-chip-arrow {
      font-size: 10px;
      opacity: 0.7;
    }

    .album-chip-change {
      padding: 0 6px;
      height: 22px;
      font-size: 11px;
    }
  }

  /* 并发 chip */
  .concurrency-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px 0 10px;
    height: 32px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    cursor: help;

    .chip-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 500;
    }

    :deep(.chip-input) {
      width: 72px;

      .el-input-number__decrease,
      .el-input-number__increase {
        background: transparent;
        border-color: transparent;
      }

      .el-input__wrapper {
        background: transparent;
        box-shadow: none !important;
        padding: 0;
      }

      .el-input__inner {
        text-align: center;
        font-weight: 600;
        font-size: 13px;
      }
    }
  }

  /* 卡片大小 chip */
  .size-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px 0 10px;
    height: 32px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;

    .chip-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 500;
    }

    :deep(.size-radio) {
      .el-radio-button__inner {
        padding: 4px 8px;
        height: 22px;
        line-height: 14px;
        font-size: 11px;
        background: transparent;
        border-color: rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.7);
        box-shadow: none !important;
      }

      .el-radio-button:first-child .el-radio-button__inner {
        border-left-color: rgba(255, 255, 255, 0.15);
        border-radius: 11px 0 0 11px;
      }

      .el-radio-button:last-child .el-radio-button__inner {
        border-radius: 0 11px 11px 0;
      }

      .el-radio-button__original-radio:checked + .el-radio-button__inner {
        background: rgba(96, 165, 250, 0.2);
        border-color: rgba(96, 165, 250, 0.5);
        color: #60a5fa;
        font-weight: 600;
        box-shadow: -1px 0 0 0 rgba(96, 165, 250, 0.5) !important;
      }
    }
  }

  // 统一按钮样式
  :deep(.action-btn) {
    height: 36px;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 13px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

    .el-icon {
      margin-right: 6px;
      font-size: 14px;
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    &.primary-btn {
      background: linear-gradient(135deg, #60a5fa 0%, #7eb8fc 100%);
      border: 1px solid #60a5fa;
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, #5bacff 0%, #66b8f7 100%);
        border-color: #5bacff;
      }
    }

    &.secondary-btn {
      background: transparent;
      border: 1px solid #60a5fa;
      color: #60a5fa;

      &:hover {
        background: rgba(96, 165, 250, 0.1);
        border-color: #5bacff;
        color: #5bacff;
      }
    }

    &.success-btn {
      background: linear-gradient(135deg, #34d399 0%, #52e3a8 100%);
      border: 1px solid #34d399;
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, #7aca52 0%, #95d373 100%);
        border-color: #7aca52;
      }

      &:disabled {
        background: #c0c4cc;
        border-color: #c0c4cc;
        color: #ffffff;
        transform: none;
        box-shadow: none;
        cursor: not-allowed;
      }
    }

    &.warning-btn {
      background: linear-gradient(135deg, #fbbf24 0%, #eebe77 100%);
      border: 1px solid #fbbf24;
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, #eaae4e 0%, #f1c589 100%);
        border-color: #eaae4e;
      }
    }

    &.danger-btn {
      background: transparent;
      border: 1px solid #f87171;
      color: #f87171;

      &:hover {
        background: rgba(248, 113, 113, 0.1);
        border-color: #fb9090;
        color: #fb9090;
      }
    }
  }
}

.upload-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 10px;

  .notice-icon {
    color: #60a5fa;
    font-size: 15px;
    flex-shrink: 0;
  }

  .notice-text {
    color: rgba(255, 255, 255, 0.85);
    font-size: 12px;
    line-height: 1.4;
  }

  /* 顶部展示：作为首屏 tip，更醒目 */
  &.top {
    margin: 0 24px 12px;
    padding: 10px 14px;
    background: linear-gradient(90deg, rgba(96, 165, 250, 0.1), rgba(96, 165, 250, 0.04));
    border: 1px solid rgba(96, 165, 250, 0.25);
    border-radius: 8px;

    .notice-icon {
      font-size: 16px;
    }

    .notice-text {
      flex: 1;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.92);
    }

    .target-album {
      color: #60a5fa;
      font-weight: 600;
    }

    .change-album-btn {
      flex-shrink: 0;
    }
  }
}

/* ==================== 主体分栏 ==================== */
// 关键：flex:1 + min-height:0 让分栏占满 body 剩余空间且能正确收缩
.layout-columns {
  display: flex;
  flex: 1;
  min-height: 0;

  .left-column {
    flex: 1;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .right-column {
    width: 200px;
    padding: 8px 10px;
    overflow: hidden;
    background: transparent;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px; // 卡片间隔由 gap 控制，配合 :last-child margin-bottom: 0
  }
}

// 让右侧卡片在容器内均匀分布，撑满高度不留空白；窗口尺寸变化时自适应
.right-column {
  .stat-card,
  .progress-card,
  .speed-card,
  .album-card {
    flex: 1 1 0;
    min-height: 0;
    margin-bottom: 0 !important;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  // 进度卡片有圆形进度图 + 多行统计，需要更多份额
  .progress-card {
    flex: 1.4 1 0;
  }
}

/* ==================== 拖拽区（空状态） ==================== */
.upload-drop-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  margin: 16px 20px;
  background: rgba(255, 255, 255, 0.015);
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: rgba(96, 165, 250, 0.4);
    background: rgba(96, 165, 250, 0.04);
  }

  &.is-dragover {
    border-color: #60a5fa;
    background: rgba(96, 165, 250, 0.1);
    transform: scale(1.01);
  }

  .drop-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(96, 165, 250, 0.08);
    border-radius: 50%;
    color: #60a5fa;
  }

  .drop-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
    font-weight: 500;
  }

  .drop-formats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;

    span {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
  }

  .drop-rules {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding: 6px 12px;
    background: rgba(251, 191, 36, 0.06);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 6px;
    font-size: 11px;
    color: rgba(251, 191, 36, 0.85);

    .el-icon {
      font-size: 12px;
    }
  }
}

// 文件列表 —— 关键：file-grid-container 是唯一可滚动层，外层 dialog 不滚
.file-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

  .file-grid-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px;
    min-height: 0;

    /* 自定义滚动条，与暗色主题对齐 */
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      &:hover {
        background: rgba(255, 255, 255, 0.25);
      }
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }

  .pagination-wrapper {
    padding: 6px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: center;
    background: transparent;
    flex-shrink: 0;
  }
}

// 文件网格 —— 按 cardSize 切换列宽，默认 mini 让 20 个/页基本无需滚动
.file-grid {
  display: grid;
  gap: 10px;
  padding: 0 4px;

  &.size-mini {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;

    .file-card .file-thumbnail {
      padding-top: 100%; /* 方形缩略图，节省纵向空间 */
    }

    .file-card .file-info {
      padding: 6px 8px;

      :deep(.el-input) {
        display: none;
      }

      .file-meta {
        font-size: 10px;
        .file-size {
          padding: 2px 6px;
          font-size: 10px;
        }
        .create-time {
          display: none;
        }
      }
    }
  }

  &.size-sm {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;

    .file-card .file-info {
      padding: 7px 8px;

      :deep(.el-input) {
        margin-bottom: 4px;
        .el-input__inner {
          height: 24px;
          line-height: 24px;
          font-size: 11px;
        }
      }
    }
  }

  &.size-md {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
  }

  &.size-lg {
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 14px;
  }
}

// 文件卡片
.file-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  &.upload-failed {
    border-color: rgba(248, 113, 113, 0.5);
    background: rgba(248, 113, 113, 0.1);

    &:hover {
      border-color: rgba(248, 113, 113, 0.7);
      background: rgba(248, 113, 113, 0.15);
    }
  }

  &.upload-uploading {
    border-color: rgba(96, 165, 250, 0.5);
    background: rgba(96, 165, 250, 0.1);

    &:hover {
      border-color: rgba(96, 165, 250, 0.7);
      background: rgba(96, 165, 250, 0.15);
    }
  }

  &.upload-waiting {
    border-color: rgba(251, 191, 36, 0.3);
    background: rgba(251, 191, 36, 0.05);

    &:hover {
      border-color: rgba(251, 191, 36, 0.5);
      background: rgba(251, 191, 36, 0.1);
    }
  }

  &.upload-completed {
    border-color: rgba(52, 211, 153, 0.5);
    background: rgba(52, 211, 153, 0.1);

    &:hover {
      border-color: rgba(52, 211, 153, 0.7);
      background: rgba(52, 211, 153, 0.15);
    }
  }

  .file-thumbnail {
    width: 100%;
    padding-top: 70%;
    position: relative;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%);
    overflow: hidden;
    border-radius: 8px 8px 0 0;

    /* 隐私模式遮罩（与主相册一致） */
    .privacy-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      z-index: 5;
      backdrop-filter: blur(2px);
      pointer-events: none;
      border-radius: inherit; /* 跟随父 file-thumbnail 圆角 */

      .privacy-icon {
        font-size: 22px;
        color: #e6a23c;
      }
      .privacy-text {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.8);
        font-weight: 500;
      }
    }

    img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumbnail-image {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;

      :deep(.el-image__inner) {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: all 0.3s ease;

        &:hover {
          transform: scale(1.05);
          filter: brightness(1.1);
        }
      }

      :deep(.el-image__wrapper) {
        width: 100%;
        height: 100%;
      }

      :deep(.el-image__error) {
        width: 100%;
        height: 100%;
      }

      :deep(.el-image__preview) {
        cursor: zoom-in;
      }
    }

    .thumbnail-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        transform: scale(1.05);
        filter: brightness(1.1);
      }
    }

    .image-error {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.05);

      .error-text {
        font-size: 12px;
      }
    }

    .preview-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: all 0.3s ease;
      cursor: pointer;
      z-index: 10;

      &:hover {
        opacity: 1;
      }

      .el-icon {
        color: white;
        font-size: 20px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      }
    }

    .video-icon,
    .file-icon {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }

    .preview-loading {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 5;

      .el-icon {
        color: #60a5fa;
        margin-bottom: 8px;
      }

      .loading-text {
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        font-weight: 500;
      }
    }

    .preview-error {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.3);
      z-index: 5;

      .el-icon {
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 8px;
      }

      .error-text {
        color: rgba(255, 255, 255, 0.5);
        font-size: 10px;
        font-weight: 400;
      }
    }

    .status-container-top-left {
      position: absolute;
      top: 4px;
      left: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      z-index: 15;
    }

    .status-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 15;
      transition: all 0.3s ease;

      .el-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }

      &.top-left {
        position: absolute;
        top: 4px;
        left: 4px;
      }

      &.failed {
        background: rgba(248, 113, 113, 0.95);
        color: white;
        border: 1px solid rgba(248, 113, 113, 1);
        box-shadow: 0 1px 6px rgba(248, 113, 113, 0.4);
        animation: pulse 2s infinite;
        cursor: help;

        &:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(248, 113, 113, 0.6);
        }
      }

      &.uploading {
        background: rgba(96, 165, 250, 0.95);
        color: white;
        border: 1px solid rgba(96, 165, 250, 1);
        box-shadow: 0 1px 6px rgba(96, 165, 250, 0.4);
        animation: pulse 1.5s ease-in-out infinite;

        &:hover {
          transform: scale(1.05);
        }
      }

      &.waiting {
        background: rgba(251, 191, 36, 0.95);
        color: white;
        border: 1px solid rgba(251, 191, 36, 1);
        box-shadow: 0 1px 6px rgba(251, 191, 36, 0.4);

        &:hover {
          transform: scale(1.05);
        }
      }

      &.paused {
        background: rgba(144, 147, 153, 0.95);
        color: white;
        border: 1px solid rgba(144, 147, 153, 1);
        box-shadow: 0 1px 6px rgba(144, 147, 153, 0.4);

        &:hover {
          transform: scale(1.05);
        }
      }

      &.completed {
        background: rgba(52, 211, 153, 0.95);
        color: white;
        border: 1px solid rgba(52, 211, 153, 1);
        box-shadow: 0 1px 6px rgba(52, 211, 153, 0.4);
        animation: scaleIn 0.3s ease-out;

        &:hover {
          transform: scale(1.05);
        }
      }
    }

    // 上传进度覆盖层
    .upload-progress-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.75);
      padding: 4px 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 12;
      backdrop-filter: blur(4px);

      .progress-bar {
        flex: 1;
        height: 3px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #60a5fa 0%, #7eb8fc 100%);
          border-radius: 2px;
          transition: width 0.3s ease;
          box-shadow: 0 0 4px rgba(96, 165, 250, 0.6);
        }
      }

      .progress-text {
        font-size: 10px;
        font-weight: 600;
        color: white;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        min-width: 32px;
        text-align: right;
      }
    }

    .error-message-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, rgba(220, 38, 38, 0.92) 0%, rgba(185, 28, 28, 0.96) 100%);
      padding: 6px 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 13;
      color: #fff;
      box-shadow: 0 -2px 8px rgba(220, 38, 38, 0.4);

      .el-icon {
        flex-shrink: 0;
      }

      .error-text {
        font-size: 11px;
        font-weight: 600;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }
    }

    .retry-btn-top {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #34d399 0%, #52e3a8 100%);
      border: 1px solid #34d399;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      color: white;
      box-shadow: 0 2px 8px rgba(52, 211, 153, 0.3);

      .el-icon {
        font-size: 12px;
      }

      &:hover {
        transform: scale(1.15) translateY(-1px);
        background: linear-gradient(135deg, #7aca52 0%, #95d373 100%);
        box-shadow: 0 4px 12px rgba(52, 211, 153, 0.4);
      }

      &:active {
        transform: scale(1.05);
        box-shadow: 0 2px 4px rgba(52, 211, 153, 0.3);
      }
    }

    .pause-btn-top,
    .resume-btn-top {
      position: absolute;
      top: 6px;
      right: 38px;
      width: 26px;
      height: 26px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 15;
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);

      .el-icon {
        font-size: 14px;
      }
    }

    .pause-btn-top:hover {
      background: linear-gradient(135deg, #fbbf24 0%, #f0b86e 100%);
      transform: scale(1.1) translateY(-1px);
      border-color: rgba(255, 255, 255, 0.6);
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
    }

    .resume-btn-top:hover {
      background: linear-gradient(135deg, #34d399 0%, #52e3a8 100%);
      transform: scale(1.1) translateY(-1px);
      border-color: rgba(255, 255, 255, 0.6);
      box-shadow: 0 4px 12px rgba(52, 211, 153, 0.4);
    }

    .pause-btn-top:active,
    .resume-btn-top:active {
      transform: scale(1.05);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    .delete-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 26px;
      height: 26px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 15;
      border: 1px solid rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);

      .el-icon {
        font-size: 14px;
      }

      &:hover {
        background: linear-gradient(135deg, #f87171 0%, #fb9090 100%);
        transform: scale(1.1) translateY(-1px);
        border-color: rgba(255, 255, 255, 0.6);
        box-shadow: 0 4px 12px rgba(248, 113, 113, 0.4);
      }

      &:active {
        transform: scale(1.05);
        box-shadow: 0 2px 6px rgba(248, 113, 113, 0.3);
      }
    }
  }

  &:hover .file-thumbnail {
    .delete-btn,
    .pause-btn-top,
    .resume-btn-top {
      opacity: 1;
    }

    .preview-overlay {
      opacity: 1;
    }
  }

  .file-info {
    padding: 8px;
    background: rgba(0, 0, 0, 0.1);

    :deep(.el-input) {
      margin-bottom: 6px;
      .el-input__inner {
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        height: 26px;
        line-height: 26px;
        font-weight: 500;
        transition: all 0.3s ease;

        &::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      }
    }

    .file-meta {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;

      .file-size {
        background: linear-gradient(
          135deg,
          rgba(96, 165, 250, 0.2) 0%,
          rgba(96, 165, 250, 0.1) 100%
        );
        color: rgba(96, 165, 250, 0.9);
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 600;
        flex-shrink: 0;
        border: 1px solid rgba(96, 165, 250, 0.2);
        box-shadow: 0 1px 2px rgba(96, 165, 250, 0.1);
      }

      .create-time {
        color: rgba(255, 255, 255, 0.5);
        font-size: 9px;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.1) 0%,
          rgba(255, 255, 255, 0.05) 100%
        );
        padding: 3px 6px;
        border-radius: 4px;
        flex: 1;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-weight: 500;
      }
    }
  }
}

// 右侧卡片基础样式 —— 紧凑版，4 张卡片要在 78vh 高度内全部装下不滚动
.stat-card,
.progress-card,
.speed-card,
.album-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  .card-title {
    margin: 0 0 6px 0;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

// 任务统计卡片
.stat-card {
  .stat-list {
    display: flex;
    flex-direction: column;
    gap: 5px;

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .stat-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
      }

      .stat-value {
        font-size: 13px;
        font-weight: 600;
        color: #60a5fa;
        text-align: right;
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

// 进度卡片
.progress-card {
  .progress-content {
    display: flex;
    gap: 10px;
    align-items: center;

    .progress-circle-wrapper {
      flex-shrink: 0;

      :deep(.el-progress) {
        width: 56px !important;
        height: 56px !important;
      }
    }

    .progress-stats {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .stat-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;

        .stat-label {
          color: rgba(255, 255, 255, 0.5);
        }

        .stat-value {
          font-weight: 600;
          text-align: right;
          max-width: 60px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          &.primary {
            color: #60a5fa;
          }
          &.warning {
            color: #fbbf24;
          }
          &.info {
            color: #909399;
          }
          &.danger {
            color: #f87171;
          }
        }
      }
    }
  }
}

// 速度卡片
.speed-card {
  .speed-display {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .speed-row {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .speed-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
      }

      .speed-value-wrapper {
        display: flex;
        align-items: baseline;
        gap: 2px;
        max-width: 100px;

        .speed-value {
          font-size: 16px;
          font-weight: 600;
          color: #34d399;
          transition: all 0.3s ease;
          line-height: 1;

          &.uploading {
            color: #60a5fa;
            animation: pulse 2s infinite;
          }
        }
      }
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes scaleIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

// 相册卡片
.album-card {
  .album-content {
    .album-name {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: default;
      max-width: 100%;

      .album-override-tag {
        display: inline-block;
        margin-left: 6px;
        padding: 1px 6px;
        font-size: 10px;
        font-weight: 600;
        color: #fbbf24;
        background: rgba(251, 191, 36, 0.15);
        border: 1px solid rgba(251, 191, 36, 0.35);
        border-radius: 10px;
        vertical-align: middle;
      }
    }

    .album-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      .meta-item {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
        cursor: default;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .album-select-hint {
      text-align: center;
      padding: 16px 12px;

      .hint-text {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        margin-bottom: 12px;
      }

      :deep(.album-btn) {
        height: 32px;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.3s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

        .el-icon {
          margin-right: 4px;
          font-size: 12px;
        }

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(96, 165, 250, 0.3);
        }
      }
    }

    .album-selected {
      .album-name {
        margin-bottom: 8px;
      }

      :deep(.album-change-btn) {
        height: 24px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.3s ease;

        .el-icon {
          margin-right: 2px;
          font-size: 11px;
        }

        &:hover {
          background: rgba(96, 165, 250, 0.1);
          color: #5bacff;
        }
      }
    }
  }
}
</style>
