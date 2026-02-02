<template>
  <div class="w-72 flex flex-col border-r border-blue-500/20 h-full relative">
    <!-- 用户信息卡片 -->
    <div class="user-section">
      <div class="user-card">
        <div class="card-header">
          <el-avatar
            shape="square"
            :size="32"
            :src="`https://qlogo4.store.qq.com/qzone/${userStore.userInfo?.uin}/${userStore.userInfo?.uin}/100`"
            class="user-avatar"
          >
            {{ userStore.userInfo?.nick?.[0] || 'Q' }}
          </el-avatar>
          <div class="user-info">
            <div class="nickname">{{ userStore.userInfo?.nick || 'QZone用户' }}</div>
            <div
              class="uin"
              :title="showUin ? '点击隐藏QQ号' : '点击显示QQ号'"
              @click="toggleUinDisplay"
            >
              {{ displayUin }}
            </div>
          </div>
          <!-- 登出按钮移到头像右边 -->
          <div class="header-actions">
            <el-button
              text
              :icon="Monitor"
              class="action-btn open-web-btn"
              title="打开官网"
              @click="openQzoneWeb"
            >
            </el-button>
            <el-popconfirm
              title="确定要登出当前账号吗？"
              confirm-button-text="确定登出"
              cancel-button-text="取消"
              width="200"
              placement="top"
              @confirm="confirmLogout"
            >
              <template #reference>
                <el-button
                  text
                  :icon="SwitchButton"
                  class="action-btn logout-btn header-logout"
                  title="登出"
                >
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
        <div class="card-stats">
          <div class="stat-grid">
            <div class="stat-item">
              <span class="label">黄钻等级</span>
              <span class="value level">{{ userStore.userInfo?.level || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="label">成长值</span>
              <span class="value growth">{{ userStore.userInfo?.score || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="label">成长速度</span>
              <span class="value speed">{{ formatSpeed(userStore.userInfo?.speed || 0) }}</span>
            </div>
            <div class="stat-item">
              <span class="label">已用容量</span>
              <span class="value storage">{{ formatStorage() }}</span>
            </div>
          </div>
        </div>

        <!-- 用户操作区域 - 管理器按钮并排布局 -->
        <div class="card-actions managers-layout">
          <div class="manager-item">
            <el-button
              text
              class="action-btn download-btn manager-btn"
              :class="{ 'has-active-tasks': hasActiveTasks }"
              title="下载管理器"
              @click="showDownloadProgress"
            >
              <div class="manager-btn-content">
                <div class="icon-wrapper">
                  <el-icon><Download /></el-icon>
                  <!-- 活跃任务指示器 -->
                  <div v-if="hasActiveTasks" class="active-indicator">
                    <div class="pulse-ring"></div>
                    <div class="pulse-dot"></div>
                  </div>
                </div>
                <div class="text-wrapper">
                  <div class="main-text">下载管理</div>
                  <div v-if="activeTaskCount > 0" class="status-text">
                    {{ statusText }}
                  </div>
                </div>
              </div>
            </el-button>
          </div>

          <div class="manager-item">
            <el-button
              text
              class="action-btn upload-btn manager-btn"
              :class="{ 'has-active-tasks': hasActiveUploadTasks }"
              title="上传管理器"
              @click="showUploadProgress"
            >
              <div class="manager-btn-content">
                <div class="icon-wrapper">
                  <el-icon><Upload /></el-icon>
                  <!-- 活跃任务指示器 -->
                  <div v-if="hasActiveUploadTasks" class="active-indicator upload-indicator">
                    <div class="pulse-ring"></div>
                    <div class="pulse-dot"></div>
                  </div>
                </div>
                <div class="text-wrapper">
                  <div class="main-text">上传管理</div>
                  <div v-if="activeUploadTaskCount > 0" class="status-text">
                    {{ uploadStatusText }}
                  </div>
                </div>
              </div>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 一级导航菜单 - 分段控制器风格 -->
    <div class="segmented-control-section">
      <div class="segmented-control">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="segment-item"
          :class="{ active: currentModule === tab.key }"
          @click="handleModuleSelect(tab.key)"
        >
          {{ tab.label }}
        </div>
      </div>
    </div>

    <!-- 下载全部相册功能区 -->
    <div v-if="currentModule === 'album'" class="download-all-section">
      <div class="download-all-card">
        <div class="download-all-button" @click="toggleDownloadAll">
          <div class="button-content">
            <div class="button-icon">
              <el-icon v-if="!isDownloadingAll && !isCancelling">
                <FolderAdd />
              </el-icon>
              <el-icon v-else-if="isCancelling" class="cancel-icon">
                <Close />
              </el-icon>
              <div v-else class="loading-wrapper">
                <div class="loading-ring"></div>
                <el-icon class="download-icon">
                  <Download />
                </el-icon>
              </div>
            </div>
            <div class="button-text">
              <div class="main-text">{{ downloadButtonText }}</div>
              <div v-if="downloadProgress.visible" class="sub-text">
                {{ downloadProgress.text }}
              </div>
            </div>
          </div>

          <!-- 进度条 -->
          <div v-if="downloadProgress.visible" class="progress-overlay">
            <div class="progress-fill" :style="{ width: downloadProgress.percentage + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 二级内容区 - 根据模块动态切换 -->
    <div class="flex-1 overflow-hidden menu-container">
      <el-scrollbar class="h-full">
        <!-- 相册模块 -->
        <el-menu
          v-if="currentModule === 'album'"
          :default-openeds="Array.from(openedKeys)"
          :default-active="selectedAlbumKey"
          mode="vertical"
          class="album-menu"
          @select="handleMenuSelect"
        >
          <el-sub-menu
            v-for="category in menuList"
            :key="category.classId"
            :index="String(category.classId)"
          >
            <template #title>
              <span class="category-title">
                {{ category.className }} ({{ category.albums.length }})
              </span>
            </template>
            <el-menu-item
              v-for="album in category.albums"
              :key="album.id"
              :index="`${category.classId}-${album.id}`"
              class="album-item"
              :class="{
                'is-downloading': isAlbumDownloading(album.id),
                'is-fetching': isAlbumFetching(album.id)
              }"
              @click="selectAlbumItem(category.classId, album)"
            >
              <div class="album-content">
                <!-- 下载状态指示器 -->
                <div
                  v-if="isAlbumDownloading(album.id) || isAlbumFetching(album.id)"
                  class="download-indicator"
                >
                  <el-icon class="is-loading"><Loading /></el-icon>
                </div>
                <div class="album-info">
                  <span v-if="getViewtypeText(album.viewtype)" class="viewtype-badge">
                    {{ getViewtypeText(album.viewtype) }}
                  </span>
                  <span class="album-text">{{ album.name }}</span>
                </div>
                <span class="album-num">
                  <span v-if="getAlbumStatusText(album.id)" class="download-progress">
                    {{ getAlbumStatusText(album.id) }}
                  </span>
                  <span v-else>{{ album.total }}</span>
                </span>
              </div>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>

        <!-- 照片模块 -->
        <el-menu
          v-else-if="currentModule === 'photo'"
          :default-active="selectedPhotoType"
          mode="vertical"
          class="photo-menu"
          @select="handlePhotoTypeSelect"
        >
          <el-menu-item index="my-photos">
            <el-icon><User /></el-icon>
            <span>我的照片</span>
          </el-menu-item>
          <!-- <el-menu-item index="friend-photos">
            <el-icon><UserFilled /></el-icon>
            <span>好友照片</span>
          </el-menu-item> -->
        </el-menu>

        <!-- 视频模块统计信息 -->
        <div v-else-if="currentModule === 'video'" class="video-stats-section">
          <div class="stats-card">
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">总视频数</div>
                <div class="stat-value">{{ videoStats.total || 0 }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">已加载</div>
                <div class="stat-value loaded">{{ videoStats.loaded || 0 }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 切换到智能相册按钮 - 底部 AI/科技感风格 -->
    <div v-if="viewMode === 'album'" class="switch-to-ai-section">
      <button class="switch-to-ai-btn" @click="handleSwitchMode">
        <div class="ai-btn-bg"></div>
        <div class="ai-btn-content">
          <div class="ai-icon-wrapper">
            <el-icon class="magic-icon"><MagicStick /></el-icon>
            <div class="icon-glow"></div>
          </div>
          <span class="ai-btn-text">切换到智能相册</span>
        </div>
        <div class="ai-btn-particles">
          <span v-for="i in 6" :key="i" class="particle"></span>
        </div>
      </button>
    </div>

    <!-- 下载管理器弹窗 -->
    <DownloadManager v-model="downloadProgressVisible" />

    <!-- 上传管理器弹窗 -->
    <UploadManager v-model="uploadProgressVisible" />
  </div>
</template>

<script setup>
import { onBeforeMount, ref, computed, nextTick, onBeforeUnmount, inject, watch } from 'vue'

import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import {
  Download,
  Upload,
  SwitchButton,
  Monitor,
  FolderAdd,
  Close,
  Loading,
  Folder,
  Picture,
  User,
  VideoPlay,
  MagicStick
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'
import UploadManager from '@renderer/components/UploadManager/index.vue'
import { generateUniqueAlbumName } from '@renderer/utils'
import { QZONE_CONFIG } from '@shared/const'
import { formatBytes } from '@renderer/utils/formatters'

const handleMenuSelect = (index) => {
  // 菜单选择处理由 selectAlbumItem 函数处理
  console.log('Menu selected:', index)
}

// 处理模块切换
const handleModuleSelect = (module) => {
  if (currentModule.value === module) return

  currentModule.value = module
  emit('module-changed', module)

  // 当切换回相册模块时，如果有选中的相册，重新触发选择事件以确保刷新
  if (module === 'album' && clickItem.value) {
    // 延迟一下，确保 Main 组件已经挂载
    setTimeout(() => {
      selectAlbum(clickItem.value)
    }, 200)
  }
}

// 处理照片类型选择
const handlePhotoTypeSelect = (type) => {
  selectedPhotoType.value = type
  emit('module-changed', 'photo', type)
}

const selectAlbumItem = (categoryId, album) => {
  // 立即更新选中状态，避免延迟
  selectedAlbumKey.value = `${categoryId}-${album.id}`
  // 同步调用选择函数
  selectAlbum(album)
}

const emit = defineEmits(['album-selected', 'module-changed', 'mode-switch'])

const userStore = useUserStore()
const downloadStore = useDownloadStore()
const refreshAlbumCallback = inject('refreshAlbumCallback', null)
const loading = ref(false)

// 当前模块状态
const currentModule = ref('album') // album, photo, video

// 当前视图模式
const viewMode = ref('album') // 'album' | 'ai'

// 处理模式切换
const handleSwitchMode = () => {
  const newMode = viewMode.value === 'album' ? 'ai' : 'album'
  viewMode.value = newMode
  emit('mode-switch', newMode)
}
const selectedPhotoType = ref('my-photos')

// 视频统计信息
const videoStats = ref({
  total: 0,
  loaded: 0
})

// TAB 配置
const tabs = [
  { key: 'album', label: '相册', icon: Folder },
  { key: 'photo', label: '照片', icon: Picture },
  { key: 'video', label: '视频', icon: VideoPlay }
]

// QQ号脱敏显示
const showUin = ref(false) // 默认脱敏

// 脱敏QQ号
const maskUin = (uin) => {
  if (!uin) return ''
  const uinStr = String(uin)
  if (uinStr.length <= 6) {
    // 如果QQ号长度小于等于6位，只显示前2位和后2位
    return uinStr.length <= 4
      ? '*'.repeat(uinStr.length)
      : `${uinStr.slice(0, 2)}${'*'.repeat(uinStr.length - 4)}${uinStr.slice(-2)}`
  } else {
    // 显示前3位和后3位，中间用*代替
    return `${uinStr.slice(0, 3)}${'*'.repeat(uinStr.length - 6)}${uinStr.slice(-3)}`
  }
}

// 计算显示的QQ号
const displayUin = computed(() => {
  const uin = userStore.userInfo?.uin
  if (!uin) return ''
  return showUin.value ? uin : maskUin(uin)
})

// 切换QQ号显示状态
const toggleUinDisplay = () => {
  showUin.value = !showUin.value
}

// 相册刷新防抖
let refreshDebounceTimer = null
const pendingRefreshAlbums = new Set() // 待刷新的相册ID集合

// 下载全部相册状态管理
const isDownloadingAll = ref(false)
const isCancelling = ref(false)
const downloadCancelled = ref(false)
const downloadProgress = ref({
  visible: false,
  percentage: 0,
  text: '',
  current: 0,
  total: 0
})

// 下载按钮文案
const downloadButtonText = computed(() => {
  if (isCancelling.value) {
    return '正在取消...'
  } else if (isDownloadingAll.value) {
    return '取消下载'
  } else {
    return '一键下载全部相册'
  }
})

// 下载进度弹窗
const downloadProgressVisible = ref(false)

// 计算相册是否正在下载
const isAlbumDownloading = computed(() => {
  return (albumId) => downloadStore.isAlbumDownloading(albumId)
})

// 计算相册是否正在获取照片
const isAlbumFetching = computed(() => {
  return (albumId) => downloadStore.isAlbumFetching(albumId)
})

// 获取相册状态显示文本
const getAlbumStatusText = computed(() => {
  return (albumId) => {
    const state = downloadStore.getAlbumDownloadState(albumId)

    // 获取阶段也显示百分比
    if (state.status === 'fetching' && state.totalPhotos > 0) {
      return `${state.progress || 0}%`
    }

    // 下载阶段显示下载进度百分比
    if (state.status === 'downloading' && state.isDownloading && state.totalCount > 0) {
      return `${state.progress || 0}%`
    }

    // 默认显示相册总数
    return null
  }
})

// 下载状态管理
const activeTaskCount = ref(0)
const detailedStatus = ref({
  downloading: 0,
  waiting: 0,
  paused: 0,
  total: 0,
  primaryStatus: 'idle'
})

// 上传状态管理
const activeUploadTaskCount = ref(0)
const uploadDetailedStatus = ref({
  uploading: 0,
  waiting: 0,
  paused: 0,
  total: 0,
  primaryStatus: 'idle'
})
const uploadProgressVisible = ref(false)

// 计算是否有活跃任务
const hasActiveTasks = computed(() => {
  return activeTaskCount.value > 0
})

// 计算状态显示文本
const statusText = computed(() => {
  const status = detailedStatus.value
  if (status.total === 0) {
    return ''
  }

  // 简化状态判断逻辑，避免频繁跳动
  const activeTasksCount = status.downloading + status.waiting // 正在进行的任务（下载中+等待中）
  const pausedTasksCount = status.paused // 暂停的任务

  if (activeTasksCount > 0) {
    // 只要有下载中或等待中的任务，就显示"进行中"
    return `${activeTasksCount} 个任务进行中`
  } else if (pausedTasksCount > 0) {
    // 只有当所有任务都是暂停状态时，才显示"暂停"
    return `暂停 ${pausedTasksCount} 个任务`
  } else {
    return ''
  }
})

// 上传相关计算属性
const hasActiveUploadTasks = computed(() => {
  return activeUploadTaskCount.value > 0
})

const uploadStatusText = computed(() => {
  const status = uploadDetailedStatus.value
  if (status.total === 0) {
    return ''
  }

  const activeTasksCount = status.uploading + status.waiting
  const pausedTasksCount = status.paused

  if (activeTasksCount > 0) {
    return `${activeTasksCount} 个任务进行中`
  } else if (pausedTasksCount > 0) {
    return `暂停 ${pausedTasksCount} 个任务`
  } else {
    return ''
  }
})

// 显示下载进度
const showDownloadProgress = () => {
  downloadProgressVisible.value = true
}

// 显示上传管理器
const showUploadProgress = () => {
  uploadProgressVisible.value = true
}

// 获取相册类型文本
const getViewtypeText = (viewtype) => {
  if (!viewtype || viewtype === 0) return ''
  return QZONE_CONFIG.viewtypeMap[viewtype] || ''
}

// 切换下载全部相册状态
const toggleDownloadAll = async () => {
  if (isDownloadingAll.value) {
    // 如果正在下载，则取消
    await cancelDownloadAll()
  } else {
    // 如果未在下载，则开始下载
    await startDownloadAll()
  }
}

// 开始下载全部相册
const startDownloadAll = async () => {
  let albumsToDownload = [] // 移到函数开始位置

  try {
    if (!menuList.value || menuList.value.length === 0) {
      ElMessage.warning('没有找到相册数据，请刷新页面重试')
      return
    }

    // 统计总相册数和需要下载的相册数
    const allAlbums = []
    menuList.value.forEach((category) => {
      if (category.albums) {
        category.albums.forEach((album) => {
          allAlbums.push({ ...album, categoryId: category.classId })
        })
      }
    })

    // 过滤掉正在下载的相册
    albumsToDownload = allAlbums.filter(
      (album) =>
        !downloadStore.isAlbumDownloading(album.id) && !downloadStore.isAlbumFetching(album.id)
    )

    const skipCount = allAlbums.length - albumsToDownload.length

    if (albumsToDownload.length === 0) {
      ElMessage.warning(`所有相册都在下载中，无需重复下载`)
      return
    }

    // 重置状态
    downloadCancelled.value = false
    isDownloadingAll.value = true
    downloadProgress.value = {
      visible: true,
      percentage: 0,
      text: `准备下载 ${albumsToDownload.length} 个相册${skipCount > 0 ? `（跳过 ${skipCount} 个正在下载的相册）` : ''}...`,
      current: 0,
      total: albumsToDownload.length
    }

    let successCount = 0
    let failCount = 0

    ElMessage.info(
      `开始批量下载 ${albumsToDownload.length} 个相册${skipCount > 0 ? `，跳过 ${skipCount} 个正在下载的相册` : ''}`
    )

    // 遍历需要下载的相册
    for (const album of albumsToDownload) {
      if (downloadCancelled.value) break

      try {
        // 检查全局取消标志 - 如果当前相册被单独取消，跳过该相册
        if (downloadStore.isGloballyCancelled(album.id)) {
          console.log(`⚠️ 相册 ${album.name} 被用户取消，跳过处理`)
          break
        }

        // 更新进度
        downloadProgress.value.current = successCount + failCount + 1
        downloadProgress.value.percentage = Math.round(
          (downloadProgress.value.current / albumsToDownload.length) * 100
        )
        downloadProgress.value.text = `正在处理: ${album.name} (${downloadProgress.value.current}/${albumsToDownload.length})`

        // 标记为正在获取照片，设置预计总数
        downloadStore.startAlbumFetch(album.id, album.total || 0)

        // 流式获取照片并添加到下载队列
        let addedPhotosCount = 0
        const batchSize = 100
        let pageStart = 0

        while (!downloadCancelled.value) {
          try {
            // 检查全局取消标志 - 如果当前相册被单独取消，跳过该相册
            if (downloadStore.isGloballyCancelled(album.id)) {
              console.log(`⚠️ 相册 ${album.name} 被用户取消，跳过处理`)
              break
            }

            const albumDetail = await window.QzoneAPI.getPhotoByTopicId({
              hostUin: userStore.userInfo.uin,
              topicId: album.id,
              pageStart: pageStart,
              pageNum: batchSize
            })

            if (!albumDetail?.data?.photoList || albumDetail.data.photoList.length === 0) {
              break
            }

            // 再次检查取消状态
            if (downloadCancelled.value || downloadStore.isGloballyCancelled(album.id)) {
              break
            }

            // 立即添加这批照片到下载队列
            const albumData = {
              album: {
                id: album.id,
                name: generateUniqueAlbumName(album),
                total: album.total,
                desc: album.desc
              },
              photos: albumDetail.data.photoList,
              uin: userStore.userInfo?.uin || 'unknown',
              albumId: album.id
            }

            await window.QzoneAPI.download.addAlbum(albumData)
            addedPhotosCount += albumDetail.data.photoList.length

            // 更新获取进度
            downloadStore.updateFetchProgress(album.id, addedPhotosCount)

            // 如果返回的照片数量少于batchSize，说明已获取完成
            if (albumDetail.data.photoList.length < batchSize) {
              break
            }

            pageStart += batchSize
            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            console.error('获取相册照片批次失败:', error)
            break
          }
        }

        // 获取完成，清理获取标记
        downloadStore.setAlbumFetching(album.id, false)

        if (downloadCancelled.value) break

        // 检查是否被单独取消
        if (downloadStore.isGloballyCancelled(album.id)) {
          console.log(`⚠️ 相册 ${album.name} 被用户单独取消`)
          downloadStore.clearGlobalCancelFlag(album.id)
          // 不计入失败，继续处理下一个相册
          continue
        }

        if (addedPhotosCount > 0) {
          // 重置状态，让任务系统接管
          downloadStore.resetAlbumState(album.id)
          successCount++
          console.log(`✅ 成功添加相册: ${album.name} (${addedPhotosCount}张照片)`)
        } else {
          console.warn(`⚠️  相册 ${album.name} 没有照片`)
          downloadStore.resetAlbumState(album.id)
        }

        // 清理该相册的全局取消标志
        downloadStore.clearGlobalCancelFlag(album.id)

        // 添加延迟，避免请求过于频繁
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        if (downloadCancelled.value) break
        console.error(`❌ 下载相册 ${album.name} 失败:`, error)
        downloadStore.resetAlbumState(album.id)
        downloadStore.errorAlbumDownload(album.id, error.message)
        // 清理该相册的全局取消标志
        downloadStore.clearGlobalCancelFlag(album.id)
        failCount++
      }
    }

    // 完成处理
    if (downloadCancelled.value) {
      // 清理所有正在获取的相册状态
      downloadStore.cancelAllFetching()
      ElMessage.warning(`下载已取消，已成功添加 ${successCount} 个相册`)
    } else {
      if (successCount > 0) {
        ElMessage.success(
          `🎉 批量下载完成！成功添加 ${successCount} 个相册到下载队列${failCount > 0 ? `，失败 ${failCount} 个` : ''}${skipCount > 0 ? `，跳过 ${skipCount} 个正在下载的相册` : ''}`
        )
        // 显示下载管理器
        downloadProgressVisible.value = true
      } else {
        ElMessage.error('没有成功添加任何相册，请检查网络连接')
      }
    }
  } catch (error) {
    console.error('批量下载失败:', error)
    ElMessage.error('批量下载失败，请重试')
    // 清理所有正在获取的相册状态
    downloadStore.cancelAllFetching()
  } finally {
    // 重置状态
    isDownloadingAll.value = false
    isCancelling.value = false
    downloadCancelled.value = false

    // 清理所有全局取消标志
    albumsToDownload.forEach((album) => {
      downloadStore.clearGlobalCancelFlag(album.id)
    })

    setTimeout(() => {
      downloadProgress.value.visible = false
    }, 2000)
  }
}

// 取消下载全部相册
const cancelDownloadAll = async () => {
  isCancelling.value = true
  downloadCancelled.value = true
  downloadProgress.value.text = '正在取消下载...'

  ElMessage.info('正在取消批量下载...')

  // 清理所有正在获取的相册状态
  downloadStore.cancelAllFetching()

  // 等待当前操作完成
  setTimeout(() => {
    isCancelling.value = false
    isDownloadingAll.value = false
    downloadProgress.value.visible = false
    downloadCancelled.value = false
  }, 1000)
}

const formatSpeed = (speed) => {
  if (speed > 0) {
    return `+${speed}/天`
  } else if (speed < 0) {
    return `${speed}/天`
  }
  return '0/天'
}

/**
 * 格式化存储空间显示
 * @returns {string} 格式化的存储空间字符串
 */
const formatStorage = () => {
  if (!apiData.value?.user?.diskused) {
    return '--'
  }

  // diskused 单位是 MB，需要转换为字节
  const bytes = apiData.value.user.diskused * 1024 * 1024
  return formatBytes(bytes)
}

const total = ref(0)
const pageSize = ref(15)
const clickItem = ref({})
const apiData = ref()
const selectedAlbumKey = ref('')
const openedKeys = ref(new Set())
// 当前相册ID，用于上传任务过滤
const currentAlbumId = ref(null)

const menuList = computed(() => {
  if (!apiData.value || !apiData.value.classList) {
    return []
  }

  const classMap = {}
  apiData.value.classList.forEach((cls) => {
    classMap[cls.id] = cls.name
  })

  // 支持两种格式：albumListModeClass（分类格式）和 albumListModeSort（平铺格式）
  if (apiData.value.albumListModeClass && Array.isArray(apiData.value.albumListModeClass)) {
    // 格式1：分类格式
    return apiData.value.albumListModeClass.map((category) => ({
      classId: category.classId,
      className: classMap[category.classId] || category.className || '其他',
      albums: category.albumList || []
    }))
  } else if (apiData.value.albumListModeSort && Array.isArray(apiData.value.albumListModeSort)) {
    // 格式2：平铺格式，需要转换为分类格式
    const categoryMap = new Map()

    apiData.value.albumListModeSort.forEach((album) => {
      const classId = album.classid
      if (!categoryMap.has(classId)) {
        categoryMap.set(classId, {
          classId: classId,
          className: classMap[classId] || '其他',
          albums: []
        })
      }
      categoryMap.get(classId).albums.push(album)
    })

    return Array.from(categoryMap.values())
  }

  return []
})

const selectAlbum = (album) => {
  clickItem.value = album
  // 更新当前相册ID（用于 UploadDialog 的相册隔离）
  const newAlbumId = album?.id || null
  currentAlbumId.value = newAlbumId
  emit('album-selected', album)
}

// 通过 albumId 选择相册（用于从动态跳转）
const selectAlbumById = (albumId) => {
  if (!albumId || !menuList.value) return false

  // 遍历所有分类和相册，查找匹配的相册
  for (const category of menuList.value) {
    if (category.albums && Array.isArray(category.albums)) {
      const album = category.albums.find((a) => a.id === albumId)
      if (album) {
        // 确保该分类是展开的
        openedKeys.value.add(String(category.classId))
        // 选择相册
        selectAlbumItem(category.classId, album)
        return true
      }
    }
  }

  return false
}

// 通过 albumId 查找相册对象（不选择，仅返回）
const findAlbumById = async (albumId) => {
  if (!albumId || !menuList.value) return null

  // 遍历所有分类和相册，查找匹配的相册
  for (const category of menuList.value) {
    if (category.albums && Array.isArray(category.albums)) {
      const album = category.albums.find((a) => a.id === albumId)
      if (album) {
        return album
      }
    }
  }

  return null
}

const fetchPhotoData = async () => {
  loading.value = true
  let allAlbumsData = []

  try {
    // 获取初始数据
    const initialRes = await window.QzoneAPI.getPhotoList({
      hostUin: userStore.userInfo.uin,
      pageStart: 0,
      pageNum: pageSize.value
    })
    console.log('[Left] 初始相册列表数据:', JSON.parse(JSON.stringify(initialRes)))

    if (!initialRes || !initialRes.data) {
      console.error('[Left] 获取相册数据失败')
      return
    }

    // 初始化数据
    apiData.value = initialRes.data
    total.value = initialRes.data.albumsInUser || 0

    // 支持两种格式：albumListModeClass（分类格式）和 albumListModeSort（平铺格式）
    if (initialRes.data.albumListModeClass && Array.isArray(initialRes.data.albumListModeClass)) {
      // 格式1：分类格式
      allAlbumsData = JSON.parse(JSON.stringify(initialRes.data.albumListModeClass))

      // 从 classList 映射分类名称
      if (initialRes.data.classList && Array.isArray(initialRes.data.classList)) {
        const classNameMap = {}
        initialRes.data.classList.forEach((cls) => {
          classNameMap[cls.id] = cls.name
        })
        allAlbumsData.forEach((category) => {
          if (!category.className && classNameMap[category.classId]) {
            category.className = classNameMap[category.classId]
          }
        })
      }

      console.log(`[Left] 初始加载完成（分类格式）: ${allAlbumsData.length} 个分类`)

      // 按分类逐个加载剩余数据
      for (let i = 0; i < allAlbumsData.length; i++) {
        const category = allAlbumsData[i]
        const totalInClass = category.totalInClass || 0
        const categoryName = category.className || category.name || `分类${category.classId}`

        // 如果该分类还有更多数据，逐页加载
        if ((category.albumList?.length || 0) < totalInClass) {
          console.log(
            `[Left] 加载分类 ${categoryName}: ${category.albumList?.length || 0}/${totalInClass}`
          )
        }

        while ((category.albumList?.length || 0) < totalInClass) {
          const currentLoaded = category.albumList?.length || 0
          const nextPageStart = category.nextPageStart || currentLoaded

          try {
            const categoryRes = await window.QzoneAPI.getPhotoList({
              hostUin: userStore.userInfo.uin,
              pageStart: nextPageStart,
              pageNum: pageSize.value,
              mode: 4,
              classId: category.classId
            })

            if (!categoryRes || !categoryRes.data) {
              console.warn(`[Left] 分类 ${categoryName} 加载失败`)
              break
            }

            // 提取相册列表
            const newAlbums = categoryRes.data.albumList || []
            if (newAlbums.length === 0) break

            // 去重并合并
            const existingIds = new Set(category.albumList.map((album) => album.id))
            const uniqueNewAlbums = newAlbums.filter((album) => !existingIds.has(album.id))

            if (uniqueNewAlbums.length > 0) {
              category.albumList.push(...uniqueNewAlbums)
            }

            // 更新分页信息
            if (categoryRes.data.nextPageStart !== undefined) {
              category.nextPageStart = categoryRes.data.nextPageStart
            }
            if (categoryRes.data.totalInClass !== undefined) {
              category.totalInClass = categoryRes.data.totalInClass
            }

            // 如果没有新增数据或已加载完毕，退出循环
            if (
              category.albumList.length >= category.totalInClass ||
              uniqueNewAlbums.length === 0
            ) {
              break
            }

            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            console.error(`[Left] 加载分类 ${categoryName} 失败:`, error)
            break
          }
        }
      }
    } else if (
      initialRes.data.albumListModeSort &&
      Array.isArray(initialRes.data.albumListModeSort)
    ) {
      // 格式2：平铺格式，需要转换为分类格式并分页加载
      const classNameMap = {}
      if (initialRes.data.classList && Array.isArray(initialRes.data.classList)) {
        initialRes.data.classList.forEach((cls) => {
          classNameMap[cls.id] = cls.name
        })
      }

      // 将平铺的相册按分类分组
      const categoryMap = new Map()
      initialRes.data.albumListModeSort.forEach((album) => {
        const classId = album.classid
        if (!categoryMap.has(classId)) {
          categoryMap.set(classId, {
            classId: classId,
            className: classNameMap[classId] || '其他',
            albumList: [],
            totalInClass: 0,
            nextPageStart: 0
          })
        }
        categoryMap.get(classId).albumList.push(album)
      })

      allAlbumsData = Array.from(categoryMap.values())
      console.log(`[Left] 初始加载完成（平铺格式）: ${allAlbumsData.length} 个分类`)

      // 平铺格式需要继续分页加载
      let pageStart =
        initialRes.data.nextPageStartModeSort || initialRes.data.albumListModeSort.length
      const totalAlbums = initialRes.data.albumsInUser || 0

      while (pageStart < totalAlbums && pageStart > 0) {
        try {
          const nextRes = await window.QzoneAPI.getPhotoList({
            hostUin: userStore.userInfo.uin,
            pageStart: pageStart,
            pageNum: pageSize.value,
            mode: 2 // normal模式
          })

          if (!nextRes || !nextRes.data || !nextRes.data.albumListModeSort) {
            break
          }

          // 将新相册分配到对应分类
          nextRes.data.albumListModeSort.forEach((album) => {
            const classId = album.classid
            let category = categoryMap.get(classId)
            if (!category) {
              category = {
                classId: classId,
                className: classNameMap[classId] || '其他',
                albumList: [],
                totalInClass: 0,
                nextPageStart: 0
              }
              categoryMap.set(classId, category)
              allAlbumsData.push(category)
            }

            // 去重
            const existingIds = new Set(category.albumList.map((a) => a.id))
            if (!existingIds.has(album.id)) {
              category.albumList.push(album)
            }
          })

          // 更新分页
          pageStart = nextRes.data.nextPageStartModeSort || 0
          if (pageStart === 0 || pageStart <= initialRes.data.albumListModeSort.length) {
            break
          }

          await new Promise((resolve) => setTimeout(resolve, 100))
        } catch (error) {
          console.error('[Left] 加载平铺格式数据失败:', error)
          break
        }
      }
    } else {
      console.error('[Left] 未找到有效的相册数据格式')
      return
    }

    // 更新最终数据
    apiData.value.albumListModeClass = allAlbumsData

    // 统计总相册数
    const totalAlbums = allAlbumsData.reduce((sum, cat) => sum + (cat.albumList?.length || 0), 0)
    console.log(`[Left] 所有相册加载完成，总计 ${totalAlbums} 个相册`)

    // 设置默认选中的相册
    nextTick(() => {
      if (apiData.value && apiData.value.albumListModeClass) {
        const firstCategory = apiData.value.albumListModeClass[0]
        if (firstCategory && firstCategory.albumList && firstCategory.albumList.length > 0) {
          const firstAlbum = firstCategory.albumList[0]
          if (firstAlbum) {
            selectedAlbumKey.value = `${firstCategory.classId}-${firstAlbum.id}`
            selectAlbum(firstAlbum)
          }
        }
      }
    })
  } catch (error) {
    console.error('[Left] 加载相册数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 初始化下载任务状态
const initDownloadTasks = async () => {
  try {
    await downloadStore.loadTasks()
    // 加载下载统计
    await loadDownloadStats()
  } catch (error) {
    console.error('初始化下载任务状态失败:', error)
  }
}

// 加载下载统计
const loadDownloadStats = async () => {
  try {
    const stats = await window.QzoneAPI.download.getStats()
    activeTaskCount.value = stats.downloading + stats.waiting + stats.paused
    detailedStatus.value = {
      downloading: stats.downloading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: stats.downloading + stats.waiting + stats.paused,
      primaryStatus:
        stats.downloading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
  } catch (error) {
    console.error('加载下载统计失败:', error)
  }
}

// 下载监听器清理函数
const downloadListenerCleanups = []

// 设置下载状态监听器
const setupDownloadListeners = () => {
  // 监听活跃任务数量更新（主要监听器）
  const cleanup1 = window.QzoneAPI.download.onActiveCountUpdate((count) => {
    activeTaskCount.value = count
  })

  // 监听详细状态更新（新增，用于状态文本显示）
  const cleanup2 = window.QzoneAPI.download.onDetailedStatusUpdate((status) => {
    detailedStatus.value = status
    // 同步更新活跃任务数量
    activeTaskCount.value = status.total
  })

  // 监听统计信息更新（备用）
  const cleanup3 = window.QzoneAPI.download.onStatsUpdate((stats) => {
    activeTaskCount.value = stats.downloading + stats.waiting + stats.paused
    detailedStatus.value = {
      downloading: stats.downloading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: stats.downloading + stats.waiting + stats.paused,
      primaryStatus:
        stats.downloading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
  })

  downloadListenerCleanups.push(cleanup1, cleanup2, cleanup3)
}

// 清理下载监听器
const cleanupDownloadListeners = () => {
  try {
    downloadListenerCleanups.forEach((cleanup) => cleanup())
    downloadListenerCleanups.length = 0
  } catch (error) {
    console.error('清理下载监听器失败:', error)
  }
}

// 初始化上传任务状态
const initUploadTasks = async () => {
  try {
    // 加载上传统计
    await loadUploadStats()
  } catch (error) {
    console.error('初始化上传任务状态失败:', error)
  }
}

// 加载上传统计（全局统计，不按相册过滤）
const loadUploadStats = async () => {
  try {
    console.log('[Left] 正在加载全局上传统计...')
    const stats = await window.QzoneAPI.upload.getStats()
    console.log('[Left] 获取到上传统计:', stats)

    const activeCount = stats.uploading + stats.waiting + stats.paused
    activeUploadTaskCount.value = activeCount

    const detailedStatus = {
      uploading: stats.uploading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: activeCount,
      primaryStatus:
        stats.uploading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
    uploadDetailedStatus.value = detailedStatus

    console.log(
      '[Left] 设置后的状态 - activeCount:',
      activeCount,
      'detailedStatus:',
      detailedStatus
    )
    console.log('[Left] hasActiveUploadTasks:', hasActiveUploadTasks.value)
    console.log('[Left] uploadStatusText:', uploadStatusText.value)
  } catch (error) {
    console.error('[Left] 加载上传统计失败:', error)
  }
}

// 上传监听器清理函数
const uploadListenerCleanups = []

// 防抖刷新相册
const debouncedRefreshAlbum = () => {
  // 清除之前的定时器
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer)
  }

  // 设置新的定时器：2秒后执行刷新
  refreshDebounceTimer = setTimeout(() => {
    if (pendingRefreshAlbums.size > 0 && refreshAlbumCallback) {
      // 检查是否需要刷新当前相册
      const currentAlbumId = clickItem.value?.id
      if (currentAlbumId && pendingRefreshAlbums.has(currentAlbumId)) {
        console.log(`[Left] 刷新相册: ${clickItem.value.name}`)
        refreshAlbumCallback()
      }
      // 清空待刷新列表
      pendingRefreshAlbums.clear()
    }
    refreshDebounceTimer = null
  }, 2000) // 2秒防抖
}

// 设置上传状态监听器
const setupUploadListeners = () => {
  // 监听活跃任务数量更新（主要监听器）
  const cleanup1 = window.QzoneAPI.upload.onActiveCountUpdate((count) => {
    activeUploadTaskCount.value = count
  })

  // 监听详细状态更新（主要用于状态文本显示）
  const cleanup2 = window.QzoneAPI.upload.onDetailedStatusUpdate((status) => {
    uploadDetailedStatus.value = status
    // 同步更新活跃任务数量
    activeUploadTaskCount.value = status.total
  })

  // 监听统计信息更新（备用）
  const cleanup3 = window.QzoneAPI.upload.onStatsUpdate((stats) => {
    activeUploadTaskCount.value = stats.uploading + stats.waiting + stats.paused
    uploadDetailedStatus.value = {
      uploading: stats.uploading,
      waiting: stats.waiting,
      paused: stats.paused,
      total: stats.uploading + stats.waiting + stats.paused,
      primaryStatus:
        stats.uploading + stats.waiting > 0 ? 'active' : stats.paused > 0 ? 'paused' : 'idle'
    }
  })

  // 监听任务变化（用于检测任务完成）
  const cleanup4 = window.QzoneAPI.upload.onTaskChanges((changedTasks) => {
    if (!Array.isArray(changedTasks)) return

    // 检查是否有任务完成
    const completedTasks = changedTasks.filter((task) => task.status === 'completed')
    if (completedTasks.length > 0) {
      // 收集需要刷新的相册ID
      completedTasks.forEach((task) => {
        if (task.albumId) {
          pendingRefreshAlbums.add(task.albumId)
        }
      })

      // 触发防抖刷新
      debouncedRefreshAlbum()
    }
  })

  uploadListenerCleanups.push(cleanup1, cleanup2, cleanup3, cleanup4)
}

// 清理上传监听器
const cleanupUploadListeners = () => {
  try {
    uploadListenerCleanups.forEach((cleanup) => cleanup())
    uploadListenerCleanups.length = 0

    // 清理防抖定时器
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer)
      refreshDebounceTimer = null
    }
    pendingRefreshAlbums.clear()
  } catch (error) {
    console.error('清理上传监听器失败:', error)
  }
}

// 打开 QQ 空间官网
const openQzoneWeb = async () => {
  try {
    await window.api.invoke('window:openQzoneWeb', {
      uin: userStore.Uin,
      p_skey: userStore.PSkey
    })
  } catch (error) {
    console.error('打开官网失败:', error)
    ElMessage.error('打开官网失败')
  }
}

// 确认登出
const confirmLogout = async () => {
  // 登出并清除用户信息
  try {
    await userStore.logout()
    ElMessage.success('已成功登出')
  } catch (error) {
    console.error('登出失败:', error)
    ElMessage.error('登出失败')
  }
}

// 监听全局上传管理器关闭，刷新当前相册
watch(uploadProgressVisible, (newVal, oldVal) => {
  // 当上传管理器从显示变为隐藏时，刷新当前相册
  if (oldVal === true && newVal === false && refreshAlbumCallback) {
    refreshAlbumCallback()
  }
})

onBeforeMount(() => {
  fetchPhotoData()
  initDownloadTasks()
  setupDownloadListeners()
  initUploadTasks()
  setupUploadListeners()
})

onBeforeUnmount(() => {
  cleanupDownloadListeners()
  cleanupUploadListeners()
})

// 更新视频统计信息
const updateVideoStats = (stats) => {
  if (stats) {
    videoStats.value = {
      total: stats.total || 0,
      loaded: stats.loaded || 0
    }
  }
}

// 暴露方法供父组件调用
defineExpose({
  selectAlbumById,
  findAlbumById,
  updateVideoStats
})
</script>

<style scoped>
/* 用户信息卡片 */
.user-section {
  padding: 6px 8px;
  padding-top: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .user-card {
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.02);

      .user-avatar {
        border: 2px solid rgba(96, 165, 250, 0.3);
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
        transition: all 0.3s ease;

        &:hover {
          border-color: rgba(96, 165, 250, 0.5);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
      }

      .user-info {
        flex: 1;
        min-width: 0;

        .nickname {
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.2;
          margin-bottom: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .uin {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.1;
          cursor: pointer;
          user-select: none;
          transition: color 0.2s ease;

          &:hover {
            color: rgba(255, 255, 255, 0.8);
          }
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;

        .open-web-btn {
          color: rgba(64, 158, 255, 0.8);
          font-size: 16px;
          padding: 4px;
          min-width: unset;
          width: 28px;
          height: 28px;

          &:hover {
            color: #409eff;
            background: rgba(64, 158, 255, 0.1);
          }
        }

        .header-logout {
          color: rgba(245, 108, 108, 0.8);
          font-size: 16px;
          padding: 4px;
          min-width: unset;
          width: 28px;
          height: 28px;
          margin-left: 0px !important;

          &:hover {
            color: #f56c6c;
            background: rgba(245, 108, 108, 0.1);
          }
        }
      }
    }

    .card-stats {
      padding: 8px 10px;

      .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 10px;

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;

          .label {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            line-height: 1;
            margin-bottom: 3px;
            font-weight: 500;
          }

          .value {
            font-size: 10px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
            line-height: 1.1;

            &.level {
              color: #fbbf24;
              text-shadow: 0 0 3px rgba(251, 191, 36, 0.3);
            }

            &.growth {
              color: #10b981;
              text-shadow: 0 0 3px rgba(16, 185, 129, 0.3);
            }

            &.speed {
              color: #f59e0b;
              text-shadow: 0 0 3px rgba(245, 158, 11, 0.3);
            }

            &.storage {
              color: #06b6d4;
              text-shadow: 0 0 3px rgba(6, 182, 212, 0.3);
            }
          }
        }
      }
    }

    .card-actions {
      display: flex;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(0, 0, 0, 0.1);

      .action-item {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;

        .action-btn {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
          border: none;
          background: none;
          padding: 6px 12px;
          transition: all 0.2s ease;
          width: 100%;
          justify-content: center;
          min-height: 32px;

          &:hover {
            color: rgba(255, 255, 255, 1);
            background: rgba(255, 255, 255, 0.1);
          }

          &.logout-btn {
            color: rgba(245, 108, 108, 0.9);

            &:hover {
              color: #f56c6c;
              background: rgba(245, 108, 108, 0.1);
            }
          }

          &.download-btn {
            position: relative;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;

            .download-btn-content {
              display: flex;
              align-items: center;
              gap: 6px;
              width: 100%;

              .icon-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 12px;
                height: 12px;

                .active-indicator {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);

                  .pulse-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 16px;
                    height: 16px;
                    border: 1px solid rgba(64, 158, 255, 0.4);
                    border-radius: 50%;
                    animation: pulse-ring 2s ease-out infinite;
                  }

                  .pulse-dot {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 4px;
                    height: 4px;
                    background: #409eff;
                    border-radius: 50%;
                    animation: pulse-dot 2s ease-out infinite;
                  }
                }
              }

              .text-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                min-width: 0;

                .main-text {
                  font-size: 11px;
                  line-height: 1.2;
                  color: inherit;
                  font-weight: inherit;
                }

                .status-text {
                  font-size: 9px;
                  line-height: 1.1;
                  margin-top: 1px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                  color: rgba(64, 158, 255, 0.8);
                }
              }
            }

            &.has-active-tasks {
              .icon-wrapper {
                .el-icon {
                  color: #409eff;
                }
              }

              .main-text {
                color: #409eff;
              }
            }

            .downloading-icon {
              display: flex;
              align-items: center;
              justify-content: center;

              .loading-icon {
                color: #409eff;
                animation: loading-spin 1s linear infinite;
              }
            }
          }

          :deep(.el-icon) {
            font-size: 12px;
            margin-right: 4px;
          }
        }
      }

      .action-divider {
        width: 1px;
        height: 24px;
        background: rgba(255, 255, 255, 0.15);
        margin: 1px;
      }

      /* 管理器并排布局样式 */
      &.managers-layout {
        padding: 0;

        .manager-item {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;

          &:not(:last-child) {
            border-right: 1px solid rgba(255, 255, 255, 0.1);
          }

          .manager-btn {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.8);
            border: none;
            background: none;
            padding: 6px 8px;
            transition: all 0.2s ease;
            width: 100%;
            justify-content: center;
            min-height: 36px;

            &:hover {
              color: rgba(255, 255, 255, 1);
              background: rgba(255, 255, 255, 0.1);
            }

            .manager-btn-content {
              display: flex;
              align-items: center;
              gap: 6px;
              width: 100%;

              .icon-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 12px;
                height: 12px;

                .active-indicator {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);

                  .pulse-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 16px;
                    height: 16px;
                    border: 1px solid rgba(64, 158, 255, 0.4);
                    border-radius: 50%;
                    animation: pulse-ring 2s ease-out infinite;
                  }

                  .pulse-dot {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 4px;
                    height: 4px;
                    background: #409eff;
                    border-radius: 50%;
                    animation: pulse-dot 2s ease-out infinite;
                  }

                  &.upload-indicator {
                    .pulse-ring {
                      border-color: rgba(103, 194, 58, 0.4);
                    }

                    .pulse-dot {
                      background: #67c23a;
                    }
                  }
                }
              }

              .text-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                min-width: 0;

                .main-text {
                  font-size: 11px;
                  line-height: 1.2;
                  color: inherit;
                  font-weight: inherit;
                }

                .status-text {
                  font-size: 9px;
                  line-height: 1.1;
                  margin-top: 1px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                }
              }
            }

            &.has-active-tasks.download-btn {
              .icon-wrapper .el-icon {
                color: #409eff;
              }

              .main-text {
                color: #409eff;
              }

              .status-text {
                color: rgba(64, 158, 255, 0.8);
              }
            }

            &.has-active-tasks.upload-btn {
              .icon-wrapper .el-icon {
                color: #67c23a;
              }

              .main-text {
                color: #67c23a;
              }

              .status-text {
                color: rgba(103, 194, 58, 0.8);
              }
            }

            :deep(.el-icon) {
              font-size: 12px;
            }
          }
        }
      }
    }
  }
}

/* 切换到智能相册按钮 - AI/科技感风格 */
.switch-to-ai-section {
  padding: 6px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);

  .switch-to-ai-btn {
    position: relative;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    overflow: hidden;
    background: transparent;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    /* 背景渐变层 */
    .ai-btn-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        135deg,
        rgba(139, 92, 246, 0.15) 0%,
        rgba(124, 58, 237, 0.2) 50%,
        rgba(99, 102, 241, 0.15) 100%
      );
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    /* 内容层 */
    .ai-btn-content {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    /* 图标容器 */
    .ai-icon-wrapper {
      position: relative;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(124, 58, 237, 0.4));
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);

      .magic-icon {
        font-size: 14px;
        color: #a78bfa;
        filter: drop-shadow(0 0 4px rgba(167, 139, 250, 0.5));
        transition: all 0.3s ease;
      }

      .icon-glow {
        position: absolute;
        inset: -3px;
        background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%);
        border-radius: 10px;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
    }

    /* 文字 */
    .ai-btn-text {
      font-size: 12px;
      font-weight: 600;
      background: linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #818cf8 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: 0.3px;
      transition: all 0.3s ease;
    }

    /* 粒子容器 - 使用固定位置 */
    .ai-btn-particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      border-radius: 8px;

      .particle {
        position: absolute;
        width: 2px;
        height: 2px;
        background: #a78bfa;
        border-radius: 50%;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      /* 固定粒子位置 */
      .particle:nth-child(1) {
        left: 15%;
        top: 20%;
        animation-delay: 0s;
      }
      .particle:nth-child(2) {
        left: 75%;
        top: 30%;
        animation-delay: 0.15s;
      }
      .particle:nth-child(3) {
        left: 25%;
        top: 70%;
        animation-delay: 0.3s;
      }
      .particle:nth-child(4) {
        left: 85%;
        top: 60%;
        animation-delay: 0.45s;
      }
      .particle:nth-child(5) {
        left: 50%;
        top: 15%;
        animation-delay: 0.6s;
      }
      .particle:nth-child(6) {
        left: 40%;
        top: 80%;
        animation-delay: 0.75s;
      }
    }

    /* 悬停效果 */
    &:hover {
      transform: translateY(-1px);

      .ai-btn-bg {
        background: linear-gradient(
          135deg,
          rgba(139, 92, 246, 0.25) 0%,
          rgba(124, 58, 237, 0.35) 50%,
          rgba(99, 102, 241, 0.25) 100%
        );
        border-color: rgba(139, 92, 246, 0.5);
        box-shadow:
          0 4px 16px rgba(139, 92, 246, 0.25),
          0 0 20px rgba(139, 92, 246, 0.1);
      }

      .ai-icon-wrapper {
        .magic-icon {
          color: #c4b5fd;
          filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.8));
        }

        .icon-glow {
          opacity: 1;
        }
      }

      .ai-btn-text {
        background: linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 50%, #a5b4fc 100%);
        -webkit-background-clip: text;
        background-clip: text;
      }

      .ai-btn-particles .particle {
        opacity: 0.6;
        animation: particle-float 2s ease-in-out infinite;
      }
    }

    /* 点击效果 */
    &:active {
      transform: translateY(0);

      .ai-btn-bg {
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.2);
      }
    }
  }
}

/* 粒子浮动动画 */
@keyframes particle-float {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-4px) scale(1.1);
    opacity: 0.3;
  }
}

/* Element Plus 菜单样式 */
.album-menu {
  background: transparent;
  border: none;

  :deep(.el-sub-menu) {
    .el-sub-menu__title {
      background: transparent;
      color: rgba(255, 255, 255, 0.85);
      font-size: 12px;
      font-weight: 600;
      padding: 7px 10px;
      height: auto;
      line-height: 1.4;
      border-left: 2px solid transparent;
      transition: all 0.25s ease;
      border-radius: 4px;
      margin: 2px 4px;

      &:hover {
        background: rgba(255, 255, 255, 0.06);
        border-left-color: #3b82f6;
        color: rgba(255, 255, 255, 1);
        transform: translateX(2px);
      }

      .el-sub-menu__icon-arrow {
        color: rgba(255, 255, 255, 0.5);
        font-size: 10px;
        margin-top: -2px;
        transition: all 0.3s ease;
      }

      &:hover .el-sub-menu__icon-arrow {
        color: #60a5fa;
      }
    }

    &.is-opened .el-sub-menu__title .el-sub-menu__icon-arrow {
      transform: rotateZ(180deg);
    }
  }

  :deep(.el-menu-item) {
    background: rgba(0, 0, 0, 0.15);
    color: rgba(255, 255, 255, 0.75);
    padding: 0 10px;
    height: 32px;
    line-height: 32px;
    margin: 1px 4px;
    border-left: 2px solid transparent;
    border-radius: 4px;
    transition: all 0.25s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.95);
      transform: translateX(2px);
    }

    &.is-active {
      background: linear-gradient(
        90deg,
        rgba(59, 130, 246, 0.2),
        rgba(59, 130, 246, 0.1)
      ) !important;
      color: rgba(255, 255, 255, 1) !important;
      border-left-color: #3b82f6 !important;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);
    }

    &.is-downloading,
    &.is-fetching {
      background: rgba(64, 158, 255, 0.05) !important;

      .album-num {
        .download-progress {
          color: #409eff;
          font-weight: 600;
        }
      }
    }

    .album-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      position: relative;

      .download-indicator {
        position: absolute;
        left: -16px;
        top: 50%;
        transform: translateY(-50%);
        width: 12px;
        height: 12px;
        display: flex;
        align-items: center;
        justify-content: center;

        .el-icon {
          font-size: 12px;
          color: #409eff;

          &.is-loading {
            animation: spin 1s linear infinite;
          }
        }
      }

      .album-info {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        margin-right: 8px;
        min-width: 0;

        .viewtype-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          font-size: 10px;
          line-height: 1;
          border-radius: 3px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15));
          color: rgba(147, 197, 253, 0.9);
          border: 1px solid rgba(59, 130, 246, 0.2);
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .album-text {
          font-size: 12px;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
      }

      .album-num {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        min-width: 30px;
        text-align: right;
      }
    }
  }

  .category-title {
    font-size: 13px;
    font-weight: 600;
  }
}

/* 为滚动条预留空间 */
.menu-container {
  :deep(.el-scrollbar__wrap) {
    padding-right: 6px;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .w-72 {
    width: 240px;
  }
}

@media (max-width: 768px) {
  .w-72 {
    width: 208px;
  }
}

/* Loading动画 */
@keyframes loading-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 新增动画效果 */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 分段控制器 Tabs - 与智能相册风格一致 */
.segmented-control-section {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .segmented-control {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 3px;
    display: flex;
    border: 1px solid rgba(255, 255, 255, 0.05);

    .segment-item {
      flex: 1;
      text-align: center;
      padding: 6px 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
      font-weight: 500;

      &:hover {
        color: rgba(255, 255, 255, 0.9);
      }

      &.active {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-weight: 600;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
    }
  }
}

/* 照片菜单样式 */
.photo-menu {
  background: transparent;
  border: none;
  padding: 8px 0;

  :deep(.el-menu-item) {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(255, 255, 255, 0.7);
    padding: 10px 16px;
    height: auto;
    line-height: 1.4;
    margin: 4px 8px;
    border-radius: 6px;
    border-left: 2px solid transparent;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.95);
      transform: translateX(2px);
    }

    &.is-active {
      background: rgba(59, 130, 246, 0.2) !important;
      color: #ffffff !important;
      border-left-color: #3b82f6 !important;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
      font-weight: 600;
    }

    .el-icon {
      margin-right: 10px;
      font-size: 16px;
      transition: all 0.2s ease;
    }

    &.is-active .el-icon {
      color: #60a5fa;
    }

    span {
      font-size: 13px;
      letter-spacing: 0.3px;
    }
  }
}

/* 下载全部相册功能区样式 */
.download-all-section {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .download-all-card {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(16, 185, 129, 0.25);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%);
    backdrop-filter: blur(10px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: rgba(16, 185, 129, 0.45);
      background: linear-gradient(
        135deg,
        rgba(16, 185, 129, 0.12) 0%,
        rgba(16, 185, 129, 0.06) 100%
      );
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(16, 185, 129, 0.2);
    }

    .download-all-button {
      position: relative;
      cursor: pointer;
      overflow: hidden;
      min-height: 42px;
      display: flex;
      align-items: center;
      transition: all 0.3s ease;

      &:active {
        transform: scale(0.98);
      }

      .button-content {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        width: 100%;
        z-index: 2;
        position: relative;

        .button-icon {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.3);
          transition: all 0.3s ease;

          .el-icon {
            font-size: 16px;
            color: #10b981;
            transition: all 0.3s ease;
          }

          .cancel-icon {
            color: #f56c6c;
            animation: pulse 1s ease-in-out infinite;
          }

          .loading-wrapper {
            position: relative;
            width: 20px;
            height: 20px;

            .loading-ring {
              position: absolute;
              top: 0;
              left: 0;
              width: 20px;
              height: 20px;
              border: 2px solid rgba(16, 185, 129, 0.2);
              border-top: 2px solid #10b981;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }

            .download-icon {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 10px;
              color: #10b981;
            }
          }
        }

        .button-text {
          flex: 1;
          min-width: 0;

          .main-text {
            font-size: 13px;
            font-weight: 600;
            color: #10b981;
            line-height: 1.2;
            margin-bottom: 2px;
            transition: all 0.3s ease;
          }

          .sub-text {
            font-size: 11px;
            color: rgba(16, 185, 129, 0.7);
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .progress-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(16, 185, 129, 0.1);
        z-index: 1;

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
          transition: width 0.3s ease;
          position: relative;
          overflow: hidden;

          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(255, 255, 255, 0.3) 50%,
              transparent 100%
            );
            animation: shimmer 2s ease-in-out infinite;
          }
        }
      }

      &:hover {
        .button-icon {
          background: rgba(16, 185, 129, 0.25);
          transform: scale(1.05);

          .el-icon {
            color: #059669;
          }
        }

        .button-text .main-text {
          color: #059669;
        }
      }
    }
  }
}

/* 下载管理按钮动画效果 */
@keyframes pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.8;
  }
}

/* 视频统计区域样式 */
.video-stats-section {
  padding: 10px 6px;
}

.stats-card {
  padding: 10px;

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateY(-2px);
    }
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #60a5fa;

    &.loaded {
      color: #34d399;
    }
  }
}
/* 侧边栏底部 AI 入口样式 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(64, 158, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
  margin-top: auto; /* 确保底部对齐 */
}

.magic-portal-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%);
  border: 1px solid rgba(124, 58, 237, 0.2);

  &:hover {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(79, 70, 229, 0.2) 100%);
    box-shadow: 0 0 15px rgba(124, 58, 237, 0.3);
    border-color: rgba(124, 58, 237, 0.5);

    .magic-icon {
      animation: pulse 2s infinite;
      color: #a78bfa;
    }
  }

  .magic-icon-wrapper {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .magic-icon {
    font-size: 18px;
    color: #8b5cf6;
  }

  .magic-text {
    font-size: 14px;
    font-weight: 600;
    background: linear-gradient(to right, #a78bfa, #818cf8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
