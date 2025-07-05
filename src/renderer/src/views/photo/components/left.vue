<template>
  <div class="w-72 flex flex-col border-r border-blue-500/20 h-full">
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
            <div class="uin">{{ userStore.userInfo?.uin }}</div>
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
              <span class="label">会员状态</span>
              <span class="value vip">{{ formatVipStatus(userStore.userInfo?.vip || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 用户操作区域 -->
        <div class="card-actions">
          <div class="action-item">
            <el-button
              text
              class="action-btn download-btn"
              :class="{ 'has-active-tasks': hasActiveTasks }"
              title="下载管理器"
              @click="showDownloadProgress"
            >
              <div class="download-btn-content">
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
          <div class="action-divider"></div>
          <div class="action-item">
            <el-popconfirm
              title="确定要登出当前账号吗？"
              confirm-button-text="确定登出"
              cancel-button-text="取消"
              width="200"
              placement="top"
              @confirm="confirmLogout"
            >
              <template #reference>
                <el-button text :icon="Switch" class="action-btn logout-btn" title="登出">
                  登出
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>

    <!-- 下载全部相册功能区 -->
    <div class="download-all-section">
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

    <!-- Element Plus 菜单 -->
    <div class="flex-1 overflow-hidden menu-container">
      <el-scrollbar class="h-full">
        <el-menu
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
                <span class="album-text">{{ album.name }}</span>
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
      </el-scrollbar>
    </div>

    <!-- 下载管理器弹窗 -->
    <DownloadManager v-model="downloadProgressVisible" />
  </div>
</template>

<script setup>
import { onBeforeMount, ref, computed, nextTick, onBeforeUnmount } from 'vue'

import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import { Download, Switch, FolderAdd, Close, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'
import { generateUniqueAlbumName } from '@renderer/utils'

const handleMenuSelect = (index) => {
  // 菜单选择处理由 selectAlbumItem 函数处理
  console.log('Menu selected:', index)
}

const selectAlbumItem = (categoryId, album) => {
  // 立即更新选中状态，避免延迟
  selectedAlbumKey.value = `${categoryId}-${album.id}`
  // 同步调用选择函数
  selectAlbum(album)
}

const emit = defineEmits(['album-selected'])

const userStore = useUserStore()
const downloadStore = useDownloadStore()
const loading = ref(false)

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

// 显示下载进度
const showDownloadProgress = () => {
  downloadProgressVisible.value = true
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

const formatVipStatus = (vip) => {
  return vip === 1 ? '黄钻会员' : '普通用户'
}

const total = ref(0)
const pageSize = ref(15)
const clickItem = ref({})
const apiData = ref()
const selectedAlbumKey = ref('')
const openedKeys = ref(new Set())

const menuList = computed(() => {
  if (!apiData.value || !apiData.value.albumListModeClass || !apiData.value.classList) {
    return []
  }

  const classMap = {}
  apiData.value.classList.forEach((cls) => {
    classMap[cls.id] = cls.name
  })

  return apiData.value.albumListModeClass.map((category) => ({
    classId: category.classId,
    className: classMap[category.classId] || category.className || '未知分类',
    albums: category.albumList || []
  }))
})

const selectAlbum = (album) => {
  clickItem.value = album
  emit('album-selected', album)
}

const fetchPhotoData = async () => {
  loading.value = true
  let allAlbumsData = []
  let pageStart = 0
  let hasMore = true

  try {
    while (hasMore) {
      const res = await window.QzoneAPI.getPhotoList({
        hostUin: userStore.userInfo.uin,
        pageStart: pageStart,
        pageNum: pageSize.value
      })

      if (res && res.data) {
        // 判断数据格式
        if (res.data.albumListModeSort && !res.data.albumListModeClass) {
          // 格式1：平铺格式，需要转换
          if (pageStart === 0) {
            // 创建分类映射
            const classMap = new Map()

            // 如果有 classList，先初始化
            if (res.data.classList && res.data.classList.length > 0) {
              res.data.classList.forEach((cls) => {
                classMap.set(cls.id, {
                  classId: cls.id,
                  className: cls.name,
                  albumList: [],
                  totalInClass: 0,
                  totalInPage: 0,
                  nextPageStart: 0
                })
              })
            }

            // 将相册分配到对应的分类
            res.data.albumListModeSort.forEach((album) => {
              const classId = album.classid

              if (classMap.has(classId)) {
                const category = classMap.get(classId)
                category.albumList.push(album)
                category.totalInClass++
                category.totalInPage++
              } else {
                // 如果分类不存在，使用相册名称作为分类，只包含自己
                classMap.set(album.id, {
                  classId: album.id,
                  className: album.name,
                  albumList: [album],
                  totalInClass: 1,
                  totalInPage: 1,
                  nextPageStart: 0
                })
              }
            })

            // 转换为数组格式
            res.data.albumListModeClass = Array.from(classMap.values()).filter(
              (category) => category.albumList.length > 0
            )
            apiData.value = res.data
            total.value = res.data.albumsInUser
            allAlbumsData = JSON.parse(JSON.stringify(res.data.albumListModeClass))
          }

          // 判断是否还有更多数据
          if (res.data.nextPageStartModeSort !== undefined && res.data.nextPageStartModeSort > 0) {
            pageStart = res.data.nextPageStartModeSort
          } else {
            hasMore = false
          }
        } else if (res.data.albumListModeClass) {
          // 格式2：已经是分类格式
          if (pageStart === 0) {
            apiData.value = res.data
            total.value = res.data.albumsInUser
            allAlbumsData = JSON.parse(JSON.stringify(res.data.albumListModeClass))
          } else {
            // 合并新数据到已有数据
            res.data.albumListModeClass.forEach((newCategory) => {
              if (newCategory.albumList && newCategory.albumList.length > 0) {
                let targetCategory = allAlbumsData.find(
                  (cat) => cat.classId === newCategory.classId
                )

                if (!targetCategory) {
                  targetCategory = {
                    classId: newCategory.classId,
                    className: newCategory.className || newCategory.name || '其他相册',
                    albumList: [],
                    totalInClass: newCategory.totalInClass,
                    totalInPage: newCategory.totalInPage,
                    nextPageStart: newCategory.nextPageStart
                  }
                  allAlbumsData.push(targetCategory)
                }

                if (targetCategory) {
                  const existingIds = new Set(
                    (targetCategory.albumList || []).map((album) => album.id)
                  )

                  const newAlbums = newCategory.albumList.filter(
                    (album) => !existingIds.has(album.id)
                  )

                  if (newAlbums.length > 0) {
                    targetCategory.albumList = [...(targetCategory.albumList || []), ...newAlbums]
                  }

                  // 更新分页信息
                  targetCategory.nextPageStart = newCategory.nextPageStart
                }
              }
            })
          }

          // 判断是否还有更多数据
          let allCategoriesComplete = true

          allAlbumsData.forEach((category) => {
            const currentLoaded = (category.albumList || []).length
            const totalInClass = category.totalInClass || 0

            if (currentLoaded < totalInClass) {
              allCategoriesComplete = false
            }
          })

          if (
            allCategoriesComplete ||
            res.data.albumListModeClass.every((cat) => !cat.albumList || cat.albumList.length === 0)
          ) {
            hasMore = false
          } else {
            pageStart += pageSize.value
          }
        } else {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    // 更新最终数据
    if (apiData.value && allAlbumsData) {
      apiData.value.albumListModeClass = allAlbumsData
    }

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
    console.error('加载相册数据失败:', error)
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

// 设置下载状态监听器
const setupDownloadListeners = () => {
  // 监听活跃任务数量更新（主要监听器）
  window.QzoneAPI.download.onActiveCountUpdate((count) => {
    activeTaskCount.value = count
  })

  // 监听详细状态更新（新增，用于状态文本显示）
  window.QzoneAPI.download.onDetailedStatusUpdate((status) => {
    detailedStatus.value = status
    // 同步更新活跃任务数量
    activeTaskCount.value = status.total
  })

  // 监听统计信息更新（备用）
  window.QzoneAPI.download.onStatsUpdate((stats) => {
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
}

// 清理下载监听器
const cleanupDownloadListeners = () => {
  try {
    window.QzoneAPI.download.removeAllListeners()
  } catch (error) {
    console.error('清理下载监听器失败:', error)
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

onBeforeMount(() => {
  fetchPhotoData()
  initDownloadTasks()
  setupDownloadListeners()
})

onBeforeUnmount(() => {
  cleanupDownloadListeners()
})
</script>

<style scoped>
/* 用户信息卡片 */
.user-section {
  padding: 8px 10px;
  padding-top: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .user-card {
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.03);

      .user-avatar {
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
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
        }
      }
    }

    .card-stats {
      padding: 6px 10px 8px;

      .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 8px;

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

            &.vip {
              color: #8b5cf6;
              text-shadow: 0 0 3px rgba(139, 92, 246, 0.3);
            }
          }
        }
      }
    }

    .card-actions {
      display: flex;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);

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
    }
  }
}

/* Element Plus 菜单样式 */
.album-menu {
  background: transparent;
  border: none;

  :deep(.el-sub-menu) {
    .el-sub-menu__title {
      background: transparent;
      color: rgba(255, 255, 255, 0.9);
      font-size: 13px;
      font-weight: 600;
      padding: 8px 12px;
      height: auto;
      line-height: 1.4;
      border-left: 2px solid transparent;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        border-left-color: #3b82f6;
        color: rgba(255, 255, 255, 1);
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
    background: rgba(0, 0, 0, 0.1);
    color: rgba(255, 255, 255, 0.8);
    padding: 6px 20px;
    height: auto;
    line-height: 1.4;
    margin: 0;
    border-left: 2px solid transparent;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.9);
    }

    &.is-active {
      background: rgba(59, 130, 246, 0.15) !important;
      color: rgba(255, 255, 255, 1) !important;
      border-left-color: #3b82f6 !important;
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

      .album-text {
        font-size: 12px;
        flex: 1;
        margin-right: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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

/* 通用样式 */
:deep(.el-scrollbar__bar) {
  opacity: 0.3;
}

:deep(.el-scrollbar__bar:hover) {
  opacity: 0.6;
}

:deep(.el-scrollbar__bar.is-horizontal) {
  display: none !important;
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

/* 下载全部相册功能区样式 */
.download-all-section {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .download-all-card {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(16, 185, 129, 0.2);
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
    transition: all 0.3s ease;

    &:hover {
      border-color: rgba(16, 185, 129, 0.4);
      background: linear-gradient(
        135deg,
        rgba(16, 185, 129, 0.08) 0%,
        rgba(16, 185, 129, 0.04) 100%
      );
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
    }

    .download-all-button {
      position: relative;
      cursor: pointer;
      overflow: hidden;
      min-height: 56px;
      display: flex;
      align-items: center;
      transition: all 0.3s ease;

      &:active {
        transform: scale(0.98);
      }

      .button-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        width: 100%;
        z-index: 2;
        position: relative;

        .button-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
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
</style>
