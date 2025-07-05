<template>
  <div class="top-bar">
    <!-- 优化的详细信息布局 -->
    <div v-if="currentAlbum" class="album-header">
      <div class="album-info">
        <div class="title-section">
          <h2 class="album-title">{{ currentAlbum.name }}</h2>
          <div v-if="currentAlbum.desc && currentAlbum.desc.trim()" class="album-description">
            {{ currentAlbum.desc }}
          </div>
        </div>

        <div class="stats-container">
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
          </div>
        </div>
      </div>

      <!-- 预留空间给底部控制区 -->
      <div class="action-section"></div>
    </div>

    <div v-else class="empty-content">
      <p class="empty-description">空间相册</p>
    </div>

    <!-- 底部控制行 - 集中所有控制功能 -->
    <div v-if="currentAlbum && hasPhotos" class="bottom-controls">
      <!-- 左侧：图片大小控制器 -->
      <div class="photo-size-controls">
        <el-radio-group v-model="photoSize" size="small">
          <el-radio-button value="mini">最小</el-radio-button>
          <el-radio-button value="small">小</el-radio-button>
          <el-radio-button value="medium">中</el-radio-button>
          <el-radio-button value="large">大</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 隐私模式切换 -->
      <div class="privacy-controls">
        <el-tooltip
          :content="privacyMode ? '关闭隐私模式，显示照片内容' : '开启隐私模式，模糊照片内容'"
          placement="top"
        >
          <el-button
            :type="privacyMode ? 'warning' : 'default'"
            size="small"
            class="privacy-btn"
            @click="privacyMode = !privacyMode"
          >
            <template #icon>
              <i class="privacy-icon">{{ privacyMode ? '🔒' : '👁️' }}</i>
            </template>
            {{ privacyMode ? '隐私模式' : '正常模式' }}
          </el-button>
        </el-tooltip>
      </div>

      <!-- 左侧：选择信息 -->
      <div class="quick-stats">
        <span class="selected-count">
          已选择 {{ selectedPhotos.size }} / {{ allPhotos.length }} 张
        </span>
      </div>

      <!-- 中间：主要操作按钮 -->
      <div class="action-buttons">
        <el-button
          class="select-btn"
          :type="isAllSelected ? 'warning' : 'default'"
          :disabled="!hasPhotos"
          @click="selectAllPhotos"
        >
          <template #icon>
            <i v-if="isAllSelected" class="btn-icon">✕</i>
            <i v-else class="btn-icon">✓</i>
          </template>
          {{ isAllSelected ? '取消全选' : '全选照片' }}
        </el-button>

        <!-- 下载相册按钮 -->
        <el-button
          v-if="shouldShowDownloadButton"
          class="download-btn"
          type="primary"
          :disabled="!hasPhotos"
          @click="downloadAllPhotos"
        >
          <template #icon>
            <i class="btn-icon">⬇</i>
          </template>
          下载相册
        </el-button>

        <!-- 获取照片状态时的取消按钮 -->
        <el-button
          v-else-if="shouldShowCancelButton"
          class="cancel-btn"
          type="warning"
          @click="cancelDownload"
        >
          <template #icon>
            <el-icon class="is-loading"><Loading /></el-icon>
          </template>
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
          class="download-progress-btn"
          type="primary"
          disabled
        >
          <template #icon>
            <el-icon class="is-loading"><Loading /></el-icon>
          </template>
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
import { Loading } from '@element-plus/icons-vue'
import StatCard from '@renderer/components/StatCard/index.vue'
import { formatDateWithYear } from '@renderer/utils/formatters'
import { useDownloadStore } from '@renderer/store/download.store'

const downloadStore = useDownloadStore()

const currentAlbum = inject('currentAlbum', ref(null))
const selectAllCallback = inject('selectAllCallback', null)
const downloadAllCallback = inject('downloadAllCallback', null)
const cancelDownloadCallback = inject('cancelDownloadCallback', null)
const allPhotos = inject('photoList', ref([]))
const selectedPhotos = inject('selectedPhotos', ref(new Set()))
const photoSize = inject('photoSize', ref('medium'))

// 隐私模式状态
const privacyMode = ref(false)

// 从localStorage恢复和保存照片尺寸设置
onMounted(() => {
  const savedSize = localStorage.getItem('photo-size')
  if (savedSize && ['mini', 'small', 'medium', 'large'].includes(savedSize)) {
    photoSize.value = savedSize
  }

  // 每次登录都默认开启隐私模式
  privacyMode.value = true
  localStorage.setItem('privacy-mode', 'true')
})

// 监听照片尺寸变化，保存到localStorage
watch(
  photoSize,
  (newSize) => {
    localStorage.setItem('photo-size', newSize)
  },
  { immediate: false }
)

// 监听隐私模式变化，保存到localStorage
watch(
  privacyMode,
  (newMode) => {
    localStorage.setItem('privacy-mode', newMode.toString())
  },
  { immediate: false }
)

// 提供隐私模式状态给其他组件
defineExpose({
  privacyMode
})

const hasPhotos = computed(() => allPhotos.value && allPhotos.value.length > 0)

const isAllSelected = computed(() => {
  if (!hasPhotos.value) return false
  return allPhotos.value.every((photo) =>
    selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )
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
</script>

<style lang="scss" scoped>
.top-bar {
  position: relative;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
}

/* 相册信息布局 */
.album-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
}

.album-info {
  flex: 1;
  min-width: 0;
}

.title-section {
  margin-bottom: 16px;

  .album-title {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 6px 0;
    line-height: 1.3;
    letter-spacing: -0.02em;
  }

  .album-description {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.4;
    margin-top: 6px;
  }
}

.stats-container {
  .stats-row {
    display: flex;
    gap: 28px;
    flex-wrap: wrap;
    transition: all 0.3s ease;
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
      transition: width 0.3s ease;
      border-radius: 0 0 8px 8px;
    }
  }
}

.bottom-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  gap: 16px;

  .quick-stats {
    flex: 0 0 auto;
  }

  .action-buttons {
    flex: 1;
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .photo-size-controls {
    flex: 0 0 auto;
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
  .album-header {
    gap: 24px;
  }

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

  .scrolled .album-header {
    gap: 12px;
  }

  .collapsed .title-section .album-title {
    font-size: 15px;
  }
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
</style>
