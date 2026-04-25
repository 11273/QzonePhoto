<template>
  <div class="photo-main">
    <Top ref="topRef" />

    <!-- 照片网格区域 -->
    <div class="photo-container">
      <LoadingState v-if="loading" text="正在加载照片..." />

      <EmptyState
        v-else-if="!currentAlbum"
        icon="📷"
        title="选择一个相册"
        description="从左侧选择一个相册来查看照片"
      />

      <EmptyState
        v-else-if="photoGroups.length === 0 && !hasMore && total === 0"
        icon="📭"
        title="相册为空"
        description="这个相册还没有照片"
      />
      <el-scrollbar v-else ref="scrollbarRef" class="h-full" @scroll="handleScroll">
        <!-- 按日期分组的照片 -->
        <div class="photo-timeline">
          <div v-for="group in photoGroups" :key="group.date" class="date-group">
            <!-- 日期标题 -->
            <div class="date-header">
              <div class="date-info">
                <h3 class="date-title">{{ group.dateDisplay }}</h3>
                <span class="photo-count">{{ group.photos.length }} 张照片</span>
              </div>
              <div class="date-actions">
                <el-button
                  size="small"
                  :type="isDateSelected(group) ? 'primary' : 'default'"
                  @click="toggleDateSelection(group)"
                >
                  {{ isDateSelected(group) ? '取消全选' : '全选日期' }}
                </el-button>
              </div>
            </div>

            <!-- 照片网格 -->
            <div class="photo-grid" :class="`size-${photoSize}`">
              <div
                v-for="(photo, index) in group.photos"
                :key="photo.lloc || index"
                class="photo-item"
                :class="{
                  selected: selectedPhotos.has(
                    photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
                  ),
                  'privacy-mode': privacyStore.privacyMode
                }"
                @click="handlePhotoClick(photo, $event, index)"
              >
                <div class="photo-wrapper">
                  <el-image
                    :src="photo.pre"
                    :preview-src-list="group.photos.map((p) => p.url)"
                    :initial-index="index"
                    preview-teleported
                    fit="cover"
                    class="photo-image"
                    lazy
                  >
                    <template #error>
                      <div class="image-error">
                        <el-icon><Picture /></el-icon>
                        <span>加载失败</span>
                      </div>
                    </template>
                    <template #placeholder>
                      <div class="image-loading">
                        <el-icon class="loading-icon"><Loading /></el-icon>
                      </div>
                    </template>
                  </el-image>

                  <!-- 隐私模式遮罩 -->
                  <div v-if="privacyStore.privacyMode" class="privacy-overlay">
                    <el-icon class="privacy-icon"><Hide /></el-icon>
                    <div class="privacy-text">隐私保护</div>
                  </div>

                  <!-- 视频图标 -->
                  <span v-if="photo.is_video" class="video-badge">
                    <el-icon><VideoPlay /></el-icon>
                  </span>

                  <!-- 照片信息覆盖层 -->
                  <div class="photo-overlay">
                    <div class="photo-info">
                      <span class="photo-time">{{ formatTime(photo.modifytime) }}</span>
                      <!-- <span v-if="photo.is_video" class="video-badge">
                        <el-icon><VideoPlay /></el-icon>
                      </span> -->
                    </div>

                    <!-- 选择框 -->
                    <div class="selection-checkbox" @click.stop="selectPhoto(photo)">
                      <el-icon
                        v-if="
                          selectedPhotos.has(
                            photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
                          )
                        "
                        class="selected-icon"
                      >
                        <Check />
                      </el-icon>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 加载更多指示器 -->
          <div v-if="loadingMore" class="loading-more">
            <el-icon class="loading-icon"><Loading /></el-icon>
            <span>正在加载更多...</span>
          </div>

          <!-- 没有更多数据提示 -->
          <div v-else-if="!hasMore && (photoList.length > 0 || total > 0)" class="no-more">
            <span>
              已加载 {{ photoList.length }} / {{ total || photoList.length }} 张照片
              <template v-if="total && photoList.length < total">
                （其中 {{ total - photoList.length }} 张已跳过或不可读取）
              </template>
            </span>
          </div>

          <!-- 加载触发器 -->
          <div v-if="hasMore && !loading" ref="loadMoreTrigger" class="load-more-trigger">
            <div class="trigger-content">{{ hasMore ? '继续滚动加载更多...' : '' }}</div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- 底部悬浮工具栏 -->
    <Transition name="toolbar" appear>
      <div v-if="selectedPhotos.size > 0" class="floating-toolbar">
        <div class="toolbar-content">
          <span class="selected-count">已选择 {{ selectedPhotos.size }} 张照片</span>
          <div class="toolbar-actions">
            <el-button size="small" @click="clearSelection">取消选择</el-button>
            <el-button v-if="!isFriendContext" size="small" type="danger" @click="deleteSelected">删除选中</el-button>
            <el-button size="small" type="primary" @click="downloadSelected">下载选中</el-button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 图片预览 -->
    <el-image-viewer
      v-if="previewVisible && !isVideoPreview"
      :url-list="previewImages"
      :initial-index="previewIndex"
      :hide-on-click-modal="true"
      @close="previewVisible = false"
    />

    <!-- 相册访问验证弹窗 -->
    <el-dialog
      v-model="accessDialogVisible"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      width="380px"
      class="album-access-dialog"
      align-center
      @close="handleAccessCancel"
    >
      <div class="access-dialog-content">
        <div class="access-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="20" width="32" height="24" rx="4" stroke="currentColor" stroke-width="2.5" fill="none"/>
            <path d="M16 20V14a8 8 0 1 1 16 0v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <circle cx="24" cy="32" r="3" fill="currentColor"/>
            <path d="M24 35v3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="access-title">{{ accessDialogData.isQuestion ? '请回答问题' : '请输入密码' }}</h3>
        <p class="access-desc" v-if="accessDialogData.isQuestion">
          主人提问：<strong>{{ accessDialogData.question }}</strong>
        </p>
        <p class="access-desc" v-else>该相册需要输入密码才能访问</p>
        <el-input
          ref="accessInputRef"
          v-model="accessDialogData.inputValue"
          :placeholder="accessDialogData.isQuestion ? '请输入答案' : '请输入密码'"
          :type="accessDialogData.isQuestion ? 'text' : 'password'"
          :show-password="!accessDialogData.isQuestion"
          size="large"
          class="access-input"
          @keyup.enter="handleAccessConfirm"
        />
        <p v-if="accessDialogData.error" class="access-error">{{ accessDialogData.error }}</p>
        <div class="access-actions">
          <el-button @click="handleAccessCancel" class="access-btn cancel-btn">取消</el-button>
          <el-button type="primary" @click="handleAccessConfirm" :loading="accessDialogData.loading" class="access-btn confirm-btn">确定</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 视频预览对话框 -->
    <el-dialog
      v-model="videoPreviewVisible"
      :title="getVideoTitle(currentVideoInfo)"
      width="60%"
      :append-to-body="true"
      :close-on-click-modal="true"
      class="video-preview-dialog"
      @close="closeVideoPreview"
    >
      <div class="video-preview-container">
        <video
          v-if="currentVideoInfo && getVideoPlayUrl(currentVideoInfo)"
          ref="videoPlayerRef"
          :src="getVideoPlayUrl(currentVideoInfo)"
          :poster="currentVideoInfo.cover_url"
          controls
          preload="metadata"
          class="video-player"
          @error="handleVideoError"
          @loadstart="handleVideoLoadStart"
          @loadeddata="handleVideoLoaded"
        >
          您的浏览器不支持视频播放
        </video>
        <div v-else class="video-loading">
          <el-icon class="loading-icon"><Loading /></el-icon>
          <p>正在获取视频信息...</p>
        </div>
      </div>

      <!-- 视频信息 -->
      <div v-if="currentVideoInfo && hasVideoInfo(currentVideoInfo)" class="video-info">
        <div v-if="currentVideoInfo.video_size > 0" class="info-item">
          <span class="label">大小:</span>
          <span class="value">{{ formatBytes(currentVideoInfo.video_size) }}</span>
        </div>
        <div v-if="currentVideoInfo.video_duration > 0" class="info-item">
          <span class="label">时长:</span>
          <span class="value">{{ formatDuration(currentVideoInfo.video_duration) }}</span>
        </div>
        <div v-if="currentVideoInfo.video_format" class="info-item">
          <span class="label">格式:</span>
          <span class="value">{{ currentVideoInfo.video_format.toUpperCase() }}</span>
        </div>
        <div class="info-item">
          <span class="label">播放源:</span>
          <span class="value">{{ getVideoPlaySource(currentVideoInfo) }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, provide, inject, onUnmounted, watch, nextTick } from 'vue'
import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { Loading, Picture, VideoPlay, Check, Hide } from '@element-plus/icons-vue'
import { ElLoading, ElMessage, ElMessageBox } from 'element-plus'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import Top from './top.vue'
import { generateUniqueAlbumName } from '@renderer/utils'
import { formatBytes } from '@renderer/utils/formatters'

const userStore = useUserStore()
const downloadStore = useDownloadStore()

// 支持好友相册查看：通过 inject 接收外部 hostUin 覆盖
const hostUinOverride = inject('hostUinOverride', null)
const effectiveHostUin = computed(() => hostUinOverride?.value || userStore.userInfo.uin)
// 好友上下文时跳过鉴权检查（避免好友相册权限码被误判为登录过期）
const isFriendContext = computed(() => !!hostUinOverride?.value)
const friendMeta = computed(() => (isFriendContext.value ? { skipAuthCheck: true } : {}))
const privacyStore = usePrivacyStore()
const loading = ref(false)
const loadingMore = ref(false)
const isScrollLoading = ref(false) // 简单布尔锁

// 引用Top组件
const topRef = ref(null)

// 滚动容器引用
const scrollbarRef = ref(null)
const loadMoreTrigger = ref(null)
let observer = null

// 滚动状态
const lastScrollTop = ref(0)
const scrollThreshold = 50 // 滚动阈值，超过这个值才触发收缩
const isCollapsing = ref(false) // 是否正在收缩/展开动画中
let scrollTimer = null // 滚动防抖定时器

// 相册和照片数据
const currentAlbum = ref(null)
const photoList = ref([])

// 选择状态
const selectedPhotos = ref(new Set())

// 照片尺寸配置
const photoSize = ref('mini')

// 分页状态
const currentPageStart = ref(0)
const pageSize = ref(100)
const total = ref(0)
const hasMore = ref(true)

// 图片预览
const previewVisible = ref(false)
const previewIndex = ref(0)
const previewImages = ref([])

// 视频预览
const videoPreviewVisible = ref(false)
const videoPlayerRef = ref(null)
const currentVideoInfo = ref(null)
const isVideoPreview = ref(false)

// 取消标志 - 添加到组件顶部
const cancelFlags = ref(new Map()) // 存储每个相册的取消标志

// 公共的API调用函数
// MD5 哈希（用于相册问题/密码验证）
const md5Hash = async (str) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('MD5', data).catch(() => null)
  if (hashBuffer) {
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // crypto.subtle 不支持 MD5 时，使用简单实现
  return simpleMD5(str)
}

// 简易 MD5 实现（crypto.subtle 通常不支持 MD5）
const simpleMD5 = (string) => {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3]
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330)
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983)
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162)
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329)
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302)
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848)
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501)
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734)
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556)
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640)
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189)
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651)
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055)
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799)
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649)
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551)
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3])
  }
  function cmn(q, a, b, x, s, t) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b) }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t) }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t) }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t) }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t) }
  function md5blk(s) {
    const md5blks = []; for (let i = 0; i < 64; i += 4) md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24)
    return md5blks
  }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF }
  function rhex(n) { let s = ''; for (let j = 0; j < 4; j++) s += ('0' + ((n >> (j * 8 + 4)) & 0x0F).toString(16)).slice(-1) + ('0' + ((n >> (j * 8)) & 0x0F).toString(16)).slice(-1); return s }
  function hex(x) { for (let i = 0; i < x.length; i++) x[i] = rhex(x[i]); return x.join('') }
  function md5str(s) {
    let n = s.length; const state = [1732584193, -271733879, -1732584194, 271733878]; let i
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)))
    s = s.substring(i - 64); const tail = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3)
    tail[i >> 2] |= 0x80 << ((i % 4) << 3); if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0 }
    tail[14] = n * 8; md5cycle(state, tail); return hex(state)
  }
  return md5str(string)
}

// 当前相册的访问凭证（答案/密码）
const albumAccessToken = ref(null) // { question, answer }

const fetchPhotosByTopicId = async (topicId, pageStart = 0, pageNum = 100) => {
  const data = {
    hostUin: effectiveHostUin.value,
    topicId: topicId,
    pageStart: pageStart,
    pageNum: pageNum
  }

  // 附加问题/答案参数（用于 priv=5 和 priv=2 的相册）
  if (albumAccessToken.value) {
    data.question = albumAccessToken.value.question
    data.answer = albumAccessToken.value.answer
  }

  try {
    const response = await window.QzoneAPI.getPhotoByTopicId(data, friendMeta.value)

    // 标准化响应数据处理 - 修正：成功状态码是 0 而不是 200
    if (response?.code === 0 && response?.data) {
      const responseData = response.data
      const photos = Array.isArray(responseData.photoList) ? responseData.photoList : []
      const responseTotal = Number(responseData.totalInAlbum)
      const fallbackTotal = Number(currentAlbum.value?.total)
      const total =
        Number.isFinite(responseTotal) && responseTotal > 0
          ? responseTotal
          : Number.isFinite(fallbackTotal) && fallbackTotal > 0
            ? fallbackTotal
            : 0
      const nextPageStartValue = Number(responseData.nextPageStart)
      const nextPageStart =
        Number.isFinite(nextPageStartValue) && nextPageStartValue >= pageStart
          ? nextPageStartValue
          : pageStart + pageNum
      const responseHasMore =
        typeof responseData.hasMore === 'boolean'
          ? responseData.hasMore
          : total > 0
            ? nextPageStart < total
            : nextPageStart > pageStart
      const hasMore = responseHasMore
      const skippedCount = Number.isFinite(responseData.skippedCount)
        ? responseData.skippedCount
        : 0
      const requestedCount = Number.isFinite(responseData.requestedCount)
        ? responseData.requestedCount
        : pageNum

      return {
        success: true,
        photos: photos,
        total: total,
        hasMore: hasMore,
        nextPageStart,
        skippedCount,
        requestedCount,
        message: response.message || ''
      }
    }

    // 权限错误特殊处理
    if (response?.code === -10805) {
      return {
        success: false,
        photos: [],
        total: 0,
        hasMore: false,
        nextPageStart: pageStart,
        skippedCount: 0,
        requestedCount: pageNum,
        error: '回答错误',
        code: -10805
      }
    }

    return {
      success: false,
      photos: [],
      total: 0,
      hasMore: false,
      nextPageStart: pageStart,
      skippedCount: 0,
      requestedCount: pageNum,
      error: response?.message || `API 错误: code=${response?.code}, message=${response?.message}`,
      code: response?.code
    }
  } catch (error) {
    console.error('API 调用失败:', error)
    return {
      success: false,
      photos: [],
      total: 0,
      hasMore: false,
      nextPageStart: pageStart,
      skippedCount: 0,
      requestedCount: pageNum,
      error: error.message || '网络请求失败'
    }
  }
}

// 注释：fetchAllPhotosFromAlbum 函数已被 fetchAllPhotosFromAlbumWithCancel 替代

// 清理照片数据的公共函数
const cleanPhotoData = (photos) => {
  return photos.map((photo) => ({
    id: photo.id,
    name: photo.name,
    url: photo.url,
    pre: photo.pre,
    raw: photo.raw,
    lloc: photo.lloc,
    modifytime: photo.modifytime,
    is_video: photo.is_video,
    size: photo.size || 0,
    // 保留关键字段
    picKey: photo.picKey
  }))
}

// 添加下载任务的公共函数 - 优化批量添加体验
const addDownloadTask = async (albumData) => {
  try {
    // 确保传递用户信息，好友模式下附带 friendUin
    const enrichedAlbumData = {
      ...albumData,
      uin: userStore.userInfo?.uin || 'unknown',
      p_skey: userStore.PSkey || null,
      ...(isFriendContext.value ? { friendUin: hostUinOverride.value } : {})
    }

    // 如果照片数量很多，显示提示
    const photoCount = enrichedAlbumData.photos?.length || 0
    if (photoCount > 100) {
      const loadingInstance = ElLoading.service({
        lock: true,
        text: `正在添加 ${photoCount} 个下载任务，请稍候...`,
        background: 'rgba(0, 0, 0, 0.7)'
      })

      try {
        await window.QzoneAPI.download.addAlbum(enrichedAlbumData)
        loadingInstance.close()
        return { success: true }
      } catch (error) {
        loadingInstance.close()
        throw error
      }
    } else {
      await window.QzoneAPI.download.addAlbum(enrichedAlbumData)
      return { success: true }
    }
  } catch (error) {
    console.error('添加下载任务失败:', error)
    return { success: false, error: error.message || '添加下载任务失败' }
  }
}

// 无限滚动加载更多照片
const loadMorePhotos = async () => {
  if (isScrollLoading.value || !currentAlbum.value || !hasMore.value) {
    return
  }

  isScrollLoading.value = true
  loadingMore.value = true

  try {
    const requestedPageSize = pageSize.value
    const pageStart = currentPageStart.value
    const result = await fetchPhotosByTopicId(currentAlbum.value.id, pageStart, requestedPageSize)

    if (result.success) {
      if (result.nextPageStart <= pageStart && result.hasMore) {
        console.warn('加载更多照片游标未推进，停止继续加载', {
          albumId: currentAlbum.value.id,
          pageStart,
          nextPageStart: result.nextPageStart
        })
        hasMore.value = false
        return
      }

      currentPageStart.value = result.nextPageStart

      // 过滤重复照片（根据 lloc 或组合键）
      const existingKeys = new Set(
        photoList.value.map((p) => p.lloc || `${p.id}_${p.name}_${p.modifytime}`)
      )

      const newPhotos = result.photos.filter((photo) => {
        const key = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
        return !existingKeys.has(key)
      })

      if (newPhotos.length > 0) {
        photoList.value.push(...newPhotos)
      }

      // 更新总数
      total.value = result.total > 0 ? result.total : total.value || currentAlbum.value?.total || 0

      hasMore.value = result.hasMore
    } else {
      hasMore.value = false
      if (!result.success) {
        console.error('加载失败:', result.error)

        ElMessage.error(result.error || '加载照片失败')
      }
    }
  } catch (error) {
    console.error('加载更多照片失败:', error)

    ElMessage.error('加载照片失败')
    hasMore.value = false
  } finally {
    loadingMore.value = false
    // 简单延迟解锁
    setTimeout(() => {
      isScrollLoading.value = false
    }, 300)
  }
}

// 处理滚动事件
const handleScroll = () => {
  if (!topRef.value || !topRef.value.setCollapsed || isCollapsing.value) return

  // 获取滚动元素和滚动位置
  const scrollElement =
    scrollbarRef.value?.wrapRef || scrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap')
  if (!scrollElement) return

  const scrollTop = scrollElement.scrollTop || 0

  // 检查内容高度是否足够滚动（避免内容少时抖动）
  const scrollHeight = scrollElement.scrollHeight
  const clientHeight = scrollElement.clientHeight
  const hasEnoughContent = scrollHeight > clientHeight + 150 // 至少需要150px的额外内容才允许收缩

  // 清除之前的防抖定时器
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }

  // 防抖处理，避免频繁切换
  scrollTimer = setTimeout(() => {
    // 如果正在动画中，跳过
    if (isCollapsing.value) return

    const shouldCollapse = scrollTop > scrollThreshold
    const shouldExpand = scrollTop <= scrollThreshold
    const isScrollingDown = scrollTop > lastScrollTop.value

    // 判断滚动方向
    if (isScrollingDown) {
      // 向下滚动（内容向上移动）
      if (shouldCollapse && hasEnoughContent) {
        // 只有在有足够内容时才收缩
        isCollapsing.value = true
        topRef.value.setCollapsed(true)
        // 动画结束后解锁（200ms是CSS transition时间）
        setTimeout(() => {
          isCollapsing.value = false
        }, 220)
      }
    } else {
      // 向上滚动（内容向下移动）或到达顶部
      if (shouldExpand) {
        isCollapsing.value = true
        topRef.value.setCollapsed(false)
        // 动画结束后解锁
        setTimeout(() => {
          isCollapsing.value = false
        }, 220)
      }
    }

    lastScrollTop.value = scrollTop
  }, 100) // 100ms防抖延迟，减少频繁触发
}

// 监听当前相册变化
watch(currentAlbum, async (newAlbum) => {
  if (!newAlbum) {
    photoList.value = []
    total.value = 0
    hasMore.value = true
    currentPageStart.value = 0
    return
  }

  // 先断开观察器
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // 重置状态
  loading.value = true
  photoList.value = []
  selectedPhotos.value.clear()
  hasMore.value = true
  currentPageStart.value = 0
  lastScrollTop.value = 0 // 重置滚动位置
  isCollapsing.value = false // 重置收缩状态

  // 清除滚动防抖定时器
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }

  // 重置顶部展开状态
  if (topRef.value && topRef.value.setCollapsed) {
    topRef.value.setCollapsed(false)
  }

  try {
    const result = await fetchPhotosByTopicId(newAlbum.id, 0, pageSize.value)

    if (result.success) {
      photoList.value = result.photos
      total.value = result.total > 0 ? result.total : newAlbum.total || 0
      currentPageStart.value = result.nextPageStart
      hasMore.value = result.hasMore
    } else {
      console.error('加载相册失败:', result.error)

      // 回答错误时，提示重新输入
      if (result.code === -10805 && currentAlbum.value) {
        albumAccessToken.value = null
        accessDialogData.value.error = '回答错误，请重试'
        const answered = await promptAlbumAccess(currentAlbum.value)
        if (answered) {
          const retry = await fetchPhotosByTopicId(newAlbum.id, 0, pageSize.value)
          if (retry.success) {
            photoList.value = retry.photos
            total.value = retry.total > 0 ? retry.total : newAlbum.total || 0
            currentPageStart.value = retry.nextPageStart
            hasMore.value = retry.hasMore
          } else if (retry.code === -10805) {
            ElMessage.error('回答错误')
            currentAlbum.value = null
          } else {
            ElMessage.error(retry.error || '加载失败')
          }
        } else {
          currentAlbum.value = null
        }
      } else {
        ElMessage.error(result.error || '加载相册照片失败')
      }
    }
  } catch (error) {
    console.error('加载相册照片失败:', error)

    ElMessage.error('加载相册照片失败')
  } finally {
    loading.value = false

    // 确保在加载完成后设置观察器
    nextTick(() => {
      setupIntersectionObserver()
    })
  }
})

// 下载当前相册所有照片
const downloadCurrentAlbum = async () => {
  if (!currentAlbum.value) {
    ElMessage.warning('请先选择相册')
    return
  }

  const albumId = currentAlbum.value.id

  // 检查是否已经在下载或获取中
  if (downloadStore.isAlbumDownloading(albumId) || downloadStore.isAlbumFetching(albumId)) {
    ElMessage.warning('该相册正在下载中')
    return
  }

  // 重置取消标志
  cancelFlags.value.set(albumId, false)

  try {
    // 开始获取，设置预计总数
    downloadStore.startAlbumFetch(albumId, currentAlbum.value.total || 0)
    downloadStore.setAlbumFetching(albumId, true)

    // 流式获取照片并添加到下载队列
    const allPhotos = []
    let totalAddedTasks = 0

    await fetchAndAddPhotosStream(
      currentAlbum.value,
      albumId,
      (fetchedPhotos, totalFetched, processedCount) => {
        // 更新获取进度
        downloadStore.updateFetchProgress(albumId, processedCount)

        // 累计所有照片用于最终统计
        allPhotos.push(...fetchedPhotos)
        totalAddedTasks = totalFetched
      }
    )

    // 检查是否被取消
    if (cancelFlags.value.get(albumId)) {
      downloadStore.setAlbumFetching(albumId, false)
      downloadStore.cancelAlbumDownload(albumId)

      ElMessage.info('已取消获取相册照片')
      return
    }

    // 获取完成
    downloadStore.setAlbumFetching(albumId, false)

    if (totalAddedTasks === 0) {
      ElMessage.warning('当前相册没有可下载的照片')
      downloadStore.clearAlbumDownloadState(albumId)
      return
    }

    // 重置状态，让任务系统接管下载进度显示
    downloadStore.resetAlbumState(albumId)

    // eslint-disable-next-line no-undef
    ElNotification({
      title: '下载任务已添加',
      message: `已将 ${totalAddedTasks} 张图片加入下载队列`,
      type: 'success',
      duration: 4000,
      position: 'top-right'
    })
  } catch (error) {
    // 获取或下载失败，清理状态
    downloadStore.setAlbumFetching(albumId, false)
    if (!cancelFlags.value.get(albumId)) {
      downloadStore.errorAlbumDownload(albumId, error.message)
      console.error('下载相册失败:', error)

      ElMessage.error('下载相册失败')
    }
  } finally {
    // 清理取消标志
    cleanupAlbumFlags(albumId)
  }
}

// 流式获取照片并添加到下载队列
const fetchAndAddPhotosStream = async (album, albumId, onProgress = null) => {
  if (!album) return

  const batchSize = 100
  let pageStart = 0
  let totalFetched = 0
  let processedCount = 0

  while (true) {
    // 检查取消标志
    if (cancelFlags.value.get(albumId)) {
      throw new Error('用户取消操作')
    }

    try {
      const currentBatchStart = pageStart
      const result = await fetchPhotosByTopicId(album.id, pageStart, batchSize)

      if (!result.success) {
        console.error('获取照片失败:', result.error)
        break
      }

      if (result.nextPageStart <= currentBatchStart && result.hasMore) {
        console.warn('下载照片时游标未推进，停止继续拉取', {
          albumId,
          pageStart: currentBatchStart,
          nextPageStart: result.nextPageStart
        })
        break
      }

      const albumTotal = Number(album.total)
      processedCount =
        Number.isFinite(albumTotal) && albumTotal > 0
          ? Math.min(albumTotal, result.nextPageStart)
          : result.nextPageStart

      if (result.photos.length > 0) {
        // 清理照片数据
        const cleanPhotos = cleanPhotoData(result.photos)

        // 立即添加这批照片到下载队列
        const albumData = {
          album: {
            id: album.id,
            name: generateUniqueAlbumName(album),
            total: album.total,
            desc: album.desc || ''
          },
          photos: cleanPhotos,
          uin: userStore.userInfo?.uin || 'unknown',
          albumId: albumId
        }

        // 检查取消状态
        if (cancelFlags.value.get(albumId)) {
          throw new Error('用户取消操作')
        }

        // 添加到下载队列
        const addResult = await addDownloadTask(albumData)
        if (!addResult.success) {
          console.error('添加下载任务失败:', addResult.error)
        }

        totalFetched += result.photos.length

        // 调用进度回调
        if (onProgress) {
          onProgress(result.photos, totalFetched, processedCount)
        }

        if (!result.hasMore) {
          break
        }
      } else {
        if (onProgress) {
          onProgress([], totalFetched, processedCount)
        }

        if (!result.hasMore) {
          break
        }
      }

      if (!result.hasMore) {
        break
      }

      pageStart = result.nextPageStart

      // 避免请求过快，并检查取消状态
      await new Promise((resolve) => setTimeout(resolve, 100))
    } catch (error) {
      console.error('获取照片时出错:', error)
      throw error
    }
  }
}

// 取消当前相册下载
const cancelCurrentAlbumDownload = () => {
  if (!currentAlbum.value) return

  const albumId = currentAlbum.value.id
  // 设置本地取消标志
  cancelFlags.value.set(albumId, true)

  // 设置全局取消标志，让批量下载能够感知
  downloadStore.setGlobalCancelFlag(albumId, true)

  // 立即更新store状态
  downloadStore.cancelAlbumDownload(albumId)

  ElMessage.info('正在取消下载...')
}

// 在下载完成或出错时清理全局取消标志
const cleanupAlbumFlags = (albumId) => {
  cancelFlags.value.delete(albumId)
  downloadStore.clearGlobalCancelFlag(albumId)
}

// 刷新当前相册
const refreshCurrentAlbum = async () => {
  if (!currentAlbum.value) {
    ElMessage.warning('请先选择一个相册')
    return
  }

  // 先断开观察器
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // 重置状态
  loading.value = true
  photoList.value = []
  selectedPhotos.value.clear()
  hasMore.value = true
  currentPageStart.value = 0

  try {
    console.log(`刷新相册: ${currentAlbum.value.name} (ID: ${currentAlbum.value.id})`)

    const result = await fetchPhotosByTopicId(currentAlbum.value.id, 0, pageSize.value)

    if (result.success) {
      photoList.value = result.photos
      total.value = result.total > 0 ? result.total : currentAlbum.value.total || 0
      currentPageStart.value = result.nextPageStart
      hasMore.value = result.hasMore

      // ElMessage.success(`已刷新相册：${currentAlbum.value.name}`)
    } else {
      console.error('刷新相册失败:', result.error)

      ElMessage.error(result.error || '刷新相册失败')
    }
  } catch (error) {
    console.error('刷新相册失败:', error)

    ElMessage.error('刷新相册失败')
  } finally {
    loading.value = false

    // 确保在加载完成后设置观察器
    nextTick(() => {
      setupIntersectionObserver()
    })
  }
}

// 全选/取消全选照片
const toggleSelectAll = () => {
  if (selectedPhotos.value.size === photoList.value.length) {
    // 当前全选状态，执行取消全选
    selectedPhotos.value = new Set()
  } else {
    // 当前非全选状态，执行全选
    const allPhotoKeys = photoList.value.map(
      (photo) => photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
    )
    selectedPhotos.value = new Set(allPhotoKeys)
  }
}

// 下载选中照片
// 删除选中的照片
const deleteSelected = async () => {
  if (selectedPhotos.value.size === 0) {
    ElMessage.warning('请先选择要删除的照片')
    return
  }

  // 二次确认
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedPhotos.value.size} 张照片吗？`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    // 用户取消
    return
  }

  // 获取选中的照片信息
  const selectedPhotoList = photoList.value.filter((photo) => {
    const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
    return selectedPhotos.value.has(photoKey)
  })

  if (selectedPhotoList.length === 0) {
    ElMessage.error('未找到选中的照片')
    return
  }

  // 提取照片数据（包含ID、picrefer和imageType）
  const photoData = selectedPhotoList.map((photo) => ({
    id: photo.lloc || photo.picKey || photo.id,
    picrefer: photo.picrefer || '',
    imageType: photo.uploadtype || photo.type || 1,
    modifytime: photo.modifytime || Math.floor(Date.now() / 1000)
  }))

  console.log('[deleteSelected] 准备删除的照片数据:', photoData)

  try {
    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在删除照片...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    // 调用删除API
    const result = await window.QzoneAPI.deletePhotos({
      hostUin: effectiveHostUin.value,
      albumId: currentAlbum.value.id,
      photoData: photoData,
      albumName: currentAlbum.value.name,
      priv: currentAlbum.value.priv || 3
    }, friendMeta.value)

    loadingInstance.close()

    // 检查删除结果
    if (result.code === 0) {
      const successCount = result.data?.succ?.length || 0
      ElMessage.success(`成功删除 ${successCount} 张照片`)

      // 清空选择
      selectedPhotos.value.clear()

      // 刷新相册照片列表
      await refreshCurrentAlbum()
    } else {
      ElMessage.error(result.message || '删除照片失败')
    }
  } catch (error) {
    console.error('删除照片失败:', error)
    ElMessage.error(error.message || '删除照片失败，请重试')
  }
}

const downloadSelected = async () => {
  if (selectedPhotos.value.size === 0) {
    ElMessage.warning('请先选择要下载的照片')
    return
  }

  try {
    // 获取选中的照片对象
    const selectedPhotoObjects = photoList.value.filter((photo) =>
      selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
    )

    if (selectedPhotoObjects.length === 0) {
      ElMessage.warning('未找到选中的照片')
      return
    }

    // 清理照片数据
    const cleanPhotos = cleanPhotoData(selectedPhotoObjects)

    // 准备下载任务数据 - 使用更描述性的名称
    const albumData = {
      album: {
        id: currentAlbum.value.id,
        name: generateUniqueAlbumName(currentAlbum.value),
        total: currentAlbum.value.total || cleanPhotos.length,
        desc: currentAlbum.value.desc || ''
      },
      photos: cleanPhotos,
      uin: userStore.userInfo?.uin || 'unknown'
    }

    const result = await addDownloadTask(albumData)
    if (result.success) {
      // eslint-disable-next-line no-undef
      ElNotification({
        title: '下载任务已添加',
        message: `已将 ${selectedPhotoObjects.length} 张图片加入下载队列`,
        type: 'success',
        duration: 4000,
        position: 'top-right'
      })
      // 清除选择
      selectedPhotos.value = new Set()
    } else {
      ElMessage.error(result.error || '下载选中照片失败')
    }
  } catch (error) {
    console.error('下载选中照片失败:', error)

    ElMessage.error('下载选中照片失败')
  }
}

// 提供给 Top 组件使用
provide('selectedPhotos', selectedPhotos)
provide('photoList', photoList)
provide('currentAlbum', currentAlbum)
provide('selectAllCallback', toggleSelectAll)
provide('downloadAllCallback', downloadCurrentAlbum)
provide('cancelDownloadCallback', cancelCurrentAlbumDownload)
provide('downloadSelectedCallback', downloadSelected)
provide('photoSize', photoSize)

// 监听左侧相册选择（通过事件总线或props）
const selectAlbum = async (album, forceRefresh = false) => {
  if (!album) {
    // 清空当前相册（切换好友时触发）
    currentAlbum.value = null
    photoList.value = []
    selectedPhotos.value = new Set()
    albumAccessToken.value = null
    total.value = 0
    currentPageStart.value = 0
    hasMore.value = true
    return
  }

  // 如果相册ID相同且不是强制刷新，则直接返回
  if (currentAlbum.value?.id === album.id && !forceRefresh) return

  // 处理权限相册：priv=3 仅自己可见（好友模式下不可访问）
  if (album.priv === 3 && isFriendContext.value) {
    ElMessage.warning('该相册仅主人可见')
    return
  }

  // 处理权限相册：priv=5 回答问题 / priv=2 密码访问
  if ((album.priv === 5 || album.priv === 2) && !album.allowAccess && isFriendContext.value) {
    const answered = await promptAlbumAccess(album)
    if (!answered) return // 用户取消
  } else {
    albumAccessToken.value = null
  }

  // 先断开监听器，避免重复触发
  if (observer) {
    observer.disconnect()
    observer = null
  }

  currentAlbum.value = album
  selectedPhotos.value = new Set()
  // 重置分页状态
  photoList.value = []
  total.value = 0
  currentPageStart.value = 0
  hasMore.value = true

  // 相册改变时会自动触发 watch(currentAlbum) 进行加载
}

// 相册访问弹窗状态
const accessDialogVisible = ref(false)
const accessInputRef = ref(null)
const accessDialogData = ref({
  isQuestion: false,
  question: '',
  inputValue: '',
  error: '',
  loading: false,
  album: null,
  resolve: null
})

// 弹窗询问相册问题/密码（返回 Promise）
const promptAlbumAccess = (album) => {
  return new Promise((resolve) => {
    accessDialogData.value = {
      isQuestion: album.priv === 5,
      question: album.question || '',
      inputValue: '',
      error: '',
      loading: false,
      album,
      resolve
    }
    accessDialogVisible.value = true
    nextTick(() => accessInputRef.value?.focus())
  })
}

const handleAccessConfirm = () => {
  const data = accessDialogData.value
  const value = data.inputValue?.trim()
  if (!value) {
    data.error = '请输入内容'
    return
  }
  data.error = ''

  // 计算 MD5
  let answerMD5
  if (data.isQuestion) {
    answerMD5 = simpleMD5(encodeURIComponent(value)).toUpperCase()
  } else {
    answerMD5 = simpleMD5(value)
  }

  albumAccessToken.value = {
    question: data.album?.question || '',
    answer: answerMD5
  }

  accessDialogVisible.value = false
  data.resolve?.(true)
}

const handleAccessCancel = () => {
  accessDialogVisible.value = false
  accessDialogData.value.resolve?.(false)
}

// 提供选择相册的方法给父组件
defineExpose({
  selectAlbum,
  refreshCurrentAlbum,
  currentAlbum // 暴露当前相册，方便外部访问
})

// 按日期分组照片
const photoGroups = computed(() => {
  if (!photoList.value.length) return []

  const groups = new Map()

  photoList.value.forEach((photo) => {
    // 使用修改时间进行分组
    const timeStr = photo.modifytime
    const date = new Date(typeof timeStr === 'string' ? timeStr : timeStr * 1000)
    const dateKey = date.toDateString()

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        dateDisplay: formatDateDisplay(date),
        photos: []
      })
    }

    groups.get(dateKey).photos.push(photo)
  })

  // 按日期降序排序
  return Array.from(groups.values()).sort((a, b) => new Date(b.date) - new Date(a.date))
})

// 格式化日期显示
const formatDateDisplay = (date) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const photoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffTime = today - photoDate
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  if (diffDays <= 7) return `${diffDays} 天前`

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (year === now.getFullYear()) {
    return `${month}月${day}日`
  }

  return `${year}年${month}月${day}日`
}

// 格式化时间显示
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(typeof timeStr === 'string' ? timeStr : timeStr * 1000)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化视频时长
const formatDuration = (seconds) => {
  if (seconds === 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// 设置IntersectionObserver监听加载更多
const setupIntersectionObserver = () => {
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // 确保触发器元素存在且还有更多数据可加载
  if (!loadMoreTrigger.value || !hasMore.value) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries
      if (entry.isIntersecting) {
        if (hasMore.value && !loadingMore.value && !loading.value && !isScrollLoading.value) {
          loadMorePhotos()
        }
      }
    },
    {
      rootMargin: '50px',
      threshold: 0.1
    }
  )

  observer.observe(loadMoreTrigger.value)
}

// 检查容器是否需要加载更多数据（解决首次加载数据不足以填满容器的问题）
const checkAndLoadMore = async () => {
  // 等待 DOM 更新
  await nextTick()

  const scrollElement =
    scrollbarRef.value?.wrapRef || scrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap')
  if (!scrollElement) return

  const hasScrollbar = scrollElement.scrollHeight > scrollElement.clientHeight

  // 如果没有滚动条且还有更多数据可以加载，则自动加载
  if (
    !hasScrollbar &&
    hasMore.value &&
    !loading.value &&
    !isScrollLoading.value &&
    !loadingMore.value
  ) {
    console.log('检测到照片内容未填满容器，自动加载更多...')
    await loadMorePhotos()
    // 递归检查是否还需要继续加载
    if (hasMore.value) {
      await checkAndLoadMore()
    }
  }
}

// 处理照片点击事件
const handlePhotoClick = async (photo, event, index) => {
  event.stopPropagation()

  // 如果是视频，获取详细信息并预览
  if (photo.is_video) {
    try {
      // 显示加载状态
      currentVideoInfo.value = { ...photo, video_play_url: null }
      isVideoPreview.value = true
      videoPreviewVisible.value = true

      // 简化参数提取逻辑 - 使用当前相册的ID作为topicId
      const topicId = currentAlbum.value?.id
      const picKey = photo.picKey || photo.lloc
      const hostUin = effectiveHostUin.value

      // 参数验证
      if (!topicId || !picKey) {
        console.error('视频预览参数不完整:', { topicId, picKey, hostUin })

        ElMessage.error('视频信息不完整，无法预览')
        closeVideoPreview()
        return
      }

      // 获取视频详细信息
      const videoInfo = await window.QzoneAPI.getVideoInfo({
        hostUin,
        topicId,
        picKey
      }, friendMeta.value)

      if (videoInfo) {
        currentVideoInfo.value = videoInfo
      } else {
        console.log('未获取到视频信息')

        ElMessage.warning('无法获取视频播放地址，可能是权限限制')
        closeVideoPreview()
      }
    } catch (error) {
      console.error('获取视频信息失败:', error)

      ElMessage.error('获取视频信息失败')
      closeVideoPreview()
    }
  } else {
    // 单击：预览图片
    previewPhoto(photo, index)
  }
}

// 选择照片
const selectPhoto = (photo) => {
  const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`

  if (selectedPhotos.value.has(photoKey)) {
    // 如果已选中，则取消选择
    selectedPhotos.value = new Set([...selectedPhotos.value].filter((key) => key !== photoKey))
  } else {
    // 否则添加到选择中
    selectedPhotos.value = new Set([...selectedPhotos.value, photoKey])
  }
}

// 预览照片
const previewPhoto = (photo, index) => {
  // 使用所有已加载的照片进行预览
  previewImages.value = photoList.value.map((p) => p.url)

  // 计算当前照片在所有照片中的位置
  const globalIndex = photoList.value.findIndex(
    (p) =>
      (p.lloc || `${p.id}_${p.name}_${p.modifytime}`) ===
      (photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )

  previewIndex.value = globalIndex >= 0 ? globalIndex : index
  previewVisible.value = true
}

// 关闭视频预览
const closeVideoPreview = () => {
  isVideoPreview.value = false
  currentVideoInfo.value = null
  videoPreviewVisible.value = false
}

// 处理视频加载错误
const handleVideoError = (event) => {
  const error = event.target.error
  console.error('视频加载失败:', error)

  // 获取当前尝试播放的URL
  const currentSrc = event.target.src

  if (currentVideoInfo.value) {
    // 如果当前使用的是 download_url，尝试回退到 play_url
    if (
      currentSrc === currentVideoInfo.value.video_download_url &&
      currentVideoInfo.value.video_play_url
    ) {
      console.log('MP4格式播放失败，尝试回退到HLS格式')
      event.target.src = currentVideoInfo.value.video_play_url
      return
    }
  }

  // 根据错误类型给出不同的提示
  let errorMessage = '视频加载失败'
  switch (error?.code) {
    case 1: // MEDIA_ERR_ABORTED
      errorMessage = '视频播放被中止'
      break
    case 2: // MEDIA_ERR_NETWORK
      errorMessage = '网络错误，无法加载视频'
      break
    case 3: // MEDIA_ERR_DECODE
      errorMessage = '视频解码失败'
      break
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      errorMessage = '不支持的视频格式或源不可用'
      break
    default:
      errorMessage = `视频播放失败 (错误代码: ${error?.code || '未知'})`
  }

  ElMessage.error(errorMessage)
  console.error('视频播放详细错误:', {
    code: error?.code,
    message: error?.message,
    currentSrc,
    videoInfo: {
      download_url: currentVideoInfo.value?.video_download_url,
      play_url: currentVideoInfo.value?.video_play_url
    }
  })
}

// 处理视频加载开始
const handleVideoLoadStart = () => {
  // 可以在这里显示加载提示
}

// 处理视频加载完成
const handleVideoLoaded = () => {
  // 可以在这里隐藏加载提示
}

// 获取视频播放URL
const getVideoPlayUrl = (videoInfo) => {
  if (!videoInfo) return null

  // 优先使用 mp4 格式的 download_url，因为浏览器原生支持
  if (videoInfo.video_download_url) {
    return videoInfo.video_download_url
  }

  // 如果没有 download_url，尝试使用 play_url（可能需要 HLS.js 支持）
  if (videoInfo.video_play_url) {
    return videoInfo.video_play_url
  }

  return null
}

// 获取视频播放源类型
const getVideoPlaySource = (videoInfo) => {
  if (!videoInfo) return '未知'

  const playUrl = getVideoPlayUrl(videoInfo)
  if (!playUrl) return '无可用源'

  if (videoInfo.video_download_url && playUrl === videoInfo.video_download_url) {
    return 'MP4'
  }

  if (videoInfo.video_play_url && playUrl === videoInfo.video_play_url) {
    return 'HLS'
  }

  return '未知格式'
}

// 检查视频信息是否有有效数据
const hasVideoInfo = (videoInfo) => {
  if (!videoInfo) return false

  return (
    videoInfo.video_size > 0 ||
    videoInfo.video_duration > 0 ||
    videoInfo.video_format ||
    getVideoPlayUrl(videoInfo)
  )
}

// 获取视频标题，处理过长的标题
const getVideoTitle = (videoInfo) => {
  if (!videoInfo || !videoInfo.name) return '视频预览'

  const title = videoInfo.name.trim()
  if (title.length > 30) {
    return title.substring(0, 30) + '...'
  }

  return title
}

// 清除选择
const clearSelection = () => {
  selectedPhotos.value = new Set()
}

// 判断某个日期是否全选
const isDateSelected = (group) => {
  return group.photos.every((photo) =>
    selectedPhotos.value.has(photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`)
  )
}

// 切换日期选择状态
const toggleDateSelection = (group) => {
  const isSelected = isDateSelected(group)
  const newSelection = new Set(selectedPhotos.value)

  if (isSelected) {
    // 取消选择该日期下的所有照片
    group.photos.forEach((photo) => {
      const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
      newSelection.delete(photoKey)
    })
  } else {
    // 选择该日期下的所有照片
    group.photos.forEach((photo) => {
      const photoKey = photo.lloc || `${photo.id}_${photo.name}_${photo.modifytime}`
      newSelection.add(photoKey)
    })
  }

  selectedPhotos.value = newSelection
}

// 监听loadMoreTrigger的变化，设置观察器
watch(loadMoreTrigger, (newTrigger) => {
  if (newTrigger) {
    nextTick(() => {
      setupIntersectionObserver()
      // 在设置观察器后，检查是否需要自动加载更多
      checkAndLoadMore()
    })
  }
})

// 监听hasMore变化，重新设置观察器
watch(hasMore, () => {
  nextTick(() => {
    setupIntersectionObserver()
    // 重新检查是否需要自动加载更多
    checkAndLoadMore()
  })
})

// 组件销毁时清理
onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
})
</script>

<style lang="scss" scoped>
.photo-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.photo-container {
  flex: 1;
  overflow: hidden;

  // 为滚动条预留空间
  :deep(.el-scrollbar__wrap) {
    padding-right: 6px;
  }
}

.photo-timeline {
  padding: 20px;
}

.usage-tips {
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 24px;
  text-align: center;

  p {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);

    strong {
      color: #409eff;
    }
  }
}

.date-group {
  margin-bottom: 40px;

  &:last-child {
    margin-bottom: 20px;
  }
}

.date-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-left: 4px solid #409eff;
  padding-left: 16px;

  .date-info {
    display: flex;
    align-items: baseline;
    gap: 12px;

    .date-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      text-shadow:
        0 0 3px rgba(0, 0, 0, 0.9),
        0 0 6px rgba(0, 0, 0, 0.8),
        0 1px 2px rgba(0, 0, 0, 1);
      filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.9));
    }

    .photo-count {
      font-size: 13px;
      color: #ffffff;
      background: rgba(64, 158, 255, 0.9);
      border: 1px solid rgba(64, 158, 255, 1);
      padding: 3px 10px;
      border-radius: 12px;
      text-shadow:
        0 0 2px rgba(0, 0, 0, 0.8),
        0 1px 2px rgba(0, 0, 0, 0.9);
      font-weight: 600;
      backdrop-filter: blur(10px);
    }
  }

  .date-actions {
    transition: all 0.2s ease;

    :deep(.el-button) {
      background: rgba(0, 0, 0, 0.6);
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
      backdrop-filter: blur(10px);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
      font-weight: 600;

      &:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(255, 255, 255, 0.5);
        color: #ffffff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      &.el-button--primary {
        background: rgba(64, 158, 255, 0.9);
        border-color: #409eff;
        color: #ffffff;

        &:hover {
          background: #409eff;
          border-color: #409eff;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
        }
      }
    }
  }
}

.photo-grid {
  display: grid;
  gap: 12px;
  transition: all 0.3s ease;

  // 大尺寸图片
  &.size-large {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  // 中等尺寸图片（默认）
  &.size-medium {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  // 小尺寸图片
  &.size-small {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }

  // 最小尺寸图片
  &.size-mini {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 6px;
  }

  @media (max-width: 768px) {
    &.size-large {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }

    &.size-medium {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }

    &.size-small {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 6px;
    }

    &.size-mini {
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 4px;
    }
  }
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);

    .photo-overlay {
      opacity: 1;
    }

    .selection-checkbox {
      opacity: 1;
      background: rgba(255, 255, 255, 0.9);
    }

    /* 隐私模式下悬停时减少模糊 */
    &.privacy-mode .photo-image :deep(.el-image__inner) {
      filter: blur(8px);
    }

    /* 隐私模式下确保选择控件可见 */
    &.privacy-mode {
      .selection-checkbox {
        opacity: 1;
        background: rgba(255, 255, 255, 0.9);
      }

      &.selected .photo-wrapper::after {
        z-index: 4; // 确保选中边框在隐私遮罩之上
      }
    }
  }

  &.selected {
    .photo-wrapper::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 3px solid #409eff;
      border-radius: 8px;
      pointer-events: none;
      z-index: 4; // 确保选中边框在隐私遮罩之上
    }

    .selection-checkbox {
      background: #409eff;
      border-color: #409eff;
      color: white;
    }
  }
}

.photo-wrapper {
  position: relative;
  width: 100%;
  height: 100%;

  .video-badge {
    color: white;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 999;
  }
}

.photo-image {
  width: 100%;
  height: 100%;

  :deep(.el-image__inner) {
    transition: transform 0.2s ease;
  }

  :deep(.el-image__error),
  :deep(.el-image__placeholder) {
    background: rgba(255, 255, 255, 0.05);
  }
}

.image-error,
.image-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;

  .el-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }
}

.photo-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.7) 0%,
    transparent 30%,
    transparent 70%,
    rgba(0, 0, 0, 0.7) 100%
  );
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 4; // 确保photo-overlay在隐私遮罩之上
}

.photo-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  .photo-time {
    font-size: 12px;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
}

.selection-checkbox {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;
  z-index: 5; // 确保选择复选框在隐私遮罩之上
  opacity: 0.8;

  &:hover {
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
  }

  .selected-icon {
    font-size: 14px;
    color: white;
    font-weight: bold;
  }
}

.loading-more,
.no-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: rgba(255, 255, 255, 0.6);

  .loading-icon {
    font-size: 24px;
    margin-bottom: 8px;
    animation: spin 1s linear infinite;
  }

  span {
    font-size: 14px;
  }
}

.no-more {
  color: rgba(255, 255, 255, 0.4);
}

.floating-toolbar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 12px 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
  transform: translateX(-50%);

  .toolbar-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    .selected-count {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      white-space: nowrap;
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
    }
  }

  @media (max-width: 768px) {
    left: 16px;
    right: 16px;
    transform: none;

    .toolbar-content {
      gap: 12px;
    }
  }
}

/* Vue Transition 动画类 */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.toolbar-enter-from {
  opacity: 0;
  transform: translate(-50%, 100%);
}

.toolbar-leave-to {
  opacity: 0;
  transform: translate(-50%, 100%);
}

/* 移动端的动画 */
@media (max-width: 768px) {
  .toolbar-enter-from {
    opacity: 0;
    transform: translateY(100%);
  }

  .toolbar-leave-to {
    opacity: 0;
    transform: translateY(100%);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.load-more-trigger {
  height: 40px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;

  .trigger-content {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }
}

/* 隐私模式样式 */
.photo-item.privacy-mode {
  .photo-image {
    :deep(.el-image__inner) {
      filter: blur(15px);
      transition: filter 0.3s ease;
    }
  }

  .photo-overlay {
    opacity: 0.5;
  }
}

.privacy-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 3;
  border-radius: 8px;
  backdrop-filter: blur(2px);
  pointer-events: none;

  .privacy-icon {
    font-size: 24px;
    color: #e6a23c;
    margin-bottom: 4px;
    opacity: 0.9;
  }

  .privacy-text {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
    text-align: center;
  }
}

.video-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-player {
  width: 100%;
  height: 50vh;
  border-radius: 4px;
  object-fit: contain;
  background: #000;
}

.video-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.6);

  .loading-icon {
    font-size: 24px;
    margin-bottom: 8px;
    animation: spin 1s linear infinite;
  }

  p {
    font-size: 14px;
    margin-top: 8px;
  }
}

.video-info {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .info-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
    border-radius: 20px;
    border: none;
    color: white;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    .label {
      font-weight: 600;
      color: white;
      font-size: 12px;
    }

    .value {
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
  }

  @media (max-width: 768px) {
    gap: 8px;
    padding: 8px;

    .info-item {
      padding: 3px 6px;
      font-size: 11px;

      .label,
      .value {
        font-size: 11px;
      }
    }
  }
}

/* 视频对话框在移动设备上的优化 */
:deep(.video-preview-dialog) {
  @media (max-width: 768px) {
    --el-dialog-width: 95% !important;
  }

  @media (max-width: 480px) {
    --el-dialog-width: 98% !important;
  }
}

@media (max-width: 768px) {
  .video-preview-container {
    padding: 8px;
  }

  .video-player {
    height: 40vh;
  }
}

/* ===== 相册访问验证弹窗 ===== */
:deep(.album-access-dialog) {
  .el-dialog {
    background: rgba(24, 24, 28, 0.98);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }
}

.access-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 28px 24px;
}

.access-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.15);
  margin-bottom: 16px;
  color: #f87171;
}

.access-icon svg {
  width: 28px;
  height: 28px;
}

.access-title {
  font-size: 17px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin: 0 0 8px;
}

.access-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0 0 20px;
  text-align: center;
  line-height: 1.5;

  strong {
    color: rgba(255, 255, 255, 0.75);
    font-weight: 600;
  }
}

.access-input {
  width: 100%;
  margin-bottom: 6px;

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow: none;
    padding: 4px 12px;
    transition: border-color 0.2s ease;

    &:hover {
      border-color: rgba(248, 113, 113, 0.3);
    }

    &.is-focus {
      border-color: rgba(248, 113, 113, 0.5);
      box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.08);
    }
  }

  :deep(.el-input__inner) {
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;

    &::placeholder {
      color: rgba(255, 255, 255, 0.2);
    }
  }
}

.access-error {
  font-size: 12px;
  color: #f87171;
  margin: 4px 0 0;
  align-self: flex-start;
}

.access-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 20px;

  .access-btn {
    flex: 1;
    border-radius: 10px;
    height: 38px;
    font-size: 14px;
    font-weight: 500;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }
  }

  .confirm-btn {
    background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
    border: none;
    color: #fff;

    &:hover {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
  }
}
</style>
