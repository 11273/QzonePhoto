<template>
  <div v-loading="loading" class="flex flex-col h-dvh">
    <div class="flex h-full">
      <Left
        ref="leftRef"
        @album-selected="handleAlbumSelected"
        @module-changed="handleModuleChanged"
      />
      <!-- 根据当前模块显示不同内容 -->
      <Main v-if="currentModule === 'album'" ref="mainRef" class="flex-1" />
      <PhotoModule
        v-if="currentModule === 'photo'"
        ref="photoModuleRef"
        :photo-type="photoType"
        class="flex-1"
        @album-click="handleAlbumClick"
      />
      <VideoModule v-if="currentModule === 'video'" ref="videoModuleRef" class="flex-1" />
    </div>

    <!-- 相册查看弹窗（从动态跳转） -->
    <el-dialog
      v-model="albumDialogVisible"
      width="90%"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      class="album-dialog"
      @closed="handleDialogClosed"
    >
      <template #header="{ close }">
        <div class="dialog-header-custom">
          <el-button text @click="close">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>
      <Main
        v-if="albumDialogVisible && currentDialogAlbum"
        ref="dialogMainRef"
        class="dialog-main-content"
      />
    </el-dialog>

    <!-- 下载管理器 -->
    <DownloadManager v-model="downloadStore.showDownloadManager" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import Left from '@renderer/views/photo/components/left.vue'
import Main from '@renderer/views/photo/components/main.vue'
import PhotoModule from '@renderer/views/photo/components/photo-module.vue'
import VideoModule from '@renderer/views/photo/components/video-module.vue'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'
import { useDownloadStore } from '@renderer/store/download.store'

const downloadStore = useDownloadStore()
const loading = ref(false)
const mainRef = ref()
const leftRef = ref()
const photoModuleRef = ref()
const videoModuleRef = ref()
const dialogMainRef = ref()

// 当前模块状态
const currentModule = ref('album')
const photoType = ref('my-photos')

// 相册弹窗状态
const albumDialogVisible = ref(false)
const currentDialogAlbum = ref(null)

// 处理相册选择
const handleAlbumSelected = (album) => {
  // console.log('父组件接收到相册选择:', album)

  if (mainRef.value && mainRef.value.selectAlbum) {
    mainRef.value.selectAlbum(album)
  }
}

// 处理模块切换
const handleModuleChanged = (module, type) => {
  currentModule.value = module
  if (type) {
    photoType.value = type
  }

  // 当切换回相册模块时，确保 Main 组件已挂载并刷新当前选中的相册
  if (module === 'album') {
    // 使用 nextTick 确保 Main 组件已经挂载
    nextTick(() => {
      // 等待一个 tick，确保 Left 组件已经选中了默认相册
      setTimeout(() => {
        if (mainRef.value && mainRef.value.selectAlbum) {
          // 如果 Main 组件有当前相册，强制刷新它
          if (mainRef.value.currentAlbum) {
            mainRef.value.selectAlbum(mainRef.value.currentAlbum, true)
          }
        }
      }, 150)
    })
  }
}

// 刷新当前相册的回调函数
const refreshCurrentAlbum = async () => {
  // 如果弹窗打开，刷新弹窗中的相册
  if (albumDialogVisible.value && dialogMainRef.value && dialogMainRef.value.refreshCurrentAlbum) {
    await dialogMainRef.value.refreshCurrentAlbum()
    return
  }
  // 否则刷新主窗口中的相册
  if (mainRef.value && mainRef.value.refreshCurrentAlbum) {
    await mainRef.value.refreshCurrentAlbum()
  }
}

// 处理相册点击（从动态跳转）
const handleAlbumClick = async ({ albumId, albumName }) => {
  // 通过 albumId 在 Left 组件中查找相册
  if (leftRef.value && leftRef.value.findAlbumById) {
    const album = await leftRef.value.findAlbumById(albumId)
    if (album) {
      // 设置当前弹窗相册
      currentDialogAlbum.value = album
      // 打开弹窗
      albumDialogVisible.value = true

      // 等待弹窗打开后，选择相册
      await nextTick()
      if (dialogMainRef.value && dialogMainRef.value.selectAlbum) {
        dialogMainRef.value.selectAlbum(album)
      }
    } else {
      ElMessage.warning(`未找到相册：${albumName || albumId}`)
    }
  } else {
    ElMessage.warning('相册列表未加载完成，请稍后再试')
  }
}

// 处理弹窗关闭
const handleDialogClosed = () => {
  currentDialogAlbum.value = null
  // 弹窗关闭时，动态列表状态保持不变
}

// 提供刷新回调给子组件
provide('refreshAlbumCallback', refreshCurrentAlbum)
// 提供 leftRef 给子组件（用于更新统计信息）
provide('leftRef', leftRef)

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

<style lang="scss" scoped>
:deep(.album-dialog) {
  margin-top: 10vh;

  .el-dialog {
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .el-dialog__header {
    padding: 0;
    border: none;
    background: transparent;
    min-height: 0;
    height: 0;
    overflow: hidden;
  }

  .dialog-header-custom {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1000;

    .el-button {
      color: rgba(255, 255, 255, 0.8) !important;
      background: rgba(0, 0, 0, 0.6) !important;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px !important;
      border-radius: 8px;

      &:hover {
        color: #ffffff !important;
        background: rgba(0, 0, 0, 0.8) !important;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .el-icon {
        font-size: 18px;
      }
    }
  }

  .el-dialog__body {
    padding: 0;
    height: 75vh;
    overflow: hidden;
  }
}

.dialog-main-content {
  height: 100%;
  background: transparent;
}
</style>
