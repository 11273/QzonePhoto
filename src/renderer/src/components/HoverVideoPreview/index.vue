<template>
  <div
    v-if="active && safeSource"
    class="hover-video-preview"
    :class="{ 'is-failed': failed }"
    aria-hidden="true"
  >
    <video
      ref="videoRef"
      class="hover-video-preview__media"
      :class="{ 'is-ready': ready }"
      :poster="poster || undefined"
      muted
      loop
      playsinline
      preload="metadata"
      tabindex="-1"
      @canplay="handleReady"
      @playing="handleReady"
      @waiting="handleWaiting"
      @stalled="handleWaiting"
      @error="handleError"
    ></video>
    <span v-if="!ready && !failed" class="hover-video-preview__loading">
      <span></span>
    </span>
    <span v-else-if="ready" class="hover-video-preview__badge">
      <VolumeX :size="11" />
      静音预览
    </span>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { VolumeX } from '@lucide/vue'
import Hls from 'hls.js'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  },
  src: {
    type: String,
    default: ''
  },
  poster: {
    type: String,
    default: ''
  }
})

const videoRef = ref(null)
const ready = ref(false)
const failed = ref(false)
let hls = null

const safeSource = computed(() => {
  const value = String(props.src || '').trim()
  if (/^\/\//.test(value)) return `https:${value}`
  return /^(https?:|blob:|data:|file:)/i.test(value) ? value : ''
})

const stop = () => {
  ready.value = false
  failed.value = false
  if (hls) {
    hls.destroy()
    hls = null
  }
  const video = videoRef.value
  if (!video) return
  video.pause()
  video.removeAttribute('src')
  video.load()
}

const start = async () => {
  stop()
  if (!props.active || !safeSource.value) return
  await nextTick()
  const video = videoRef.value
  if (!video) return
  video.muted = true
  video.defaultMuted = true
  const source = safeSource.value
  const isHlsSource = /\.m3u8(?:$|[?#])/i.test(source)
  if (isHlsSource && Hls.isSupported()) {
    hls = new Hls({ enableWorker: true, lowLatencyMode: false })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) handleError()
    })
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (!props.active || videoRef.value !== video) return
      video.play().catch(handleError)
    })
    hls.loadSource(source)
    hls.attachMedia(video)
  } else {
    video.src = source
  }
  try {
    await video.play()
  } catch {
    // 浏览器仍可能按节能策略拒绝自动播放；回退到原始封面，不阻塞卡片操作。
    handleError()
  }
}

const handleReady = () => {
  failed.value = false
  ready.value = true
}

const handleWaiting = () => {
  ready.value = false
}

const handleError = () => {
  ready.value = false
  failed.value = true
  if (hls) {
    hls.destroy()
    hls = null
  }
}

const handlePlaybackInterruption = () => {
  if (document.hidden || !document.hasFocus()) stop()
}

watch(() => [props.active, safeSource.value], start, { immediate: true })
onMounted(() => {
  document.addEventListener('visibilitychange', handlePlaybackInterruption)
  window.addEventListener('blur', handlePlaybackInterruption)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handlePlaybackInterruption)
  window.removeEventListener('blur', handlePlaybackInterruption)
  stop()
})
</script>

<style scoped>
.hover-video-preview {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
  background: var(--theme-backdrop);
}

.hover-video-preview.is-failed {
  background: transparent;
}

.hover-video-preview__media {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  opacity: 0;
  transition: opacity 180ms ease;
}

.hover-video-preview__media.is-ready {
  opacity: 1;
}

.hover-video-preview__loading {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 18%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--theme-backdrop) 76%, transparent);
  backdrop-filter: blur(8px);
  transform: translate(-50%, -50%);
}

.hover-video-preview__loading span {
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--theme-text-inverse) 28%, transparent);
  border-top-color: var(--theme-text-inverse);
  border-radius: 50%;
  animation: hover-video-spin 0.8s linear infinite;
}

.hover-video-preview__badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 7px;
  color: color-mix(in srgb, var(--theme-text-inverse) 88%, transparent);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  background: color-mix(in srgb, var(--theme-backdrop) 66%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-text-inverse) 13%, transparent);
  border-radius: 7px;
  backdrop-filter: blur(8px);
}

@media (prefers-reduced-motion: reduce) {
  .hover-video-preview__media {
    transition: none;
  }

  .hover-video-preview__loading span {
    animation: none;
  }
}

@keyframes hover-video-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
