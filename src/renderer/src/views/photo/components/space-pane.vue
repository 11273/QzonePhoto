<template>
  <div class="space-pane flex h-full overflow-hidden">
    <Left
      ref="leftRef"
      :view-mode="friend ? 'friend' : 'self'"
      :current-friend="friend"
      :active-module="currentModule"
      :photo-type="photoType"
      @album-selected="handleAlbumSelected"
      @module-changed="handleModuleChanged"
      @enter-friend="enterFriend"
      @exit-friend="emit('exit-friend')"
    />
    <Main v-if="currentModule === 'album'" ref="mainRef" class="flex-1" />
    <PhotoModule
      v-if="currentModule === 'photo'"
      :photo-type="photoType"
      class="flex-1"
      @album-click="handleAlbumClick"
      @enter-friend="enterFriend"
    />
    <VideoModule v-if="currentModule === 'video'" class="flex-1" />
    <FeedsModule v-if="currentModule === 'feeds'" class="flex-1" @enter-friend="enterFriend" />

    <el-dialog
      v-model="albumDialogVisible"
      width="90%"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      class="album-dialog"
      @closed="currentDialogAlbum = null"
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
  </div>
</template>

<script setup>
import { computed, nextTick, provide, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import Left from './left.vue'
import Main from './main.vue'
import PhotoModule from './photo-module.vue'
import VideoModule from './video-module.vue'
import FeedsModule from './feeds-module.vue'

const props = defineProps({
  friend: { type: Object, default: null },
  initialModule: { type: String, default: 'album' },
  initialPhotoType: { type: String, default: 'my-photos' }
})
const emit = defineEmits(['enter-friend', 'exit-friend'])
const currentModule = ref(props.initialModule)
const photoType = ref(props.initialPhotoType)
const mainRef = ref()
const leftRef = ref()
const dialogMainRef = ref()
const albumDialogVisible = ref(false)
const currentDialogAlbum = ref(null)
const enterFriend = (friend) =>
  emit('enter-friend', { friend, module: currentModule.value, photoType: photoType.value })

// 每个空间持有自己的固定 host；隐藏的空间不会因跳转而重置数据。
provide(
  'hostUinOverride',
  computed(() => props.friend?.uin || null)
)
provide('leftRef', leftRef)

const handleAlbumSelected = (album) => mainRef.value?.selectAlbum?.(album)
const handleModuleChanged = (module, type) => {
  currentModule.value = module
  if (type) photoType.value = type
}

const refreshCurrentAlbum = async () => {
  if (albumDialogVisible.value && dialogMainRef.value?.refreshCurrentAlbum) {
    await dialogMainRef.value.refreshCurrentAlbum()
  } else {
    await mainRef.value?.refreshCurrentAlbum?.()
  }
}
provide('refreshAlbumCallback', refreshCurrentAlbum)

const handleAlbumClick = async ({ albumId, albumName }) => {
  const album = await leftRef.value?.findAlbumById?.(albumId)
  if (!album) {
    ElMessage.warning(albumName ? `未找到相册：${albumName}` : '相册列表未加载完成，请稍后再试')
    return
  }
  currentDialogAlbum.value = album
  albumDialogVisible.value = true
  await nextTick()
  await dialogMainRef.value?.selectAlbum?.(album)
}
</script>

<style lang="scss" scoped>
.space-pane {
  min-width: 0;
}
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
