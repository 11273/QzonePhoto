<template>
  <div class="top-bar" :class="{ collapsed: isCollapsed }">
    <!-- 上传弹窗 - 相册上下文模式 -->
    <UploadDialog
      :visible="showUpload"
      :album-id="currentAlbum?.id"
      :album-name="currentAlbum?.name"
      context-mode="album"
      @close="handleUploadDialogClose"
    />

    <!-- 优化的详细信息布局 -->
    <div v-if="currentAlbum" class="album-header">
      <div class="album-info">
        <div class="title-section">
          <div class="album-title-row">
            <div class="title-left">
              <h2 class="album-title">{{ currentAlbum.name }}</h2>

              <!-- 权限信息显示 - 简化版本 -->
              <div v-if="albumPermissionText" class="album-permissions">
                <el-tooltip :content="albumPermissionText" placement="top" :show-after="500">
                  <span class="permission-text">{{ shortPermissionText }}</span>
                </el-tooltip>
              </div>
            </div>

            <!-- 相册刷新按钮 -->
            <div class="title-right">
              <el-button
                text
                :icon="Refresh"
                :loading="refreshLoading"
                :disabled="refreshLoading"
                class="refresh-btn"
                @click="refreshAlbum"
              >
                刷新
              </el-button>
            </div>
          </div>

          <transition name="fade-slide">
            <div
              v-show="!isCollapsed && currentAlbum.desc && currentAlbum.desc.trim()"
              class="album-description"
            >
              {{ currentAlbum.desc }}
            </div>
          </transition>
        </div>

        <transition name="fade-slide">
          <div v-show="!isCollapsed" class="stats-container">
            <div class="stats-row">
              <StatCard icon="📷" :value="currentAlbum.total" label="张照片" :is-primary="true" />

              <StatCard icon="💬" :value="currentAlbum.comment || 0" label="评论" />

              <StatCard
                icon="📅"
                :value="formatDateWithYear(currentAlbum.createtime)"
                label="创建时间"
              />

              <StatCard
                icon="🕒"
                :value="formatDateWithYear(currentAlbum.modifytime)"
                label="最后更新"
              />

              <!-- 问题信息显示在最后更新旁边 -->
              <StatCard
                v-if="currentAlbum.question"
                icon="🔒"
                :value="currentAlbum.question"
                label="相册问题"
              />
            </div>
          </div>
        </transition>
      </div>

      <!-- 预留空间给底部控制区 -->
      <div class="action-section"></div>
    </div>

    <div v-else class="empty-content">
      <p class="empty-description">空间相册</p>
    </div>

    <!-- 底部控制行 - 集中所有控制功能 -->
    <div v-if="currentAlbum" class="bottom-controls">
      <!-- 左侧：选择信息和图片大小控制 -->
      <div class="left-controls">
        <div class="selection-control">
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            :disabled="!hasPhotos"
            @change="selectAllPhotos"
          >
            <span class="selection-text">
              已选 {{ selectedPhotos.size }} / {{ allPhotos.length }} 张
            </span>
          </el-checkbox>
        </div>
        <div class="photo-size-controls">
          <span class="control-label">图片大小：</span>
          <el-radio-group v-model="photoSize" size="small">
            <el-radio-button value="mini">最小</el-radio-button>
            <el-radio-button value="small">小</el-radio-button>
            <el-radio-button value="medium">中</el-radio-button>
            <el-radio-button value="large">大</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 中间：预留空间 -->
      <div class="center-spacer"></div>

      <!-- 右侧：主要操作按钮 -->
      <div class="right-action-buttons">
        <!-- 上传照片按钮 -->
        <el-button
          class="album-action-btn upload-btn"
          size="default"
          type="success"
          :disabled="!currentAlbum"
          @click="showUploadDialog"
        >
          <el-icon><Upload /></el-icon>
          上传照片
        </el-button>

        <!-- 下载相册按钮 -->
        <el-button
          v-if="shouldShowDownloadButton"
          class="album-action-btn download-btn"
          size="default"
          type="primary"
          :disabled="!hasPhotos"
          @click="downloadAllPhotos"
        >
          <el-icon><Download /></el-icon>
          下载相册
        </el-button>

        <!-- 获取照片状态时的取消按钮 -->
        <el-button
          v-else-if="shouldShowCancelButton"
          class="album-action-btn cancel-btn"
          size="default"
          type="warning"
          @click="cancelDownload"
        >
          <el-icon class="is-loading"><Loading /></el-icon>
          <span
            v-if="albumDownloadState.status === 'fetching' && albumDownloadState.totalPhotos > 0"
          >
            获取中 {{ albumDownloadState.fetchedCount || 0 }}/{{ albumDownloadState.totalPhotos }}
          </span>
          <span v-else> 取消获取 </span>
        </el-button>

        <!-- 下载状态时的进度显示 -->
        <el-button
          v-else-if="shouldShowProgressButton"
          class="album-action-btn download-progress-btn"
          size="default"
          type="primary"
          disabled
        >
          <el-icon class="is-loading"><Loading /></el-icon>
          {{ downloadButtonText }}

          <!-- 进度条显示在按钮内部 -->
          <div
            class="download-progress-bar"
            :style="{ width: `${albumDownloadState.progress}%` }"
          ></div>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, inject, onMounted, watch } from 'vue'
import { Loading, Upload, Download, Refresh } from '@element-plus/icons-vue'
import StatCard from '@renderer/components/StatCard/index.vue'
import UploadDialog from '@renderer/components/UploadDialog/index.vue'
import { formatDateWithYear } from '@renderer/utils/formatters'
import { useDownloadStore } from '@renderer/store/download.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { QZONE_UTILS, QZONE_CONFIG } from '@shared/const'

const downloadStore = useDownloadStore()
const privacyStore = usePrivacyStore()

const currentAlbum = inject('currentAlbum', ref(null))
const selectAllCallback = inject('selectAllCallback', null)
const downloadAllCallback = inject('downloadAllCallback', null)
const cancelDownloadCallback = inject('cancelDownloadCallback', null)
const refreshAlbumCallback = inject('refreshAlbumCallback', null)
const allPhotos = inject('photoList', ref([]))
const selectedPhotos = inject('selectedPhotos', ref(new Set()))
const photoSize = inject('photoSize', ref('medium'))

// 计算相册权限文本
const albumPermissionText = computed(() => {
  if (!currentAlbum.value) return ''
  return QZONE_UTILS.getAlbumPermissionText(currentAlbum.value)
})

// 计算简化的权限文本
const shortPermissionText = computed(() => {
  if (!currentAlbum.value) return ''

  const privText = QZONE_CONFIG.privMap[currentAlbum.value.priv] || '未知权限'
  const features = []

  // if (QZONE_UTILS.checkAllowShare(currentAlbum.value)) features.push('分享')
  if (QZONE_UTILS.checkShowCameraInfo(currentAlbum.value)) features.push('相机信息')

  // 如果有功能权限，只显示主权限 + 第一个功能
  if (features.length > 0) {
    return `${privText} / ${features[0]}${features.length > 1 ? '等' : ''}`
  }

  return privText
})

// 从localStorage恢复和保存照片尺寸设置
onMounted(() => {
  const savedSize = localStorage.getItem('photo-size')
  if (savedSize && ['mini', 'small', 'medium', 'large'].includes(savedSize)) {
    photoSize.value = savedSize
  }
})

// 监听照片尺寸变化，保存到localStorage
watch(
  photoSize,
  (newSize) => {
    localStorage.setItem('photo-size', newSize)
  },
  { immediate: false }
)

// 上传弹窗的显示状态
const showUpload = ref(false)

// 收缩状态
const isCollapsed = ref(false)

// 刷新加载状态
const refreshLoading = ref(false)

// 设置收缩状态
const setCollapsed = (collapsed) => {
  isCollapsed.value = collapsed
}

// 显示上传弹窗
const showUploadDialog = () => {
  showUpload.value = true
}

// 关闭上传弹窗的回调
const handleUploadDialogClose = async (shouldRefresh) => {
  showUpload.value = false
  if (shouldRefresh && currentAlbum.value) {
    // 刷新当前相册的照片列表
    if (refreshAlbumCallback) {
      await refreshAlbumCallback()
    }
  }
}

// 提供隐私模式状态和收缩控制给其他组件
defineExpose({
  privacyMode: privacyStore.privacyMode,
  setCollapsed
})

const hasPhotos = computed(() => allPhotos.value && allPhotos.value.length > 0)

const isAllSelected = computed(() => {
  if (!hasPhotos.value) return false
  return allPhotos.value.every((photo) =>
    selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )
})

const isIndeterminate = computed(() => {
  if (!hasPhotos.value) return false
  const selectedCount = selectedPhotos.value.size
  return selectedCount > 0 && selectedCount < allPhotos.value.length
})

// 计算当前相册的下载状态
const albumDownloadState = computed(() => {
  if (!currentAlbum.value) {
    return { isDownloading: false, progress: 0 }
  }
  return downloadStore.getAlbumDownloadState(currentAlbum.value.id)
})

// 计算当前相册是否正在获取照片
const isFetching = computed(() => {
  if (!currentAlbum.value) return false
  return downloadStore.isAlbumFetching(currentAlbum.value.id)
})

// 下载按钮文本
const downloadButtonText = computed(() => {
  const state = albumDownloadState.value

  // 获取阶段
  if (state.status === 'fetching' && state.totalPhotos > 0) {
    return `获取中 ${state.fetchedCount || 0}/${state.totalPhotos} (${state.progress}%)`
  }

  // 下载阶段
  if (state.isDownloading && state.totalCount > 0) {
    return `${state.downloadedCount}/${state.totalCount} (${state.progress}%)`
  }

  // 其他状态
  if (state.status === 'fetching') {
    return '获取照片中...'
  }

  return '下载中...'
})

// 检查是否应该显示正常的下载按钮
const shouldShowDownloadButton = computed(() => {
  const state = albumDownloadState.value
  return !state.isDownloading && !isFetching.value && state.status !== 'fetching'
})

// 检查是否应该显示取消按钮
const shouldShowCancelButton = computed(() => {
  return isFetching.value || albumDownloadState.value.status === 'fetching'
})

// 检查是否应该显示进度按钮
const shouldShowProgressButton = computed(() => {
  const state = albumDownloadState.value
  return state.isDownloading && state.status === 'downloading'
})

const selectAllPhotos = () => {
  if (selectAllCallback) {
    selectAllCallback()
  }
}

const downloadAllPhotos = async () => {
  if (downloadAllCallback && !albumDownloadState.value.isDownloading && !isFetching.value) {
    try {
      await downloadAllCallback()
    } catch (error) {
      console.error('下载失败:', error)
    }
  }
}

const cancelDownload = () => {
  if (cancelDownloadCallback) {
    cancelDownloadCallback()
  }
}

// 刷新当前相册
const refreshAlbum = async () => {
  if (refreshLoading.value) return

  refreshLoading.value = true
  try {
    if (refreshAlbumCallback) {
      await refreshAlbumCallback()
    }
  } finally {
    refreshLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.top-bar {
  position: relative;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &.collapsed {
    padding: 8px 24px;

    .album-header {
      gap: 8px;
    }

    .title-section {
      margin-bottom: 0;

      .album-title {
        font-size: 16px;
      }
    }

    .bottom-controls {
      margin-top: 8px;
      padding-top: 8px;
    }
  }
}

/* 相册信息布局 */
.album-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.album-info {
  flex: 1;
  min-width: 0;
}

.album-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.title-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 16px;
}

.title-section {
  margin-bottom: 16px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  .album-title {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.3;
    letter-spacing: -0.02em;
    display: inline-block;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .album-description {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.4;
    margin-top: 6px;
  }

  .album-permissions {
    display: inline-block;

    .permission-text {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-weight: 400;
      line-height: 1.2;
      cursor: help;
    }
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
}

.stats-container {
  .stats-row {
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
    transition: all 0.2s ease;
  }
}

/* 操作区域 */
.action-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 12px;
  align-items: center;

  .select-btn {
    min-width: 100px;
    height: 36px;
    font-weight: 500;
    border-radius: 8px;
    transition: all 0.2s ease;
    margin-left: auto;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-icon {
      font-style: normal;
      display: inline-block;
      font-size: 12px;
      line-height: 1;
    }
  }

  .download-btn {
    min-width: 140px;
    height: 36px;
    font-weight: 600;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: none;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      cursor: not-allowed;
    }

    .btn-icon {
      font-style: normal;
      display: inline-block;
      font-size: 12px;
      line-height: 1;
    }
  }

  .cancel-btn {
    min-width: 140px;
    height: 36px;
    font-weight: 600;
    border-radius: 8px;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border: none;
    transition: all 0.2s ease;

    &:hover {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4);
    }

    &:active {
      transform: translateY(0);
    }

    :deep(.el-icon.is-loading) {
      margin-right: 4px;
    }
  }

  .download-progress-btn {
    min-width: 140px;
    height: 36px;
    font-weight: 600;
    border-radius: 8px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border: none;
    position: relative;
    overflow: hidden;
    cursor: not-allowed;

    :deep(.el-icon.is-loading) {
      margin-right: 4px;
    }

    // 进度条样式
    .download-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: rgba(255, 255, 255, 0.5);
      transition: width 0.2s ease;
      border-radius: 0 0 8px 8px;
    }
  }
}

.bottom-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  gap: 24px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  .left-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    flex: 0 0 auto;
  }

  .selection-control {
    :deep(.el-checkbox) {
      .el-checkbox__label {
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        font-weight: 500;

        .selection-text {
          margin-left: 6px;
        }
      }

      .el-checkbox__input.is-checked .el-checkbox__inner {
        background-color: #409eff;
        border-color: #409eff;
      }

      .el-checkbox__input.is-indeterminate .el-checkbox__inner {
        background-color: #409eff;
        border-color: #409eff;
      }

      .el-checkbox__inner {
        border-color: rgba(255, 255, 255, 0.3);
        background-color: transparent;
      }

      &:hover {
        .el-checkbox__inner {
          border-color: #409eff;
        }
      }
    }
  }

  .center-spacer {
    flex: 1;
  }

  .left-action-buttons {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .right-action-buttons {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .right-controls {
    flex: 0 0 auto;
    min-width: 120px;
  }

  // 统一按钮样式
  :deep(.album-action-btn) {
    height: 32px;
    padding: 6px 16px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 13px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    min-width: 80px;
    max-width: 120px;

    .el-icon {
      margin-right: 6px;
      font-size: 14px;
    }

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    &.upload-btn {
      background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
      border: 1px solid #67c23a;
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, #7aca52 0%, #95d373 100%);
        border-color: #7aca52;
      }
    }

    &.download-btn {
      background: linear-gradient(135deg, #409eff 0%, #4dabf7 100%);
      border: 1px solid #409eff;
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, #5bacff 0%, #66b8f7 100%);
        border-color: #5bacff;
      }
    }

    &.cancel-btn {
      background: linear-gradient(135deg, #e6a23c 0%, #eebe77 100%);
      border: 1px solid #e6a23c;
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, #eaae4e 0%, #f1c589 100%);
        border-color: #eaae4e;
      }
    }

    &:disabled {
      background: #c0c4cc;
      border-color: #c0c4cc;
      color: #ffffff;
      transform: none;
      box-shadow: none;
      cursor: not-allowed;

      &:hover {
        transform: none;
        box-shadow: none;
      }
    }
  }
}

.photo-size-controls {
  display: flex;
  align-items: center;
  gap: 8px;

  .control-label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  :deep(.el-radio-group) {
    .el-radio-button {
      .el-radio-button__inner {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
        padding: 4px 10px;
        font-size: 11px;
        min-width: 36px;

        &:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.9);
        }
      }

      &.is-active .el-radio-button__inner {
        background: #409eff;
        border-color: #409eff;
        color: #fff;
      }
    }
  }
}

.privacy-controls {
  display: flex;
  align-items: center;

  .privacy-btn {
    min-width: 90px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.2s ease;

    &:not(.el-button--warning) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.8);

      &:hover {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
        color: rgba(255, 255, 255, 0.9);
        transform: translateY(-1px);
      }
    }

    &.el-button--warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      border-color: #f59e0b;
      color: #fff;

      &:hover {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        border-color: #d97706;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
      }
    }

    .privacy-icon {
      font-style: normal;
      font-size: 12px;
      margin-right: 4px;
    }
  }
}

.quick-stats {
  .selected-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 500;
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  padding: 32px 20px;
}

.empty-content {
  text-align: center;
  color: rgba(255, 255, 255, 0.6);

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
    margin-bottom: 16px;
    filter: grayscale(1);
  }

  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 8px 0;
  }

  .empty-description {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.4;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .stats-container .stats-row {
    gap: 20px;
  }

  .action-section {
    .action-buttons {
      gap: 10px;
    }
  }
}

@media (max-width: 1024px) {
  .album-header {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }

  .action-section {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }

  .stats-container .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .top-bar {
    padding: 12px 16px;
    min-height: 80px;
  }

  .album-header {
    gap: 16px;
  }

  .title-section .album-title {
    font-size: 18px;
  }

  .stats-container .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .action-section {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .bottom-controls {
    flex-direction: column;
    gap: 12px;
    align-items: center;

    .action-buttons {
      order: 1;
    }

    .quick-stats {
      order: 2;
    }

    .photo-size-controls,
    .privacy-controls {
      order: 3;
    }

    /* 移动端将尺寸和隐私控制放在同一行 */
    .photo-size-controls {
      display: flex;
      justify-content: center;
      margin-bottom: 8px;
    }

    .privacy-controls {
      display: flex;
      justify-content: center;
    }
  }

  .action-buttons {
    justify-content: center;
    gap: 12px;

    .select-btn,
    .download-btn {
      flex: 1;
      min-width: 120px;
    }
  }

  .quick-stats {
    text-align: center;
  }

  .empty-state {
    min-height: 100px;
    padding: 24px 16px;
  }

  .empty-content .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }
}

/* 淡入淡出滑动动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

@media (max-width: 480px) {
  .top-bar {
    padding: 8px 12px;
  }

  .stats-container .stats-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-item {
    flex-direction: row;
    gap: 8px;
    padding: 6px 0;

    .stat-content {
      flex-direction: row;
      gap: 6px;
      align-items: center;

      .stat-value {
        font-size: 12px;
      }

      .stat-label {
        font-size: 10px;
      }
    }
  }

  .action-buttons {
    flex-direction: column;
    gap: 8px;

    .select-btn,
    .download-btn {
      width: 100%;
    }
  }
}
.upload-btn {
  min-width: 100px;
  height: 36px;
  font-weight: 500;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
    cursor: not-allowed;
  }

  .btn-icon {
    font-style: normal;
    display: inline-block;
    font-size: 14px;
    line-height: 1;
  }
}
</style>
