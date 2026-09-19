<template>
  <teleport to="body">
    <transition name="mp-fade">
      <div
        v-if="visible"
        ref="previewMaskRef"
        class="media-preview-mask"
        :class="{ 'is-mac': isMac }"
        role="dialog"
        aria-modal="true"
        :aria-label="current?.title ? `媒体预览：${current.title}` : '媒体预览'"
        tabindex="-1"
        @click.self="close"
        @wheel.prevent="handleWheel"
      >
        <!-- 顶部加载进度条 —— 主流方案（YouTube/GitHub/PhotoSwipe）
             prefetching 时显示一条 1.5px 蓝色不定式进度条 -->
        <div v-if="prefetching || loadingMore" class="mp-top-progress" aria-hidden="true">
          <span class="mp-top-progress-bar"></span>
        </div>

        <header class="mp-topbar" @click.stop>
          <div class="mp-caption">
            <span class="mp-cap-index">{{ currentIndex + 1 }} / {{ total }}</span>
            <span v-if="current?.title" class="mp-cap-title" :title="current.title">
              {{ current.title }}
            </span>
          </div>

          <div class="mp-actions">
            <button
              v-if="selectable"
              class="mp-action mp-action-check"
              :class="{ checked: isSelected }"
              type="button"
              role="checkbox"
              :aria-checked="isSelected"
              :aria-label="isSelected ? '取消选中当前项' : '选中当前项'"
              :title="isSelected ? '取消选中' : '选中当前项'"
              @click="toggleSelect"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                :stroke-width="isSelected ? 3 : 2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              v-if="canDownloadCurrent"
              class="mp-action mp-action-primary"
              type="button"
              :disabled="downloadingCurrent"
              :aria-label="downloadingCurrent ? '正在加入下载' : '下载当前媒体'"
              :title="downloadingCurrent ? '正在加入下载…' : '下载当前媒体'"
              @click="downloadCurrent"
            >
              <el-icon :class="{ 'is-loading': downloadingCurrent }">
                <Loading v-if="downloadingCurrent" />
                <Download v-else />
              </el-icon>
            </button>
            <button
              v-if="currentActionSrc"
              class="mp-action"
              type="button"
              aria-label="复制当前媒体链接"
              title="复制链接"
              @click="copyLink"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            <button
              v-if="currentActionSrc"
              class="mp-action"
              type="button"
              aria-label="在浏览器中打开当前媒体"
              title="在浏览器中打开"
              @click="openExternal"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
            <button
              class="mp-action mp-action-close"
              type="button"
              aria-label="关闭媒体预览"
              title="关闭 (Esc)"
              @click="close"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <!-- 主显示区 -->
        <div class="mp-stage" @click.self="close">
          <!-- 左切换 -->
          <button
            v-if="total > 1"
            class="mp-nav mp-nav-left"
            type="button"
            :disabled="loadingMore || currentIndex === 0"
            aria-label="查看上一个媒体"
            title="上一个 (←)"
            @click="prev"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>

          <!-- 当前媒体 -->
          <div class="mp-content" @click.stop>
            <template v-if="current?.type === 'image'">
              <img
                :key="`${currentIndex}-img-${reloadNonce}`"
                :src="imageDisplaySrc"
                :alt="current.title || ''"
                class="mp-media mp-img"
                :style="imageTransformStyle"
                draggable="false"
                @load="onMediaLoad"
                @error="onMediaError"
                @mousedown="onImgMouseDown"
              />
            </template>
            <template v-else-if="current?.type === 'video'">
              <video
                v-if="current.src"
                :key="currentIndex + '-' + current.src"
                ref="videoEl"
                :src="current.src"
                :poster="current.thumb"
                class="mp-media mp-video"
                controls
                playsinline
                preload="metadata"
                @loadeddata="onMediaLoad"
                @error="onMediaError"
              ></video>
              <div v-else class="mp-video-cover">
                <img v-if="current.thumb" :src="current.thumb" class="mp-cover-img" />
                <div class="mp-cover-overlay">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>正在获取视频播放地址…</span>
                </div>
              </div>
            </template>
            <div v-else class="mp-empty">
              <el-icon><Picture /></el-icon>
            </div>

            <!-- 视频自带 loading，不再叠加全屏 spinner，避免「两个进度条」 -->
            <div
              v-if="mediaLoading && current?.type !== 'video'"
              class="mp-loading"
              role="status"
              aria-live="polite"
            >
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>正在加载图片…</span>
            </div>
            <div v-if="mediaError" class="mp-error" role="alert">
              <el-icon><WarningFilled /></el-icon>
              <span>无法加载该媒体</span>
              <div class="mp-error-actions">
                <button type="button" class="mp-error-btn primary" @click="retryCurrentMedia">
                  重试
                </button>
                <button
                  v-if="currentActionSrc"
                  type="button"
                  class="mp-error-btn"
                  @click="openExternal"
                >
                  浏览器打开
                </button>
              </div>
            </div>
          </div>

          <!-- 右切换 -->
          <button
            v-if="total > 1 || hasMore"
            class="mp-nav mp-nav-right"
            type="button"
            :disabled="loadingMore || (currentIndex === total - 1 && !hasMore)"
            :aria-label="loadingMore ? '正在加载更多媒体' : '查看下一个媒体'"
            :title="loadingMore ? '加载中…' : '下一个 (→)'"
            @click="next"
          >
            <el-icon v-if="!loadingMore"><ArrowRight /></el-icon>
            <el-icon v-else class="is-loading"><Loading /></el-icon>
          </button>

          <!-- 边界提示 -->
          <transition name="mp-fade">
            <div v-if="boundaryHint" class="mp-boundary-hint" role="status" aria-live="polite">
              {{ boundaryHint }}
            </div>
          </transition>
        </div>

        <!-- 底部工具栏 + 缩略图（独立安全区，不遮挡媒体和导航） -->
        <div class="mp-bottom" @click.stop>
          <!-- 图片工具栏：只在图片项显示 -->
          <div v-if="current?.type === 'image'" class="mp-toolbar" aria-label="图片查看工具">
            <button
              class="mp-tool"
              type="button"
              aria-label="缩小图片"
              title="缩小 (-)"
              @click="zoom(-0.25)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="8" y1="11" x2="14" y2="11" />
                <line x1="20" y1="20" x2="16.5" y2="16.5" />
              </svg>
            </button>
            <button
              class="mp-tool mp-tool-zoom"
              type="button"
              aria-label="恢复图片到百分之百大小"
              title="实际大小（点击重置 100%）"
              @click="resetZoom"
            >
              {{ Math.round(scale * 100) }}%
            </button>
            <button
              class="mp-tool"
              type="button"
              aria-label="放大图片"
              title="放大 (+)"
              @click="zoom(0.25)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
                <line x1="20" y1="20" x2="16.5" y2="16.5" />
              </svg>
            </button>
            <div class="mp-tool-sep" aria-hidden="true"></div>
            <button
              class="mp-tool"
              type="button"
              aria-label="向左旋转图片九十度"
              title="左旋转 90°"
              @click="rotate(-90)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <button
              class="mp-tool"
              type="button"
              aria-label="向右旋转图片九十度"
              title="右旋转 90°"
              @click="rotate(90)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <div class="mp-tool-sep" aria-hidden="true"></div>
            <button
              class="mp-tool"
              type="button"
              aria-label="复位图片缩放旋转和位置"
              title="复位（缩放/旋转/位置归零，快捷键 0）"
              @click="resetAll"
            >
              <!-- 四角向中心收拢 —— 表示「适配窗口/复位」，与左/右旋转的弧形箭头明显不同 -->
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

          <!-- 缩略图条（去掉 scroll 监听 / loading thumb，
               加载状态统一由「顶部进度条 + 右切按钮 spinner」表达） -->
          <div v-if="items.length > 1" class="mp-thumbs">
            <div ref="thumbsRef" class="mp-thumbs-inner">
              <button
                v-for="(item, idx) in items"
                :key="idx"
                class="mp-thumb"
                :class="{ active: idx === currentIndex }"
                type="button"
                :aria-current="idx === currentIndex ? 'true' : undefined"
                :aria-label="`查看第 ${idx + 1} 个媒体${item.title ? `：${item.title}` : ''}`"
                :title="`查看第 ${idx + 1} 个媒体`"
                @click="jumpTo(idx)"
              >
                <img v-if="item.thumb" :src="item.thumb" :alt="''" />
                <div v-else class="mp-thumb-fallback">
                  <el-icon><Picture /></el-icon>
                </div>
                <div v-if="item.type === 'video'" class="mp-thumb-badge">
                  <el-icon><VideoPlay /></el-icon>
                </div>
                <div
                  v-if="privacyMode && idx !== currentIndex"
                  class="mp-thumb-privacy qz-privacy-overlay"
                >
                  <el-icon class="qz-privacy-icon"><Hide /></el-icon>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  Loading,
  Picture,
  VideoPlay,
  WarningFilled,
  Hide,
  Download
} from '@element-plus/icons-vue'
import { usePrivacyStore } from '@renderer/store/privacy.store'

const privacyStore = usePrivacyStore()
const privacyMode = computed(() => !!privacyStore.privacyMode)

const props = defineProps({
  visible: { type: Boolean, default: false },
  items: {
    type: Array,
    default: () => []
    // each item: { type: 'image'|'video', src, thumb, title?, subtitle?, width?, height?, needsResolve? }
  },
  initialIndex: { type: Number, default: 0 },
  // 是否还有更多可加载（true 则末尾会尝试 loadMore）
  hasMore: { type: Boolean, default: false },
  // 加载更多回调 —— 应在执行后通过更新 items 把新项追加上来；resolve 表示完成
  loadMore: { type: Function, default: null },
  // 异步解析回调 —— 当当前 item 标记 needsResolve 时调用，返回更新后的 item（含真实 src）
  // 外部应通过修改 items 数组里对应位置触发响应式
  resolveItem: { type: Function, default: null },
  // 剩多少张时开始静默预加载下一页（避免用户切到末尾时再阻塞等待）
  prefetchThreshold: { type: Number, default: 10 },
  // 是否启用「联动选中」功能：右上角显示复选框，状态由 isItemSelected 决定，点击触发 toggle-select
  selectable: { type: Boolean, default: false },
  // 判定某 item 是否已被选中（外部传入回调，参数 item / idx）
  isItemSelected: { type: Function, default: () => false },
  // 下载当前项。传入时在右上角展示下载按钮，由业务页面负责加入自己的下载队列。
  downloadItem: { type: Function, default: null }
})

const emit = defineEmits(['update:visible', 'index-change', 'toggle-select'])

const currentIndex = ref(0)
const mediaLoading = ref(false)
const mediaError = ref(false)
const imageFallbackSrc = ref('')
const loadingMore = ref(false)
const boundaryHint = ref('')
const videoEl = ref(null)
const thumbsRef = ref(null)
const previewMaskRef = ref(null)
const reloadNonce = ref(0)
const downloadingCurrent = ref(false)
let previousActiveElement = null

// 缩放 / 旋转 / 平移 状态（仅对图片生效，切换 item / 重置时归零）
const scale = ref(1)
const rotation = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)
const MIN_SCALE = 0.2
const MAX_SCALE = 6

const imageTransformStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`,
  cursor: scale.value > 1 ? 'grab' : 'default',
  transition: dragging.value ? 'none' : 'transform 0.18s ease'
}))

const dragging = ref(false)
const dragStart = { x: 0, y: 0, ox: 0, oy: 0 }

const resetTransform = () => {
  scale.value = 1
  rotation.value = 0
  offsetX.value = 0
  offsetY.value = 0
}

const zoom = (delta) => {
  if (current.value?.type !== 'image') return
  scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(scale.value + delta).toFixed(2)))
  if (scale.value === 1) {
    offsetX.value = 0
    offsetY.value = 0
  }
}
const resetZoom = () => {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
}
const rotate = (deg) => {
  if (current.value?.type !== 'image') return
  rotation.value = (rotation.value + deg) % 360
}
const resetAll = () => {
  resetTransform()
}

const onImgMouseDown = (e) => {
  if (scale.value <= 1) return
  dragging.value = true
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  dragStart.ox = offsetX.value
  dragStart.oy = offsetY.value
  const onMove = (ev) => {
    offsetX.value = dragStart.ox + (ev.clientX - dragStart.x)
    offsetY.value = dragStart.oy + (ev.clientY - dragStart.y)
  }
  const onUp = () => {
    dragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// macOS 全屏弹层会覆盖左上角 traffic light（红黄绿按钮），需要让顶栏留出空间
const isMac =
  /Mac|iPad|iPhone/i.test(navigator.platform || '') || /Mac/i.test(navigator.userAgent || '')

const total = computed(() => props.items.length)
const current = computed(() => props.items[currentIndex.value] || null)
const uniqueSources = (sources = []) => [
  ...new Set(sources.flat().filter((source) => typeof source === 'string' && source.trim()))
]
const imageSourceCandidates = computed(() => {
  if (current.value?.type !== 'image') return []
  return uniqueSources([current.value.src, current.value.thumb, current.value.fallbackSrcs || []])
})
const imageDisplaySrc = computed(
  () => imageFallbackSrc.value || imageSourceCandidates.value[0] || ''
)
const currentActionSrc = computed(() =>
  current.value?.type === 'image' ? imageDisplaySrc.value : current.value?.src || ''
)
const canDownloadCurrent = computed(
  () => !!current.value && typeof props.downloadItem === 'function'
)
const nextImageCandidate = () => {
  const candidates = imageSourceCandidates.value
  const currentCandidateIndex = Math.max(candidates.indexOf(imageDisplaySrc.value), 0)
  return candidates[currentCandidateIndex + 1] || ''
}
const showNextImageCandidate = () => {
  const nextSrc = nextImageCandidate()
  if (!nextSrc) return false
  imageFallbackSrc.value = nextSrc
  mediaLoading.value = true
  mediaError.value = false
  return true
}
const isQzoneUnavailableImage = (img) => {
  if (!img || current.value?.type !== 'image') return false
  const src = img.currentSrc || img.src || ''
  if (!/photo\.store\.qq\.com\/psc\?/i.test(src)) return false
  if (!/[/?&](?:b|r|raw)(?:[&=]|$)/i.test(src)) return false
  return img.naturalWidth === 340 && img.naturalHeight === 320
}

const showBoundary = (text) => {
  boundaryHint.value = text
  setTimeout(() => {
    if (boundaryHint.value === text) boundaryHint.value = ''
  }, 1600)
}

const close = () => emit('update:visible', false)

const prev = () => {
  if (currentIndex.value === 0) {
    showBoundary('已经是第一个')
    return
  }
  setIndex(currentIndex.value - 1)
}

const next = async () => {
  if (currentIndex.value < total.value - 1) {
    setIndex(currentIndex.value + 1)
    return
  }
  // 末尾：尝试加载更多
  if (props.hasMore && typeof props.loadMore === 'function' && !loadingMore.value) {
    loadingMore.value = true
    try {
      const prevLen = total.value
      await props.loadMore()
      await nextTick()
      if (total.value > prevLen) {
        setIndex(prevLen) // 跳到第一条新加载的
      } else {
        showBoundary('已经是最后一个')
      }
    } catch (e) {
      console.warn('[MediaPreview] loadMore 失败:', e)
      showBoundary('加载更多失败')
    } finally {
      loadingMore.value = false
    }
  } else {
    showBoundary('已经是最后一个')
  }
}

const jumpTo = (idx) => {
  if (idx === currentIndex.value) return
  setIndex(idx)
}

const prefetching = ref(false)

const maybePrefetch = () => {
  // 距末尾还剩 <= prefetchThreshold 张时静默拉下一页（不显示 loading）
  if (
    props.hasMore &&
    typeof props.loadMore === 'function' &&
    !prefetching.value &&
    !loadingMore.value &&
    total.value - currentIndex.value <= props.prefetchThreshold
  ) {
    prefetching.value = true
    Promise.resolve(props.loadMore())
      .catch((e) => console.warn('[MediaPreview] prefetch 失败:', e))
      .finally(() => {
        prefetching.value = false
      })
  }
}

const setIndex = (i) => {
  currentIndex.value = i
  mediaLoading.value = true
  mediaError.value = false
  imageFallbackSrc.value = ''
  resetTransform() // 切换 item 时归零缩放/旋转/位移
  emit('index-change', i)
  scrollThumbIntoView(i)
  // 若当前项标记 needsResolve（如视频需异步拉真实 URL），调用 resolveItem
  const item = props.items[i]
  if (item && item.needsResolve && typeof props.resolveItem === 'function') {
    Promise.resolve(props.resolveItem(item, i)).catch((e) => {
      console.warn('[MediaPreview] resolveItem 失败:', e)
      mediaError.value = true
      mediaLoading.value = false
    })
  }
  // 临近末尾时静默预加载下一页
  maybePrefetch()
}

const scrollThumbIntoView = (i) => {
  nextTick(() => {
    const wrap = thumbsRef.value
    if (!wrap) return
    const el = wrap.children?.[i]
    if (!el) return
    const wrapRect = wrap.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    if (elRect.left < wrapRect.left || elRect.right > wrapRect.right) {
      const target = el.offsetLeft - wrap.clientWidth / 2 + el.clientWidth / 2
      wrap.scrollTo({ left: target, behavior: 'smooth' })
    }
  })
}

const onMediaLoad = (event) => {
  if (isQzoneUnavailableImage(event?.target) && showNextImageCandidate()) {
    return
  }
  mediaLoading.value = false
}
const onMediaError = () => {
  if (current.value?.type === 'image') {
    if (showNextImageCandidate()) {
      return
    }
  }

  if (
    current.value?.type === 'image' &&
    current.value?.thumb &&
    imageDisplaySrc.value !== current.value.thumb
  ) {
    imageFallbackSrc.value = current.value.thumb
    mediaLoading.value = true
    mediaError.value = false
    return
  }
  mediaLoading.value = false
  mediaError.value = true
}

const retryCurrentMedia = async () => {
  if (!current.value) return
  mediaError.value = false
  mediaLoading.value = true
  imageFallbackSrc.value = ''
  reloadNonce.value += 1

  if (current.value.needsResolve && typeof props.resolveItem === 'function') {
    try {
      await props.resolveItem(current.value, currentIndex.value)
    } catch (error) {
      console.warn('[MediaPreview] retry resolveItem 失败:', error)
      mediaLoading.value = false
      mediaError.value = true
      return
    }
  }

  await nextTick()
  if (current.value?.type === 'video') {
    videoEl.value?.load?.()
  }
}

const isSelected = computed(() =>
  current.value ? !!props.isItemSelected(current.value, currentIndex.value) : false
)
const toggleSelect = () => {
  emit('toggle-select', current.value, currentIndex.value)
}

const downloadCurrent = async () => {
  if (!canDownloadCurrent.value || downloadingCurrent.value) return
  downloadingCurrent.value = true
  try {
    await props.downloadItem(current.value, currentIndex.value)
    showBoundary('已加入下载队列')
  } catch (error) {
    console.error('[MediaPreview] download current failed:', error)
    showBoundary(error?.message || '加入下载失败，请重试')
  } finally {
    downloadingCurrent.value = false
  }
}

const copyLink = async () => {
  if (!currentActionSrc.value) {
    showBoundary('当前项还在加载，没有链接可复制')
    return
  }
  try {
    await navigator.clipboard.writeText(currentActionSrc.value)
    showBoundary('已复制链接')
  } catch (e) {
    console.error('[MediaPreview] copy failed:', e)
    showBoundary('复制失败')
  }
}
const openExternal = async () => {
  if (!currentActionSrc.value) return
  try {
    await window.QzoneAPI?.shell?.openExternal?.(currentActionSrc.value)
    showBoundary('正在打开浏览器')
  } catch (e) {
    console.error('[MediaPreview] open external failed:', e)
    showBoundary('打开浏览器失败')
  }
}

let wheelLock = 0
const handleWheel = (e) => {
  // 图片：滚轮缩放（Ctrl 也是缩放，跟系统习惯一致）
  if (current.value?.type === 'image') {
    zoom(e.deltaY > 0 ? -0.15 : 0.15)
    return
  }
  // 视频：滚轮翻页
  const now = Date.now()
  if (now - wheelLock < 250) return
  wheelLock = now
  if (e.deltaY > 0) next()
  else if (e.deltaY < 0) prev()
}

const onKey = (e) => {
  if (!props.visible) return
  if (e.key === 'Tab') {
    const focusable = [
      ...(previewMaskRef.value?.querySelectorAll(
        'button:not(:disabled), video[controls], [href], [tabindex]:not([tabindex="-1"])'
      ) || [])
    ].filter((element) => !element.hidden && element.getClientRects().length > 0)
    if (!focusable.length) {
      e.preventDefault()
      previewMaskRef.value?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (
      e.shiftKey &&
      (document.activeElement === first || document.activeElement === previewMaskRef.value)
    ) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  } else if (e.key === 'Escape') {
    close()
    e.preventDefault()
  } else if (e.key === 'ArrowLeft') {
    prev()
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    next()
    e.preventDefault()
  } else if (e.key === '+' || e.key === '=') {
    zoom(0.25)
    e.preventDefault()
  } else if (e.key === '-' || e.key === '_') {
    zoom(-0.25)
    e.preventDefault()
  } else if (e.key === '0') {
    resetAll()
    e.preventDefault()
  } else if (e.key === 'r' || e.key === 'R') {
    rotate(e.shiftKey ? -90 : 90)
    e.preventDefault()
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      previousActiveElement = document.activeElement
      const initial = Math.max(0, Math.min(props.items.length - 1, props.initialIndex || 0))
      boundaryHint.value = ''
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
      // 通过 setIndex 走完整流程：触发 resolveItem（视频拉真实 URL）+ 预加载检测
      // 不能只赋值 currentIndex，否则第一个就是视频时永远停在「正在获取播放地址」
      setIndex(initial)
      nextTick(() => previewMaskRef.value?.focus())
    } else {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      // 关闭后停止视频
      try {
        videoEl.value?.pause?.()
      } catch {
        // ignore
      }
      nextTick(() => previousActiveElement?.focus?.())
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.media-preview-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background:
    radial-gradient(circle at 50% 42%, rgba(31, 41, 55, 0.26), transparent 42%), rgba(0, 0, 0, 0.94);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  user-select: none;
  /* 关键：覆盖 Electron 自定义标题栏的 -webkit-app-region: drag —— 否则按钮中心点击会被识别为拖窗口而吞掉 click */
  -webkit-app-region: no-drag;
}

.mp-topbar {
  flex-shrink: 0;
  min-height: 64px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 12px 18px 10px 22px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0));
  -webkit-app-region: no-drag;
}

.media-preview-mask.is-mac .mp-topbar {
  padding-left: 88px;
}

.mp-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mp-action {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
  user-select: none;
  -webkit-app-region: no-drag;

  svg {
    width: 18px;
    height: 18px;
    pointer-events: none;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.28);
    color: #fff;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0) scale(0.96);
  }

  &:focus-visible {
    outline: 2px solid var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
    transform: none;
  }

  &.mp-action-primary {
    color: #fff;
    background: var(--qz-action, #c2410c);
    border-color: var(--qz-active, #fb923c);

    &:hover:not(:disabled) {
      background: var(--qz-active, #fb923c);
      border-color: #fdba74;
    }
  }

  &.mp-action-close:hover {
    background: rgba(239, 68, 68, 0.78);
    border-color: rgba(248, 113, 113, 0.92);
  }

  &.mp-action-check {
    color: rgba(255, 255, 255, 0.38);
    background: rgba(255, 255, 255, 0.05);

    &:hover {
      color: rgba(255, 255, 255, 0.78);
    }

    &.checked {
      background: var(--qz-active-strong, #f97316);
      border-color: var(--qz-active, #fb923c);
      color: #fff;
    }
  }
}

/* 底部容器：工具栏 + 缩略图，居中堆叠 */
.mp-bottom {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 20px 16px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0));
  -webkit-app-region: no-drag;
}

.mp-caption {
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: min(760px, calc(100vw - 390px));
  padding: 5px 12px 5px 5px;
  border-radius: 999px;
  background: rgba(18, 18, 20, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.13);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(16px);
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  -webkit-app-region: no-drag;

  .mp-cap-index {
    height: 34px;
    display: inline-flex;
    align-items: center;
    font-weight: 600;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.13);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.95);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
  .mp-cap-title {
    min-width: 0;
    color: rgba(255, 255, 255, 0.92);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: none;
    line-height: 34px;
    padding-right: 2px;
  }
  .mp-cap-subtitle {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    flex-shrink: 0;
  }
}

/* 图片工具栏（缩放 / 旋转 / 重置） */
.mp-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 9px;
  background: rgba(18, 18, 20, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 999px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(16px);
  -webkit-app-region: no-drag;
}

.mp-tool {
  width: 34px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  border-radius: 999px;
  transition:
    background 0.15s,
    color 0.15s;
  font-size: 11px;
  font-weight: 600;
  -webkit-app-region: no-drag;

  svg {
    width: 15px;
    height: 15px;
    pointer-events: none;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  &:focus-visible {
    outline: 2px solid var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
    outline-offset: 1px;
  }
}

.mp-tool-zoom {
  width: 58px;
  font-variant-numeric: tabular-nums;
}

.mp-tool-sep {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
}

.mp-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 16px 88px 18px;
  overflow: hidden; /* 缩放/平移时不溢出到顶/底 caption 工具栏 */
}

.mp-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 50px;
  height: 50px;
  padding: 0;
  border-radius: 50%;
  background: rgba(18, 18, 20, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  transition:
    background 0.15s,
    transform 0.15s,
    opacity 0.15s;
  z-index: 2;

  *,
  &::before {
    pointer-events: none;
  }

  /* 扩大点击命中区 */
  &::after {
    content: '';
    position: absolute;
    inset: -10px;
    border-radius: 50%;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-50%) scale(1.04);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.mp-nav-left {
    left: 16px;
  }
  &.mp-nav-right {
    right: 16px;
  }
}

.mp-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden; /* 关键：放大平移时图片不会溢出到外层 */
}

.mp-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  background: #111;
  box-shadow: 0 18px 64px rgba(0, 0, 0, 0.54);
  transform-origin: center;
  will-change: transform;
}

.mp-video {
  outline: none;
}

.mp-video-cover {
  position: relative;
  width: min(80vw, 800px);
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  background: #111;
}

.mp-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.45;
}

.mp-cover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.4);

  .el-icon {
    font-size: 26px;
  }
}

.mp-empty {
  color: rgba(255, 255, 255, 0.3);
  font-size: 64px;
}

.mp-loading,
.mp-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  font-size: 13px;

  .el-icon {
    font-size: 28px;
  }
}

.mp-error-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.mp-error-btn {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.08);
  font: inherit;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.32);
  }

  &.primary {
    color: #fff;
    background: var(--qz-action, #c2410c);
    border-color: var(--qz-active, #fb923c);
  }
}

.mp-boundary-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
}

.mp-thumbs {
  width: 100%;
  max-width: min(780px, calc(100vw - 120px));
  overflow: hidden;
}

.mp-thumbs-inner {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scroll-behavior: smooth;
  /* 上下左右各留 3px，给 active thumb 的 outline(2px + offset 1px)
     完整显示空间，避免被 overflow 裁掉边缘 */
  padding: 3px 3px 6px;
  justify-content: flex-start;

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
}

.mp-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  cursor: pointer;
  padding: 0;
  font: inherit;
  transition:
    outline-color 0.15s,
    opacity 0.15s;
  border: none;
  opacity: 0.85;
  /* 默认浅灰 outline 描边 —— 用 outline 而不是 box-shadow inset，
     因为 inset shadow 会被隐私模式 .mp-thumb-privacy 黑底 overlay 完全盖住；
     outline 在元素外侧绘制，overlay 盖不到，每张 thumb 边界依然可辨 */
  outline: 1px solid rgba(255, 255, 255, 0.16);
  outline-offset: 0;

  /* 缩略图内部所有子元素（img、icon、badge）不拦截点击 */
  * {
    pointer-events: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .mp-thumb-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
  }

  .mp-thumb-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 16px;
    background: rgba(0, 0, 0, 0.4);
  }

  &:hover {
    opacity: 1;
  }
  &.active {
    opacity: 1;
    /* 当前项沿用应用品牌橙，避免预览层重新回到蓝色选中态。 */
    outline: 2px solid var(--qz-active, #fb923c);
    outline-offset: 1px;
    box-shadow: inset 0 0 0 2px var(--qz-active-border, rgba(251, 146, 60, 0.38));
  }

  &:focus-visible {
    outline: 2px solid var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
    outline-offset: 1px;
  }
}

/* 隐私模式：非当前项缩略图叠加统一遮罩
   注意：不用 backdrop-filter —— 它在 Chromium 会创建新 stacking context，
   绕过父 overflow:hidden 的圆角裁切，导致四角白边 */
.mp-thumb-privacy {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  border-radius: 8px; /* 显式数值，跟父 .mp-thumb 完全对齐 */
  backdrop-filter: none;
}

/* 顶部进度条 —— 主流加载更多视觉方案（YouTube / GitHub / NProgress 风格）
   不打断浏览，1.5px 高，蓝色不定式滑动，prefetch / loadMore 期间都显示 */
.mp-top-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 11;
  background: rgba(96, 165, 250, 0.12);
  overflow: hidden;
  pointer-events: none;
}

.mp-top-progress-bar {
  display: block;
  height: 100%;
  width: 30%;
  background: linear-gradient(
    90deg,
    rgba(96, 165, 250, 0.2) 0%,
    #60a5fa 50%,
    rgba(96, 165, 250, 0.2) 100%
  );
  border-radius: 1px;
  animation: mp-progress-indeterminate 1.4s ease-in-out infinite;
}

@media (max-width: 760px) {
  .mp-topbar {
    min-height: 56px;
    padding: 10px 12px;
    gap: 10px;
  }

  .media-preview-mask.is-mac .mp-topbar {
    padding-left: 70px;
  }

  .mp-action {
    width: 34px;
    height: 34px;
  }

  .mp-cap-title {
    max-width: 34vw;
  }

  .mp-stage {
    padding: 12px 58px;
  }

  .mp-nav {
    width: 42px;
    height: 42px;

    &.mp-nav-left {
      left: 10px;
    }

    &.mp-nav-right {
      right: 10px;
    }
  }

  .mp-bottom {
    padding: 8px 12px 12px;
  }

  .mp-thumbs {
    max-width: calc(100vw - 28px);
  }

  .mp-thumb {
    width: 48px;
    height: 48px;
  }
}

@keyframes mp-progress-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(450%);
  }
}

.mp-fade-enter-active,
.mp-fade-leave-active {
  transition: opacity 0.18s ease;
}
.mp-fade-enter-from,
.mp-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .mp-action,
  .mp-tool,
  .mp-nav,
  .mp-thumb,
  .mp-media,
  .mp-fade-enter-active,
  .mp-fade-leave-active {
    transition: none !important;
  }

  .mp-top-progress-bar,
  .media-preview-mask .is-loading {
    animation: none !important;
  }
}
</style>
