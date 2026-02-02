<template>
  <div class="w-72 flex flex-col border-r border-blue-500/20 h-full">
    <!-- 用户信息区 - 与 QQ 相册样式一致 -->
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

        <!-- AI 统计 Grid -->
        <div class="card-stats">
          <div class="stat-grid">
            <div class="stat-item">
              <span class="label">隐私引擎</span>
              <span class="value text-blue">本地计算已就绪</span>
            </div>
            <div class="stat-item">
              <span class="label">已处理</span>
              <span class="value text-green">{{ formatNumber(aiStore.processedCount) }}</span>
            </div>
            <div class="stat-item">
              <span class="label">速度</span>
              <span class="value text-orange">{{ aiStore.speed || 0 }} img/s</span>
            </div>
            <el-tooltip content="AI 向量数据库本地占用空间" placement="right">
              <div class="stat-item cursor-help">
                <span class="label">存储</span>
                <span class="value text-cyan">{{ formatStorage(aiStore.storageUsed) }}</span>
              </div>
            </el-tooltip>
          </div>
        </div>

        <!-- 卡片底部操作 - 设置和日志 -->
        <div class="card-actions managers-layout" :class="{ 'is-disabled': !aiStore.isModelReady }">
          <div class="manager-item">
            <el-button
              text
              class="action-btn manager-btn"
              title="配置"
              :disabled="!aiStore.isModelReady"
              @click="handleOpenConfig"
            >
              <div class="manager-btn-content">
                <div class="icon-wrapper">
                  <el-icon><Setting /></el-icon>
                </div>
                <div class="text-wrapper">
                  <div class="main-text">设置</div>
                </div>
              </div>
            </el-button>
          </div>
          <div class="manager-item">
            <el-button
              text
              class="action-btn manager-btn"
              title="日志"
              :disabled="!aiStore.isModelReady"
              @click="handleOpenLogs"
            >
              <div class="manager-btn-content">
                <div class="icon-wrapper">
                  <el-icon><Document /></el-icon>
                </div>
                <div class="text-wrapper">
                  <div class="main-text">日志</div>
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

    <!-- 全局分析按钮 - 仅在智能探索视图显示 -->
    <div v-if="aiStore.isModelReady && currentView === 'smart'" class="global-action-section">
      <button
        class="run-analysis-btn"
        :class="{ 'is-running': aiStore.isScanning, 'needs-download': !modelsReady }"
        @click="handleStartAnalysis"
      >
        <div class="btn-content">
          <el-icon class="btn-icon" :class="{ spinning: aiStore.isScanning }">
            <component
              :is="aiStore.isScanning ? Loading : modelsReady ? MagicStick : DownloadIcon"
            />
          </el-icon>
          <div class="btn-text-group">
            <span class="btn-text">{{ analysisBtnText }}</span>
            <span v-if="aiStore.isScanning || aiStore.pendingCount > 0" class="btn-subtext">
              {{
                aiStore.isScanning
                  ? aiStore.currentAnalysisTag || '正在提取特征...'
                  : `发现 ${aiStore.pendingCount} 张新照片`
              }}
            </span>
          </div>
        </div>
        <div class="btn-bg-glow"></div>
        <div
          v-if="aiStore.isScanning"
          class="scan-progress-bar"
          :style="{ width: aiStore.scanProgress + '%' }"
        ></div>
      </button>
    </div>

    <!-- 分类导航 -->
    <div class="flex-1 overflow-hidden menu-container">
      <el-scrollbar class="h-full">
        <div v-if="currentView === 'smart'" class="library-view">
          <!-- 所有照片 - 主入口 -->
          <div class="all-photos-section">
            <div
              class="all-photos-item"
              :class="{
                'is-active': activeCollection === 'overview',
                'is-disabled': !aiStore.isModelReady
              }"
              @click="aiStore.isModelReady && handleCollectionSelect('overview')"
            >
              <el-icon class="item-icon"><DataBoard /></el-icon>
              <span class="item-label">AI 智能概览</span>
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

        <!-- 文件夹列表视图 -->
        <div v-else-if="currentView === 'folders'" class="folder-management-section px-4 pb-4">
          <!-- 快捷入口：所有照片 -->
          <div class="all-photos-section mb-6">
            <div
              class="all-photos-item"
              :class="{
                'is-active': activeCollection === 'all-photos',
                'is-disabled': !aiStore.isModelReady
              }"
              @click="aiStore.isModelReady && handleCollectionSelect('all-photos')"
            >
              <el-icon class="item-icon"><Files /></el-icon>
              <div class="item-content flex flex-col">
                <span class="item-label">所有照片</span>
                <span class="text-[9px] text-white/20 -mt-1 scale-90 origin-left"
                  >功能开发中...</span
                >
              </div>
              <span class="item-count ml-auto">{{ aiStore.totalCount || 0 }}</span>
            </div>
          </div>

          <div class="section-title-row">
            <span class="text-xs font-bold text-white/40 uppercase tracking-wider"
              >扫描范围 ({{ aiStore.allScanPaths.length }})</span
            >
            <el-tooltip content="添加扫描文件夹" placement="top">
              <el-button circle size="small" class="add-folder-btn-mini" @click="handleAddFolder">
                <el-icon><Plus /></el-icon>
              </el-button>
            </el-tooltip>
          </div>

          <div class="folder-cards-list space-y-2">
            <div
              v-for="path in aiStore.allScanPaths"
              :key="path.path"
              class="folder-item-card"
              :class="{ 'is-default': !path.deletable }"
            >
              <!-- 左侧：主要信息区 -->
              <div class="card-body">
                <el-icon class="folder-icon"><Folder /></el-icon>
                <div class="folder-info">
                  <div class="folder-label flex items-center gap-1.5">
                    <span
                      class="name text-[13px] font-semibold text-white/90 truncate max-w-[140px]"
                      >{{ path.label }}</span
                    >
                    <el-tag
                      v-if="!path.deletable"
                      size="small"
                      class="scale-75 origin-left opacity-60"
                      >默认</el-tag
                    >
                  </div>
                  <div class="folder-meta mt-0.5">
                    <el-tooltip :content="path.path" placement="top" :show-after="500">
                      <span
                        class="folder-path text-[10px] text-white/30 truncate max-w-[150px] cursor-pointer hover:text-white/50"
                        @click.stop="handleCopyPath(path.path)"
                      >
                        {{ path.path }}
                      </span>
                    </el-tooltip>
                  </div>
                </div>
              </div>

              <!-- 右侧：独立操作与统计区 -->
              <div class="card-right-actions">
                <div class="action-top">
                  <el-button
                    v-if="path.deletable"
                    text
                    size="small"
                    class="remove-btn-mini"
                    @click.stop="handleRemoveFolder(path.path)"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                  <div v-else class="h-5 w-5"></div>
                  <!-- 占位保持高度一致 -->
                </div>
                <div class="count-bottom">
                  {{ aiStore.folderCounts[path.path] || 0 }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="aiStore.isScanning" class="scanning-alert mt-4">
            <div class="flex items-center gap-2 mb-2">
              <el-icon class="is-loading text-blue-400"><Loading /></el-icon>
              <span class="text-xs font-bold text-blue-400">正在分析新路径...</span>
            </div>
            <div class="text-[10px] text-white/30 leading-relaxed">
              AI 正在提取新文件夹中的视觉特征，这可能需要一点时间。
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 返回 QQ 相册按钮 - 底部 QQ空间经典橙色风格 -->
    <div class="back-to-album-section">
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
import { ref, computed, onMounted, markRaw, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import { useAIStore } from '@renderer/services/ai/store'
import {
  MagicStick,
  Loading,
  Setting,
  Document,
  Monitor,
  SwitchButton,
  Files,
  Folder,
  UserFilled,
  User,
  Star,
  Picture,
  IceCream,
  ChatDotRound,
  ArrowDown,
  Plus,
  Search,
  Close,
  Download as DownloadIcon,
  DataBoard
} from '@element-plus/icons-vue'
import QZoneIcon from '@renderer/icons/qzone.svg'
import { useAIAlbum } from '@renderer/composables/useAIAlbum'

const userStore = useUserStore()
const aiStore = useAIStore()
const downloadStore = useDownloadStore()
const { checkModels } = useAIAlbum()

const modelsReady = ref(true)
const collectionsExpanded = ref(true)

onMounted(async () => {
  const status = await checkModels()
  if (status && typeof status.exists !== 'undefined') {
    modelsReady.value = status.exists
  } else {
    modelsReady.value = false
  }
})

const analysisBtnText = computed(() => {
  if (aiStore.isScanning) return '正在进行智能分析...'
  if (aiStore.systemStatus === 'MODEL_MISSING') return '下载模型以启用 AI'
  if (aiStore.pendingCount > 0) return `启动 AI 分析 (${aiStore.pendingCount})`
  return '启动 AI 分析'
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
  { key: 'smart', label: '智能探索', icon: markRaw(Search) },
  { key: 'folders', label: '文件夹', icon: markRaw(Folder) }
]

// 处理 Tab 切换
const handleViewChange = async (key) => {
  currentView.value = key
  // 切换到文件夹视图时，不自动选择任何内容，且刷新各文件夹的照片数量
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
const collections = shallowRef([
  { key: 'people', icon: markRaw(UserFilled), label: '人物与面孔', count: 0 },
  { key: 'pets', icon: markRaw(Star), label: '宠物', count: 0 },
  { key: 'food', icon: markRaw(IceCream), label: '美食', count: 0 },
  { key: 'scenery', icon: markRaw(Picture), label: '风景', count: 0 },
  { key: 'memes', icon: markRaw(ChatDotRound), label: '表情包', count: 0 },
  { key: 'docs', icon: markRaw(Document), label: '文档票据', count: 0 },
  { key: 'groups', icon: markRaw(User), label: '合照', count: 0 }
])

// 过滤掉 count 为 0 的分类（当 AI 已就绪时）
const activeCollections = computed(() => {
  if (!aiStore.isModelReady) return [] // AI 未就绪时不显示集合
  return collections.value.filter((item) => item.count > 0)
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

const handleOpenConfig = () => {
  console.log('打开配置')
}

const handleOpenLogs = () => {
  console.log('打开日志')
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

// 格式化存储
const formatStorage = (bytes) => {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB'
  return mb.toFixed(1) + ' MB'
}
// 文件夹管理
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

const handleRemoveFolder = (path) => {
  aiStore.removePath(path)
}

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

    /* 卡片统计区域 */
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

            &.text-blue {
              color: #fbbf24;
              text-shadow: 0 0 3px rgba(251, 191, 36, 0.3);
            }

            &.text-green {
              color: #10b981;
              text-shadow: 0 0 3px rgba(16, 185, 129, 0.3);
            }

            &.text-orange {
              color: #f59e0b;
              text-shadow: 0 0 3px rgba(245, 158, 11, 0.3);
            }

            &.text-cyan {
              color: #06b6d4;
              text-shadow: 0 0 3px rgba(6, 182, 212, 0.3);
            }
          }
        }
      }
    }
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
            display: flex;
            align-items: center;
            justify-content: center;

            .el-icon {
              font-size: 14px;
            }
          }

          .text-wrapper {
            .main-text {
              font-size: 11px;
              line-height: 1.2;
              font-weight: 500;
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

/* 4. 全局分析大按钮 - 未来科技风格重塑 */
.global-action-section {
  padding: 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .run-analysis-btn {
    width: 100%;
    height: 52px;
    position: relative;
    border: none;
    background: #0f172a;
    padding: 0 16px;
    border-radius: 14px;
    cursor: pointer;
    overflow: hidden;
    display: flex;
    align-items: center;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    animation: breathing-glow 4s ease-in-out infinite;

    /* 内部渐变背景 */
    &::after {
      content: '';
      position: absolute;
      inset: 1.5px;
      background:
        radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.15) 0, transparent 50%),
        radial-gradient(at 100% 100%, rgba(96, 165, 250, 0.1) 0, transparent 50%),
        linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 12px;
      z-index: 1;
      transition: background 0.4s ease;
    }

    /* 动态旋转边框效果 */
    &::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: conic-gradient(
        transparent,
        rgba(59, 130, 246, 0.3),
        #3b82f6,
        #60a5fa,
        transparent 30%
      );
      animation: rotate 4s linear infinite;
      z-index: 0;
      opacity: 0.8;
    }

    /* 内部额外的 AI 氛围光晕 */
    .btn-bg-glow {
      position: absolute;
      bottom: -30%;
      right: -10%;
      width: 80%;
      height: 80%;
      background: radial-gradient(circle at center, rgba(59, 130, 246, 0.1), transparent 70%);
      pointer-events: none;
      z-index: 2;
    }

    &:hover {
      transform: translateY(-3px) scale(1.01);
      box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3);

      &::after {
        background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
      }

      &::before {
        animation-duration: 2s;
        opacity: 1;
      }

      .btn-content .btn-icon {
        color: #60a5fa;
        transform: scale(1.1) rotate(5deg);
      }
    }

    &:active {
      transform: translateY(-1px) scale(0.99);
    }

    &.is-running {
      pointer-events: none;
      filter: saturate(0.8);

      &::before {
        background: conic-gradient(
          transparent,
          rgba(16, 185, 129, 0.3),
          #10b981,
          #34d399,
          transparent 30%
        );
        animation-duration: 2s;
      }
      .btn-content .btn-text {
        background: linear-gradient(to right, #34d399, #10b981);
        -webkit-background-clip: text;
        background-clip: text;
      }
      .btn-content .btn-icon {
        color: #10b981;
      }
    }

    &.needs-download {
      &::before {
        background: conic-gradient(
          transparent,
          rgba(245, 158, 11, 0.3),
          #f59e0b,
          #fbbf24,
          transparent 30%
        );
      }
    }

    .btn-content {
      position: relative;
      z-index: 3;
      display: flex;
      align-items: center;
      width: 100%;
      gap: 12px;
      color: white;

      .btn-icon {
        font-size: 22px;
        color: rgba(255, 255, 255, 0.8);
        transition: all 0.3s ease;
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));

        &.spinning {
          animation: spin 1.5s linear infinite;
          color: #60a5fa;
        }
      }

      .btn-text-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.25;

        .btn-text {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.8px;
          background: linear-gradient(to right, #fff, rgba(255, 255, 255, 0.8));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-transform: uppercase;
        }

        .btn-subtext {
          font-size: 10px;
          opacity: 0.8;
          font-weight: 600;
          margin-top: 2px;
          color: rgba(96, 165, 250, 0.9);
        }
      }
    }

    .scan-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(to right, #3b82f6, #60a5fa);
      z-index: 4;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
    }
  }
}

/* 5. 菜单列表 */
.menu-container {
  padding-bottom: 20px;

  /* ==================== 智能探索视图 ==================== */
  /* Shared Styles for All Photos Section */
  .all-photos-section {
    margin-bottom: 20px;

    .all-photos-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(96, 165, 250, 0.08));
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(96, 165, 250, 0.12));
        border-color: rgba(59, 130, 246, 0.35);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
      }

      &.is-active {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        border-color: #3b82f6;
        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);

        .item-icon,
        .item-label,
        .item-count {
          color: #fff !important;
        }
        .item-count {
          background: rgba(255, 255, 255, 0.25);
        }
        .text-white\/20 {
          color: rgba(255, 255, 255, 0.6) !important;
        }
      }

      &.is-disabled {
        opacity: 0.5;
        cursor: not-allowed;
        filter: grayscale(1);
      }

      .item-icon {
        font-size: 20px;
        color: #3b82f6;
      }

      .item-label {
        flex: 1;
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .item-count {
        font-size: 12px;
        font-weight: 700;
        color: rgba(59, 130, 246, 0.8);
        background: rgba(59, 130, 246, 0.1);
        padding: 2px 8px;
        border-radius: 20px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      }
    }
  }

  .library-view {
    padding: 8px 12px;

    /* Removed .all-photos-section from here */
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

  /* 所有照片禁用状态 */
  .all-photos-section .all-photos-item.is-disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}

/* ==================== 文件夹管理视图 ==================== */
.folder-management-section {
  padding: 12px;

  /* 标题行 */
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* 添加按钮 */
  .add-folder-btn-mini {
    width: 26px !important;
    height: 26px !important;
    background: rgba(255, 255, 255, 0.06) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    color: rgba(255, 255, 255, 0.5) !important;
    transition: all 0.2s ease !important;

    &:hover {
      background: rgba(59, 130, 246, 0.15) !important;
      border-color: rgba(59, 130, 246, 0.3) !important;
      color: #3b82f6 !important;
      transform: rotate(90deg);
    }

    .el-icon {
      font-size: 13px;
    }
  }

  /* 文件夹卡片列表 */
  .folder-cards-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .folder-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      gap: 12px;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.12);

        .card-right-actions .action-top {
          opacity: 1;
          transform: translateY(0);
        }
      }

      &.is-default {
        background: rgba(59, 130, 246, 0.04);
        border-color: rgba(59, 130, 246, 0.1);

        .folder-icon {
          color: #3b82f6 !important;
        }
      }

      .card-body {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;

        .folder-icon {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.4);
          flex-shrink: 0;
        }

        .folder-info {
          flex: 1;
          min-width: 0;

          .folder-label {
            display: flex;
            align-items: center;
            gap: 6px;

            .name {
              font-size: 13px;
              font-weight: 600;
              color: rgba(255, 255, 255, 0.9);
            }
          }

          .folder-path {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.35);
            margin-top: 2px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 140px; /* 强制限制宽度以防溢出 */
            display: block;
          }
        }
      }

      .card-right-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: space-between;
        height: 38px;
        flex-shrink: 0;
        width: 28px;

        .action-top {
          opacity: 0;
          transform: translateY(-2px);
          transition: all 0.2s ease;
          height: 20px;
          display: flex;
          align-items: center;

          .remove-btn-mini {
            padding: 4px !important;
            height: 20px !important;
            width: 20px !important;
            color: rgba(255, 255, 255, 0.3) !important;
            background: transparent !important;

            &:hover {
              color: #ef4444 !important;
              background: rgba(239, 68, 68, 0.1) !important;
            }

            .el-icon {
              font-size: 12px;
            }
          }
        }

        .count-bottom {
          font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
          font-size: 11px;
          font-weight: 700;
          color: rgba(59, 130, 246, 0.7);
          line-height: 1;
        }
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
