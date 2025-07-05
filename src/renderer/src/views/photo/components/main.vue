<template>
  <div class="photo-main">
    <Top ref="topRef" />

    <!-- 照片网格区域 -->
    <div class="photo-container">
      <LoadingState v-if="loading" text="正在加载照片..." />

      <EmptyState
        v-else-if="!currentAlbum"
        icon="📷"
        title="选择一个相册"
        description="从左侧选择一个相册来查看照片"
      />

      <EmptyState
        v-else-if="photoGroups.length === 0"
        icon="📭"
        title="相册为空"
        description="这个相册还没有照片"
      />
      <el-scrollbar v-else class="h-full">
        <!-- 按日期分组的照片 -->
        <div class="photo-timeline">
          <div v-for="group in photoGroups" :key="group.date" class="date-group">
            <!-- 日期标题 -->
            <div class="date-header">
              <div class="date-info">
                <h3 class="date-title">{{ group.dateDisplay }}</h3>
                <span class="photo-count">{{ group.photos.length }} 张照片</span>
              </div>
              <div class="date-actions">
                <el-button
                  size="small"
                  :type="isDateSelected(group) ? 'primary' : 'default'"
                  @click="toggleDateSelection(group)"
                >
                  {{ isDateSelected(group) ? '取消全选' : '全选日期' }}
                </el-button>
              </div>
            </div>

            <!-- 照片网格 -->
            <div class="photo-grid" :class="`size-${photoSize}`">
              <div
                v-for="(photo, index) in group.photos"
                :key="photo.lloc || index"
                class="photo-item"
                :class="{
                  selected: selectedPhotos.has(
                    photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
                  ),
                  'privacy-mode': privacyMode
                }"
                @click="handlePhotoClick(photo, $event, index)"
              >
                <div class="photo-wrapper">
                  <el-image
                    :src="photo.pre"
                    :preview-src-list="group.photos.map((p) => p.url)"
                    :initial-index="index"
                    preview-teleported
                    fit="cover"
                    class="photo-image"
                    lazy
                  >
                    <template #error>
                      <div class="image-error">
                        <el-icon><Picture /></el-icon>
                        <span>加载失败</span>
                      </div>
                    </template>
                    <template #placeholder>
                      <div class="image-loading">
                        <el-icon class="loading-icon"><Loading /></el-icon>
                      </div>
                    </template>
                  </el-image>

                  <!-- 隐私模式遮罩 -->
                  <div v-if="privacyMode" class="privacy-overlay">
                    <div class="privacy-icon">🔒</div>
                    <div class="privacy-text">隐私保护</div>
                  </div>

                  <!-- 照片信息覆盖层 -->
                  <div class="photo-overlay">
                    <div class="photo-info">
                      <span class="photo-time">{{ formatTime(photo.modifytime) }}</span>
                      <span v-if="photo.is_video" class="video-badge">
                        <el-icon><VideoPlay /></el-icon>
                      </span>
                    </div>

                    <!-- 选择框 -->
                    <div class="selection-checkbox" @click.stop="selectPhoto(photo)">
                      <el-icon
                        v-if="
                          selectedPhotos.has(
                            photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
                          )
                        "
                        class="selected-icon"
                      >
                        <Check />
                      </el-icon>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 加载更多指示器 -->
          <div v-if="loadingMore" class="loading-more">
            <el-icon class="loading-icon"><Loading /></el-icon>
            <span>正在加载更多...</span>
          </div>

          <!-- 没有更多数据提示 -->
          <div v-else-if="!hasMore && photoList.length > 0" class="no-more">
            <span>已加载全部 {{ photoList.length }} 张照片</span>
          </div>

          <!-- 加载触发器 -->
          <div v-if="hasMore && !loading" ref="loadMoreTrigger" class="load-more-trigger">
            <div class="trigger-content">{{ hasMore ? '继续滚动加载更多...' : '' }}</div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 底部悬浮工具栏 -->
    <Transition name="toolbar" appear>
      <div v-if="selectedPhotos.size > 0" class="floating-toolbar">
        <div class="toolbar-content">
          <span class="selected-count">已选择 {{ selectedPhotos.size }} 张照片</span>
          <div class="toolbar-actions">
            <el-button size="small" @click="clearSelection">取消选择</el-button>
            <el-button size="small" type="primary" @click="downloadSelected">下载选中</el-button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 图片预览 -->
    <el-image-viewer
      v-if="previewVisible"
      :url-list="previewImages"
      :initial-index="previewIndex"
      :hide-on-click-modal="true"
      @close="previewVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, provide, onUnmounted, watch, nextTick } from 'vue'
import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import { Loading, Picture, VideoPlay, Check } from '@element-plus/icons-vue'
import { ElLoading } from 'element-plus'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import Top from './top.vue'
import { generateUniqueAlbumName } from '@renderer/utils'

const userStore = useUserStore()
const downloadStore = useDownloadStore()
const loading = ref(false)
const loadingMore = ref(false)
const isScrollLoading = ref(false) // 简单布尔锁

// 引用Top组件，获取隐私模式状态
const topRef = ref(null)

// 隐私模式状态
const privacyMode = computed(() => {
  return topRef.value?.privacyMode || false
})

// 滚动容器引用
const loadMoreTrigger = ref(null)
let observer = null

// 相册和照片数据
const currentAlbum = ref(null)
const photoList = ref([])

// 选择状态
const selectedPhotos = ref(new Set())

// 照片尺寸配置
const photoSize = ref('mini')

// 分页状态
const currentPageStart = ref(0)
const pageSize = ref(100)
const total = ref(0)
const hasMore = ref(true)

// 图片预览
const previewVisible = ref(false)
const previewIndex = ref(0)
const previewImages = ref([])

// 取消标志 - 添加到组件顶部
const cancelFlags = ref(new Map()) // 存储每个相册的取消标志

// 公共的API调用函数
const fetchPhotosByTopicId = async (topicId, pageStart = 0, pageNum = 100) => {
  const data = {
    hostUin: userStore.userInfo.uin,
    topicId: topicId,
    pageStart: pageStart,
    pageNum: pageNum
  }

  try {
    const response = await window.QzoneAPI.getPhotoByTopicId(data)

    // 标准化响应数据处理 - 修正：成功状态码是 0 而不是 200
    if (response?.code === 0 && response?.data) {
      const photos = response.data.photoList || []
      const total = response.data.totalInAlbum || 0

      // 判断是否还有更多数据：
      // 1. 当前返回的照片数量等于请求的数量，说明可能还有更多
      // 2. 但总数必须大于当前已获取的数量（pageStart + photos.length）
      const hasMore = photos.length === pageNum && pageStart + photos.length < total

      return {
        success: true,
        photos: photos,
        total: total,
        hasMore: hasMore
      }
    }

    return {
      success: false,
      photos: [],
      total: 0,
      hasMore: false,
      error: response?.message || `API 错误: code=${response?.code}, message=${response?.message}`
    }
  } catch (error) {
    console.error('API 调用失败:', error)
    return {
      success: false,
      photos: [],
      total: 0,
      hasMore: false,
      error: error.message || '网络请求失败'
    }
  }
}

// 注释：fetchAllPhotosFromAlbum 函数已被 fetchAllPhotosFromAlbumWithCancel 替代

// 清理照片数据的公共函数
const cleanPhotoData = (photos) => {
  return photos.map((photo) => ({
    id: photo.id,
    name: photo.name,
    url: photo.url,
    pre: photo.pre,
    raw: photo.raw,
    lloc: photo.lloc,
    modifytime: photo.modifytime,
    is_video: photo.is_video,
    size: photo.size || 0
  }))
}

// 添加下载任务的公共函数 - 优化批量添加体验
const addDownloadTask = async (albumData) => {
  try {
    // 如果照片数量很多，显示提示
    const photoCount = albumData.photos?.length || 0
    if (photoCount > 100) {
      const loadingInstance = ElLoading.service({
        lock: true,
        text: `正在添加 ${photoCount} 个下载任务，请稍候...`,
        background: 'rgba(0, 0, 0, 0.7)'
      })

      try {
        await window.QzoneAPI.download.addAlbum(albumData)
        loadingInstance.close()
        return { success: true }
      } catch (error) {
        loadingInstance.close()
        throw error
      }
    } else {
      await window.QzoneAPI.download.addAlbum(albumData)
      return { success: true }
    }
  } catch (error) {
    console.error('添加下载任务失败:', error)
    return { success: false, error: error.message || '添加下载任务失败' }
  }
}

// 无限滚动加载更多照片
const loadMorePhotos = async () => {
  if (isScrollLoading.value || !currentAlbum.value || !hasMore.value) {
    return
  }

  isScrollLoading.value = true
  loadingMore.value = true

  try {
    const result = await fetchPhotosByTopicId(
      currentAlbum.value.id,
      photoList.value.length,
      pageSize.value
    )

    if (result.success && result.photos.length > 0) {
      // 过滤重复照片（根据 lloc 或组合键）
      const existingKeys = new Set(
        photoList.value.map((p) => p.lloc || `${p.id}_${p.name}_${p.modifytime}`)
      )

      const newPhotos = result.photos.filter((photo) => {
        const key = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
        return !existingKeys.has(key)
      })

      if (newPhotos.length > 0) {
        photoList.value.push(...newPhotos)
      }

      // 更新总数
      if (result.total > 0) {
        total.value = result.total
      }

      // 检查是否还有更多数据
      const currentTotal = photoList.value.length
      if (currentTotal >= total.value || result.photos.length < pageSize.value || !result.hasMore) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
      if (!result.success) {
        console.error('加载失败:', result.error)
        // eslint-disable-next-line no-undef
        ElMessage.error(result.error || '加载照片失败')
      }
    }
  } catch (error) {
    console.error('加载更多照片失败:', error)
    // eslint-disable-next-line no-undef
    ElMessage.error('加载照片失败')
    hasMore.value = false
  } finally {
    loadingMore.value = false
    // 简单延迟解锁
    setTimeout(() => {
      isScrollLoading.value = false
    }, 300)
  }
}

// 监听当前相册变化
watch(currentAlbum, async (newAlbum) => {
  if (!newAlbum) {
    photoList.value = []
    return
  }

  // 先断开观察器
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // 重置状态
  loading.value = true
  photoList.value = []
  selectedPhotos.value.clear()
  hasMore.value = true
  currentPageStart.value = 0

  try {
    const result = await fetchPhotosByTopicId(newAlbum.id, 0, pageSize.value)

    if (result.success) {
      photoList.value = result.photos
      total.value = result.total

      // 检查是否还有更多数据
      if (
        result.photos.length >= result.total ||
        result.photos.length < pageSize.value ||
        !result.hasMore
      ) {
        hasMore.value = false
      } else {
        hasMore.value = true
      }
    } else {
      console.error('加载相册失败:', result.error)
      // eslint-disable-next-line no-undef
      ElMessage.error(result.error || '加载相册照片失败')
    }
  } catch (error) {
    console.error('加载相册照片失败:', error)
    // eslint-disable-next-line no-undef
    ElMessage.error('加载相册照片失败')
  } finally {
    loading.value = false

    // 确保在加载完成后设置观察器
    nextTick(() => {
      setupIntersectionObserver()
    })
  }
})

// 下载当前相册所有照片
const downloadCurrentAlbum = async () => {
  if (!currentAlbum.value) {
    // eslint-disable-next-line no-undef
    ElMessage.warning('请先选择相册')
    return
  }

  const albumId = currentAlbum.value.id

  // 检查是否已经在下载或获取中
  if (downloadStore.isAlbumDownloading(albumId) || downloadStore.isAlbumFetching(albumId)) {
    // eslint-disable-next-line no-undef
    ElMessage.warning('该相册正在下载中')
    return
  }

  // 重置取消标志
  cancelFlags.value.set(albumId, false)

  try {
    // 开始获取，设置预计总数
    downloadStore.startAlbumFetch(albumId, currentAlbum.value.total || 0)
    downloadStore.setAlbumFetching(albumId, true)

    // 流式获取照片并添加到下载队列
    const allPhotos = []
    let totalAddedTasks = 0

    await fetchAndAddPhotosStream(
      currentAlbum.value,
      albumId,
      (fetchedPhotos, currentBatch, totalFetched) => {
        // 更新获取进度
        downloadStore.updateFetchProgress(albumId, totalFetched)

        // 累计所有照片用于最终统计
        allPhotos.push(...fetchedPhotos)
        totalAddedTasks += fetchedPhotos.length
      }
    )

    // 检查是否被取消
    if (cancelFlags.value.get(albumId)) {
      downloadStore.setAlbumFetching(albumId, false)
      downloadStore.cancelAlbumDownload(albumId)
      // eslint-disable-next-line no-undef
      ElMessage.info('已取消获取相册照片')
      return
    }

    // 获取完成
    downloadStore.setAlbumFetching(albumId, false)

    if (totalAddedTasks === 0) {
      // eslint-disable-next-line no-undef
      ElMessage.warning('当前相册没有照片')
      downloadStore.clearAlbumDownloadState(albumId)
      return
    }

    // 重置状态，让任务系统接管下载进度显示
    downloadStore.resetAlbumState(albumId)

    // eslint-disable-next-line no-undef
    ElNotification({
      title: '下载任务已添加',
      message: `已将 ${totalAddedTasks} 张图片加入下载队列`,
      type: 'success',
      duration: 4000,
      position: 'top-right'
    })
  } catch (error) {
    // 获取或下载失败，清理状态
    downloadStore.setAlbumFetching(albumId, false)
    if (!cancelFlags.value.get(albumId)) {
      downloadStore.errorAlbumDownload(albumId, error.message)
      console.error('下载相册失败:', error)
      // eslint-disable-next-line no-undef
      ElMessage.error('下载相册失败')
    }
  } finally {
    // 清理取消标志
    cleanupAlbumFlags(albumId)
  }
}

// 流式获取照片并添加到下载队列
const fetchAndAddPhotosStream = async (album, albumId, onProgress = null) => {
  if (!album) return

  const batchSize = 100
  let pageStart = 0
  let totalFetched = 0

  while (true) {
    // 检查取消标志
    if (cancelFlags.value.get(albumId)) {
      throw new Error('用户取消操作')
    }

    try {
      const result = await fetchPhotosByTopicId(album.id, pageStart, batchSize)

      if (!result.success) {
        console.error('获取照片失败:', result.error)
        break
      }

      if (result.photos.length > 0) {
        // 清理照片数据
        const cleanPhotos = cleanPhotoData(result.photos)

        // 立即添加这批照片到下载队列
        const albumData = {
          album: {
            id: album.id,
            name: generateUniqueAlbumName(album),
            total: album.total,
            desc: album.desc || ''
          },
          photos: cleanPhotos,
          uin: userStore.userInfo?.uin || 'unknown',
          albumId: albumId
        }

        // 检查取消状态
        if (cancelFlags.value.get(albumId)) {
          throw new Error('用户取消操作')
        }

        // 添加到下载队列
        const addResult = await addDownloadTask(albumData)
        if (!addResult.success) {
          console.error('添加下载任务失败:', addResult.error)
        }

        totalFetched += result.photos.length

        // 调用进度回调
        if (onProgress) {
          onProgress(result.photos, result.photos.length, totalFetched)
        }

        // 如果返回的数据少于batchSize，说明已经是最后一页
        if (result.photos.length < batchSize) {
          break
        }

        pageStart += batchSize
      } else {
        break
      }

      // 避免请求过快，并检查取消状态
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.error('获取照片时出错:', error)
      throw error
    }
  }
}

// 取消当前相册下载
const cancelCurrentAlbumDownload = () => {
  if (!currentAlbum.value) return

  const albumId = currentAlbum.value.id
  // 设置本地取消标志
  cancelFlags.value.set(albumId, true)

  // 设置全局取消标志，让批量下载能够感知
  downloadStore.setGlobalCancelFlag(albumId, true)

  // 立即更新store状态
  downloadStore.cancelAlbumDownload(albumId)

  // eslint-disable-next-line no-undef
  ElMessage.info('正在取消下载...')
}

// 在下载完成或出错时清理全局取消标志
const cleanupAlbumFlags = (albumId) => {
  cancelFlags.value.delete(albumId)
  downloadStore.clearGlobalCancelFlag(albumId)
}

// 全选/取消全选照片
const toggleSelectAll = () => {
  if (selectedPhotos.value.size === photoList.value.length) {
    // 当前全选状态，执行取消全选
    selectedPhotos.value = new Set()
  } else {
    // 当前非全选状态，执行全选
    const allPhotoKeys = photoList.value.map(
      (photo) => photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
    )
    selectedPhotos.value = new Set(allPhotoKeys)
  }
}

// 下载选中照片
const downloadSelected = async () => {
  if (selectedPhotos.value.size === 0) {
    // eslint-disable-next-line no-undef
    ElMessage.warning('请先选择要下载的照片')
    return
  }

  try {
    // 获取选中的照片对象
    const selectedPhotoObjects = photoList.value.filter((photo) =>
      selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
    )

    if (selectedPhotoObjects.length === 0) {
      // eslint-disable-next-line no-undef
      ElMessage.warning('未找到选中的照片')
      return
    }

    // 清理照片数据
    const cleanPhotos = cleanPhotoData(selectedPhotoObjects)

    // 准备下载任务数据 - 使用更描述性的名称
    const albumData = {
      album: {
        id: currentAlbum.value.id,
        name: generateUniqueAlbumName(currentAlbum.value),
        total: currentAlbum.value.total || cleanPhotos.length,
        desc: currentAlbum.value.desc || ''
      },
      photos: cleanPhotos,
      uin: userStore.userInfo?.uin || 'unknown'
    }

    const result = await addDownloadTask(albumData)
    if (result.success) {
      // eslint-disable-next-line no-undef
      ElNotification({
        title: '下载任务已添加',
        message: `已将 ${selectedPhotoObjects.length} 张图片加入下载队列`,
        type: 'success',
        duration: 4000,
        position: 'top-right'
      })
      // 清除选择
      selectedPhotos.value = new Set()
    } else {
      // eslint-disable-next-line no-undef
      ElMessage.error(result.error || '下载选中照片失败')
    }
  } catch (error) {
    console.error('下载选中照片失败:', error)
    // eslint-disable-next-line no-undef
    ElMessage.error('下载选中照片失败')
  }
}

// 提供给 Top 组件使用
provide('selectedPhotos', selectedPhotos)
provide('photoList', photoList)
provide('currentAlbum', currentAlbum)
provide('selectAllCallback', toggleSelectAll)
provide('downloadAllCallback', downloadCurrentAlbum)
provide('cancelDownloadCallback', cancelCurrentAlbumDownload)
provide('downloadSelectedCallback', downloadSelected)
provide('photoSize', photoSize)

// 监听左侧相册选择（通过事件总线或props）
const selectAlbum = async (album) => {
  if (!album || currentAlbum.value?.id === album.id) return

  // 先断开监听器，避免重复触发
  if (observer) {
    observer.disconnect()
    observer = null
  }

  currentAlbum.value = album
  selectedPhotos.value = new Set()
  // 重置分页状态
  photoList.value = []
  hasMore.value = true

  // 相册改变时会自动触发 watch(currentAlbum) 进行加载
}

// 提供选择相册的方法给父组件
defineExpose({
  selectAlbum
})

// 按日期分组照片
const photoGroups = computed(() => {
  if (!photoList.value.length) return []

  const groups = new Map()

  photoList.value.forEach((photo) => {
    // 使用修改时间进行分组
    const timeStr = photo.modifytime
    const date = new Date(typeof timeStr === 'string' ? timeStr : timeStr * 1000)
    const dateKey = date.toDateString()

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        dateDisplay: formatDateDisplay(date),
        photos: []
      })
    }

    groups.get(dateKey).photos.push(photo)
  })

  // 按日期降序排序
  return Array.from(groups.values()).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// 格式化日期显示
const formatDateDisplay = (date) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const photoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffTime = today - photoDate
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  if (diffDays <= 7) return `${diffDays} 天前`

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (year === now.getFullYear()) {
    return `${month}月${day}日`
  }

  return `${year}年${month}月${day}日`
}

// 格式化时间显示
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(typeof timeStr === 'string' ? timeStr : timeStr * 1000)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 设置IntersectionObserver监听加载更多
const setupIntersectionObserver = () => {
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // 确保触发器元素存在且还有更多数据可加载
  if (!loadMoreTrigger.value || !hasMore.value) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries
      if (entry.isIntersecting) {
        if (hasMore.value && !loadingMore.value && !loading.value && !isScrollLoading.value) {
          loadMorePhotos()
        }
      }
    },
    {
      rootMargin: '50px',
      threshold: 0.1
    }
  )

  observer.observe(loadMoreTrigger.value)
}

// 处理照片点击事件
const handlePhotoClick = (photo, event, index) => {
  event.stopPropagation()
  // 单击：预览照片
  previewPhoto(photo, index)
}

// 选择照片
const selectPhoto = (photo) => {
  const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`

  if (selectedPhotos.value.has(photoKey)) {
    // 如果已选中，则取消选择
    selectedPhotos.value = new Set([...selectedPhotos.value].filter((key) => key !== photoKey))
  } else {
    // 否则添加到选择中
    selectedPhotos.value = new Set([...selectedPhotos.value, photoKey])
  }
}

// 预览照片
const previewPhoto = (photo, index) => {
  // 使用所有已加载的照片进行预览
  previewImages.value = photoList.value.map((p) => p.url)

  // 计算当前照片在所有照片中的位置
  const globalIndex = photoList.value.findIndex(
    (p) =>
      (p.lloc || `${p.id}_${p.name}_${p.modifytime}`) ===
      (photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )

  previewIndex.value = globalIndex >= 0 ? globalIndex : index
  previewVisible.value = true
}

// 清除选择
const clearSelection = () => {
  selectedPhotos.value = new Set()
}

// 判断某个日期是否全选
const isDateSelected = (group) => {
  return group.photos.every((photo) =>
    selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )
}

// 切换日期选择状态
const toggleDateSelection = (group) => {
  const isSelected = isDateSelected(group)
  const newSelection = new Set(selectedPhotos.value)

  if (isSelected) {
    // 取消选择该日期下的所有照片
    group.photos.forEach((photo) => {
      const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
      newSelection.delete(photoKey)
    })
  } else {
    // 选择该日期下的所有照片
    group.photos.forEach((photo) => {
      const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
      newSelection.add(photoKey)
    })
  }

  selectedPhotos.value = newSelection
}

// 监听loadMoreTrigger的变化，设置观察器
watch(loadMoreTrigger, (newTrigger) => {
  if (newTrigger) {
    nextTick(() => {
      setupIntersectionObserver()
    })
  }
})

// 监听hasMore变化，重新设置观察器
watch(hasMore, () => {
  nextTick(() => {
    setupIntersectionObserver()
  })
})

// 组件销毁时清理
onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<style lang="scss" scoped>
.photo-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.photo-container {
  flex: 1;
  overflow: hidden;
}

.photo-timeline {
  padding: 20px;
}

.usage-tips {
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 24px;
  text-align: center;

  p {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);

    strong {
      color: #409eff;
    }
  }
}

.date-group {
  margin-bottom: 40px;

  &:last-child {
    margin-bottom: 20px;
  }
}

.date-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-left: 4px solid #409eff;
  padding-left: 16px;

  .date-info {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .date-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      text-shadow:
        0 0 3px rgba(0, 0, 0, 0.9),
        0 0 6px rgba(0, 0, 0, 0.8),
        0 1px 2px rgba(0, 0, 0, 1);
      filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
    }

    .photo-count {
      font-size: 13px;
      color: #ffffff;
      background: rgba(64, 158, 255, 0.9);
      border: 1px solid rgba(64, 158, 255, 1);
      padding: 3px 10px;
      border-radius: 12px;
      text-shadow:
        0 0 2px rgba(0, 0, 0, 0.8),
        0 1px 2px rgba(0, 0, 0, 0.9);
      font-weight: 600;
      backdrop-filter: blur(10px);
    }
  }

  .date-actions {
    transition: all 0.2s ease;

    :deep(.el-button) {
      background: rgba(0, 0, 0, 0.6);
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
      backdrop-filter: blur(10px);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      font-weight: 600;

      &:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(255, 255, 255, 0.5);
        color: #ffffff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      &.el-button--primary {
        background: rgba(64, 158, 255, 0.9);
        border-color: #409eff;
        color: #ffffff;

        &:hover {
          background: #409eff;
          border-color: #409eff;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
        }
      }
    }
  }
}

.photo-grid {
  display: grid;
  gap: 12px;
  transition: all 0.3s ease;

  // 大尺寸图片
  &.size-large {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  // 中等尺寸图片（默认）
  &.size-medium {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  // 小尺寸图片
  &.size-small {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }

  // 最小尺寸图片
  &.size-mini {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }

  @media (max-width: 768px) {
    &.size-large {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    &.size-medium {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }

    &.size-small {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 6px;
    }

    &.size-mini {
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 4px;
    }
  }
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);

    .photo-overlay {
      opacity: 1;
    }

    .selection-checkbox {
      opacity: 1;
      background: rgba(255, 255, 255, 0.9);
    }

    /* 隐私模式下悬停时减少模糊 */
    &.privacy-mode .photo-image :deep(.el-image__inner) {
      filter: blur(8px);
    }
  }

  &.selected {
    .photo-wrapper::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 3px solid #409eff;
      border-radius: 8px;
      pointer-events: none;
    }

    .selection-checkbox {
      background: #409eff;
      border-color: #409eff;
      color: white;
    }
  }
}

.photo-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.photo-image {
  width: 100%;
  height: 100%;

  :deep(.el-image__inner) {
    transition: transform 0.2s ease;
  }

  :deep(.el-image__error),
  :deep(.el-image__placeholder) {
    background: rgba(255, 255, 255, 0.05);
  }
}

.image-error,
.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;

  .el-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.7) 0%,
    transparent 30%,
    transparent 70%,
    rgba(0, 0, 0, 0.7) 100%
  );
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.photo-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .photo-time {
    font-size: 12px;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .video-badge {
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
}

.selection-checkbox {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;
  z-index: 2;
  opacity: 0.8;

  &:hover {
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
  }

  .selected-icon {
    font-size: 14px;
    color: white;
    font-weight: bold;
  }
}

.loading-more,
.no-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.6);

  .loading-icon {
    font-size: 24px;
    margin-bottom: 8px;
    animation: spin 1s linear infinite;
  }

  span {
    font-size: 14px;
  }
}

.no-more {
  color: rgba(255, 255, 255, 0.4);
}

.floating-toolbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
  transform: translateX(-50%);

  .toolbar-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    .selected-count {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      white-space: nowrap;
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
    }
  }

  @media (max-width: 768px) {
    left: 16px;
    right: 16px;
    transform: none;

    .toolbar-content {
      gap: 12px;
    }
  }
}

/* Vue Transition 动画类 */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.toolbar-enter-from {
  opacity: 0;
  transform: translate(-50%, 100%);
}

.toolbar-leave-to {
  opacity: 0;
  transform: translate(-50%, 100%);
}

/* 移动端的动画 */
@media (max-width: 768px) {
  .toolbar-enter-from {
    opacity: 0;
    transform: translateY(100%);
  }

  .toolbar-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.load-more-trigger {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;

  .trigger-content {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }
}

/* 隐私模式样式 */
.photo-item.privacy-mode {
  .photo-image {
    :deep(.el-image__inner) {
      filter: blur(15px);
      transition: filter 0.3s ease;
    }
  }

  .photo-overlay {
    opacity: 0.5;
  }
}

.privacy-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: 8px;
  backdrop-filter: blur(2px);

  .privacy-icon {
    font-size: 24px;
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
</style>
