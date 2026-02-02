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
import { useAIAlbum } from '@renderer/composables/useAIAlbum'
import { ElMessage } from 'element-plus'
import AILeftSidebar from './components/left.vue'
import AIMainContent from './components/main.vue'

const aiStore = useAIStore()
const { getWorkerInfo } = useAIAlbum()
const emit = defineEmits(['back-to-album'])

// 返回普通相册
const handleBackToAlbum = () => {
  emit('back-to-album')
}

// 开始分析
const handleStartAnalysis = async () => {
  // 分支 A: 模型缺失
  if (aiStore.systemStatus === 'MODEL_MISSING') {
    console.log('[AI Album] 模型缺失，启动引导初始化...')
    await aiStore.startInitialization()
    return
  }

  // 分支 B: 模型存在/引擎就绪
  if (aiStore.systemStatus === 'READY') {
    if (aiStore.pendingCount > 0) {
      console.log('[AI Album] 启动全局分析, 任务数:', aiStore.pendingCount)
      await aiStore.startGlobalAnalysis()
    } else {
      ElMessage.info('当前没有待处理的照片')
    }
  } else {
    console.warn('[AI Album] 引擎当前状态不支持启动分析:', aiStore.systemStatus)
  }
}

// 刷新
const handleRefresh = () => {
  console.log('刷新')
}

// 暂停扫描
const handlePauseScan = () => {
  console.log('[AI Album] 用户请求暂停分析...')
  aiStore.stopScan()
}

// 扫描更多
const handleScanMore = () => {
  console.log('扫描更多')
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
