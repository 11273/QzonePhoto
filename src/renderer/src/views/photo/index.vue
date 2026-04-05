<template>
  <div v-loading="loading" class="flex flex-col h-dvh">
    <div class="flex h-full overflow-hidden">
      <Left
        ref="leftRef"
        :view-mode="viewMode"
        :current-friend="currentFriend"
        @album-selected="handleAlbumSelected"
        @module-changed="handleModuleChanged"
        @enter-friend="handleEnterFriend"
        @exit-friend="handleExitFriend"
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
import { ref, onMounted, onUnmounted, provide, nextTick, computed } from 'vue'
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

// 好友上下文：viewMode 控制整个页面是"我的空间"还是"好友空间"
const viewMode = ref('self') // 'self' | 'friend'
const currentFriend = ref(null) // { uin, name, img, score }

// 为所有子组件提供 hostUin 覆盖（好友模式时生效）
const hostUinOverride = computed(() => (viewMode.value === 'friend' ? currentFriend.value?.uin : null))
provide('hostUinOverride', hostUinOverride)

// 相册弹窗状态（仅用于动态跳转）
const albumDialogVisible = ref(false)
const currentDialogAlbum = ref(null)

// 进入好友空间
const handleEnterFriend = (friend) => {
  currentFriend.value = friend
  viewMode.value = 'friend'
  // 进入好友空间默认显示相册 tab
  currentModule.value = 'album'
}

// 退出好友空间，回到自己空间
const handleExitFriend = () => {
  viewMode.value = 'self'
  currentFriend.value = null
  currentModule.value = 'album'
}

// 处理相册选择
const handleAlbumSelected = (album) => {
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
    nextTick(() => {
      setTimeout(() => {
        if (mainRef.value && mainRef.value.selectAlbum) {
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
  if (albumDialogVisible.value && dialogMainRef.value && dialogMainRef.value.refreshCurrentAlbum) {
    await dialogMainRef.value.refreshCurrentAlbum()
    return
  }
  if (mainRef.value && mainRef.value.refreshCurrentAlbum) {
    await mainRef.value.refreshCurrentAlbum()
  }
}

// 处理相册点击（从动态跳转）
const handleAlbumClick = async ({ albumId, albumName }) => {
  if (leftRef.value && leftRef.value.findAlbumById) {
    const album = await leftRef.value.findAlbumById(albumId)
    if (album) {
      currentDialogAlbum.value = album
      albumDialogVisible.value = true

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
}

// 提供刷新回调给子组件
provide('refreshAlbumCallback', refreshCurrentAlbum)
provide('leftRef', leftRef)

// 监听下载任务更新
let taskUpdateListener = null

onMounted(() => {
  taskUpdateListener = (event, tasks) => {
    if (tasks && Array.isArray(tasks)) {
      downloadStore.updateTasks(tasks)
    }
  }

  window.ipcRenderer?.on('download:task-update', taskUpdateListener)

  downloadStore.loadTasks().then(() => {})
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
