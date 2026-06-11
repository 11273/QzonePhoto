<template>
  <div class="w-72 flex flex-col border-r border-blue-500/20 h-full ai-sidebar">
    <!-- 用户信息区 - 与 QQ 相册样式一致 -->
    <div class="user-section">
      <div class="user-card">
        <div class="card-header">
          <el-avatar
            v-if="!userStore.isLoggedIn"
            shape="square"
            :size="32"
            class="user-avatar is-guest"
          >
            <el-icon><Cpu /></el-icon>
          </el-avatar>
          <el-avatar
            v-else
            shape="square"
            :size="32"
            :src="`https://qlogo4.store.qq.com/qzone/${userStore.userInfo?.uin}/${userStore.userInfo?.uin}/100`"
            class="user-avatar"
          >
            {{ userStore.userInfo?.nick?.[0] || 'Q' }}
          </el-avatar>
          <div class="user-info">
            <div class="nickname">
              {{
                userStore.isLoggedIn
                  ? userStore.userInfo?.nick || 'QZone用户'
                  : systemInfo?.hostname || 'Local Device'
              }}
            </div>
            <div v-if="userStore.isLoggedIn" class="uin-row">
              <span class="uin uin-copyable" title="点击切换 QQ 号显示" @click="toggleUinDisplay">
                {{ displayUin }}
              </span>
              <el-icon
                class="uin-toggle"
                :title="showUin ? '隐藏' : '显示'"
                @click.stop="toggleUinDisplay"
              >
                <component :is="showUin ? Hide : View" />
              </el-icon>
            </div>
            <div v-else class="uin-row guest-row">
              <span class="uin">本地智能相册</span>
              <span class="status-badge">
                <span class="status-dot-breathing"></span>
                本地
              </span>
            </div>
          </div>
          <!-- 登出按钮移到头像右边 -->
          <div class="header-actions">
            <!-- 已登录：显示登出 -->
            <el-popconfirm
              v-if="userStore.isLoggedIn"
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

            <!-- 未登录：显示去登录 -->
            <el-button
              v-else
              text
              :icon="SwitchButton"
              class="action-btn logout-btn header-logout"
              title="去登录"
              @click="handleGoToLogin"
            >
            </el-button>
          </div>
        </div>

        <!-- AI 统计 Grid - 对齐 QQ 相册信息卡片 -->
        <div class="card-stats">
          <div class="stat-grid">
            <div class="stat-item">
              <span class="label">照片索引</span>
              <span class="value level"
                >{{ formatNumber(aiStore.totalCount) }} <span class="unit">张</span></span
              >
            </div>
            <div class="stat-item">
              <span class="label">人物聚类</span>
              <span class="value growth"
                >{{ formatNumber(aiStore.personCount) }} <span class="unit">人</span></span
              >
            </div>
            <div class="stat-item">
              <span class="label">推理引擎</span>
              <span class="value speed" :class="{ 'is-active': aiStore.speed > 0 }">
                {{ aiStore.speed > 0 ? aiStore.speed + ' fps' : 'Ready' }}
              </span>
            </div>
            <div class="stat-item" title="AI 向量数据库本地占用空间">
              <span class="label">数据体积</span>
              <span class="value storage">{{ formatStorage(aiStore.storageUsed) }}</span>
            </div>
          </div>
        </div>

        <!-- 卡片底部操作 - 与 QQ 相册管理器按钮一致 -->
        <div class="card-actions managers-layout">
          <div class="manager-item">
            <el-button
              text
              class="action-btn analysis-btn manager-btn"
              :class="{ 'has-active-tasks': aiStore.isScanning }"
              :title="analysisBtnText"
              :disabled="aiStore.isScanning"
              @click="handleStartAnalysis"
            >
              <div class="manager-btn-content">
                <div class="icon-wrapper">
                  <el-icon :class="{ 'is-loading': aiStore.isScanning }">
                    <component :is="aiStore.isScanning ? Loading : MagicStick" />
                  </el-icon>
                  <div
                    v-if="aiStore.isScanning || aiStore.pendingCount > 0"
                    class="active-indicator"
                  >
                    <div class="pulse-ring"></div>
                    <div class="pulse-dot"></div>
                  </div>
                </div>
                <div class="text-wrapper">
                  <div class="main-text">{{ analysisBtnText }}</div>
                  <div v-if="analysisSubText" class="status-text">{{ analysisSubText }}</div>
                </div>
              </div>
            </el-button>
          </div>
          <div class="manager-item">
            <el-button
              text
              class="action-btn manager-btn"
              title="目录管理"
              @click="handleViewChange('folders')"
            >
              <div class="manager-btn-content">
                <div class="icon-wrapper">
                  <el-icon><Folder /></el-icon>
                </div>
                <div class="text-wrapper">
                  <div class="main-text">目录管理</div>
                  <div v-if="aiStore.allScanPaths.length" class="status-text">
                    {{ aiStore.allScanPaths.length }} 个目录
                  </div>
                </div>
              </div>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图切换 - 分段控制器风格 -->
    <div class="segmented-control-section">
      <div class="segmented-control">
        <div
          v-for="tab in viewTabs"
          :key="tab.key"
          class="segment-item"
          :class="{ active: currentView === tab.key }"
          @click="handleViewChange(tab.key)"
        >
          {{ tab.label }}
        </div>
      </div>
    </div>

    <!-- 分类导航 -->
    <div class="flex-1 overflow-hidden menu-container">
      <el-scrollbar class="h-full">
        <div v-if="currentView === 'smart'" class="library-view">
          <!-- 所有照片 - 主入口 -->
          <!-- AI 仪表盘入口 - 大按钮风格 -->
          <div class="all-photos-section">
            <div
              class="dashboard-nav-card"
              :class="{
                'is-active': activeCollection === 'overview',
                'is-disabled': !aiStore.isModelReady
              }"
              @click="aiStore.isModelReady && handleCollectionSelect('overview')"
            >
              <div class="card-bg"></div>
              <div class="card-content">
                <div class="icon-circle">
                  <el-icon><Odometer /></el-icon>
                </div>
                <div class="text-info">
                  <span class="main-title">AI 智能概览</span>
                </div>
                <el-icon class="arrow-icon"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>

          <!-- 集合区域 - 可折叠 -->
          <div v-if="aiStore.isModelReady && activeCollections.length" class="collections-section">
            <div class="section-header" @click="collectionsExpanded = !collectionsExpanded">
              <div class="header-left">
                <el-icon class="collapse-icon" :class="{ 'is-collapsed': !collectionsExpanded }">
                  <ArrowDown />
                </el-icon>
                <span class="section-title">智能集合</span>
              </div>
              <el-button text size="small" class="merge-btn" @click.stop="handleMergePeople">
                整理
              </el-button>
            </div>
            <el-collapse-transition>
              <div v-show="collectionsExpanded" class="collection-list">
                <div
                  v-for="item in activeCollections"
                  :key="item.key"
                  class="collection-item"
                  :class="{ 'is-active': activeCollection === item.key }"
                  @click="handleCollectionSelect(item.key)"
                >
                  <el-icon class="item-icon"><component :is="item.icon" /></el-icon>
                  <span class="item-label">{{ item.label }}</span>
                  <span class="item-count">{{ item.count }}</span>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>

        <!-- 文件夹列表视图 - 卡片化重构 (Compact & Functional) -->
        <div v-else-if="currentView === 'folders'" class="folder-management-section">
          <div class="section-title-row">
            <div class="title-group">
              <span class="section-title">扫描目录管理</span>
              <span class="section-count">{{ aiStore.allScanPaths.length }}</span>
            </div>
            <el-button circle class="add-folder-btn-mini" @click.stop="handleAddFolder">
              <el-icon><Plus /></el-icon>
            </el-button>
          </div>

          <div class="folder-cards-list">
            <div
              v-for="folder in aiStore.allScanPaths"
              :key="folder.id"
              class="folder-item-card"
              :class="{
                'is-active':
                  aiStore.selectedFilter.type === 'folder' &&
                  aiStore.selectedFilter.value === folder.path,
                'is-default': folder.type === 'default'
              }"
              @click="handleFolderSelect(folder.path)"
            >
              <div class="card-body">
                <el-icon class="folder-icon">
                  <component :is="folder.type === 'default' ? Files : Folder" />
                </el-icon>
                <div class="folder-info">
                  <div class="folder-label">
                    <span class="name">{{ folder.label }}</span>
                    <span v-if="folder.type === 'default'" class="default-badge">默认</span>
                  </div>
                  <!-- 点击路径复制 -->
                  <div
                    class="folder-path-wrapper"
                    title="点击复制路径"
                    @click.stop="handleCopyPath(folder.path)"
                  >
                    <span class="folder-path">{{ folder.path }}</span>
                  </div>
                </div>
              </div>

              <!-- 右侧操作区: 数量常驻，删除悬停显示 -->
              <div class="card-extra-info">
                <span v-if="aiStore.folderCounts[folder.path]" class="persistent-count">
                  {{ formatNumber(aiStore.folderCounts[folder.path]) }}
                </span>

                <div class="hover-actions internal-actions">
                  <el-button
                    v-if="folder.deletable"
                    text
                    circle
                    class="action-btn-mini remove-btn"
                    title="移除目录"
                    @click.stop="handleRemoveFolder(folder)"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态提示 -->
          <div v-if="aiStore.isScanning" class="scanning-alert">
            <div class="text-xs text-blue-400 flex items-center gap-2">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在扫描变更...</span>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 返回 QQ 相册按钮 - 底部 QQ空间经典橙色风格 -->
    <div v-if="userStore.isLoggedIn" class="back-to-album-section">
      <button class="back-to-album-btn" @click="handleBackToAlbum">
        <div class="qzone-btn-bg"></div>
        <div class="qzone-btn-content">
          <div class="qzone-icon-wrapper">
            <img :src="QZoneIcon" class="qzone-icon" alt="QZone" />
          </div>
          <span class="qzone-btn-text">返回 QQ 相册</span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, markRaw, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import { useAIStore } from '@renderer/services/ai/store'
import {
  MagicStick,
  Loading,
  SwitchButton,
  Files,
  Folder,
  UserFilled,
  ArrowDown,
  Plus,
  Close,
  Cpu,
  ArrowRight,
  Hide,
  View,
  Odometer
} from '@element-plus/icons-vue'

import { useRouter } from 'vue-router'
import QZoneIcon from '@renderer/assets/qzone_logo.png'

const router = useRouter()
const userStore = useUserStore()
const aiStore = useAIStore()
const downloadStore = useDownloadStore()

const handleGoToLogin = () => {
  router.push('/login')
}

const collectionsExpanded = ref(true)
const systemInfo = ref(null)

onMounted(async () => {
  // 获取系统信息用于访客展示
  if (!userStore.isLoggedIn) {
    try {
      systemInfo.value = await window.QzoneAPI.app.getInfo()
    } catch (e) {
      console.error('获取系统信息失败', e)
    }
  }
})

const analysisBtnText = computed(() => {
  if (aiStore.isScanning) return '分析中'
  if (aiStore.systemStatus === 'MODEL_MISSING') return '初始化引擎'
  return '启动分析'
})

const analysisSubText = computed(() => {
  if (aiStore.isScanning) return `${aiStore.scanProgress || 0}%`
  if (aiStore.pendingCount > 0) return `${aiStore.pendingCount} 张待处理`
  if (aiStore.systemStatus === 'MODEL_MISSING') return '本地 AI'
  return ''
})

const handleMergePeople = () => {
  ElMessage.info('正在进入人物聚类整理模式...')
}

const emit = defineEmits(['start-analysis', 'back-to-album'])

// 返回 QQ 相册
const handleBackToAlbum = () => {
  emit('back-to-album')
}

// 视图切换
const currentView = ref('smart')
const viewTabs = [
  { key: 'smart', label: '智能探索', icon: markRaw(MagicStick) },
  { key: 'folders', label: '文件夹', icon: markRaw(Folder) }
]

// 处理 Tab 切换
const handleViewChange = async (key) => {
  currentView.value = key
  if (key === 'folders') {
    activeCollection.value = null
    await aiStore.updateTotalPhotoCount()
  } else if (key === 'smart') {
    activeCollection.value = 'overview'
  }
}

// 分类导航 - 库分组 (包含“所有照片”，作为最顶层分类)
const activeCollection = ref('overview') // 默认选中 AI 智能概览，展示首页效果
const library = computed(() => {
  const list = [
    {
      key: 'all-photos',
      icon: markRaw(Files),
      label: '所有照片',
      count: aiStore.totalCount || 0,
      disabled: !aiStore.isModelReady,
      type: 'all'
    }
  ]

  // 将扫描路径加入库列表
  aiStore.allScanPaths.forEach((p) => {
    list.push({
      key: `folder-${p.path}`,
      icon: markRaw(Folder),
      label: p.label,
      path: p.path,
      count: aiStore.folderCounts[p.path] || 0,
      disabled: !aiStore.isModelReady,
      type: 'folder'
    })
  })

  return list
})

// 集合分组
const activeCollections = computed(() => {
  if (!aiStore.isModelReady || aiStore.personCount <= 0) return []
  return [
    {
      key: 'people',
      icon: markRaw(UserFilled),
      label: '人物与面孔',
      count: aiStore.personCount
    }
  ]
})

const handleCollectionSelect = (key) => {
  activeCollection.value = key
  const item = library.value.find((i) => i.key === key)
  if (item) {
    if (item.type === 'all') {
      aiStore.setSelectedFilter('all')
    } else if (item.type === 'folder') {
      aiStore.setSelectedFilter('folder', item.path)
    }
  } else if (key === 'overview') {
    aiStore.setSelectedFilter('overview')
  } else if (key === 'people') {
    aiStore.setSelectedFilter('people')
    aiStore.fetchFaceGroups() // 切换时顺便刷新
  }
}

const handleStartAnalysis = () => {
  emit('start-analysis')
}

// 格式化数字
const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

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

// 格式化存储
const formatStorage = (bytes) => {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
  return mb.toFixed(1) + ' MB'
}
// 文件夹管理
// 复制路径到剪贴板
const handleCopyPath = async (path) => {
  try {
    await navigator.clipboard.writeText(path)
    ElMessage.success('路径已复制')
  } catch (e) {
    console.error('复制失败', e)
    ElMessage.error('复制失败')
  }
}

const handleAddFolder = async () => {
  try {
    const result = await window.QzoneAPI.download.selectDirectory()
    if (result) {
      const res = await aiStore.addCustomPath(result)
      if (res.success) {
        ElMessage.success('已添加扫描路径')
        // 刷新所有文件夹的照片数量
        await aiStore.updateTotalPhotoCount()
      } else {
        ElMessage.warning(res.message || '该路径已存在或无效')
      }
    }
  } catch (error) {
    console.error('选择文件夹失败', error)
  }
}

// 文件夹切换
const handleFolderSelect = (path) => {
  aiStore.setSelectedFilter('folder', path)
}

const handleRemoveFolder = (folder) => {
  if (!folder?.deletable) return
  aiStore.removeCustomPath(folder.path)
}

// 监听默认下载路径变更
watch(
  () => downloadStore.downloadPath,
  (newPath) => {
    if (!newPath) return

    // 如果没有记录过，先记录下来并作为初始默认
    if (!aiStore.recognizedDefaultPath) {
      aiStore.confirmDefaultPathChange(newPath)
      return
    }

    // 如果发生变化
    if (aiStore.recognizedDefaultPath !== newPath) {
      // 直接跟随切换，并将旧路径加入可删除列表
      // 无需弹窗干扰，符合“跟随切换”的需求描述
      aiStore.confirmDefaultPathChange(newPath)
      ElMessage({
        message: '默认下载位置已变更，系统已自动更新 AI 扫描策略',
        type: 'info',
        duration: 5000
      })
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
/* 响应式设计 - 确保侧边栏宽度与 QQ 相册完全一致 */
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

/* 1. 用户信息区 - 复用 QQ 相册样式 */
.user-section {
  padding: 6px 8px;
  padding-top: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  /* 卡片容器 */
  .user-card {
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(10px);

    /* 卡片头部 */
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

        &.is-guest {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;

          .el-icon {
            font-size: 18px;
          }
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
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          line-height: 1.1;
          cursor: pointer;
          user-select: none;
          transition: color 0.2s ease;

          &:hover {
            color: rgba(255, 255, 255, 0.6);
          }

          &.status-text {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
            font-weight: 500;
          }
        }

        .uin-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .uin-toggle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.42);
          cursor: pointer;
          padding: 2px;
          border-radius: 3px;
          transition: all 0.15s ease;

          &:hover {
            color: rgba(255, 255, 255, 0.72);
            background: rgba(255, 255, 255, 0.06);
          }
        }

        .guest-row {
          gap: 8px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(16, 185, 129, 0.08);
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10px;
          color: #10b981;
          font-weight: 600;
        }

        .status-dot-breathing {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #10b981;
          box-shadow: 0 0 5px rgba(16, 185, 129, 0.5);
          animation: breathing 2s infinite ease-in-out;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;

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
            line-height: 1.1;
            display: flex;
            align-items: baseline;
            gap: 2px;
            color: rgba(255, 255, 255, 0.9);

            .unit {
              font-size: 9px;
              font-weight: 600;
              opacity: 0.6;
            }

            &.is-active {
              color: #fbbf24;
              text-shadow: 0 0 10px rgba(251, 191, 36, 0.4);
              animation: text-pulse 1s infinite alternate;
            }

            &.level {
              color: #fbbf24;
              text-shadow: 0 0 3px rgba(251, 191, 36, 0.3);
            }

            &.growth {
              color: #10b981;
              text-shadow: 0 0 3px rgba(16, 185, 129, 0.3);
            }

            &.speed {
              color: #fbbf24;
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
  }
}

@keyframes breathing {
  0% {
    transform: scale(1);
    opacity: 0.6;
    box-shadow: 0 0 2px rgba(16, 185, 129, 0.2);
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  }
  100% {
    transform: scale(1);
    opacity: 0.6;
    box-shadow: 0 0 2px rgba(16, 185, 129, 0.2);
  }
}

@keyframes text-pulse {
  from {
    opacity: 0.8;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

/* 卡片底部操作 - 设置和日志 */
.card-actions {
  display: flex;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.1);

  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
    filter: grayscale(1);
  }

  &.managers-layout {
    padding: 0;

    .manager-item {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;

      &:not(:last-child) {
        border-right: 1px solid rgba(255, 255, 255, 0.06);
      }

      .manager-btn {
        width: 100%;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.8);
        border: none;
        background: none;
        padding: 0;
        transition: all 0.2s ease;
        min-height: 40px;

        &:hover {
          color: rgba(255, 255, 255, 1);
          background: rgba(255, 255, 255, 0.05);
        }

        .manager-btn-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;

          .icon-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;

            .el-icon {
              font-size: 14px;
            }

            .active-indicator {
              position: absolute;
              right: -4px;
              top: -4px;
              width: 8px;
              height: 8px;

              .pulse-ring {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 1px solid rgba(64, 158, 255, 0.7);
                animation: pulse-ring 1.8s ease-out infinite;
              }

              .pulse-dot {
                position: absolute;
                left: 2px;
                top: 2px;
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: #409eff;
                box-shadow: 0 0 6px rgba(64, 158, 255, 0.6);
              }
            }
          }

          .text-wrapper {
            min-width: 0;

            .main-text {
              font-size: 11px;
              line-height: 1.2;
              font-weight: 500;
              white-space: nowrap;
            }

            .status-text {
              margin-top: 1px;
              font-size: 10px;
              line-height: 1.1;
              color: rgba(255, 255, 255, 0.45);
              white-space: nowrap;
            }
          }
        }

        .analysis-btn {
          .icon-wrapper .el-icon {
            color: #a78bfa;
          }

          &:hover .icon-wrapper .el-icon,
          &:hover .main-text {
            color: #c4b5fd;
          }

          &.has-active-tasks {
            .icon-wrapper .el-icon,
            .main-text {
              color: #409eff;
            }
          }
        }
      }
    }
  }
}

/* 返回 QQ 相册按钮 - QQ空间经典橙色风格 */
.back-to-album-section {
  padding: 6px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);

  .back-to-album-btn {
    position: relative;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    overflow: hidden;
    background: transparent;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    /* 背景渐变层 - 橙色系 */
    .qzone-btn-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        135deg,
        rgba(241, 90, 36, 0.12) 0%,
        rgba(255, 138, 0, 0.15) 50%,
        rgba(251, 191, 36, 0.1) 100%
      );
      border: 1px solid rgba(241, 90, 36, 0.2);
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    /* 内容层 */
    .qzone-btn-content {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    /* 图标容器 */
    .qzone-icon-wrapper {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(241, 90, 36, 0.2), rgba(255, 138, 0, 0.25));
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(241, 90, 36, 0.2);
      transition: all 0.3s ease;

      .qzone-icon {
        width: 14px;
        height: 14px;
        object-fit: contain;
        filter: drop-shadow(0 0 2px rgba(241, 90, 36, 0.4));
        transition: all 0.3s ease;
      }
    }

    /* 文字 */
    .qzone-btn-text {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 180, 120, 0.9);
      letter-spacing: 0.3px;
      transition: all 0.3s ease;
    }

    /* 悬停效果 */
    &:hover {
      transform: translateY(-1px);

      .qzone-btn-bg {
        background: linear-gradient(
          135deg,
          rgba(241, 90, 36, 0.2) 0%,
          rgba(255, 138, 0, 0.25) 50%,
          rgba(251, 191, 36, 0.18) 100%
        );
        border-color: rgba(241, 90, 36, 0.4);
        box-shadow:
          0 4px 12px rgba(241, 90, 36, 0.2),
          0 0 16px rgba(255, 138, 0, 0.08);
      }

      .qzone-icon-wrapper {
        background: linear-gradient(135deg, rgba(241, 90, 36, 0.3), rgba(255, 138, 0, 0.35));
        box-shadow: 0 3px 8px rgba(241, 90, 36, 0.25);

        .qzone-icon {
          filter: drop-shadow(0 0 4px rgba(241, 90, 36, 0.5));
          transform: scale(1.03);
        }
      }

      .qzone-btn-text {
        color: rgba(255, 200, 150, 1);
      }
    }

    /* 点击效果 */
    &:active {
      transform: translateY(0);

      .qzone-btn-bg {
        box-shadow: 0 2px 6px rgba(241, 90, 36, 0.12);
      }
    }
  }
}

/* 3. 分段控制器 Tabs */
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

/* 5. 菜单列表 */
.menu-container {
  padding-bottom: 20px;

  /* ==================== 智能探索视图 ==================== */
  .all-photos-section {
    margin-top: 12px; // Reduced from 20px
    margin-bottom: 16px; // Reduced from 24px
    padding: 0 12px;

    .dashboard-nav-card {
      position: relative;
      background: transparent;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      height: 52px; // Reduced height to look more like a button

      // Background layer
      .card-bg {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          rgba(255, 255, 255, 0.03) 0%,
          rgba(255, 255, 255, 0.01) 100%
        );
        z-index: 0;
        transition: all 0.3s;
      }

      // Content
      .card-content {
        position: relative;
        z-index: 10;
        display: flex;
        align-items: center;
        height: 100%;
        padding: 0 12px; // Slightly reduced padding
        gap: 12px;
      }

      .icon-circle {
        width: 32px; // Smaller icon circle
        height: 32px;
        border-radius: 8px;
        background: rgba(30, 41, 59, 0.5); // Dark Slate
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        transition: all 0.3s;

        .el-icon {
          font-size: 16px;
        } // Smaller icon
      }

      .text-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;

        .main-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }
      }

      .arrow-icon {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.2);
        transition: all 0.3s;
      }

      // Hover State
      &:hover {
        border-color: rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);

        .card-bg {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.06) 0%,
            rgba(255, 255, 255, 0.03) 100%
          );
        }

        .icon-circle {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .main-title {
          color: #fff;
        }
        .arrow-icon {
          color: rgba(255, 255, 255, 0.6);
          transform: translateX(2px);
        }
      }

      // Active State
      &.is-active {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.05); // Tint

        .card-bg {
          opacity: 0;
        } // Hide default bg

        .icon-circle {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: #fff;
          border: none;
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.4);
        }

        .main-title {
          color: #fff;
          text-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
        }
        .sub-title {
          color: rgba(96, 165, 250, 0.8);
        }
        .arrow-icon {
          color: #60a5fa;
        }
      }

      // Disabled
      &.is-disabled {
        opacity: 0.5;
        filter: grayscale(1);
        pointer-events: none;
      }
    }
  }

  /* 可折叠区域通用样式 */
  .folders-section,
  .collections-section {
    margin-bottom: 12px;

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 4px;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.15s ease;
      user-select: none;

      &:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .collapse-icon {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.3);
        transition: transform 0.2s ease;

        &.is-collapsed {
          transform: rotate(-90deg);
        }
      }

      .section-title {
        font-size: 10px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .section-count {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.25);
      }

      .merge-btn {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        padding: 2px 6px;
        height: auto;

        &:hover {
          color: #3b82f6;
        }
      }
    }

    .folder-list,
    .collection-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 4px;
    }

    .folder-item,
    .collection-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px 7px 22px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(.is-disabled) {
        background: rgba(255, 255, 255, 0.05);
      }

      &.is-active:not(.is-disabled) {
        background: rgba(59, 130, 246, 0.12);
        .item-icon {
          color: #60a5fa;
        }
        .item-label {
          color: #fff;
          font-weight: 500;
        }
        .item-count {
          color: rgba(96, 165, 250, 0.8);
        }
      }

      &.is-disabled {
        opacity: 0.4;
        cursor: not-allowed;

        &:hover {
          background: transparent;
        }
      }

      .item-icon {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.4);
      }

      .item-label {
        flex: 1;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.75);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .item-count {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        font-variant-numeric: tabular-nums;
      }
    }
  }
}

/* ==================== 文件夹管理视图 ==================== */
.folder-management-section {
  padding: 8px 12px; // Reduced padding

  /* 标题行 */
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08); // More subtle

    .title-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
    }

    .section-count {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.08);
      padding: 1px 5px;
      border-radius: 4px;
    }
  }

  /* 添加按钮 */
  .add-folder-btn-mini {
    width: 22px !important; // Smaller
    height: 22px !important;
    background: transparent !important;
    border: 1px solid rgba(255, 255, 255, 0.15) !important;
    color: rgba(255, 255, 255, 0.6) !important;
    transition: all 0.2s ease !important;

    &:hover {
      background: rgba(59, 130, 246, 0.15) !important;
      border-color: #3b82f6 !important;
      color: #3b82f6 !important;
    }

    .el-icon {
      font-size: 12px;
    }
  }

  /* 文件夹卡片列表 */
  .folder-cards-list {
    display: flex;
    flex-direction: column;
    gap: 6px; // Tighter gap

    .folder-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px; // Compact padding
      background: rgba(255, 255, 255, 0.03); // Lighter touch
      border: 1px solid transparent;
      border-radius: 6px;
      transition: all 0.15s ease;
      gap: 10px;
      height: 48px; // Fixed compact height

      &:hover {
        background: rgba(255, 255, 255, 0.08);

        .card-right-actions {
          opacity: 1;
        }
      }

      &.is-active {
        background: rgba(59, 130, 246, 0.12);
        border-color: rgba(59, 130, 246, 0.3);

        .folder-icon {
          color: #60a5fa !important;
        }
        .folder-info .folder-label .name {
          color: #fff;
        }
      }

      // Default highlight
      &.is-default {
        .folder-icon {
          color: #3b82f6;
        }
      }

      .card-body {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        overflow: hidden;

        .folder-icon {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0;
          transition: color 0.2s;
        }

        .folder-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0; // CRITICAL for truncating
          overflow: hidden; // CRITICAL

          .folder-label {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;

            .name {
              font-size: 13px;
              color: rgba(255, 255, 255, 0.9);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              flex-shrink: 1; // Allow shrinking
            }

            .default-badge {
              flex-shrink: 0; // Don't squash the badge
              font-size: 9px;
              padding: 0 4px;
              height: 16px;
              display: flex;
              align-items: center;
              background: rgba(59, 130, 246, 0.2);
              color: #60a5fa;
              border-radius: 3px;
              border: 1px solid rgba(59, 130, 246, 0.3); // Explicit border
            }
          }

          .folder-path-wrapper {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: copy;
            width: 100%;

            &:hover {
              .folder-path {
                color: #60a5fa;
              }
            }

            .folder-path {
              flex: 1;
              font-size: 10px;
              color: rgba(255, 255, 255, 0.35);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
              transition: color 0.15s;
            }
          }
        }
      }

      .card-extra-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;

        .persistent-count {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          font-family: 'Monaco', monospace;
          background: rgba(255, 255, 255, 0.06);
          padding: 1px 5px;
          border-radius: 4px;
        }

        .hover-actions {
          opacity: 0;
          transform: translateX(5px);
          transition: all 0.2s ease;
          display: flex;
        }

        .action-btn-mini {
          width: 24px !important;
          height: 24px !important;
          padding: 0 !important;
          color: rgba(255, 255, 255, 0.4) !important;

          &:hover {
            background: rgba(255, 255, 255, 0.1) !important;
            color: #fff !important;
          }

          &.remove-btn:hover {
            color: #ef4444 !important;
            background: rgba(239, 68, 68, 0.15) !important;
          }

          .el-icon {
            font-size: 13px;
          }
        }
      }

      &:hover .card-extra-info .hover-actions {
        opacity: 1;
        transform: translateX(0);
      }
    }
  }

  /* 扫描中提示 */
  .scanning-alert {
    margin-top: 16px;
    padding: 12px;
    background: rgba(59, 130, 246, 0.06);
    border: 1px dashed rgba(59, 130, 246, 0.25);
    border-radius: 8px;
  }
}

/* 滚动条样式 */
:deep(.el-scrollbar__bar) {
  opacity: 0.3;
  &.is-vertical {
    width: 4px;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes breathing-glow {
  0%,
  100% {
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.5),
      0 0 0px rgba(59, 130, 246, 0);
  }
  50% {
    box-shadow:
      0 4px 25px rgba(0, 0, 0, 0.6),
      0 0 15px rgba(59, 130, 246, 0.2);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 禁用状态 */
.is-disabled {
  opacity: 0.5;
  pointer-events: none;
  filter: grayscale(1);
}
</style>
