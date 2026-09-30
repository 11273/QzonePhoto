<template>
  <div class="space-pane flex h-full overflow-hidden">
    <Left
      ref="leftRef"
      :view-mode="friend ? 'friend' : 'self'"
      :current-friend="friend"
      :active-module="currentModule"
      :photo-type="photoType"
      @album-selected="handleAlbumSelected"
      @album-state-changed="handleAlbumStateChanged"
      @module-changed="handleModuleChanged"
      @enter-friend="enterFriend"
      @exit-friend="emit('exit-friend')"
    />
    <Main
      v-if="currentModule === 'album'"
      ref="mainRef"
      :album-load-state="albumLoadState"
      class="flex-1"
      @retry-albums="retryAlbums"
    />
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
      width="min(1180px, calc(100vw - 32px))"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="false"
      align-center
      class="album-dialog ds-dialog"
      modal-class="ds-dialog-overlay album-dialog-overlay"
      @closed="currentDialogAlbum = null"
    >
      <template #header="{ close }">
        <div class="dialog-header-custom">
          <AppRefreshButton
            class="dialog-refresh-action"
            :loading="dialogRefreshLoading"
            :disabled="dialogRefreshLoading"
            aria-label="刷新相册"
            @click="refreshDialogAlbum"
          />
          <el-button text aria-label="关闭相册弹窗" title="关闭" @click="close">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>
      <Main
        v-if="albumDialogVisible && currentDialogAlbum"
        ref="dialogMainRef"
        class="dialog-main-content"
        dialog-mode
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, provide, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import AppRefreshButton from '@renderer/components/AppRefreshButton/index.vue'
import Left from './left.vue'
import Main from './main.vue'
import PhotoModule from './photo-module.vue'
import VideoModule from './video-module.vue'
import FeedsModule from './feeds-module.vue'
import { createAlbumLoadState } from '@shared/album-load-state'

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
const dialogRefreshLoading = ref(false)
const currentDialogAlbum = ref(null)
const albumLoadState = ref(createAlbumLoadState())
const enterFriend = (friend) =>
  emit('enter-friend', { friend, module: currentModule.value, photoType: photoType.value })

// 每个空间持有自己的固定 host；隐藏的空间不会因跳转而重置数据。
provide(
  'hostUinOverride',
  computed(() => props.friend?.uin || null)
)
provide('leftRef', leftRef)

const handleAlbumSelected = (album) => mainRef.value?.selectAlbum?.(album)
const handleAlbumStateChanged = (state) => {
  albumLoadState.value = state || createAlbumLoadState()
}
const retryAlbums = () => leftRef.value?.retryPhotoData?.()
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

const refreshDialogAlbum = async () => {
  if (dialogRefreshLoading.value || !dialogMainRef.value?.refreshCurrentAlbum) return
  dialogRefreshLoading.value = true
  try {
    await dialogMainRef.value.refreshCurrentAlbum()
  } finally {
    dialogRefreshLoading.value = false
  }
}

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
  display: flex;
  max-height: min(84dvh, 820px);
  margin: 0 !important;
  flex-direction: column;
  overflow: hidden;
  background: var(--theme-material-thick);
  border-color: var(--theme-material-border);

  .el-dialog__header {
    padding: 0;
    border: none;
    background: transparent;
    min-height: 0;
    height: 0;
    overflow: visible;
    position: relative;
    z-index: 3;
  }
  .dialog-header-custom {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;

    .dialog-refresh-action {
      min-width: 76px;
      color: var(--theme-text-secondary);
      background: transparent;
      border-color: transparent;

      &:hover,
      &:focus-visible {
        color: var(--theme-text-primary);
        background: var(--theme-surface-hover);
        border-color: var(--theme-border-subtle);
      }
    }

    > .el-button:last-child {
      width: var(--theme-control);
      height: var(--theme-control);
      color: var(--theme-text-secondary) !important;
      background: var(--theme-backdrop) !important;
      backdrop-filter: blur(10px);
      border: 1px solid var(--theme-border);
      padding: 8px !important;
      border-radius: var(--theme-radius-md);
      box-shadow: var(--theme-shadow-sm);
      &:hover {
        color: var(--theme-text-primary) !important;
        background: var(--theme-surface-raised) !important;
        border-color: var(--theme-brand-border);
      }
      &:focus-visible {
        outline: 2px solid var(--theme-focus);
        outline-offset: 2px;
      }
      .el-icon {
        font-size: 18px;
      }
    }
  }
  .el-dialog__body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 0;
    height: min(78dvh, 760px);
    overflow: hidden;
  }

  /* 仅标题区为右上角操作组留位；底部操作行保持左右等距并贴齐右边界。 */
  .top-bar {
    padding-right: 20px;
    box-shadow: none !important;
  }

  .top-bar.collapsed {
    padding-right: 20px;
  }

  .top-bar .album-header {
    padding-right: 136px;
  }

  .top-bar .bottom-controls {
    box-shadow: none;
  }
}

:deep(.album-dialog-overlay .el-overlay-dialog) {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
}

.dialog-main-content {
  height: 100%;
  background: transparent;
}
</style>
