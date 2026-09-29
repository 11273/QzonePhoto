<template>
  <div class="top-bar" :class="{ collapsed: isCollapsed }">
    <!-- 上传弹窗 - 相册上下文模式（好友空间不显示） -->
    <UploadDialog
      v-if="!isFriendContext"
      :visible="showUpload"
      :album-id="currentAlbum?.id"
      :album-name="currentAlbum?.name"
      :available-albums="availableAlbums"
      context-mode="album"
      @close="handleUploadDialogClose"
    />

    <!-- 优化的详细信息布局 -->
    <div v-if="currentAlbum" class="album-header">
      <div class="album-info">
        <div class="title-section">
          <div class="album-title-row">
            <h2 class="album-title" :title="currentAlbum.name">{{ currentAlbum.name }}</h2>

            <!-- 相册刷新按钮 -->
            <div class="title-right">
              <AppRefreshButton
                class="album-refresh-action"
                :loading="refreshLoading"
                :disabled="refreshLoading"
                aria-label="刷新相册"
                @click="refreshAlbum"
              />
            </div>
          </div>

          <transition name="fade-slide">
            <div
              v-show="!isCollapsed"
              class="album-meta-row"
              role="group"
              aria-label="相册摘要信息"
            >
              <span class="album-meta-item album-meta-count">{{ currentAlbum.total }} 张照片</span>

              <span class="album-meta-group album-meta-privacy">
                <span class="album-meta-divider" aria-hidden="true">·</span>
                <el-popover
                  v-model:visible="privPopoverVisible"
                  trigger="click"
                  placement="bottom-start"
                  :width="300"
                  popper-class="album-priv-popper"
                  @before-enter="onPrivPopoverEnter"
                >
                  <template #reference>
                    <button
                      ref="privTriggerRef"
                      type="button"
                      class="inline-priv"
                      :class="`priv-${currentAlbum.priv || 1}`"
                      :title="`${getPrivLabel(currentAlbum.priv)}，点击查看相册信息`"
                      :aria-label="`${getPrivLabel(currentAlbum.priv)}，查看相册信息`"
                    >
                      {{ getPrivLabel(currentAlbum.priv) }}
                      <el-icon class="inline-priv-arrow"><ArrowDown /></el-icon>
                    </button>
                  </template>
                  <div class="priv-popover">
                    <div class="priv-popover-header">
                      <el-icon :class="`priv-${currentAlbum.priv || 1}`">
                        <component :is="privIcon(currentAlbum.priv)" />
                      </el-icon>
                      <span>{{ getPrivLabel(currentAlbum.priv) }}</span>
                    </div>

                    <div
                      v-if="currentAlbum.desc && currentAlbum.desc.trim()"
                      class="priv-row priv-description-row"
                    >
                      <span class="priv-label">描述</span>
                      <span class="priv-text muted">{{ currentAlbum.desc }}</span>
                    </div>

                    <div v-if="currentAlbum.createtime" class="priv-row">
                      <span class="priv-label">创建</span>
                      <span class="priv-text muted">{{
                        formatCompactDate(currentAlbum.createtime)
                      }}</span>
                    </div>

                    <div v-if="currentAlbum.lastuploadtime" class="priv-row">
                      <span class="priv-label">最近上传</span>
                      <span class="priv-text muted">{{
                        formatCompactDate(currentAlbum.lastuploadtime)
                      }}</span>
                    </div>

                    <div v-if="currentAlbum.modifytime" class="priv-row">
                      <span class="priv-label">更新</span>
                      <span class="priv-text muted">{{
                        formatCompactDate(currentAlbum.modifytime)
                      }}</span>
                    </div>

                    <template v-if="currentAlbum.priv === 5">
                      <div class="priv-row">
                        <span class="priv-label">问题</span>
                        <span
                          v-if="currentAlbum.question"
                          class="priv-text copyable"
                          title="点击复制"
                          role="button"
                          tabindex="0"
                          @click="copyToClipboard(currentAlbum.question, '问题')"
                          @keydown.enter.prevent="copyToClipboard(currentAlbum.question, '问题')"
                          @keydown.space.prevent="copyToClipboard(currentAlbum.question, '问题')"
                          >{{ currentAlbum.question }}</span
                        >
                        <span v-else class="priv-text muted">...</span>
                      </div>
                      <div class="priv-row">
                        <span class="priv-label">答案</span>
                        <span v-if="qaLoading" class="priv-text muted">加载中...</span>
                        <span v-else-if="qaAnswer" class="priv-text answer-wrap">
                          <span
                            v-if="qaAnswerVisible"
                            class="answer-value"
                            title="点击复制"
                            role="button"
                            tabindex="0"
                            @click="copyToClipboard(qaAnswer, '答案')"
                            @keydown.enter.prevent="copyToClipboard(qaAnswer, '答案')"
                            @keydown.space.prevent="copyToClipboard(qaAnswer, '答案')"
                            >{{ qaAnswer }}</span
                          >
                          <span v-else class="muted">已隐藏</span>
                          <button
                            type="button"
                            class="answer-toggle"
                            :aria-label="qaAnswerVisible ? '隐藏相册答案' : '显示相册答案'"
                            @click.stop="qaAnswerVisible = !qaAnswerVisible"
                          >
                            <el-icon><component :is="qaAnswerVisible ? Hide : View" /></el-icon>
                            {{ qaAnswerVisible ? '隐藏' : '显示' }}
                          </button>
                        </span>
                        <span v-else class="priv-text muted">{{
                          isFriendContext ? '仅相册主人可见' : '-'
                        }}</span>
                      </div>
                    </template>

                    <div v-if="currentAlbum.priv === 2" class="priv-row">
                      <span class="priv-label">提示</span>
                      <span class="priv-text muted">需输入密码访问</span>
                    </div>

                    <div v-if="enabledFeatures.length" class="priv-row">
                      <span class="priv-label">允许</span>
                      <span class="priv-text">{{ enabledFeatures.join(' · ') }}</span>
                    </div>

                    <div v-if="pypyPrivLabel" class="priv-row">
                      <span class="priv-label">朋友圈</span>
                      <span class="priv-text muted">{{ pypyPrivLabel }}</span>
                    </div>

                    <div v-if="viewtypeText" class="priv-row">
                      <span class="priv-label">类型</span>
                      <span class="priv-text muted">{{ viewtypeText }}</span>
                    </div>
                  </div>
                </el-popover>
              </span>

              <span v-if="albumActivityMeta" class="album-meta-group album-meta-updated">
                <span class="album-meta-divider" aria-hidden="true">·</span>
                <span class="album-meta-item">{{ albumActivityMeta }}</span>
              </span>

              <span class="album-meta-group album-meta-comments">
                <span class="album-meta-divider" aria-hidden="true">·</span>
                <span class="album-meta-item">{{ Number(currentAlbum.comment || 0) }} 条评论</span>
              </span>

              <!-- 访客（本人相册按需拉取，明确区分加载、0 条和失败） -->
              <span
                v-if="!isFriendContext"
                class="album-meta-group album-meta-visitors"
                role="status"
                aria-live="polite"
              >
                <span class="album-meta-divider" aria-hidden="true">·</span>
                <el-popover
                  v-if="visitorStatus === 'success'"
                  v-model:visible="visitorPopoverVisible"
                  trigger="click"
                  placement="bottom-end"
                  :width="320"
                  popper-class="album-visitors-popper"
                >
                  <template #reference>
                    <button
                      ref="visitorTriggerRef"
                      type="button"
                      class="album-meta-item album-meta-link visitor-meta-link"
                      :aria-label="`查看最近访客，共 ${visitorTotal} 位`"
                      @click.stop
                    >
                      {{ visitorTotal }} 位访客
                      <span v-if="visitorToday > 0" class="visitor-today">
                        今日 +{{ visitorToday }}
                      </span>
                    </button>
                  </template>
                  <div class="visitor-popover">
                    <div class="visitor-popover-header">最近访客 · 共 {{ visitorTotal }} 人</div>
                    <div class="visitor-list">
                      <div
                        v-for="v in visitorItems"
                        :key="v.uin"
                        class="visitor-item"
                        :title="`点击复制 QQ 号 ${v.uin}`"
                        role="button"
                        tabindex="0"
                        @click="copyToClipboard(v.uin, 'QQ 号')"
                        @keydown.enter.prevent="copyToClipboard(v.uin, 'QQ 号')"
                        @keydown.space.prevent="copyToClipboard(v.uin, 'QQ 号')"
                      >
                        <el-avatar :size="28" :src="(v.img || '').replace('/50', '/100')">
                          {{ v.name?.[0] || '?' }}
                        </el-avatar>
                        <div class="visitor-meta">
                          <div class="visitor-name">{{ v.name }}</div>
                          <div class="visitor-time">{{ formatVisitorTime(v.time) }}</div>
                        </div>
                      </div>
                      <div v-if="visitorItems.length === 0" class="visitor-empty">暂无最近访客</div>
                    </div>
                  </div>
                </el-popover>

                <button
                  v-else
                  type="button"
                  class="album-meta-item album-meta-link visitor-meta-link visitor-state-link"
                  :class="{ 'is-error': visitorStatus === 'error' }"
                  :disabled="visitorStatus === 'loading'"
                  :aria-busy="visitorStatus === 'loading'"
                  :aria-label="visitorStateAriaLabel"
                  :title="
                    visitorStatus === 'error' ? '访客信息获取失败，点击重试' : '正在获取访客信息'
                  "
                  @click.stop="retryVisitors"
                >
                  <el-icon
                    v-if="visitorStatus === 'loading'"
                    class="is-loading visitor-loading-icon"
                  >
                    <Loading />
                  </el-icon>
                  <span>{{ visitorStatus === 'error' ? '访客 —' : '访客 …' }}</span>
                  <span v-if="visitorStatus === 'error'" class="visitor-retry">重试</span>
                </button>
              </span>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <div v-else class="empty-content">
      <p class="empty-description">空间相册</p>
    </div>

    <!-- 底部控制行 - 集中所有控制功能 -->
    <div v-if="currentAlbum" class="bottom-controls">
      <!-- 左侧：选择信息和图片大小控制 -->
      <div class="left-controls">
        <div class="selection-control">
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            :disabled="!hasPhotos"
            @change="selectAllPhotos"
          >
            <span class="selection-text">
              本页已选 {{ selectedPhotos.size }} / {{ allPhotos.length }} 张
            </span>
          </el-checkbox>
        </div>
        <div class="photo-size-controls">
          <span class="control-label">图片大小：</span>
          <el-radio-group v-model="photoSize" size="small">
            <el-radio-button value="mini">最小</el-radio-button>
            <el-radio-button value="small">小</el-radio-button>
            <el-radio-button value="medium">中</el-radio-button>
            <el-radio-button value="large">大</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 中间：预留空间 -->
      <div class="center-spacer"></div>

      <!-- 右侧：主要操作按钮 -->
      <div class="right-action-buttons">
        <!-- 上传照片按钮（好友空间不显示） -->
        <AppActionButton
          v-if="!isFriendContext"
          class="album-primary-action"
          variant="neutral"
          ui-size="large"
          :disabled="!currentAlbum"
          @click="showUploadDialog"
        >
          <el-icon><Upload /></el-icon>
          上传照片
        </AppActionButton>

        <!-- 下载相册按钮 -->
        <AppActionButton
          v-if="shouldShowDownloadButton"
          class="album-primary-action"
          variant="primary"
          ui-size="large"
          :disabled="!hasPhotos"
          @click="downloadAllPhotos"
        >
          <el-icon><Download /></el-icon>
          下载相册
        </AppActionButton>

        <!-- 获取照片状态时的取消按钮 -->
        <AppActionButton
          v-else-if="shouldShowCancelButton"
          class="album-primary-action"
          variant="warning"
          ui-size="large"
          @click="cancelDownload"
        >
          <el-icon class="is-loading"><Loading /></el-icon>
          <span
            v-if="albumDownloadState.status === 'fetching' && albumDownloadState.totalPhotos > 0"
          >
            获取中 {{ albumDownloadState.fetchedCount || 0 }}/{{ albumDownloadState.totalPhotos }}
          </span>
          <span v-else> 取消获取 </span>
        </AppActionButton>

        <!-- 下载状态时的进度显示 -->
        <AppActionButton
          v-else-if="shouldShowProgressButton"
          class="album-primary-action download-progress-action"
          variant="primary"
          ui-size="large"
          disabled
        >
          <el-icon class="is-loading"><Loading /></el-icon>
          {{ downloadButtonText }}

          <!-- 进度条显示在按钮内部 -->
          <div
            class="download-progress-bar"
            :style="{ width: `${albumDownloadState.progress}%` }"
          ></div>
        </AppActionButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, inject, nextTick, onMounted, onUnmounted, watch } from 'vue'
import {
  Loading,
  Upload,
  Download,
  Lock,
  Key,
  User,
  View,
  Hide,
  QuestionFilled,
  Unlock,
  ArrowDown
} from '@element-plus/icons-vue'
import UploadDialog from '@renderer/components/UploadDialog/index.vue'
import AppActionButton from '@renderer/components/AppActionButton/index.vue'
import AppRefreshButton from '@renderer/components/AppRefreshButton/index.vue'
import { formatDateWithYear } from '@renderer/utils/formatters'
import { copyToClipboard } from '@renderer/utils'
import { resolveQzoneHostUin } from '@renderer/utils/qzone-identity'
import { useDownloadStore } from '@renderer/store/download.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { useUserStore } from '@renderer/store/user.store'
import { QZONE_UTILS, QZONE_CONFIG } from '@shared/const'

const downloadStore = useDownloadStore()
const privacyStore = usePrivacyStore()
const userStore = useUserStore()

const hostUinOverride = inject('hostUinOverride', null)
const isFriendContext = computed(() => !!hostUinOverride?.value)
const effectiveHostUin = computed(() => resolveQzoneHostUin(hostUinOverride?.value, userStore))
const formatCompactDate = (value) =>
  formatDateWithYear(value).replace('年', '.').replace('月', '.').replace('日', '')

const currentAlbum = inject('currentAlbum', ref(null))
const leftRef = inject('leftRef', ref(null))
// 给上传弹窗提供完整相册列表用于切换上传目标
const availableAlbums = computed(() => {
  const menu = leftRef?.value?.menuList || []
  return menu.flatMap((cat) =>
    (cat.albums || []).map((a) => ({
      id: a.id,
      name: a.name,
      total: a.total,
      className: cat.className
    }))
  )
})
const selectAllCallback = inject('selectAllCallback', null)
const downloadAllCallback = inject('downloadAllCallback', null)
const cancelDownloadCallback = inject('cancelDownloadCallback', null)
const refreshAlbumCallback = inject('refreshAlbumCallback', null)
const allPhotos = inject('photoList', ref([]))
const selectedPhotos = inject('selectedPhotos', ref(new Set()))
const photoSize = inject('photoSize', ref('medium'))

// 问答状态（在 popover 打开时按需拉取）
const qaAnswer = ref(null)
const qaLoading = ref(false)
const qaAnswerVisible = ref(false)
const privPopoverVisible = ref(false)
const visitorPopoverVisible = ref(false)
const privTriggerRef = ref(null)
const visitorTriggerRef = ref(null)

const closeAlbumPopover = (type) => {
  if (type === 'visitor') {
    visitorPopoverVisible.value = false
    nextTick(() => visitorTriggerRef.value?.focus?.())
    return
  }
  privPopoverVisible.value = false
  nextTick(() => privTriggerRef.value?.focus?.())
}

const handleAlbumPopoverEscape = (event) => {
  if (event.key !== 'Escape') return
  if (visitorPopoverVisible.value) {
    event.preventDefault()
    event.stopPropagation()
    closeAlbumPopover('visitor')
  } else if (privPopoverVisible.value) {
    event.preventDefault()
    event.stopPropagation()
    closeAlbumPopover('privacy')
  }
}

const fetchAnswer = async () => {
  if (currentAlbum.value?.priv !== 5) return
  if (isFriendContext.value) {
    qaAnswer.value = ''
    return
  }
  if (qaAnswer.value !== null || qaLoading.value) return
  qaLoading.value = true
  try {
    const res = await window.QzoneAPI.getAlbumQA({
      hostUin: effectiveHostUin.value,
      albumId: currentAlbum.value?.id
    })
    qaAnswer.value = res?.code === 0 ? res.data?.answer || '' : ''
  } catch {
    qaAnswer.value = ''
  } finally {
    qaLoading.value = false
  }
}

const onPrivPopoverEnter = () => fetchAnswer()

// 切换相册时重置问答状态
watch(
  () => currentAlbum.value?.id,
  () => {
    qaAnswer.value = null
    qaAnswerVisible.value = false
    privPopoverVisible.value = false
    visitorPopoverVisible.value = false
  }
)

// 权限弹层数据
const PRIV_ICONS = { 1: Unlock, 2: Key, 3: Lock, 4: User, 5: QuestionFilled, 6: View, 8: Hide }
const privIcon = (priv) => PRIV_ICONS[priv] || Lock
const getPrivLabel = (priv) => QZONE_CONFIG.privMap[priv] || '未知权限'

const albumActivityMeta = computed(() => {
  const album = currentAlbum.value
  if (!album) return ''
  if (Number(album.lastuploadtime) > 0) {
    return `最近上传 ${formatCompactDate(album.lastuploadtime)}`
  }
  if (Number(album.modifytime) > 0) {
    return `更新于 ${formatCompactDate(album.modifytime)}`
  }
  return ''
})

const enabledFeatures = computed(() => {
  const a = currentAlbum.value
  if (!a) return []
  const features = []
  if (QZONE_UTILS.checkAllowReprint(a)) features.push('转载')
  if (QZONE_UTILS.checkAllowShare(a)) features.push('分享')
  if (QZONE_UTILS.checkAllowMark(a)) features.push('圈人')
  if (QZONE_UTILS.checkShowCameraInfo(a)) features.push('显示相机信息')
  return features
})

const pypyPrivLabel = computed(() => {
  const py = currentAlbum.value?.pypriv
  return py ? QZONE_CONFIG.pyPrivMap[py] || '' : ''
})

// 相册类型（弹层里展示）
const viewtypeText = computed(() => {
  const v = currentAlbum.value?.viewtype
  if (!v) return ''
  return QZONE_CONFIG.viewtypeMap[v] || ''
})

// 访客信息仅用于本人相册。好友相册没有稳定的访客查看权限，
// 不请求该接口，避免无意义的第三方访问和“无权限”提示。
const visitorTotal = ref(0)
const visitorToday = ref(0)
const visitorItems = ref([])
const visitorStatus = ref('idle')
let visitorRequestId = 0

const fetchVisitors = async () => {
  if (isFriendContext.value) return
  const albumId = currentAlbum.value?.id
  if (!albumId) return
  const requestId = ++visitorRequestId
  visitorStatus.value = 'loading'
  try {
    const res = await window.QzoneAPI.getAlbumVisitors(
      { hostUin: effectiveHostUin.value, albumId },
      { skipAuthCheck: true }
    )
    const stat = res?.data?.modvisitcount?.[0]
    if (!stat) throw new Error('相册访客接口未返回统计数据')
    if (requestId !== visitorRequestId) return
    visitorTotal.value = Number(stat.totalcount) || 0
    visitorToday.value = Number(stat.todaycount) || 0
    visitorItems.value = res?.data?.items || []
    visitorStatus.value = 'success'
  } catch (err) {
    if (requestId !== visitorRequestId) return
    console.warn('[top] 获取相册访客失败:', err)
    visitorTotal.value = 0
    visitorToday.value = 0
    visitorItems.value = []
    visitorStatus.value = 'error'
  }
}

const retryVisitors = () => {
  if (visitorStatus.value === 'error') fetchVisitors()
}

const visitorStateAriaLabel = computed(() =>
  visitorStatus.value === 'error' ? '访客信息获取失败，点击重试' : '正在获取访客信息'
)

watch(
  [() => currentAlbum.value?.id, () => isFriendContext.value],
  ([id, isFriend]) => {
    visitorRequestId += 1
    visitorTotal.value = 0
    visitorToday.value = 0
    visitorItems.value = []
    visitorStatus.value = 'idle'
    if (id && !isFriend) {
      fetchVisitors()
    }
  },
  { immediate: true }
)

// 访客时间相对格式：刚刚 / 5分钟前 / 3天前 / 2024.06
const formatVisitorTime = (t) => {
  if (!t) return ''
  const diff = Math.max(0, Date.now() / 1000 - t)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}天前`
  const d = new Date(t * 1000)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 从localStorage恢复和保存照片尺寸设置
onMounted(() => {
  window.addEventListener('keydown', handleAlbumPopoverEscape, true)
  const savedSize = localStorage.getItem('photo-size')
  if (savedSize && ['mini', 'small', 'medium', 'large'].includes(savedSize)) {
    photoSize.value = savedSize
  }
})

onUnmounted(() => window.removeEventListener('keydown', handleAlbumPopoverEscape, true))

// 监听照片尺寸变化，保存到localStorage
watch(
  photoSize,
  (newSize) => {
    localStorage.setItem('photo-size', newSize)
  },
  { immediate: false }
)

// 上传弹窗的显示状态
const showUpload = ref(false)

// 收缩状态
const isCollapsed = ref(false)

// 刷新加载状态
const refreshLoading = ref(false)

// 设置收缩状态
const setCollapsed = (collapsed) => {
  isCollapsed.value = collapsed
}

// 显示上传弹窗
const showUploadDialog = () => {
  showUpload.value = true
}

// 关闭上传弹窗的回调
const handleUploadDialogClose = async (shouldRefresh) => {
  showUpload.value = false
  if (shouldRefresh && currentAlbum.value) {
    // 刷新当前相册的照片列表
    if (refreshAlbumCallback) {
      await refreshAlbumCallback()
    }
  }
}

// 提供隐私模式状态和收缩控制给其他组件
defineExpose({
  privacyMode: privacyStore.privacyMode,
  setCollapsed
})

const hasPhotos = computed(() => allPhotos.value && allPhotos.value.length > 0)

const isAllSelected = computed(() => {
  if (!hasPhotos.value) return false
  return allPhotos.value.every((photo) =>
    selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )
})

const isIndeterminate = computed(() => {
  if (!hasPhotos.value) return false
  const selectedCount = selectedPhotos.value.size
  return selectedCount > 0 && selectedCount < allPhotos.value.length
})

// 计算当前相册的下载状态
const albumDownloadState = computed(() => {
  if (!currentAlbum.value) {
    return { isDownloading: false, progress: 0 }
  }
  return downloadStore.getAlbumDownloadState(currentAlbum.value.id)
})

// 计算当前相册是否正在获取照片
const isFetching = computed(() => {
  if (!currentAlbum.value) return false
  return downloadStore.isAlbumFetching(currentAlbum.value.id)
})

// 下载按钮文本
const downloadButtonText = computed(() => {
  const state = albumDownloadState.value

  // 获取阶段
  if (state.status === 'fetching' && state.totalPhotos > 0) {
    return `获取中 ${state.fetchedCount || 0}/${state.totalPhotos} (${state.progress}%)`
  }

  // 下载阶段
  if (state.isDownloading && state.totalCount > 0) {
    return `${state.downloadedCount}/${state.totalCount} (${state.progress}%)`
  }

  // 其他状态
  if (state.status === 'fetching') {
    return '获取照片中...'
  }

  return '下载中...'
})

// 检查是否应该显示正常的下载按钮
const shouldShowDownloadButton = computed(() => {
  const state = albumDownloadState.value
  return !state.isDownloading && !isFetching.value && state.status !== 'fetching'
})

// 检查是否应该显示取消按钮
const shouldShowCancelButton = computed(() => {
  return isFetching.value || albumDownloadState.value.status === 'fetching'
})

// 检查是否应该显示进度按钮
const shouldShowProgressButton = computed(() => {
  const state = albumDownloadState.value
  return state.isDownloading && state.status === 'downloading'
})

const selectAllPhotos = () => {
  if (selectAllCallback) {
    selectAllCallback()
  }
}

const downloadAllPhotos = async () => {
  if (downloadAllCallback && !albumDownloadState.value.isDownloading && !isFetching.value) {
    try {
      await downloadAllCallback()
    } catch (error) {
      console.error('下载失败:', error)
    }
  }
}

const cancelDownload = () => {
  if (cancelDownloadCallback) {
    cancelDownloadCallback()
  }
}

// 刷新当前相册
const refreshAlbum = async () => {
  if (refreshLoading.value) return

  refreshLoading.value = true
  try {
    if (refreshAlbumCallback) {
      await refreshAlbumCallback()
    }
  } finally {
    refreshLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.top-bar {
  position: relative;
  padding: 8px 20px;
  border-bottom: 1px solid var(--theme-border-subtle);
  background: var(--theme-surface-soft);
  transition: padding var(--theme-duration) var(--theme-ease);

  &.collapsed {
    padding: 8px 20px;

    .album-header {
      gap: 8px;
    }

    .title-section {
      margin-bottom: 0;

      .album-title {
        font-size: 16px;
      }
    }

    .bottom-controls {
      margin-top: 6px;
      padding-top: 6px;
    }
  }
}

/* 相册信息布局 */
.album-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  container-type: inline-size;
}

.album-info {
  display: block;
  flex: 1;
  min-width: 0;
}

.album-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  width: 100%;
}

.title-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.title-section {
  width: 100%;
  min-width: 0;
  margin-bottom: 6px;
  transition: margin var(--theme-duration) var(--theme-ease);

  .album-title {
    margin: 0;
    min-width: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text-primary);
    line-height: 1.35;
    letter-spacing: -0.02em;
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    transition: font-size var(--theme-duration) var(--theme-ease);
  }
}

.album-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  min-height: 28px;
  margin-top: 4px;
  color: var(--theme-text-muted);
  font-size: 12px;
  line-height: 20px;
}

.album-meta-item,
.album-meta-group {
  flex: 0 0 auto;
  white-space: nowrap;
}

.album-meta-item {
  color: var(--theme-text-muted);
  font-variant-numeric: tabular-nums;
}

.album-meta-count {
  color: var(--theme-text-secondary);
  font-weight: 600;
}

.album-meta-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.album-meta-divider {
  color: var(--theme-border-strong);
  user-select: none;
}

.inline-priv,
.album-meta-link {
  appearance: none;
  border: 0;
  font: inherit;
  cursor: pointer;
  transition:
    color var(--theme-duration-fast) var(--theme-ease),
    background-color var(--theme-duration-fast) var(--theme-ease);

  &:focus-visible {
    outline: 2px solid var(--theme-focus);
    outline-offset: 2px;
  }
}

.inline-priv {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding: 4px 6px;
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-muted);
  background: transparent;
  white-space: nowrap;

  &:hover {
    color: var(--theme-text-primary);
    background: var(--theme-surface-hover);

    .inline-priv-arrow {
      opacity: 0.9;
    }
  }

  &.priv-2,
  &.priv-5 {
    color: var(--theme-warning-text);
  }

  &.priv-8 {
    color: var(--theme-brand-text);
  }
}

.inline-priv-arrow {
  font-size: 10px;
  opacity: 0.45;
  margin-left: 1px;
  transition: opacity var(--theme-duration-fast) var(--theme-ease);
}

.album-meta-link {
  min-height: 28px;
  padding: 4px 6px;
  margin: 0 -6px;
  border-radius: var(--theme-radius-sm);
  background: transparent;

  &:hover {
    color: var(--theme-text-primary);
    background: var(--theme-surface-hover);
  }
}

.visitor-meta-link {
  min-width: 64px;
}

.visitor-state-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  &:disabled {
    color: var(--theme-text-subtle);
    cursor: wait;
  }

  &.is-error {
    color: var(--theme-danger-text);
  }
}

.visitor-loading-icon {
  font-size: 12px;
}

.visitor-retry {
  color: var(--theme-text-secondary);
  font-size: 11px;
}

.visitor-today {
  margin-left: 4px;
  color: var(--theme-brand-text);
  font-size: 11px;
}

/* 操作区域 */
.action-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 12px;
  align-items: center;

  .select-btn {
    min-width: 100px;
    height: 36px;
    font-weight: 500;
    border-radius: 8px;
    transition: all 0.2s ease;
    margin-left: auto;

    &:hover {
      transform: translateY(-1px);
      box-shadow: var(--theme-shadow-sm);
    }

    .btn-icon {
      font-style: normal;
      display: inline-block;
      font-size: 12px;
      line-height: 1;
    }
  }

  .download-btn {
    min-width: 140px;
    height: 36px;
    font-weight: 600;
    border-radius: 8px;
    background: var(--theme-brand);
    border: none;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;

    &:hover:not(:disabled) {
      background: var(--theme-brand-hover);
      transform: translateY(-1px);
      box-shadow: var(--theme-shadow-brand);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      background: var(--theme-surface-disabled);
      color: var(--theme-text-disabled);
      cursor: not-allowed;
    }

    .btn-icon {
      font-style: normal;
      display: inline-block;
      font-size: 12px;
      line-height: 1;
    }
  }

  .cancel-btn {
    min-width: 140px;
    height: 36px;
    font-weight: 600;
    border-radius: 8px;
    background: var(--theme-warning-soft);
    border: 1px solid var(--theme-warning-border);
    color: var(--theme-warning-text);
    transition: all 0.2s ease;

    &:hover {
      background: color-mix(in srgb, var(--theme-warning-soft) 75%, var(--theme-warning) 25%);
      transform: translateY(-1px);
      box-shadow: var(--theme-shadow-sm);
    }

    &:active {
      transform: translateY(0);
    }

    :deep(.el-icon.is-loading) {
      margin-right: 4px;
    }
  }

  .download-progress-btn {
    min-width: 140px;
    height: 36px;
    font-weight: 600;
    border-radius: 8px;
    background: var(--theme-brand-pressed);
    border: none;
    position: relative;
    overflow: hidden;
    cursor: not-allowed;

    :deep(.el-icon.is-loading) {
      margin-right: 4px;
    }

    // 进度条样式
    .download-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: var(--theme-border-strong);
      transition: width 0.2s ease;
      border-radius: 0 0 8px 8px;
    }
  }
}

.bottom-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--theme-border-subtle);
  gap: 16px;
  transition:
    margin var(--theme-duration) var(--theme-ease),
    padding var(--theme-duration) var(--theme-ease);

  .left-controls {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 0 0 auto;
  }

  .selection-control {
    :deep(.el-checkbox) {
      .el-checkbox__label {
        color: var(--theme-text-secondary);
        font-size: 13px;
        font-weight: 500;

        .selection-text {
          margin-left: 6px;
        }
      }

      .el-checkbox__input.is-checked .el-checkbox__inner {
        background-color: var(--theme-brand);
        border-color: var(--theme-brand);
      }

      .el-checkbox__input.is-indeterminate .el-checkbox__inner {
        background-color: var(--theme-brand);
        border-color: var(--theme-brand);
      }

      .el-checkbox__inner {
        border-color: var(--theme-border-strong);
        background-color: transparent;
      }

      &:hover {
        .el-checkbox__inner {
          border-color: var(--theme-brand-accent);
        }
      }
    }
  }

  .center-spacer {
    flex: 1;
  }

  .left-action-buttons {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .right-action-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .album-primary-action {
    min-width: 108px;
  }

  .download-progress-action {
    position: relative;
    overflow: hidden;

    .download-progress-bar {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 2px;
      background: var(--theme-brand-accent);
      transform-origin: left;
      transition: width var(--theme-duration-fast) var(--theme-ease);
    }
  }

  .right-controls {
    flex: 0 0 auto;
    min-width: 120px;
  }

  // 统一按钮样式
  :deep(.album-action-btn) {
    height: 32px;
    padding: 6px 16px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 13px;
    transition:
      color var(--theme-duration-fast) var(--theme-ease),
      background-color var(--theme-duration-fast) var(--theme-ease),
      border-color var(--theme-duration-fast) var(--theme-ease),
      box-shadow var(--theme-duration-fast) var(--theme-ease);
    box-shadow: var(--ds-shadow-sm);
    min-width: 80px;
    max-width: 120px;

    .el-icon {
      margin-right: 6px;
      font-size: 14px;
    }

    &:hover {
      box-shadow: var(--ds-shadow-sm);
      filter: brightness(1.08);
    }

    &:active {
      box-shadow: var(--ds-shadow-sm);
      filter: none;
    }

    &.upload-btn {
      background: var(--theme-surface-soft);
      border: 1px solid var(--theme-border);
      color: var(--theme-text-secondary);

      &:hover {
        background: var(--theme-surface-hover);
        border-color: var(--theme-brand-border);
        color: var(--theme-text-primary);
        filter: brightness(1.08);
      }
    }

    &.download-btn {
      background: var(--theme-brand);
      border: 1px solid transparent;
      color: var(--theme-text-inverse);

      &:hover {
        background: var(--theme-brand-hover);
        border-color: transparent;
        filter: brightness(1.08);
      }
    }

    &.cancel-btn {
      background: var(--theme-warning-soft);
      border: 1px solid var(--theme-warning-border);
      color: var(--theme-warning-text);

      &:hover {
        background: color-mix(in srgb, var(--theme-warning-soft) 75%, var(--theme-warning) 25%);
        border-color: var(--theme-warning-border);
        filter: brightness(1.08);
      }
    }

    &:disabled {
      background: var(--theme-surface-disabled);
      border-color: transparent;
      color: var(--theme-text-disabled);
      transform: none;
      box-shadow: none;
      filter: none;
      cursor: not-allowed;

      &:hover {
        transform: none;
        box-shadow: none;
        filter: none;
      }
    }
  }
}

.photo-size-controls {
  display: flex;
  align-items: center;
  gap: 8px;

  .control-label {
    color: var(--theme-text-secondary);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  :deep(.el-radio-group) {
    display: inline-flex;
    align-items: stretch;
    box-sizing: border-box;
    height: 22px;
    overflow: hidden;
    background: var(--theme-surface-soft);
    border: 1px solid var(--theme-border);
    border-radius: 7px;

    .el-radio-button {
      display: flex;
      align-items: stretch;
      height: 100%;

      .el-radio-button__inner {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
        background: var(--theme-surface-soft);
        border: 0;
        outline: 0;
        color: var(--theme-text-secondary);
        padding: 0 9px;
        font-size: 11px;
        line-height: 1;
        min-width: 34px;
        border-radius: 0;
        box-shadow: inset 1px 0 0 var(--theme-border);

        &:hover {
          background: var(--theme-surface-hover);
          color: var(--theme-text-primary);
        }
      }

      &:first-child .el-radio-button__inner {
        box-shadow: none;
      }

      &.is-active .el-radio-button__inner {
        background: var(--theme-brand);
        color: var(--theme-text-inverse);
        box-shadow: inset 1px 0 0 color-mix(in srgb, var(--theme-text-inverse) 22%, transparent);
      }

      &:first-child.is-active .el-radio-button__inner {
        box-shadow: none;
      }

      .el-radio-button__original-radio:focus-visible + .el-radio-button__inner {
        z-index: 1;
        border-radius: 5px;
        outline: 2px solid var(--theme-focus);
        outline-offset: -2px;
      }
    }
  }
}

.privacy-controls {
  display: flex;
  align-items: center;

  .privacy-btn {
    min-width: 90px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 6px;
    transition: all 0.2s ease;

    &:not(.el-button--warning) {
      background: var(--theme-surface-soft);
      border-color: var(--theme-border);
      color: var(--theme-text-secondary);

      &:hover {
        background: var(--theme-surface-hover);
        border-color: var(--theme-border-strong);
        color: var(--theme-text-primary);
        transform: translateY(-1px);
      }
    }

    &.el-button--warning {
      background: var(--theme-warning-soft);
      border-color: var(--theme-warning-border);
      color: var(--theme-warning-text);

      &:hover {
        background: color-mix(in srgb, var(--theme-warning-soft) 70%, var(--theme-warning) 30%);
        border-color: var(--theme-warning);
        transform: translateY(-1px);
        box-shadow: var(--theme-shadow-sm);
      }
    }

    .privacy-icon {
      font-style: normal;
      font-size: 12px;
      margin-right: 4px;
    }
  }
}

.quick-stats {
  .selected-count {
    font-size: 12px;
    color: var(--theme-text-muted);
    background: var(--theme-surface-soft);
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--theme-border-subtle);
    font-weight: 500;
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  padding: 32px 20px;
}

.empty-content {
  text-align: center;
  color: var(--theme-text-muted);

  .empty-icon {
    font-size: 48px;
    opacity: 0.3;
    margin-bottom: 16px;
    filter: grayscale(1);
  }

  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text-secondary);
    margin: 0 0 8px 0;
  }

  .empty-description {
    font-size: 13px;
    color: var(--theme-text-muted);
    margin: 0;
    line-height: 1.4;
  }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .action-section {
    .action-buttons {
      gap: 10px;
    }
  }
}

@media (max-width: 900px) {
  .title-section {
    margin-bottom: 6px;
  }
}

@container (max-width: 760px) {
  .title-section {
    margin-bottom: 0;
  }

  .album-meta-row {
    row-gap: 2px;
  }
}

@container (max-width: 520px) {
  .album-title-row {
    align-items: flex-start;
  }

  .title-section .album-title {
    font-size: 16px;
  }

  .title-right {
    :deep(.album-refresh-action) {
      width: var(--theme-control-sm);
      min-width: var(--theme-control-sm);
      padding-inline: 0;
    }
  }

  .refresh-label {
    display: none;
  }

  .album-meta-row {
    margin-top: 2px;
  }
}

@container (max-width: 420px) {
  .visitor-today {
    display: none;
  }
}

@media (max-width: 768px) {
  .top-bar {
    padding: 12px 16px;
    min-height: 80px;
  }

  .album-header {
    gap: 16px;
  }

  .action-section {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .bottom-controls {
    flex-direction: column;
    gap: 12px;
    align-items: center;

    .action-buttons {
      order: 1;
    }

    .quick-stats {
      order: 2;
    }

    .photo-size-controls,
    .privacy-controls {
      order: 3;
    }

    /* 移动端将尺寸和隐私控制放在同一行 */
    .photo-size-controls {
      display: flex;
      justify-content: center;
      margin-bottom: 8px;
    }

    .privacy-controls {
      display: flex;
      justify-content: center;
    }
  }

  .action-buttons {
    justify-content: center;
    gap: 12px;

    .select-btn,
    .download-btn {
      flex: 1;
      min-width: 120px;
    }
  }

  .quick-stats {
    text-align: center;
  }

  .empty-state {
    min-height: 100px;
    padding: 24px 16px;
  }

  .empty-content .empty-icon {
    font-size: 40px;
    margin-bottom: 12px;
  }
}

/* 淡入淡出滑动动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

@media (max-width: 480px) {
  .top-bar {
    padding: 8px 12px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 8px;

    .select-btn,
    .download-btn {
      width: 100%;
    }
  }
}
.upload-btn {
  min-width: 100px;
  height: 36px;
  font-weight: 500;
  border-radius: 8px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border);
  color: var(--theme-text-primary);
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--theme-surface-hover);
    border-color: var(--theme-brand-border);
    transform: translateY(-1px);
    box-shadow: var(--theme-shadow-sm);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    background: var(--theme-surface-disabled);
    border-color: var(--theme-border-subtle);
    color: var(--theme-text-disabled);
    cursor: not-allowed;
  }

  .btn-icon {
    font-style: normal;
    display: inline-block;
    font-size: 14px;
    line-height: 1;
  }
}
</style>

<style lang="scss">
/* 权限弹层（el-popover 渲染到 body，需要非 scoped 样式） */
.album-priv-popper.el-popper {
  background: var(--theme-surface-overlay);
  border: 1px solid var(--theme-border);

  .priv-popover {
    color: var(--theme-text-primary);
    font-size: 12px;

    .priv-popover-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-bottom: 8px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--theme-border-subtle);
      font-weight: 600;
      font-size: 13px;

      .el-icon {
        font-size: 15px;
        &.priv-1 {
          color: var(--theme-text-secondary);
        }
        &.priv-3 {
          color: var(--theme-text-muted);
        }
        &.priv-2,
        &.priv-5 {
          color: var(--theme-warning);
        }
        &.priv-4 {
          color: var(--theme-info);
        }
        &.priv-6 {
          color: var(--theme-info);
        }
        &.priv-8 {
          color: var(--theme-brand-accent);
        }
      }
    }

    .priv-row {
      display: flex;
      gap: 10px;
      padding: 4px 0;
      align-items: baseline;
      line-height: 1.5;

      &.priv-description-row {
        align-items: flex-start;
      }
    }

    .priv-label {
      flex-shrink: 0;
      width: 44px;
      font-size: 11px;
      color: var(--theme-text-subtle);
    }

    .priv-text {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;

      &.muted {
        color: var(--theme-text-muted);
      }

      &.answer {
        color: var(--theme-warning);
        font-weight: 500;
      }

      &.answer-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      &.mono {
        font-family:
          ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
      }

      &.copyable {
        cursor: pointer;
        border-radius: 3px;
        padding: 1px 4px;
        margin: -1px -4px;
        transition: background-color 0.15s ease;

        &:hover {
          background: var(--theme-surface-hover);
        }
        &:active {
          background: var(--theme-surface-active);
        }

        &:focus-visible {
          outline: 2px solid var(--theme-focus);
          outline-offset: 2px;
        }
      }

      .answer-value {
        min-width: 0;
        padding: 1px 4px;
        margin: -1px -4px;
        border-radius: 3px;
        color: var(--theme-warning);
        font-weight: 500;
        overflow-wrap: anywhere;
        cursor: pointer;
        transition: background-color var(--theme-duration-fast) var(--theme-ease);

        &:hover {
          background: var(--theme-surface-hover);
        }

        &:active {
          background: var(--theme-surface-active);
        }

        &:focus-visible {
          outline: 2px solid var(--theme-focus);
          outline-offset: 2px;
        }
      }

      .answer-toggle {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex: 0 0 auto;
        min-height: 24px;
        padding: 2px 6px;
        border: 0;
        border-radius: var(--theme-radius-sm);
        color: var(--theme-text-secondary);
        background: transparent;
        font: inherit;
        cursor: pointer;

        &:hover {
          color: var(--theme-text-primary);
          background: var(--theme-surface-hover);
        }

        &:focus-visible {
          outline: 2px solid var(--theme-focus);
          outline-offset: 2px;
        }
      }
    }
  }
}

/* 访客弹层 */
.album-visitors-popper.el-popper {
  background: var(--theme-surface-overlay);
  border: 1px solid var(--theme-border);

  .visitor-popover-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-primary);
    padding-bottom: 8px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--theme-border-subtle);
  }

  .visitor-list {
    max-height: 320px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--theme-surface-hover);
      border-radius: 2px;
    }
  }

  .visitor-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--theme-surface-hover);
    }

    &:focus-visible {
      outline: 2px solid var(--theme-focus);
      outline-offset: -2px;
    }

    .visitor-meta {
      flex: 1;
      min-width: 0;
    }

    .visitor-name {
      font-size: 12px;
      color: var(--theme-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    .visitor-time {
      font-size: 10px;
      color: var(--theme-text-subtle);
      line-height: 1.2;
      margin-top: 2px;
    }
  }

  .visitor-empty {
    text-align: center;
    color: var(--theme-text-disabled);
    font-size: 12px;
    padding: 16px 0;
  }
}
</style>
