<template>
  <div class="ai-main">
    <!-- 顶部标题栏 -->
    <div class="header-section">
      <div class="header-left flex flex-col gap-1">
        <h2 class="title text-xl font-bold">AI 智能相册</h2>
        <div class="flex items-center gap-1.5 text-gray-400 text-xs">
          <el-icon class="flex items-center justify-center opacity-70"><Lock /></el-icon>
          <span>100% 本地隐私计算</span>
        </div>
      </div>

      <!-- Top Center: Analysis Progress -->
      <div class="header-center">
        <div
          v-if="aiStore.isScanning || aiStore.analysisStatus === 'ANALYZING'"
          class="analysis-progress-center"
        >
          <div class="progress-info">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span class="curr-file">{{ aiStore.currentAnalysisTag || '正在分析...' }}</span>
            <span class="progress-text"
              >{{ aiStore.progress.current }}/{{ aiStore.progress.total }}</span
            >
          </div>
          <el-progress
            :percentage="aiStore.scanProgress"
            :stroke-width="4"
            :show-text="false"
            class="center-progress-bar"
          />
        </div>
      </div>

      <div class="header-right">
        <!-- AI 实时仪表盘 - 性能监控 -->
        <!-- 只要有性能数据就显示，不必等模型就绪 -->
        <div v-if="aiStore.isReady || aiStore.isModelReady" class="performance-capsules">
          <!-- Capsule A: System Load -->
          <div class="capsule system-load">
            <span class="cap-item">🧠 CPU {{ aiStore.performance.cpu }}%</span>
            <span class="cap-divider"></span>
            <span class="cap-item">📝 RAM {{ aiStore.performance.memoryVal }}G</span>
          </div>

          <!-- Capsule B: AI Accelerator -->
          <div class="capsule ai-accel" :class="{ 'is-active': aiStore.isScanning }">
            <span class="accel-icon">⚡️</span>
            <span class="accel-text">
              {{
                aiStore.isScanning
                  ? `${aiStore.gpuDisplayName} ${85 + Math.floor(Math.random() * 10)}%`
                  : 'GPU Idle'
              }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 进度条区域 -->
    <!-- 深度重构的进度区域 (匹配 Mockup) -->
    <div
      v-if="aiStore.isScanning || aiStore.analysisStatus === 'ANALYZING'"
      class="analysis-progress-panel"
    >
      <div class="panel-content">
        <!-- 左侧图标与标题 -->
        <div class="panel-left">
          <div class="ai-chip-container">
            <el-icon class="chip-icon"><Cpu /></el-icon>
          </div>
          <div class="title-group">
            <div class="flex items-center gap-2">
              <h3 class="panel-title">智能分类处理中</h3>
              <div class="status-badge-active">ACTIVE</div>
            </div>
            <p class="panel-subtitle">
              本地神经引擎正在分析 {{ aiStore.progress.total }} 个新项目。您的数据从未离开此设备。
            </p>
          </div>
        </div>

        <!-- 右侧进度与操作 -->
        <div class="panel-right">
          <div class="progress-stats">
            <div class="percent-text">{{ onboardingProgress }}%</div>
            <div class="count-text">
              {{ aiStore.progress.current.toLocaleString() }} /
              {{ aiStore.progress.total.toLocaleString() }} 项
            </div>
          </div>
          <el-button class="pause-btn" @click="handlePauseScan">
            <el-icon class="mr-1"><VideoPause /></el-icon>
            暂停扫描
          </el-button>
        </div>
      </div>
      <!-- 底部发光进度条 -->
      <div class="bottom-progress-container">
        <div class="bottom-progress-track">
          <div class="bottom-progress-fill" :style="{ width: `${onboardingProgress}%` }"></div>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div v-if="aiStore.isModelReady" class="toolbar-section">
      <div class="toolbar-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox>
        <span class="selected-count">{{ selectedCount }} / {{ totalCount }} 已选择</span>
      </div>
      <div class="toolbar-right">
        <div class="segmented-control">
          <div
            v-for="size in sizes"
            :key="size.key"
            class="segment-item"
            :class="{ active: currentSize === size.key }"
            @click="currentSize = size.key"
          >
            {{ size.label }}
          </div>
        </div>
        <el-button type="primary" size="small" class="export-btn">
          <el-icon class="mr-1"><Upload /></el-icon>
          导出到本地
        </el-button>
      </div>
    </div>

    <!-- 内容滚动区 -->
    <el-scrollbar v-if="aiStore.isReady && aiStore.isModelReady" class="content-scroll">
      <!-- 1. 概览视图 (首页) -->
      <div v-if="aiStore.selectedFilter.type === 'overview'" class="p-5">
        <!-- 此处后续可以放置更加丰富的概览统计，目前复用智能探索的布局 -->
        <!-- 人物检测区 -->
        <div class="content-section">
          <div class="section-header">
            <div class="section-title">
              <span class="title-bar"></span>
              人物检测
              <el-tag
                v-if="newPeopleCount > 0"
                size="small"
                type="success"
                effect="plain"
                class="ml-2"
              >
                {{ newPeopleCount }} 新面孔
              </el-tag>
            </div>
            <div class="section-actions">
              <el-button text size="small" class="action-link" @click="handleOrganizePeople">
                整理并合并
              </el-button>
              <el-button text size="small" class="action-link" @click="handleViewAllPeople">
                查看全部
              </el-button>
            </div>
          </div>
          <div class="people-grid">
            <div
              v-for="person in detectedPeople"
              :key="person.id"
              class="person-card"
              @click="handlePersonClick(person)"
            >
              <div class="avatar-wrapper">
                <div class="mini-avatar-crop">
                  <img
                    :src="person.faceThumbnail || 'qzone-local://' + person.coverPath"
                    :style="person.faceThumbnail ? { objectFit: 'cover' } : getFaceStyle(person)"
                  />
                </div>
                <span class="photo-count">{{ person.count }}</span>
              </div>
              <span class="person-name">{{ person.name || '未知' }}</span>
            </div>
            <div class="person-card scan-more" @click="handleScanMore">
              <div class="scan-icon">
                <el-icon><Camera /></el-icon>
              </div>
              <span class="person-name">扫描更多</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 文件夹视图 (之前误删的占位) -->

      <!-- 3. 人物墙视图 -->
      <div v-else-if="aiStore.selectedFilter.type === 'people'" class="people-wall-view p-6">
        <div class="view-header flex items-center justify-between mb-8">
          <div class="header-left">
            <div class="flex items-center gap-3">
              <el-button circle :icon="ArrowLeft" class="back-btn" @click="handleBackToOverview" />
              <h2 class="text-2xl font-bold text-white/90">人物墙</h2>
            </div>
            <p class="text-xs text-white/40 mt-2 ml-12">
              隐私引擎已自动对您的相册进行了离线聚类，发现
              {{ aiStore.detectedPeople.length }} 位人物
            </p>
          </div>
          <div class="header-right">
            <el-button type="primary" plain round :icon="Refresh" @click="handleOrganizePeople">
              重新整理
            </el-button>
          </div>
        </div>

        <div
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
        >
          <div
            v-for="person in aiStore.detectedPeople"
            :key="person.id"
            class="person-wall-card group cursor-pointer"
            @click="handlePersonClick(person)"
          >
            <div class="avatar-container shadow-xl">
              <img
                :src="person.faceThumbnail || 'qzone-local://' + person.coverPath"
                class="face-img group-hover:scale-110 transition-transform duration-500"
                :style="person.faceThumbnail ? { objectFit: 'cover' } : getFaceStyle(person)"
              />
              <div class="card-overlay">
                <div class="photo-count-badge">
                  <el-icon class="mr-1 mt-0.5"><Picture /></el-icon>
                  {{ person.count }}
                </div>
              </div>
            </div>
            <div class="person-info p-3">
              <div class="name-row flex items-center justify-between">
                <span class="name text-sm font-bold text-white/90">{{ person.name }}</span>
                <el-tag size="small" effect="plain" class="gender-tag">{{
                  person.gender === 'male' ? '男' : '女'
                }}</el-tag>
              </div>
              <div class="meta-row mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
                <span>预测年龄: {{ person.age }} 岁</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 人物详情页 -->
      <div v-else-if="aiStore.selectedFilter.type === 'person'" class="person-detail-view p-6">
        <div class="detail-header flex items-center gap-6 mb-8 mt-2">
          <el-button circle :icon="ArrowLeft" size="large" @click="handleBackToWall" />
          <div class="person-summary flex items-center gap-4">
            <div class="mini-avatar">
              <img
                :src="currentPerson?.faceThumbnail || 'qzone-local://' + currentPerson?.coverPath"
                :style="
                  currentPerson?.faceThumbnail
                    ? { objectFit: 'cover' }
                    : getFaceStyle(currentPerson)
                "
              />
            </div>
            <div>
              <h2 class="text-2xl font-bold">{{ currentPerson?.name }}</h2>
              <div class="text-xs text-white/40 mt-1 flex items-center gap-3">
                <span>共 {{ personPhotos.length }} 张照片</span>
                <span class="w-1 h-1 rounded-full bg-white/10"></span>
                <span>{{ currentPerson?.gender === 'male' ? '男性' : '女性' }}</span>
                <span class="w-1 h-1 rounded-full bg-white/10"></span>
                <span>约 {{ currentPerson?.age }} 岁</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 照片网格 -->
        <div class="photos-grid">
          <PhotoCard
            v-for="photo in personPhotos"
            :key="photo.path"
            :photo="photo"
            :size="currentSize"
          />
        </div>
      </div>

      <!-- 3. 文件夹详情 -->
      <div v-else-if="aiStore.selectedFilter.type === 'folder'" class="folder-detail-view">
        <!-- 头部区域 - 仿 QQ 空间相册风格 -->
        <div class="view-header-qzone px-6 pt-4 pb-2">
          <div class="header-content flex items-start gap-3">
            <!-- 返回按钮 -->
            <div
              class="back-btn-square flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
              @click="handleBackToOverview"
            >
              <el-icon class="text-white/70"><ArrowLeft /></el-icon>
            </div>

            <!-- 详情信息 -->
            <div class="info-group flex-1">
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-bold text-white/90">文件目录</h2>
                <el-tag
                  effect="dark"
                  round
                  size="small"
                  class="bg-blue-500/20 border-blue-500/30 text-blue-400"
                >
                  共 {{ folderPhotos.length }} 张照片
                </el-tag>
              </div>
              <p
                class="text-xs text-secondary mt-1 font-mono opacity-50 break-all leading-relaxed max-w-2xl select-text"
              >
                {{ aiStore.selectedFilter.value }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="folderPhotos.length > 0" class="photos-grid px-8 pb-12">
          <PhotoCard
            v-for="photo in folderPhotos"
            :key="photo.path"
            :photo="photo"
            :size="currentSize"
          />
        </div>
        <div v-else class="empty-placeholder py-32 flex flex-col items-center justify-center">
          <!-- 这里的图片将来可以换成更酷炫的 -->
          <div class="w-32 h-32 mb-4 opacity-20">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-full h-full text-white"
            >
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
              ></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <span class="text-sm text-white/30 tracking-wider">该目录下暂无已分析的照片</span>
        </div>
      </div>
    </el-scrollbar>

    <!-- 4. Onboarding / 模型初始化引导 (仅模型未就绪时) -->
    <div v-else-if="aiStore.isReady && !aiStore.isModelReady" class="onboarding-view">
      <div class="onboarding-content">
        <div class="illustration-wrapper">
          <div class="ai-sparkle">
            <el-icon><MagicStick /></el-icon>
          </div>
        </div>
        <h1 class="onboarding-title">
          {{ aiStore.isModelReady ? 'AI 智能探索' : '开启 AI 智能相册' }}
        </h1>
        <p class="onboarding-desc">
          {{
            aiStore.isModelReady
              ? '您的私有 AI 助手已就绪，正在通过高性能人脸识别为您智能整理照片。'
              : '为了保护隐私，所有识别模型将下载至本地运行。初始化后，您可以体验：人物自动聚类、面孔精选时刻等功能。'
          }}
        </p>
        <div class="privacy-badge">
          <el-icon><Lock /></el-icon>
          100% 本地离线处理，数据不传云端
        </div>

        <!-- 概览模式下的快捷操作 -->
        <div
          v-if="aiStore.isModelReady && aiStore.selectedFilter.type === 'overview'"
          class="overview-actions mt-8 flex gap-4"
        >
          <div class="action-card" @click="aiStore.setSelectedFilter('all')">
            <el-icon><MagicStick /></el-icon>
            <span>智能推选</span>
          </div>
          <div class="action-card" @click="emit('scan-more')">
            <el-icon><Folder /></el-icon>
            <span>路径管理</span>
          </div>
        </div>

        <div v-if="!aiStore.modelStatus.downloading && !aiStore.isScanning" class="action-wrapper">
          <!-- 错误提示区 -->
          <div v-if="aiStore.initError" class="error-card">
            <div class="error-card-inner">
              <el-icon class="error-icon"><Warning /></el-icon>
              <div class="error-body">
                <div class="error-title">{{ errorTitle }}</div>
                <div class="error-desc">{{ errorDescription }}</div>
                <div v-if="errorSuggestion" class="error-suggestion">💡 {{ errorSuggestion }}</div>
              </div>
            </div>
          </div>

          <button
            class="init-btn-base"
            :class="[`ai-btn-style-${currentBtnStyle}`, { 'is-retry': aiStore.initError }]"
            @click="handleInitAI"
          >
            <span class="btn-content">
              {{ initButtonText }}
              <el-icon class="ml-2 icon-arrow"
                ><component :is="aiStore.initError ? Refresh : Right"
              /></el-icon>
            </span>
            <!-- 装饰性元素 (部分样式可能会用到) -->
            <div class="btn-glow"></div>
            <div class="btn-border"></div>
            <div class="btn-shine"></div>
          </button>
        </div>

        <!-- 下载/初始化进度展示 -->
        <div v-else class="init-progress-wrapper w-full mt-8">
          <div class="flex justify-between mb-2 text-sm text-white/70">
            <span>{{ onboardingStatusText }}</span>
            <span>{{ onboardingProgress }}%</span>
          </div>
          <el-progress
            :percentage="onboardingProgress"
            :show-text="false"
            :stroke-width="8"
            striped
            striped-flow
            class="custom-init-progress"
          />
          <div class="mt-2 text-xs text-white/40">
            {{ onboardingSubText }}
          </div>
        </div>

        <!-- 样式切换器 (开发预览用) -->
        <div
          v-if="!aiStore.modelStatus.downloading && !aiStore.isScanning"
          class="style-switcher mt-12 py-4 border-t border-white/10 w-full"
        >
          <div class="text-xs text-white/30 text-center mb-3 font-mono">
            STYLE SELECTOR (PREVIEW)
          </div>
          <div class="flex flex-wrap justify-center gap-2">
            <div
              v-for="i in 10"
              :key="i - 1"
              class="style-chip"
              :class="{ active: currentBtnStyle === i - 1 }"
              @click="currentBtnStyle = i - 1"
            >
              {{ i - 1 }}
            </div>
          </div>
        </div>
        <div class="onboarding-footer">首次索引可能消耗较多电量，建议连接电源</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAIStore } from '@renderer/services/ai/store'
import PhotoCard from '@renderer/components/business/PhotoCard/index.vue'
import {
  Right,
  Warning,
  Folder,
  Cpu,
  VideoPause,
  ArrowLeft,
  Picture,
  Lock,
  Upload,
  Camera,
  MagicStick,
  Refresh,
  Loading
} from '@element-plus/icons-vue'

const aiStore = useAIStore()

const emit = defineEmits(['refresh', 'pause-scan', 'scan-more', 'init-ai'])

// Onboarding 状态文案
const onboardingStatusText = computed(() => {
  if (aiStore.modelStatus.downloading) return '正在加载识别模型...'
  if (aiStore.isScanning) return '正在分析图库...'
  return '准备中...'
})

const onboardingProgress = computed(() => {
  if (aiStore.modelStatus.downloading) return aiStore.modelStatus.progress
  if (aiStore.isScanning) return aiStore.scanProgress
  return 0
})

const onboardingSubText = computed(() => {
  if (aiStore.modelStatus.downloading) return '模型文件约 152MB，旨在保护您的隐私'
  if (aiStore.isScanning) return aiStore.currentAnalysisTag || '正在进行人脸分析...'
  return ''
})

// 错误信息解析 - 根据错误类型提供更友好的提示
const errorTitle = computed(() => {
  const err = aiStore.initError || ''
  if (err.includes('not valid JSON') || err.includes('Unexpected token')) {
    return 'AI 模型加载失败'
  }
  if (err.includes('WebGPU') || err.includes('GPU')) {
    return 'GPU 加速不可用'
  }
  if (err.includes('network') || err.includes('fetch') || err.includes('timeout')) {
    return '网络连接问题'
  }
  if (err.includes('Human')) {
    return 'Human 模型加载失败'
  }
  return '初始化遇到问题'
})

const errorDescription = computed(() => {
  const err = aiStore.initError || ''
  if (err.includes('not valid JSON') || err.includes('Unexpected token')) {
    return '模型文件可能已损坏或格式不正确。'
  }
  if (err.includes('WebGPU')) {
    return '您的设备可能不支持 WebGPU 硬件加速。'
  }
  // 默认显示原始错误
  return err
})

const errorSuggestion = computed(() => {
  const err = aiStore.initError || ''
  if (err.includes('not valid JSON') || err.includes('Unexpected token')) {
    return '请尝试删除模型文件后重新下载，或检查网络连接是否稳定。'
  }
  if (err.includes('WebGPU')) {
    return '请更新系统和浏览器到最新版本，或尝试重启应用。'
  }
  if (err.includes('Human')) {
    return '请确保应用资源文件完整，或尝试重新安装应用。'
  }
  return '请点击重试，如果问题持续存在，请反馈给开发者。'
})

const initButtonText = computed(() => {
  if (!aiStore.initError) {
    return '立即初始化 AI 引擎 (152MB)'
  }
  const err = aiStore.initError || ''
  if (err.includes('not valid JSON') || err.includes('Unexpected token')) {
    return '重新加载模型'
  }
  return '重试初始化'
})

// 仪表盘与搜索状态
// const searchQuery = ref('')
// const searchResults = ref([])
// const memories = ref([])

// 人物聚类相关逻辑
const detectedPeople = computed(() => {
  const people = aiStore.detectedPeople || []
  if (aiStore.selectedFilter.type === 'overview') {
    return people.slice(0, 12)
  }
  return people
})
const newPeopleCount = computed(() => detectedPeople.value.length) // 暂时简单处理
const currentPerson = ref(null)
const personPhotos = ref([])
const folderPhotos = ref([])

// 监听全选筛选器
watch(
  () => aiStore.selectedFilter,
  async (newFilter) => {
    if (newFilter.type === 'folder' && newFilter.value) {
      folderPhotos.value = await aiStore.fetchPhotosByFolder(newFilter.value)
    } else if (newFilter.type === 'person' && newFilter.value) {
      personPhotos.value = await aiStore.fetchPhotosByFace(newFilter.value)
    }
  },
  { deep: true, immediate: true }
)

onMounted(async () => {
  // 详情页加载时，如果正在人物墙视图，尝试获取一次
  if (aiStore.selectedFilter.type === 'people' || aiStore.selectedFilter.type === 'overview') {
    console.log('[Main] 初始化加载人物分组...')
    await aiStore.fetchFaceGroups()
  }
})

const handleBackToOverview = () => {
  aiStore.setSelectedFilter('overview')
}

const handleBackToWall = () => {
  aiStore.setSelectedFilter('people')
}

const handleViewAllPeople = () => {
  aiStore.setSelectedFilter('people')
  aiStore.fetchFaceGroups()
}

const handlePersonClick = (person) => {
  currentPerson.value = person
  aiStore.setSelectedFilter('person', person.id)
}

const handleOrganizePeople = async () => {
  const loading = ElMessage.info({
    message: '正在整理库中所有人物面孔...',
    duration: 0
  })
  try {
    const res = await aiStore.organizePeople()
    loading.close()
    if (res.success) {
      ElMessage.success(`整理完成，共发现 ${res.count} 位识别人物`)
    } else {
      ElMessage.error('整理失败: ' + res.msg)
    }
  } catch {
    loading.close()
    ElMessage.error('服务异常')
  }
}

const getFaceStyle = (person) => {
  if (!person || !person.faceBox || !person.coverWidth) return {}
  const [x, y, w, h] = person.faceBox
  const { coverWidth, coverHeight } = person

  // 计算中心点百分比
  const centerX = ((x + w / 2) / coverWidth) * 100
  const centerY = ((y + h / 2) / coverHeight) * 100

  // 我们希望脸部占满容器的 70%
  const scale = 1 / (w / coverWidth / 0.7)

  return {
    objectPosition: `${centerX}% ${centerY}%`,
    transform: `scale(${Math.max(1, scale)})`,
    objectFit: 'cover'
  }
}

// 工具栏
const selectAll = ref(false)
const selectedCount = ref(0)
const totalCount = computed(() => aiStore.totalCount || 0)
const currentSize = ref('s')
const sizes = [
  { key: 'xs', label: '最小' },
  { key: 's', label: '小' },
  { key: 'm', label: '中' },
  { key: 'l', label: '大' }
]

const handleSelectAll = (val) => {
  selectedCount.value = val ? totalCount.value : 0
}

const handlePauseScan = () => {
  emit('pause-scan')
}

const handleScanMore = () => {
  emit('scan-more')
}

const handleInitAI = () => {
  emit('init-ai')
}

// 样式选择
const currentBtnStyle = ref(0)

// 监听过滤器
watch(
  () => aiStore.selectedFilter,
  () => {
    // searchQuery.value = ''
    // 暂时不获取照片
  },
  { deep: true, immediate: true }
)
</script>

<style lang="scss" scoped>
.ai-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .header-left {
    display: flex;
    flex-direction: column;

    .title {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      margin: 0;
      line-height: 1.2;
    }
  }

  .header-center {
    flex: 1;
    max-width: 460px;
    margin: 0 20px;

    .search-input {
      :deep(.el-input__wrapper) {
        background: rgba(255, 255, 255, 0.05);
        box-shadow: none;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding-left: 12px;
        transition: all 0.3s;

        &:hover,
        &.is-focus {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(64, 158, 255, 0.4);
          box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.1) inset;
        }
      }

      :deep(.el-input__inner) {
        color: #fff;
        font-size: 13px;
        height: 34px;

        &::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;

    .performance-capsules {
      display: flex;
      gap: 8px;
      align-items: center;

      .capsule {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 500;
        transition: all 0.3s ease;
        height: 32px;
        box-sizing: border-box;

        .cap-divider {
          width: 1px;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
          margin: 0 4px;
        }

        &.ai-accel {
          &.is-active {
            background: rgba(99, 102, 241, 0.15);
            border-color: rgba(99, 102, 241, 0.3);
            color: #a5b4fc;
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.15);

            .accel-text {
              color: #a5b4fc;
              font-weight: 600;
            }
          }

          .accel-icon {
            font-size: 10px;
          }
        }
      }
    }
  }

  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
    padding: 0 20px;

    .analysis-progress-center {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 6px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 300px;

      .progress-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        :deep(.el-progress-bar__inner) {
          background-color: #3b82f6 !important;
        }
      }
    }
  }
}

@keyframes pulse-mini {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.overview-actions {
  margin: 20px 0;
  .action-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 16px 20px;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    min-width: 120px;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-2px);
      border-color: #3b82f6;
    }

    .el-icon {
      font-size: 28px;
      color: #3b82f6;
    }

    span {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.onboarding-view {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: radial-gradient(circle at center, rgba(59, 130, 246, 0.05) 0%, transparent 70%);

  .onboarding-content {
    max-width: 500px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;

    .illustration-wrapper {
      margin-bottom: 24px;
      position: relative;

      .ai-sparkle {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 40px;
        box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
        animation: float 3s ease-in-out infinite;

        &::after {
          content: '';
          position: absolute;
          inset: -10px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 25px;
          filter: blur(15px);
          z-index: -1;
        }
      }
    }

    .onboarding-title {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }

    .onboarding-desc {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.6;
      margin-bottom: 32px;
    }

    .privacy-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 100px;
      font-size: 13px;
      color: #10b981;
      font-weight: 600;
      margin-bottom: 32px;
    }

    // 操作区容器
    .action-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      width: 100%;
      max-width: 400px;
    }

    // 错误卡片样式
    .error-card {
      width: 100%;
      padding: 16px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 12px;

      .error-card-inner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .error-icon {
        color: #f87171;
        font-size: 20px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .error-body {
        flex: 1;
        text-align: left;

        .error-title {
          font-size: 14px;
          font-weight: 600;
          color: #f87171;
          margin-bottom: 6px;
        }

        .error-desc {
          font-size: 12px;
          color: rgba(248, 113, 113, 0.8);
          line-height: 1.5;
          word-break: break-word;
        }

        .error-suggestion {
          margin-top: 10px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.4;
        }
      }
    }

    // 基础按钮重置
    .init-btn-base {
      position: relative;
      min-width: 280px;
      height: 56px;
      border: none;
      outline: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      user-select: none;
      overflow: hidden; // 防止内部光效溢出

      .btn-content {
        position: relative;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.3s ease;
      }

      .btn-glow,
      .btn-border,
      .btn-shine {
        position: absolute;
        inset: 0;
        pointer-events: none;
        transition: all 0.5s ease;
      }

      &:active {
        transform: scale(0.98);
      }

      // --- Style 0: Nexus Core (经典升级) ---
      &.ai-btn-style-0 {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);

        &:hover {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          box-shadow:
            0 12px 28px rgba(37, 99, 235, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          transform: translateY(-2px);
        }
      }

      // --- Style 1: Deep Cosmos (深空) ---
      &.ai-btn-style-1 {
        background: radial-gradient(circle at center, #4f46e5 0%, #312e81 100%);
        border-radius: 30px;
        box-shadow: 0 10px 30px -10px rgba(79, 70, 229, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);

        .btn-glow {
          background: radial-gradient(
            circle at 50% -20%,
            rgba(255, 255, 255, 0.2),
            transparent 70%
          );
          opacity: 0.6;
        }

        &:hover {
          box-shadow: 0 0 25px rgba(99, 102, 241, 0.5);
          border-color: rgba(99, 102, 241, 0.5);

          .btn-content {
            letter-spacing: 1px;
          }
        }
      }

      // --- Style 2: Neon Flux (赛博霓虹) ---
      &.ai-btn-style-2 {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid #06b6d4;
        border-radius: 4px;
        color: #06b6d4;
        box-shadow:
          0 0 10px rgba(6, 182, 212, 0.1),
          inset 0 0 10px rgba(6, 182, 212, 0.1);
        font-family: 'Space Mono', monospace;
        letter-spacing: 1px;

        .btn-shine {
          background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.2), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }

        &:hover {
          background: rgba(6, 182, 212, 0.1);
          box-shadow:
            0 0 20px rgba(6, 182, 212, 0.4),
            inset 0 0 15px rgba(6, 182, 212, 0.2);
          text-shadow: 0 0 8px rgba(6, 182, 212, 0.8);

          .btn-shine {
            transform: translateX(100%);
          }
        }
      }

      // --- Style 3: Glass Pure (极简磨砂) ---
      &.ai-btn-style-3 {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        color: #fff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

        &:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
      }

      // --- Style 4: Aurora (极光) ---
      &.ai-btn-style-4 {
        background: linear-gradient(90deg, #10b981, #3b82f6);
        border-radius: 50px;

        &::before {
          content: '';
          position: absolute;
          inset: 2px;
          background: #0f172a; // 假镂空
          border-radius: 48px;
          z-index: 1;
        }

        .btn-content {
          background: linear-gradient(90deg, #34d399, #60a5fa);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 800;
        }

        &:hover {
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
          transform: scale(1.02);

          &::before {
            background: #1e293b;
          }
        }
      }

      // --- Style 5: Cyber Dark (硬核科技) ---
      &.ai-btn-style-5 {
        background: #000;
        border: 1px solid #333;
        border-radius: 0;
        color: #fff;
        clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        text-transform: uppercase;
        font-size: 14px;
        letter-spacing: 2px;

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          right: 0;
          width: 8px;
          height: 8px;
          background: #fff;
        }

        &:hover {
          background: #fff;
          color: #000;
          border-color: #fff;
        }
      }

      // --- Style 6: Future Silver (液态银) ---
      &.ai-btn-style-6 {
        background: linear-gradient(180deg, #f1f5f9 0%, #cbd5e1 100%);
        border-radius: 12px;
        color: #0f172a;
        box-shadow:
          0 4px 6px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(255, 255, 255, 0.5) inset,
          0 -2px 5px rgba(0, 0, 0, 0.1) inset;

        .icon-arrow {
          color: #0f172a;
        }

        &:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 8px 15px rgba(255, 255, 255, 0.2);
        }
      }

      // --- Style 7: Quantum Dot (量子点阵) ---
      &.ai-btn-style-7 {
        background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;

        .btn-border {
          background-image: radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px);
          background-size: 8px 8px;
          opacity: 0.3;
        }

        &:hover {
          box-shadow: 0 0 30px rgba(124, 58, 237, 0.4);

          .btn-border {
            opacity: 0.5;
            transform: scale(1.1);
          }
        }
      }

      // --- Style 8: Liquid Metal (流体渐变) ---
      &.ai-btn-style-8 {
        background: linear-gradient(270deg, #ff0080, #7928ca, #ff0080);
        background-size: 200% 200%;
        border-radius: 50px;
        animation: gradient-anim 3s ease infinite;
        box-shadow: 0 10px 25px rgba(121, 40, 202, 0.4);

        @keyframes gradient-anim {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        &:hover {
          transform: scale(1.03);
          box-shadow: 0 15px 35px rgba(255, 0, 128, 0.5);
        }
      }

      // --- Style 9: Bold AI (强力蓝) ---
      &.ai-btn-style-9 {
        background: #0066ff;
        border-radius: 12px;
        border: 2px solid #0052cc;
        box-shadow: 4px 4px 0px 0px #003380;
        transition:
          transform 0.1s,
          box-shadow 0.1s;

        &:hover {
          transform: translate(2px, 2px);
          box-shadow: 2px 2px 0px 0px #003380;
        }
        &:active {
          transform: translate(4px, 4px);
          box-shadow: 0px 0px 0px 0px #003380;
        }
      }

      // 重试状态强制覆盖
      &.is-retry {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
        box-shadow: 0 8px 20px rgba(245, 158, 11, 0.25) !important;
        border: none !important;
        border-radius: 12px !important;
        color: #fff !important;
        transform: none !important;
        clip-path: none !important;

        .btn-content {
          -webkit-text-fill-color: #fff !important;
        }

        // 移除特殊装饰
        .btn-glow,
        .btn-border,
        .btn-shine {
          display: none;
        }
        &::before,
        &::after {
          display: none;
        }
      }
    }

    .style-switcher {
      .style-chip {
        width: 24px;
        height: 24px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.5);
        transition: all 0.2s;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        &.active {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
        }
      }
    }

    .onboarding-footer {
      margin-top: 20px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
    }
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.custom-init-progress {
  :deep(.el-progress-bar__outer) {
    background: rgba(255, 255, 255, 0.05);
  }
  :deep(.el-progress-bar__inner) {
    background: linear-gradient(90deg, #3b82f6, #6366f1);
  }
}

.analysis-progress-panel {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  margin: 10px 20px;
  padding: 16px 24px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);

  .panel-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }

  .panel-left {
    display: flex;
    align-items: center;
    gap: 20px;

    .ai-chip-container {
      width: 56px;
      height: 56px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;

      .chip-icon {
        font-size: 28px;
        color: #10b981;
        filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4));
      }
    }

    .title-group {
      .panel-title {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.5px;
      }

      .status-badge-active {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        font-size: 10px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 6px;
        border: 1px solid rgba(16, 185, 129, 0.3);
        letter-spacing: 1px;
      }

      .panel-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 6px;
        font-weight: 400;
      }
    }
  }

  .panel-right {
    display: flex;
    align-items: center;
    gap: 32px;

    .progress-stats {
      text-align: right;

      .percent-text {
        font-size: 32px;
        font-weight: 800;
        color: #fff;
        line-height: 1;
      }

      .count-text {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 4px;
        font-weight: 500;
      }
    }

    .pause-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #fff;
      height: 48px;
      padding: 0 20px;
      border-radius: 12px;
      font-weight: 600;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .bottom-progress-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;

    .bottom-progress-track {
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.05);
    }

    .bottom-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981, #6366f1);
      border-top-right-radius: 2px;
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
      transition: width 0.6s cubic-bezier(0.1, 0, 0, 1);
    }
  }
}

.toolbar-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .selected-count {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;

    .segmented-control {
      display: flex;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      padding: 1.5px;
      overflow: hidden;

      .segment-item {
        padding: 2px 8px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
          color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.03);
        }

        &.active {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
      }
    }

    .export-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      font-weight: 600;
      border-radius: 8px;
      margin-left: 8px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
      }
    }
  }
}

.content-scroll {
  flex: 1;
  // padding: 20px; // Removed to allow full-width headers
}

.content-section {
  margin-bottom: 24px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;

      .title-bar {
        width: 3px;
        height: 14px;
        background: #3b82f6;
        border-radius: 2px;
      }
    }

    .section-actions {
      display: flex;
      gap: 8px;
    }

    .action-link {
      color: #3b82f6;
      font-size: 11px;
      font-weight: 500;

      &:hover {
        color: #60a5fa;
        background: transparent;
        text-decoration: underline;
      }
    }
  }
}

.people-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  .person-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    min-width: 80px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .avatar-wrapper {
      position: relative;
      margin-bottom: 8px;

      .mini-avatar-crop {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        overflow: hidden;
        background: #1a1a1a;
        border: 2px solid rgba(255, 255, 255, 0.1);

        img {
          width: 100%;
          height: 100%;
        }
      }

      .photo-count {
        position: absolute;
        bottom: -2px;
        right: -2px;
        background: #3b82f6;
        color: #fff;
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 8px;
      }
    }

    .person-name {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
    }

    &.scan-more {
      border-style: dashed;

      .scan-icon {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 50%;
        font-size: 20px;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 8px;
      }
    }
  }
}

.scenes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;

  .scene-card {
    position: relative;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateY(-1px);
    }

    .scene-count {
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      background: rgba(0, 0, 0, 0.2);
      padding: 2px 6px;
      border-radius: 8px;
    }

    .scene-icon {
      font-size: 28px;
      display: block;
      margin-bottom: 12px;
    }

    .scene-info {
      .scene-name {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 2px;
      }

      .scene-time {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
      }
    }
  }
}

.memories-grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .memory-card {
    position: relative;
    min-width: 200px;
    height: 120px;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;

    &:hover {
      transform: scale(1.02);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);

      .memory-overlay {
        background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
      }
    }

    .memory-image {
      width: 100%;
      height: 100%;
    }

    .memory-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 10px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 60%);
      transition: all 0.3s ease;

      .memory-label {
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 2px;
      }

      .memory-date {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }
    }
  }
}

.title-bar.orange {
  background: #f59e0b !important;
}

/* 人物墙与详情 */
.people-wall-view {
  .back-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    &:hover {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.3);
    }
  }

  .person-wall-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(59, 130, 246, 0.4);
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
    }

    .avatar-container {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      background: #1a1a1a;

      .face-img {
        width: 100%;
        height: 100%;
        transition: transform 0.6s cubic-bezier(0.1, 0, 0, 1);
      }

      .card-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.4) 0%, transparent 40%);
        pointer-events: none;

        .photo-count-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      }
    }

    .gender-tag {
      background: rgba(59, 130, 246, 0.1) !important;
      border-color: rgba(59, 130, 246, 0.3) !important;
      color: #60a5fa !important;
      font-size: 10px;
      padding: 0 6px;
      height: 18px;
    }
  }
}

.person-detail-view {
  .mini-avatar {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid rgba(59, 130, 246, 0.3);
    background: #1a1a1a;
    img {
      width: 100%;
      height: 100%;
    }
  }

  .photos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
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
</style>
