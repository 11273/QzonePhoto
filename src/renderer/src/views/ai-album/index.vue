<template>
  <div class="ai-album-container">
    <AILeftSidebar @start-analysis="handleStartAnalysis" @back-to-album="handleBackToAlbum" />
    <AIMainContent
      @refresh="handleRefresh"
      @pause-scan="handlePauseScan"
      @scan-more="handleScanMore"
      @init-ai="handleStartAnalysis"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useAIStore } from '@renderer/services/ai/store'
import { ElMessage } from 'element-plus'
import AILeftSidebar from './components/AILeftSidebar/index.vue'
import AIMainContent from './components/AIMainContent/index.vue'

const aiStore = useAIStore()
const emit = defineEmits(['back-to-album'])

// 返回普通相册
const handleBackToAlbum = () => {
  emit('back-to-album')
}

// 开始分析
const handleStartAnalysis = async () => {
  if (aiStore.isScanning) {
    ElMessage.info('当前已有任务正在进行')
    return
  }

  const shouldInitialize = ['MODEL_MISSING', 'ERROR', 'FATAL_ERROR', 'STOPPED'].includes(
    aiStore.systemStatus
  )
  const isPreparing = ['STARTING', 'INITIALIZING', 'DOWNLOADING'].includes(aiStore.systemStatus)

  if (isPreparing || aiStore.modelStatus.downloading) {
    ElMessage.info('AI 引擎正在准备中，请稍后再试')
    return
  }

  // 分支 A: 模型缺失、异常或停止时统一走初始化/重试
  if (shouldInitialize || !aiStore.isModelReady) {
    console.log('[AI Album] 启动或重试本地 AI 引擎:', aiStore.systemStatus)
    const initialized = await aiStore.startInitialization()
    if (initialized) {
      ElMessage.success('本地 AI 引擎已就绪')
      await aiStore.triggerDiffSync()
    } else if (aiStore.initError) {
      ElMessage.error(aiStore.initError)
    }
    return
  }

  // 分支 B: 模型存在/引擎就绪
  if (aiStore.systemStatus === 'READY') {
    if (aiStore.pendingCount <= 0) {
      await aiStore.triggerDiffSync()
      await aiStore.refreshPendingCount()
    }

    if (aiStore.pendingCount <= 0) {
      ElMessage.info('当前图库已是最新状态')
      return
    }

    console.log('[AI Album] 启动全局分析, 任务数:', aiStore.pendingCount)
    const result = await aiStore.startGlobalAnalysis()
    if (!result?.success) {
      ElMessage.warning(result?.message || '分析未启动')
    }
  } else {
    console.warn('[AI Album] 引擎当前状态不支持启动分析:', aiStore.systemStatus)
    ElMessage.warning('AI 引擎正在准备中，请稍后再试')
  }
}

// 刷新
const handleRefresh = async () => {
  await aiStore.refreshPendingCount()
  await aiStore.fetchFaceGroups()
  await aiStore.refreshStorageSize()
  await aiStore.updateTotalPhotoCount()
  ElMessage.success('智能相册状态已刷新')
}

// 暂停扫描
const handlePauseScan = async () => {
  console.log('[AI Album] 用户请求暂停分析...')
  const stopped = await aiStore.stopScan()
  if (stopped) {
    ElMessage.success('已停止当前任务')
  } else {
    ElMessage.error('停止失败，请稍后重试')
  }
}

// 扫描更多
const handleScanMore = async () => {
  if (!aiStore.isModelReady) {
    ElMessage.info('请先初始化本地 AI 引擎')
    return
  }

  const result = await aiStore.triggerDiffSync()
  const changed = (result?.newCount || 0) + (result?.modifiedCount || 0)
  if (changed > 0) {
    ElMessage.success(`已发现 ${changed} 张待分析照片`)
  } else {
    ElMessage.info('没有发现新的待分析照片')
  }
}

const getWorkerInfo = async () => {
  const api = window.QzoneAPI?.ai?.checkStatus
  if (typeof api !== 'function') return null
  try {
    return await api()
  } catch (error) {
    console.warn('[AI Album] 获取 Worker 诊断信息失败:', error)
    return null
  }
}

onMounted(async () => {
  await aiStore.init()

  // 检查模型状态，如果模型已就绪则自动启用 UI
  const info = await getWorkerInfo()
  console.log('[AI Album] Worker Diagnostics:', info)

  // 统一在此处触发静默同步
  if (aiStore.isModelReady) {
    aiStore.triggerDiffSync()
  }
})
</script>

<style lang="scss" scoped>
.ai-album-container {
  display: flex;
  height: 100%;
  width: 100%;
}
</style>
