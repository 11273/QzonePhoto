<template>
  <div class="flex flex-col h-dvh">
    <div class="relative h-full overflow-hidden">
      <SpacePane
        v-show="spaceStack.length === 0"
        :key="accountUin || 'anonymous'"
        class="h-full"
        @enter-friend="handleEnterFriend"
      />
      <SpacePane
        v-for="(friend, index) in spaceStack"
        v-show="index === spaceStack.length - 1"
        :key="friend.uin"
        :friend="friend"
        :initial-module="friend.initialModule"
        :initial-photo-type="friend.initialPhotoType"
        class="h-full"
        @enter-friend="handleEnterFriend"
        @exit-friend="handleExitFriend"
      />
    </div>
    <DownloadManager v-model="downloadStore.showDownloadManager" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import SpacePane from './components/space-pane.vue'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'
import { useDownloadStore } from '@renderer/store/download.store'
import { useUserStore } from '@renderer/store/user.store'
import { normalizeQzoneUin, resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'

const downloadStore = useDownloadStore()
const userStore = useUserStore()
const accountUin = computed(() => resolveSelfQzoneUin(userStore))
// 已打开的空间保持挂载；返回时无需重新请求，滚动容器也保留原位置。
const spaceStack = ref([])
watch(accountUin, () => {
  // 切换登录账号时丢弃旧账号打开的好友空间，避免显示上一账号的数据。
  spaceStack.value = []
})

const handleEnterFriend = ({ friend, module, photoType }) => {
  const targetUin = normalizeQzoneUin(friend?.uin)
  if (!targetUin) return
  if (targetUin === accountUin.value) {
    spaceStack.value = []
    return
  }
  const existingIndex = spaceStack.value.findIndex((item) => item.uin === targetUin)
  if (existingIndex >= 0) {
    spaceStack.value = spaceStack.value.slice(0, existingIndex + 1)
    return
  }
  spaceStack.value.push({
    ...friend,
    uin: targetUin,
    name: friend?.name || `QQ ${targetUin}`,
    img: friend?.img || `https://qlogo4.store.qq.com/qzone/${targetUin}/${targetUin}/100`,
    initialModule: module,
    initialPhotoType: photoType
  })
}

const handleExitFriend = () => {
  spaceStack.value.pop()
}

let taskUpdateListener = null
onMounted(() => {
  taskUpdateListener = (event, tasks) => {
    if (Array.isArray(tasks)) downloadStore.updateTasks(tasks)
  }
  window.ipcRenderer?.on('download:task-update', taskUpdateListener)
  downloadStore.loadTasks().then(() => {})
})
onUnmounted(() => {
  if (taskUpdateListener)
    window.ipcRenderer?.removeListener('download:task-update', taskUpdateListener)
})
</script>
