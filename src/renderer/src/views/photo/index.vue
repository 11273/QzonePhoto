<template>
  <div v-loading="loading" class="flex flex-col h-dvh">
    <div class="flex h-full">
      <Left @album-selected="handleAlbumSelected" />
      <Main ref="mainRef" class="flex-1" />
    </div>

    <!-- 下载管理器 -->
    <DownloadManager v-model="downloadStore.showDownloadManager" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide } from 'vue'
import Left from '@renderer/views/photo/components/left.vue'
import Main from '@renderer/views/photo/components/main.vue'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'
import { useDownloadStore } from '@renderer/store/download.store'

const downloadStore = useDownloadStore()
const loading = ref(false)
const mainRef = ref()

// 处理相册选择
const handleAlbumSelected = (album) => {
  // console.log('父组件接收到相册选择:', album)

  if (mainRef.value && mainRef.value.selectAlbum) {
    mainRef.value.selectAlbum(album)
  }
}

// 刷新当前相册的回调函数
const refreshCurrentAlbum = async () => {
  if (mainRef.value && mainRef.value.refreshCurrentAlbum) {
    await mainRef.value.refreshCurrentAlbum()
  }
}

// 提供刷新回调给子组件
provide('refreshAlbumCallback', refreshCurrentAlbum)

// 监听下载任务更新
let taskUpdateListener = null

onMounted(() => {
  // 监听任务更新事件
  taskUpdateListener = (event, tasks) => {
    // console.log('[Photo/index] 收到任务更新:', tasks?.length || 0, '个任务')
    if (tasks && Array.isArray(tasks)) {
      downloadStore.updateTasks(tasks)
    }
  }

  window.ipcRenderer?.on('download:task-update', taskUpdateListener)
  // console.log('[Photo/index] 已设置任务更新监听器')

  // 初始加载任务列表
  downloadStore.loadTasks().then(() => {
    // console.log('[Photo/index] 初始任务加载完成')
  })
})

onUnmounted(() => {
  if (taskUpdateListener) {
    window.ipcRenderer?.removeListener('download:task-update', taskUpdateListener)
  }
})
</script>

<style lang="scss" scoped></style>
