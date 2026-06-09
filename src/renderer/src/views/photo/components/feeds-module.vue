<template>
  <div class="feeds-module">
    <!-- 顶部：标题 + 工具 + sub-tab -->
    <header class="fm-top">
      <div class="fm-top-left">
        <h2 class="fm-title">{{ activeSource.label }}</h2>
        <span class="fm-sub">{{ filteredFeeds.length }} 条</span>
      </div>
      <div class="fm-top-right">
        <button
          v-if="totalMediaCount"
          class="fm-tool-btn"
          :disabled="downloadingAll"
          @click="downloadAll"
        >
          <Download :size="14" />
          {{ downloadingAll ? '加入下载…' : `下载全部 ${totalMediaCount}` }}
        </button>
        <button class="fm-tool-btn" :disabled="loading" @click="handleRefresh">
          <Refresh :size="14" />
          刷新
        </button>
      </div>
    </header>

    <!-- 分类切换：好友动态 / 特别关心 / 与我相关 / 那年今日 -->
    <nav class="fm-sources" role="tablist">
      <button
        v-for="src in sources"
        :key="src.key"
        class="fm-source"
        :class="{ active: src.key === activeKey }"
        role="tab"
        :aria-selected="src.key === activeKey"
        @click="switchSource(src.key)"
      >
        <component :is="src.icon" :size="13" class="fm-source-icon" />
        <span class="fm-source-label">{{ src.label }}</span>
        <span
          v-if="badgeCount(src.key) > 0"
          class="fm-source-badge"
        >{{ badgeCount(src.key) > 99 ? '99+' : badgeCount(src.key) }}</span>
      </button>
    </nav>

    <!-- 主体：瀑布流卡片 -->
    <el-scrollbar ref="scrollbarRef" class="fm-scroll" @scroll="handleScroll">
      <div class="fm-wrap">
        <LoadingState v-if="loading && feeds.length === 0" :text="`正在加载${activeSource.label}...`" />

        <EmptyState
          v-else-if="filteredFeeds.length === 0 && !loading"
          :icon="MessageCircle"
          :title="emptyStateTitle"
          :description="emptyStateDesc"
        />

        <template v-else>
          <!-- 瀑布流（column-count），卡片自适应高度，最大化空间利用 -->
          <div class="fm-masonry">
            <article
              v-for="feed in filteredFeeds"
              :key="feed.tid"
              class="fc-card"
            >
              <header class="fc-header">
                <a
                  class="fc-avatar-link"
                  :href="feed.userHome"
                  rel="noopener"
                  @click.prevent="openQzoneProfile(feed.uin, feed.userHome)"
                >
                  <img
                    :src="feed.avatar || avatarUrl(feed.uin)"
                    :alt="feed.name"
                    class="fc-avatar"
                    referrerpolicy="no-referrer"
                    @error="onAvatarError"
                  />
                </a>
                <div class="fc-author">
                  <a
                    class="fc-name"
                    :href="feed.userHome"
                    rel="noopener"
                    @click.prevent="openQzoneProfile(feed.uin, feed.userHome)"
                  >
                    <RichText
                      class="fc-name-rich"
                      :text="feed.name || feed.uin"
                      @mention-click="onCommentAuthorClick"
                    />
                  </a>
                  <div class="fc-author-meta">
                    <span v-if="feed.appType" class="fc-type-chip" :data-type="feed.appType">
                      {{ feed.appType }}
                    </span>
                    <span v-if="feed.yearLabel" class="fc-year-chip">
                      {{ feed.yearLabel }}
                    </span>
                    <span class="fc-time" :title="formatTime(feed.abstime)">
                      {{ feed.feedstime || formatTime(feed.abstime) }}
                    </span>
                  </div>
                </div>
                <div class="fc-card-actions">
                  <button
                    v-if="feed.media.length"
                    class="fc-dl-btn fc-dl-btn-header"
                    :disabled="isFeedDownloading(feed.tid)"
                    :title="`下载这条动态的 ${feed.media.length} 个媒体`"
                    @click="downloadFeed(feed)"
                  >
                    <Download :size="13" />
                    {{ isFeedDownloading(feed.tid) ? '加入中' : feed.media.length }}
                  </button>
                </div>
              </header>

              <div v-if="feed.actionText" class="fc-action">
                <component
                  v-if="feed.actionIcon"
                  :is="feed.actionIcon"
                  :size="13"
                  class="fc-action-icon"
                />
                {{ feed.actionText }}
              </div>

              <div v-if="feed.contentText" class="fc-content fc-content-rich">
                <RichText
                  :text="feed.contentText"
                  @mention-click="onCommentAuthorClick"
                />
              </div>

              <div
                v-else-if="feed.contentHtml"
                class="fc-content"
                @click="onContentClick"
                v-html="feed.contentHtml"
              ></div>

              <div v-if="feed.media.length" class="fc-media" :class="`fc-media-n${Math.min(feed.media.length, 9)}`">
                <div
                  v-for="(media, idx) in feed.media.slice(0, 9)"
                  :key="idx"
                  class="fc-media-item"
                  :class="{ 'is-video': isVideoMedia(media) }"
                  @click="openPreview(feed, idx)"
                >
                  <img
                    v-if="getMediaThumb(feed, media, idx)"
                    :src="getMediaThumb(feed, media, idx)"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    @error="onMediaThumbError(feed, idx, media)"
                  />
                  <div v-else class="fc-thumb-fallback">
                    <el-icon>
                      <VideoPlay v-if="isVideoMedia(media)" />
                      <Picture v-else />
                    </el-icon>
                  </div>
                  <div v-if="isVideoMedia(media)" class="fc-video-overlay" aria-hidden="true">
                    <span class="fc-video-play">
                      <Play :size="18" :stroke-width="2.6" />
                    </span>
                    <span v-if="formatDuration(media.duration)" class="fc-video-duration">
                      {{ formatDuration(media.duration) }}
                    </span>
                  </div>
                  <div v-if="privacyStore.privacyMode" class="fc-privacy qz-privacy-overlay">
                    <el-icon class="qz-privacy-icon"><Hide /></el-icon>
                    <span class="qz-privacy-text">隐私保护</span>
                  </div>
                  <span v-if="idx === 8 && feed.media.length > 9" class="fc-more-overlay">
                    +{{ feed.media.length - 9 }}
                  </span>
                </div>
              </div>

              <!-- 点赞者头像行 -->
              <div v-if="feed.likers?.length" class="fc-likers">
                <ThumbsUp :size="11" class="fc-likers-icon" />
                <div class="fc-likers-avatars">
                  <el-tooltip
                    v-for="liker in feed.likers"
                    :key="liker.uin"
                    :content="liker.name || liker.uin"
                    placement="top"
                  >
                    <a
                      class="fc-liker-avatar"
                      :href="`https://user.qzone.qq.com/${liker.uin}`"
                      rel="noopener"
                      @click.prevent="openQzoneProfile(liker.uin)"
                    >
                      <img :src="avatarUrl(liker.uin)" :alt="liker.name" referrerpolicy="no-referrer" @error="onAvatarError" />
                    </a>
                  </el-tooltip>
                </div>
                <span v-if="feed.likeCount > feed.likers.length" class="fc-likers-rest">
                  等 {{ feed.likeCount }} 人
                </span>
              </div>

              <footer class="fc-footer">
                <div class="fc-stats">
                  <span v-if="feed.likeCount > 0" class="fc-stat" :class="{ liked: feed.isLiked }">
                    <ThumbsUp :size="13" /> {{ feed.likeCount }}
                  </span>
                  <span v-if="feed.cmtCount > 0" class="fc-stat">
                    <MessageCircle :size="13" /> {{ feed.cmtCount }}
                  </span>
                  <span v-if="feed.fwdCount > 0" class="fc-stat">
                    <Repeat2 :size="13" /> {{ feed.fwdCount }}
                  </span>
                  <span v-if="feed.viewCount > 0" class="fc-stat" :title="`${feed.viewCount} 次浏览`">
                    <Eye :size="13" /> {{ formatBigNum(feed.viewCount) }}
                  </span>
                  <span v-if="feed.deviceName" class="fc-stat" :title="`来自 ${feed.deviceName}`">
                    <Smartphone :size="13" /> {{ feed.deviceName }}
                  </span>
                </div>
              </footer>

              <!-- 评论区：默认展示内嵌评论；剩余评论按需展开 -->
              <div v-if="visibleComments(feed).length || canExpandMore(feed)" class="fc-comments-wrap">
                <FeedComment
                  v-if="visibleComments(feed).length"
                  :comments="visibleComments(feed)"
                  @author-click="onCommentAuthorClick"
                  @mention-click="onCommentAuthorClick"
                />
                <button
                  v-if="canExpandMore(feed)"
                  class="fc-cmt-more"
                  :disabled="commentsByTid[feed.tid]?.loading"
                  @click="expandMoreComments(feed)"
                >
                  <el-icon v-if="commentsByTid[feed.tid]?.loading" class="is-loading"><Loading /></el-icon>
                  <ChevronDown v-else :size="13" />
                  {{ commentsByTid[feed.tid]?.loading
                      ? '加载评论…'
                      : `展开剩余 ${remainingCmtCount(feed)} 条评论` }}
                </button>
                <div v-if="commentsByTid[feed.tid]?.error" class="fc-cmt-error">
                  {{ commentsByTid[feed.tid].error }}
                </div>
              </div>
            </article>
          </div>

          <div v-if="loadingMore" class="fm-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            加载更多…
          </div>
          <div v-else-if="!hasMore" class="fm-end">没有更多了</div>
        </template>
      </div>
    </el-scrollbar>

    <MediaPreview
      :visible="previewVisible"
      :items="previewItems"
      :initial-index="previewIndex"
      @update:visible="previewVisible = $event"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, onMounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, Hide, Picture, VideoPlay } from '@element-plus/icons-vue'
import LoadingState from '@renderer/components/LoadingState/index.vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import MediaPreview from '@renderer/components/MediaPreview/index.vue'
import {
  MessageCircle,
  Repeat2,
  ThumbsUp,
  Download,
  Eye,
  Smartphone,
  ChevronDown,
  RefreshCw as Refresh,
  Users,
  Star,
  AtSign,
  History,
  Bookmark,
  Home,
  Play
} from '@lucide/vue'
import FeedComment from '@renderer/components/FeedComment/index.vue'
import RichText from '@renderer/components/RichText/index.vue'
import { useUserStore } from '@renderer/store/user.store'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { createPaginationGuard } from '@renderer/utils/paginationGuard'

const userStore = useUserStore()
const privacyStore = usePrivacyStore()
const leftRef = inject('leftRef', ref(null))
const hostUinOverride = inject('hostUinOverride', null)
const normalizeQzoneUin = (uin) => String(uin || '').replace(/^o/, '')
const isFriendContext = computed(() => !!hostUinOverride?.value)
const selfUin = computed(() => normalizeQzoneUin(userStore.userInfo?.uin || userStore.Uin))
const activeHostUin = computed(() => normalizeQzoneUin(hostUinOverride?.value || selfUin.value))

const PAGE_SIZE = 10
const LAST_YEAR_MIN = 2010

// ============= 数据源配置 =============
//   key:     内部标识
//   label:   tab 文字 & 标题
//   icon:    lucide 图标
//   countKey: 对应 cgi_get_feeds_count 的字段（用于角标）
//   loader:  调用哪个 API，传入 (pager, reset) 返回 { code, hasMore, pager, feeds, emptyHint }
const sources = computed(() => [
  {
    key: 'home',
    label: isFriendContext.value ? '好友主页' : '我的主页',
    icon: Home,
    countKey: 'myFeeds_new_cnt',
    emptyTitle: isFriendContext.value ? '暂时看不到好友主页动态' : '我的主页还没有动态',
    emptyDesc: isFriendContext.value ? '可能是权限限制，或 TA 最近没有公开说说' : '发表说说后会在这里展示',
    kind: 'html',
    initialPager: () => ({ start: 0, count: PAGE_SIZE }),
    load: (p) =>
      window.QzoneAPI.getHomeFeeds(
        {
          hostUin: activeHostUin.value,
          start: p.start,
          count: PAGE_SIZE
        },
        isFriendContext.value ? { skipAuthCheck: true } : undefined
      )
  },
  {
    key: 'friend',
    label: '好友动态',
    icon: Users,
    countKey: 'friendFeeds_new_cnt',
    emptyTitle: '还没有好友动态',
    emptyDesc: '好友的说说 / 相册 / 日志会在这里展示',
    initialPager: () => ({ pagenum: 1, begintime: 0, externparam: 'undefined', dayspac: 0 }),
    load: (p) =>
      window.QzoneAPI.getFriendFeeds({
        scope: 0,
        pagenum: p.pagenum,
        begintime: p.begintime,
        externparam: p.externparam,
        dayspac: p.dayspac,
        count: PAGE_SIZE
      })
  },
  {
    key: 'special',
    label: '特别关心',
    icon: Star,
    countKey: 'specialCareFeeds_new_cnt',
    emptyTitle: '没有特别关心的动态',
    emptyDesc: '在 QQ 空间网页端把好友加入「特别关心」即可在此查看',
    initialPager: () => ({ pagenum: 1, begintime: 0, externparam: 'undefined', dayspac: 0 }),
    load: (p) =>
      window.QzoneAPI.getFriendFeeds({
        scope: 7,
        pagenum: p.pagenum,
        begintime: p.begintime,
        externparam: p.externparam,
        dayspac: p.dayspac,
        count: PAGE_SIZE
      })
  },
  {
    key: 'aboutMe',
    label: '与我相关',
    icon: AtSign,
    countKey: 'aboutHostFeeds_new_cnt',
    emptyTitle: '近期没有人提到你',
    emptyDesc: '别人评论、点赞、@ 你的动态会在这里聚合',
    initialPager: () => ({ offset: 0 }),
    load: (p) =>
      window.QzoneAPI.getAboutMeFeeds({
        offset: p.offset,
        count: PAGE_SIZE
      })
  },
  {
    key: 'lastYear',
    label: '那年今日',
    icon: History,
    countKey: null,
    emptyTitle: '那年今日还没有内容',
    emptyDesc: '去年的今天，你和朋友们都很安静呢',
    initialPager: () => ({ done: false, year: new Date().getFullYear() - 1, count: PAGE_SIZE, mode: 1 }),
    load: async (p) => {
      let year = p.year || new Date().getFullYear() - 1
      const mode = p.mode || 1
      const count = p.count || PAGE_SIZE
      while (year >= LAST_YEAR_MIN) {
        const res = await window.QzoneAPI.getLastYearFeeds({ year, count, mode })
        if (res?.feeds?.length || year === LAST_YEAR_MIN) {
          return { ...res, pager: { year, count, mode } }
        }
        year -= 1
      }
      return { code: 0, feeds: [], hasMore: false, pager: { year, count, mode } }
    }
  },
  {
    key: 'fav',
    label: '我的收藏',
    icon: Bookmark,
    countKey: null,
    emptyTitle: '收藏夹还是空的',
    emptyDesc: '在 QQ 空间网页端把好玩的说说 / 日志 / 分享加入收藏，会出现在这里',
    // 官方收藏 type：0=全部 1=网页 2=本地图片 3=日志 4=相册/照片 5=说说 6=文字 7=分享
    initialPager: () => ({ start: 0, type: 0 }),
    load: (p) =>
      window.QzoneAPI.getFavList(
        {
          type: p.type ?? 0,
          start: p.start ?? 0,
          num: PAGE_SIZE
        },
        { skipAuthCheck: true }
      )
  }
].filter((source) => {
  if (!isFriendContext.value) return true
  return source.key === 'home'
}))
const activeKey = ref('home')
const activeSource = computed(() => sources.value.find((s) => s.key === activeKey.value) || sources.value[0])
const emptyStateTitle = computed(() =>
  loadError.value ? `${activeSource.value.label}加载失败` : activeSource.value.emptyTitle
)
const emptyStateDesc = computed(() =>
  loadError.value ? loadError.value : activeSource.value.emptyDesc
)

const feeds = ref([])
const pager = ref(activeSource.value.initialPager())
const feedsCounts = reactive({})  // { friendFeeds_new_cnt, specialCareFeeds_new_cnt, ... }
const badgeCount = (key) => {
  const src = sources.value.find((s) => s.key === key)
  if (!src?.countKey) return 0
  return Number(feedsCounts[src.countKey] || 0)
}
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const loadError = ref('')
const loadRetryAfter = ref(0)
const scrollbarRef = ref(null)
const requestSeq = ref(0)
const notifiedLoadErrors = new Set()
const pageGuard = createPaginationGuard({ cooldownMs: 3000, maxFailures: 3 })

const previewVisible = ref(false)
const previewItems = ref([])
const previewIndex = ref(0)

const brokenThumbs = reactive(new Set())
const thumbRetryIndexes = reactive({})
const downloadingAll = ref(false)
const downloadingFeedIds = ref(new Set())
// commentsByTid[tid]: { comments: [], loading: false, expanded: false, error: '' }
//   expanded=false 时只显示 inlineComments（列表 HTML 内嵌的前几条）
//   expanded=true  时显示二次拉到的完整评论列表
const commentsByTid = reactive({})

// ============= 访客 =============
const MOD_NAME = { 0: '空间', 2: '相册', 8: '动态', 10: '日志', 43: '个人档' }

const visitor = reactive({
  loaded: false,
  count: 0, recent: [], blockedCount: 0, maxShow: 0,
  mods: [], totalViews: 0, todayViews: 0, trend: []
})

const fetchVisitor = async () => {
  try {
    const [albumRes, allModsRes] = await Promise.all([
      window.QzoneAPI.getVisitorDetail({ mask: 2, mod: 2 }),
      window.QzoneAPI.getVisitorDetail({ mask: 1, mod: 1 })
    ])
    const album = albumRes?.data
    const all = allModsRes?.data
    if (album) {
      visitor.count = album.count || 0
      visitor.recent = (album.items || []).slice(0, 12).map((it) => ({
        uin: it.uin,
        name: it.name || '',
        img: toHttps(it.img || ''),
        time: it.time || 0,
        haveNewFeeds: !!it.haveNewFeeds,
        isFriend: it.isFriend === 1
      }))
      visitor.trend = Array.isArray(album.calvisitcount) ? album.calvisitcount.slice(-30) : []
      visitor.blockedCount = album.visitor_to_blk_count || 0
      visitor.maxShow = album.max_show_visitor_num || 0
    }
    const mods = (all?.modvisitcount || []).map((m) => ({
      mod: m.mod,
      name: MOD_NAME[m.mod] || `mod${m.mod}`,
      today: m.todaycount || 0,
      total: m.totalcount || 0
    }))
    visitor.mods = mods.sort((a, b) => b.total - a.total)
    const mod0 = mods.find((m) => m.mod === 0)
    visitor.totalViews = mod0?.total || 0
    visitor.todayViews = mod0?.today || 0
    visitor.loaded = true
    pushVisitorStats()
  } catch {
    /* silent */
  }
}

// ============= appid 映射 =============
const APP_TYPE_MAP = {
  311: '说说', 4: '相册', 2: '日志', 202: '分享',
  334: '转发', 537: '视频', 349: '游戏', 35: '日志'
}

const AD_APP_IDS = new Set(['6600'])
const isJunk = (raw) => {
  if (!raw || !raw.html) return true
  if (AD_APP_IDS.has(String(raw.appid))) return true
  if (!raw.uin || raw.uin === '0' || raw.uin === 0) return true
  if (/class="[^"]*f-single-biz/.test(raw.html)) return true
  return false
}

// ============= normalize =============
const HTTP_RE = /^http:\/\//
const toHttps = (u) => {
  if (typeof u !== 'string') return ''
  return u
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/\^\|\|\^/g, '_')
    .replace(/^\/\//, 'https://')
    .replace(HTTP_RE, 'https://')
}
const isImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('javascript:')) return false
  if (!/^https?:\/\//i.test(url)) return false
  if (/h5\.qzone\.qq\.com\/page\/photo/i.test(url) || /[?&]init=photo\./i.test(url)) return false
  if (/user\.qzone\.qq\.com/i.test(url)) return false
  if (/qzone_v6\/img\/feed\/loading/.test(url)) return false
  if (/\/ac\/b\.gif(?:[?#]|$)/i.test(url)) return false
  if (/qzonestyle\.gtimg\.cn\/qzone\/em\//.test(url)) return false
  if (/qlogo\d?\.store\.qq\.com/.test(url)) return false
  return /(?:qpic\.cn|photo\.store\.qq\.com|gtimg\.cn)/i.test(url) || /\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(url)
}
const mediaKey = (url) =>
  String(url || '')
    .replace(/[?&](?:width|height|w|h|size|s)=\d+/g, '')
    .replace(/\/(?:\d{2,4}|m|b)(?=\/|\?|$)/g, '')
const qzoneSizeScore = (url) => {
  const text = String(url || '').toLowerCase()
  const sizes = [...text.matchAll(/\/(\d{2,4})(?=\/|\?|#|$)/g)].map((match) => Number(match[1]))
  const size = sizes[sizes.length - 1] || 0
  if (!size) return 0
  if (size >= 2000) return 8
  if (size >= 1600) return 7
  if (size >= 1280) return 6
  if (size >= 1024) return 5
  if (size >= 800) return 4
  if (size >= 640) return 2
  if (size >= 400) return -1
  if (size >= 280) return -2
  if (size >= 200) return -4
  return -6
}
const originScore = (url) => {
  const text = String(url || '').toLowerCase()
  let score = 0
  if (/(?:raw|origin|original|large|big|orignal)/.test(text)) score += 8
  if (/\/0(?:[?#]|$)/.test(text)) score += 5
  if (/\/(?:b|2000|1600)(?:[/?#]|$)/.test(text)) score += 4
  if (/(?:small|thumb|s_|\/m(?:[/?#]|$)|\/100(?:[/?#]|$)|\/200(?:[/?#]|$))/.test(text)) score -= 5
  score += qzoneSizeScore(text)
  return score
}
const toQzoneOriginalUrl = (url) => {
  const safeUrl = toHttps(url)
  if (!safeUrl) return ''
  if (!/\/psc\?\//i.test(safeUrl)) return safeUrl
  // Qzone feeds often expose list thumbnails as `...!/m&...` or `...!/c&...`.
  // The same signed URL accepts `/b` for the original image.
  return safeUrl.replace(/!\/(?:m|c|r)(?=&|$)/i, '!/b')
}
const uniqueImageUrls = (urls = []) => [...new Set(urls.map(toHttps).filter(isImageUrl))]
const pickOrigin = (urls) =>
  uniqueImageUrls(
    urls
      .map(toHttps)
      .filter(isImageUrl)
      .flatMap((url) => [toQzoneOriginalUrl(url), url])
  ).sort((a, b) => originScore(b) - originScore(a))[0] || ''
const collectMediaCandidates = (el) => {
  const urls = []
  const push = (value) => {
    if (!value) return
    String(value)
      .split(/[\s,]+/)
      .forEach((part) => {
        const url = toHttps(part.replace(/^url\(["']?/, '').replace(/["']?\)$/, ''))
        if (isImageUrl(url)) urls.push(url)
      })
  }

  const attrs = [
    'src',
    'data-src',
    'data-original',
    'data-origin',
    'data-originurl',
    'data-url',
    'data-picurl',
    'data-pic',
    'data-pickey',
    'data-bigurl',
    'data-raw',
    'data-lazyload',
    'data-ks-lazyload',
    'origin',
    'rel',
    'href'
  ]
  attrs.forEach((name) => push(el.getAttribute?.(name)))
  push(el.getAttribute?.('style')?.match(/url\(([^)]+)\)/)?.[1])
  return urls
}
const normalizeMediaList = (items) => {
  const map = new Map()
  items.forEach((item, index) => {
    const itemUrls = Array.isArray(item.urls) ? item.urls : [item.urls]
    const sourceUrls = uniqueImageUrls([
      item.thumb,
      item.pre,
      item.origin,
      item.url,
      item.raw,
      ...itemUrls
    ])
    const origin = pickOrigin(sourceUrls)
    const fallbackUrls = uniqueImageUrls([item.thumb, item.pre, ...sourceUrls, origin])
    const finalThumb = fallbackUrls[0] || origin
    if (!finalThumb && !origin) return
    const key = mediaKey(origin || finalThumb) || `${origin || finalThumb}-${index}`
    const previous = map.get(key)
    const next = {
      id: item.id || key,
      name: item.name || `photo_${index + 1}`,
      thumb: finalThumb,
      origin: origin || finalThumb,
      url: origin || finalThumb,
      pre: finalThumb,
      raw: origin || finalThumb,
      urls: fallbackUrls,
      type: 'image',
      is_video: false,
      modifytime: item.modifytime || 0
    }
    if (!previous || originScore(next.origin) > originScore(previous.origin)) map.set(key, next)
  })
  return [...map.values()]
}
const collectHtmlMedia = (doc) => {
  const summary = doc.querySelector('.qz_summary') || doc
  const mediaRoot = summary.querySelector('.f-ct') || summary
  const media = []

  mediaRoot.querySelectorAll('a.img-item').forEach((anchor, index) => {
    const videoUrl =
      toHttps(anchor.getAttribute('data-v_vidioswfurl')) ||
      toHttps(anchor.getAttribute('data-v_vidiourl')) ||
      toHttps(anchor.closest('.f-video-wrap')?.getAttribute('url3')) ||
      toHttps(anchor.querySelector('video')?.getAttribute('src'))
    const img = anchor.querySelector('img')
    const cover = toHttps(anchor.getAttribute('data-v_picinfo_url')) || toHttps(img?.getAttribute('src'))

    if (videoUrl) {
      media.push({
        id: anchor.getAttribute('data-v_itemid') || anchor.getAttribute('data-param') || `video_${index + 1}`,
        name: `video_${index + 1}`,
        type: 'video',
        thumb: cover,
        origin: videoUrl,
        url: videoUrl,
        pre: cover,
        raw: videoUrl,
        is_video: true,
        modifytime: 0
      })
      return
    }

    const pickey = anchor.getAttribute('data-pickey') || ''
    const pickeyParts = pickey.split(',').map(toHttps).filter(Boolean)
    const originUrlParts = (anchor.getAttribute('data-originurl') || '')
      .split('|')
      .map(toHttps)
      .filter(Boolean)
    const urls = [
      ...pickeyParts.slice(1),
      ...originUrlParts,
      ...collectMediaCandidates(anchor),
      toHttps(img?.getAttribute('src'))
    ].filter(isImageUrl)

    if (urls.length) {
      media.push(
        ...normalizeMediaList([
          {
            id: pickeyParts[0] || anchor.getAttribute('data-param') || `photo_${index + 1}`,
            name: `photo_${index + 1}`,
            thumb: toHttps(img?.getAttribute('src')) || urls[0],
            origin: pickOrigin(urls),
            urls
          }
        ])
      )
    }
  })

  if (media.length) return media

  const fallbackItems = []
  mediaRoot.querySelectorAll('.pic-content img, .f-ct img').forEach((img) => {
    if (img.classList?.contains('user-avatar') || img.classList?.contains('feedemoji') || img.classList?.contains('load_img')) return
    const url = toHttps(img.getAttribute('src'))
    if (isImageUrl(url)) fallbackItems.push({ urls: [url], thumb: url })
  })
  return normalizeMediaList(fallbackItems)
}
const parser = new DOMParser()

const normalizePlainText = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+\n/g, '\n')
    .replace(/\n[ \t\f\v]+/g, '\n')
    .replace(/[ \t\f\v]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const TEXT_BLOCK_TAGS = new Set([
  'address',
  'article',
  'blockquote',
  'div',
  'li',
  'p',
  'section',
  'ul',
  'ol'
])

const getEmojiCodeFromImg = (img) => {
  const src = img?.getAttribute?.('src') || ''
  return src.match(/\/(e\d+)\.gif(?:[?#]|$)/i)?.[1] || ''
}

const getMentionTokenFromAnchor = (anchor) => {
  const text = normalizePlainText(anchor?.textContent || '')
  if (!text.startsWith('@')) return ''

  const href = anchor?.getAttribute?.('href') || ''
  const dataUin = anchor?.dataset?.uin || anchor?.getAttribute?.('uin') || ''
  const hrefUin =
    href.match(/user\.qzone\.qq\.com\/(?:u\/)?(\d+)/)?.[1] ||
    href.match(/[?&#]uin=(\d+)/)?.[1] ||
    href.match(/[?&#]hostUin=(\d+)/)?.[1] ||
    ''
  const uin = normalizeQzoneUin(dataUin || hrefUin)
  if (!uin) return ''

  const nick = text
    .replace(/^@+/, '')
    .replace(/[{},]/g, '')
    .trim() || uin

  return `@{uin:${uin},nick:${nick},who:1}`
}

const htmlToPlainText = (node) => {
  if (!node) return ''
  let text = ''

  const appendText = (value) => {
    const normalized = String(value || '').replace(/\s+/g, ' ')
    if (!normalized.trim()) return
    text += normalized
  }

  const appendLineBreak = () => {
    text = text.replace(/[ \t\f\v]+$/g, '')
    if (text && !text.endsWith('\n')) text += '\n'
  }

  const walk = (current) => {
    if (!current) return
    if (current.nodeType === Node.TEXT_NODE) {
      appendText(current.nodeValue)
      return
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return

    const tag = current.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style') return
    if (tag === 'br') {
      appendLineBreak()
      return
    }
    if (tag === 'img') {
      const code = getEmojiCodeFromImg(current)
      appendText(code ? `[em]${code}[/em]` : current.getAttribute('alt') || '')
      return
    }
    if (tag === 'a') {
      const mentionToken = getMentionTokenFromAnchor(current)
      if (mentionToken) {
        appendText(mentionToken)
        return
      }
    }

    const isBlock = TEXT_BLOCK_TAGS.has(tag)
    if (isBlock) appendLineBreak()
    current.childNodes.forEach(walk)
    if (isBlock) appendLineBreak()
  }

  walk(node)
  return normalizePlainText(text)
}

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const ABOUT_ACTION_RULES = [
  { verb: '访问了', icon: Eye, targets: ['主页', '空间', '个人档'] },
  { verb: '赞了', icon: ThumbsUp, targets: ['说说', '照片', '相册', '日志', '分享', '视频', '动态'] },
  { verb: '评论了', icon: MessageCircle, targets: ['说说', '照片', '相册', '日志', '分享', '视频', '动态'] },
  { verb: '回复了', icon: MessageCircle, targets: ['评论', '说说', '照片', '相册', '日志', '分享', '视频', '动态'] },
  { verb: '留言了', icon: MessageCircle, targets: ['留言板', '主页', '空间'] },
  { verb: '转发了', icon: Repeat2, targets: ['说说', '照片', '相册', '日志', '分享', '视频', '动态'] },
  { verb: '收藏了', icon: Bookmark, targets: ['说说', '照片', '相册', '日志', '分享', '视频', '动态'] },
  { verb: '提到了', icon: AtSign, targets: ['说说', '照片', '相册', '日志', '分享', '视频', '动态'] },
  { verb: '@了', icon: AtSign, targets: ['说说', '照片', '相册', '日志', '分享', '视频', '动态'] }
]

const extractAboutMeAction = (doc, raw) => {
  const verbs = ABOUT_ACTION_RULES.map((rule) => escapeRegExp(rule.verb)).join('|')
  const targets = [...new Set(ABOUT_ACTION_RULES.flatMap((rule) => rule.targets))]
    .map(escapeRegExp)
    .join('|')
  const actionPattern = new RegExp(`(?:${verbs}).{0,28}(?:${targets})`)
  const normalizeAction = (value) =>
    normalizePlainText(value)
      .replace(/\s+/g, ' ')
      .replace(/你的/g, '我的')
      .replace(new RegExp(`^${escapeRegExp(raw?.nickname || '')}\\s*`), '')
      .trim()

  const candidates = [
    ...doc.querySelectorAll('.feed-info, .qz_feed_plugin, .state, .f-aside, .f-nick, .f-detail')
  ]
    .map((el) => normalizeAction(el.textContent || ''))
    .filter(Boolean)

  candidates.push(normalizeAction(raw?.feedstime || ''))
  candidates.push(normalizeAction(doc.body?.textContent || ''))

  for (const text of candidates) {
    const match = text.match(actionPattern)
    if (match) {
      const actionText = normalizeAction(match[0])
      const rule = ABOUT_ACTION_RULES.find((item) => actionText.includes(item.verb))
      const target = rule?.targets.find((item) => actionText.includes(item)) || ''
      return {
        text: actionText,
        verb: rule?.verb || '',
        target,
        icon: rule?.icon || AtSign
      }
    }
  }
  return null
}

const normalize = (raw) => {
  const doc = parser.parseFromString(raw.html || '', 'text/html')
  const userLink = doc.querySelector('a[href*="user.qzone.qq.com/"]')
  const parsedUin = (userLink?.getAttribute('href') || '').match(/user\.qzone\.qq\.com\/(\d+)/)?.[1] || ''
  const parsedAvatar = userLink?.querySelector('img')?.getAttribute('src') || ''

  const contentNode = doc.querySelector('.qz_info_cut, .f-info')?.cloneNode(true)
  if (contentNode) {
    contentNode.querySelectorAll('a[data-cmd="qz_toggle"], img.load_img').forEach((el) => el.remove())
    contentNode.querySelectorAll('img').forEach((img) => {
      const orig = img.getAttribute('src') || ''
      if (!orig || orig.startsWith('/') || orig.startsWith('data:')) {
        img.remove()
        return
      }
      img.src = toHttps(orig)
      img.setAttribute('referrerpolicy', 'no-referrer')
    })
    contentNode.querySelectorAll('a').forEach((a) => {
      const h = a.getAttribute('href')
      if (h && h !== 'javascript:;') {
        a.setAttribute('target', '_blank')
        a.setAttribute('rel', 'noopener')
      }
    })
  }

  const media = collectHtmlMedia(doc)

  const likeBtn = doc.querySelector('.qz_like_btn_v3')
  const likeCount = parseInt(likeBtn?.dataset?.likecnt || '0', 10) || 0
  const isLiked = likeBtn?.dataset?.islike === '1'
  const likers = [...doc.querySelectorAll('.f-like-list .user-list a')]
    .slice(0, 8)
    .map((a) => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/user\.qzone\.qq\.com\/(\d+)/)
      return { uin: m ? m[1] : '', name: a.textContent?.trim() || '' }
    })
    .filter((l) => l.uin)

  let viewCount = 0
  doc.querySelectorAll('.state, .qz_feed_plugin').forEach((el) => {
    const m = (el.textContent || '').match(/浏览\s*(\d+)\s*次/)
    if (m) viewCount = Math.max(viewCount, parseInt(m[1], 10))
  })
  const deviceName = normalizePlainText(doc.querySelector('.phone-style')?.textContent || '')

  const replyBtn = doc.querySelector('.qz_btn_reply em')
  const retweetBtn = doc.querySelector('.qz_retweet_btn em')
  const cmtCount = parseInt(replyBtn?.textContent || '0', 10) || parseInt(raw.commentcnt || '0', 10) || 0
  const fwdCount = parseInt(retweetBtn?.textContent || '0', 10) || parseInt(raw.relycnt || '0', 10) || 0

  const appid = Number(raw.appid) || 0
  const typeid = Number(raw.typeid) || 0

  const feedMeta = doc.querySelector('i[name="feed_data"]')
  const topicId = feedMeta?.getAttribute('data-topicid') || ''

  // 非说说（appid != 311）的评论 li 通常已经在 feeds3 html 里，提前解出来
  const inlineComments = parseCommentsHtml(raw.html || '')

  const appType = media.some((item) => item.type === 'video' || item.is_video)
    ? '视频'
    : APP_TYPE_MAP[appid] || ''
  const plainContent = htmlToPlainText(contentNode)
  const richText = /@\{uin:|\[em\]e\d+\[\/em\]/.test(plainContent) ? plainContent : ''
  const actionMeta = activeSource.value?.key === 'aboutMe' ? extractAboutMeAction(doc, raw) : null
  const feedYear = Number(raw.abstime) ? new Date(Number(raw.abstime) * 1000).getFullYear() : 0

  return {
    tid: raw.key || `${raw.uin}-${raw.abstime}`,
    topicId,
    inlineComments,
    uin: String(raw.uin || parsedUin || ''),
    name: raw.nickname || userLink?.textContent?.trim() || '',
    avatar: toHttps(raw.logimg || parsedAvatar || ''),
    userHome: raw.userHome || `https://user.qzone.qq.com/${raw.uin || parsedUin || ''}`,
    abstime: Number(raw.abstime) || 0,
    feedstime: raw.feedstime || '',
    appid,
    typeid,
    appType,
    yearLabel: activeSource.value?.key === 'lastYear' && feedYear ? `${feedYear} 的今天` : '',
    actionText: actionMeta?.text || '',
    actionVerb: actionMeta?.verb || '',
    actionTarget: actionMeta?.target || '',
    actionIcon: actionMeta?.icon || null,
    contentText: richText,
    contentHtml: richText ? '' : contentNode?.innerHTML?.trim() || '',
    media,
    images: media.map((item) => item.origin || item.thumb),
    likeCount,
    isLiked,
    likers,
    viewCount,
    deviceName,
    cmtCount,
    fwdCount
  }
}

// 收藏列表 normalize：fav_list 返回的字段跟 feed 不一样，直接读 JSON
//  - 收藏没有点赞 / 评论 / 转发等互动数（仅是用户的私人收藏）
//  - shuoshuo_info / share_info / blog_info / 等子对象拿原作者
const FAV_TYPE_LABEL = { 0: '收藏', 1: '网页', 2: '照片', 3: '日志', 4: '照片', 5: '说说', 6: '文字', 7: '分享' }
const firstStringField = (item, fields) =>
  fields.map((field) => item?.[field]).find((value) => typeof value === 'string' && value.trim()) || ''

const objectImageStrings = (item) =>
  Object.values(item || {})
    .filter((value) => typeof value === 'string')
    .map(toHttps)
    .filter(isImageUrl)

const ORIGIN_IMAGE_FIELDS = [
  'picrawurl', 'rawurl', 'raw_url', 'originurl', 'origin_url', 'origin',
  'picoriginurl', 'picOriginUrl', 'url4', 'url3', 'picbigurl', 'bigurl',
  'big_url', 'largeurl', 'large_url', 'hdurl', 'hd_url', 'raw'
]
const THUMB_IMAGE_FIELDS = [
  'smallurl', 'small_url', 'thumb', 'thumburl', 'thumb_url', 'picsmall',
  'url1', 'url2', 'url', 'pre', 'preview'
]
const mediaFromUnknownList = (list = [], time = 0) => {
  const values = Array.isArray(list) ? list : Object.values(list || {})
  return normalizeMediaList(
    values
      .map((item, index) => {
        if (typeof item === 'string') return { urls: [item], thumb: item, modifytime: time }
        if (!item || typeof item !== 'object') return null
        const origin = firstStringField(item, ORIGIN_IMAGE_FIELDS)
        const thumb = firstStringField(item, THUMB_IMAGE_FIELDS)
        const urls = [...new Set([origin, thumb, ...objectImageStrings(item)].map(toHttps).filter(isImageUrl))]
        return {
          id: item.pic_id || item.lloc || item.id || item.key || '',
          name: item.name || item.desc || `photo_${index + 1}`,
          thumb: thumb || urls[0] || '',
          origin: origin || pickOrigin(urls),
          urls,
          modifytime: time
        }
      })
      .filter(Boolean)
  )
}

const normalizeVideoDurationSeconds = (value, sourceKey = '') => {
  const duration = Number(value) || 0
  if (duration <= 0) return 0
  if (/time/i.test(sourceKey) && duration >= 1000) return Math.round(duration / 1000)
  return Math.round(duration)
}

const mediaFromShuoshuoVideos = (list = [], time = 0) => {
  const values = Array.isArray(list) ? list : Object.values(list || {})
  return values
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const url = toHttps(item.url3 || item.video_url || item.videourl || item.url || '')
      if (!url) return null
      const cover = toHttps(item.url1 || item.pic_url || item.cover || item.cover_url || '')
      const id = item.video_id || item.vid || item.lloc || `video_${index + 1}`
      const rawDuration = item.video_time || item.videotime || item.playtime || item.duration || 0
      const durationSource = item.video_time || item.videotime ? 'video_time' : 'duration'
      return {
        id,
        name: item.name || id || `video_${index + 1}`,
        type: 'video',
        thumb: cover,
        origin: url,
        url,
        pre: cover,
        raw: url,
        is_video: true,
        duration: normalizeVideoDurationSeconds(rawDuration, durationSource),
        modifytime: time
      }
    })
    .filter(Boolean)
}

const withQzoneImageSize = (url, size) => {
  const safeUrl = toHttps(url)
  if (!safeUrl || /[?#]/.test(safeUrl)) return safeUrl
  const parts = safeUrl.split('/')
  if (parts.length < 4) return safeUrl
  parts.pop()
  return `${parts.join('/')}/${size}`
}

const isFavoriteCollectorImage = (url) => /shp\.qpic\.cn\/collector\//i.test(String(url || ''))

const mediaFromFavoriteImages = (raw, time = 0) => {
  const favTypeKey = Number(raw?.type) || 0
  const thumbs = Array.isArray(raw?.img_list) ? raw.img_list : []
  const origins = Array.isArray(raw?.origin_img_list) ? raw.origin_img_list : []
  const length = Math.max(thumbs.length, origins.length)
  if (!length) return mediaFromUnknownList(raw?.photo_list || raw?.photo_info?.photos || [], time)

  return normalizeMediaList(
    Array.from({ length }, (_, index) => {
      let thumb = thumbs[index] || origins[index] || ''
      let origin = origins[index] || thumb
      // 官方收藏页 type=2 会把 native photo 的尺寸段改为 /400 和 /800。
      if (favTypeKey === 2 || isFavoriteCollectorImage(thumb) || isFavoriteCollectorImage(origin)) {
        thumb = withQzoneImageSize(thumb, '400')
        origin = withQzoneImageSize(origin, '800')
      }
      return {
        id: `${raw?.id || 'fav'}_${index}`,
        name: `photo_${index + 1}`,
        thumb,
        origin,
        urls: [origin, thumb],
        modifytime: time
      }
    })
  )
}

const normalizeFav = (raw) => {
  const favTypeKey = Number(raw.type) || 0
  const photoInfo = raw.photo_info || raw.album_info || raw.photo_list?.[0] || {}
  const info =
    favTypeKey === 5 ? raw.shuoshuo_info || {} :
    favTypeKey === 7 ? raw.share_info || {} :
    favTypeKey === 3 ? raw.blog_info || {} :
    favTypeKey === 4 ? photoInfo :
    raw.shuoshuo_info || raw.share_info || raw.blog_info || photoInfo || {}
  const ownerUin = info.owner_uin || info.uin || raw.custom_uin || ''
  const ownerName = info.owner_nam || info.owner_name || info.nickname || raw.custom_name || raw.title || ''
  const media = mediaFromFavoriteImages(raw, Number(raw.create_time) || 0)
  const text = normalizePlainText(
    raw.abstract ||
    raw.desp ||
    raw.text ||
    raw.shuoshuo_info?.reason ||
    raw.shuoshuo_info?.detail_shuoshuo_info?.content ||
    raw.share_info?.reason ||
    raw.blog_info?.title ||
    raw.title ||
    ''
  )
  // 给 fav type 一个中文标签，复用 fc-type-chip 视觉
  const appType = FAV_TYPE_LABEL[favTypeKey] || '收藏'
  return {
    tid: raw.id || `fav-${ownerUin}-${raw.create_time}`,
    topicId: '',
    inlineComments: [],
    uin: String(ownerUin),
    name: ownerName,
    avatar: avatarUrl(ownerUin),
    userHome: ownerUin ? `https://user.qzone.qq.com/${ownerUin}` : '',
    abstime: Number(raw.create_time) || 0,
    feedstime: formatTime(raw.create_time),
    appid: 0,
    typeid: favTypeKey,
    appType,
    yearLabel: '',
    actionText: raw.favorite_name ? `${raw.favorite_name}收藏了${appType}` : '',
    actionVerb: raw.favorite_name ? '收藏了' : '',
    actionTarget: appType,
    actionIcon: raw.favorite_name ? Bookmark : null,
    contentText: text,
    contentHtml: '',
    media,
    images: media.map((item) => item.origin || item.thumb),
    likeCount: 0, isLiked: false, likers: [],
    viewCount: 0, deviceName: '', cmtCount: 0, fwdCount: 0,
    isFav: true
  }
}

const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

const getReplyItems = (item) => [
  ...toArray(item?.replylist),
  ...toArray(item?.reply_list),
  ...toArray(item?.list_3),
  ...toArray(item?.children),
  ...toArray(item?.subcomments),
  ...toArray(item?.sub_comment),
  ...toArray(item?.commentlist).filter((reply) => reply !== item)
].filter((reply) => reply && typeof reply === 'object')

const normalizeCommentAuthor = (item) =>
  cleanMentionNick(item?.name || item?.nick || item?.nickname || item?.user?.nickname || item?.userinfo?.nickname || '')

const cleanMentionNick = (nick) =>
  String(nick || '')
    .replace(/\[em\]e\d+\[\/em\]/g, '')
    .trim()

const takeLeadingMention = (text) => {
  const source = String(text || '').trim()
  const match = source.match(/^@\{uin:([\w-]+)(?:,nick:([^,}]*))?(?:,[^}]*)?\}/)
  if (!match) return { text: source, targetUin: '', targetNick: '' }
  return {
    text: source.slice(match[0].length).trim(),
    targetUin: match[1],
    targetNick: cleanMentionNick(match[2]) || match[1]
  }
}

const normalizeShuoshuoReply = (item, parent) => {
  const leading = takeLeadingMention(item.content || item.reply_content || item.text || '')
  return {
    id: item.tid || item.id || item.commentid || item.replyid || `${item.uin || ''}-${item.create_time || ''}-${item.content || ''}`,
    uin: String(item.uin || item.owner_uin || item.user?.uin || ''),
    author: normalizeCommentAuthor(item),
    text: leading.text,
    time: item.create_time ? formatTime(item.create_time) : '',
    deviceName: item.source_name || item.source || '',
    targetUin: String(item.touin || item.targetuin || item.target_uin || leading.targetUin || parent?.uin || ''),
    targetNick: item.toname || item.targetnick || item.target_nick || leading.targetNick || parent?.author || '',
    responses: []
  }
}

const flattenShuoshuoReplies = (items, parent) => {
  const replies = []
  for (const item of items) {
    const reply = normalizeShuoshuoReply(item, parent)
    replies.push(reply)
    replies.push(...flattenShuoshuoReplies(getReplyItems(item), reply))
  }
  return replies
}

const normalizeShuoshuo = (raw) => {
  const uin = String(raw.uin || raw.owner_uin || activeHostUin.value || '')
  const time = Number(raw.created_time || raw.create_time || raw.abstime || 0)
  const media = [
    ...mediaFromUnknownList(raw.pic || raw.pics || raw.piclist || raw.photo || [], time),
    ...mediaFromShuoshuoVideos(raw.video || raw.videos || [], time)
  ]
  const comments = (raw.commentlist || []).map((item) => {
    const comment = {
      id: item.tid || item.id || item.commentid || `${item.uin}-${item.create_time}`,
      uin: String(item.uin || item.owner_uin || ''),
      author: normalizeCommentAuthor(item),
      text: item.content || item.text || '',
      time: item.create_time ? formatTime(item.create_time) : '',
      deviceName: item.source_name || item.source || '',
      responses: []
    }
    comment.responses = flattenShuoshuoReplies(getReplyItems(item), comment)
    return comment
  })
  return {
    tid: raw.tid || raw.id || `${uin}-${time}`,
    topicId: raw.tid ? `${uin}_${raw.tid}__1` : '',
    inlineComments: comments,
    uin,
    name: raw.name || raw.nick || raw.nickname || userStore.userInfo?.nickname || '',
    avatar: avatarUrl(uin),
    userHome: `https://user.qzone.qq.com/${uin}`,
    abstime: time,
    feedstime: formatTime(time),
    appid: 311,
    typeid: Number(raw.typeid) || 0,
    appType: media.some((item) => item.type === 'video' || item.is_video) ? '视频' : '说说',
    yearLabel: '',
    actionText: '',
    actionVerb: '',
    actionTarget: '',
    actionIcon: null,
    contentText: normalizePlainText(raw.content || ''),
    contentHtml: '',
    media,
    images: media.map((item) => item.origin || item.thumb),
    likeCount: Number(raw.praise_num || raw.praisenum || 0),
    isLiked: raw.isliked === 1 || raw.isliked === '1',
    likers: [],
    viewCount: Number(raw.visitorCount || raw['visitorCount '] || 0),
    deviceName: raw.source_name || raw.source || raw.deviceName || '',
    cmtCount: Number(raw.cmtnum || raw.commentnum || comments.length || 0),
    fwdCount: Number(raw.fwdnum || raw.forwardnum || 0)
  }
}
// ============= 时间 / 数字 =============
const pad = (n) => String(n).padStart(2, '0')
const formatTime = (sec) => {
  if (!sec) return ''
  const d = new Date(Number(sec) * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const formatBigNum = (n) => {
  if (!n && n !== 0) return ''
  if (n < 10000) return String(n)
  return (n / 10000).toFixed(n < 100000 ? 1 : 0) + '万'
}
const isVideoMedia = (media) => media?.type === 'video' || media?.is_video
const formatDuration = (seconds) => {
  const totalSeconds = Math.floor(Number(seconds) || 0)
  if (totalSeconds <= 0) return ''
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`
}
const getMediaThumbKey = (feed, media, index) =>
  `${feed?.tid || feed?.abstime || 'feed'}-${media?.id || media?.origin || media?.thumb || index}`
const getMediaThumbCandidates = (media) => {
  const mediaUrls = Array.isArray(media?.urls) ? media.urls : [media?.urls]
  return uniqueImageUrls([media?.thumb, media?.pre, ...mediaUrls, media?.origin, media?.url, media?.raw])
}
const getMediaThumb = (feed, media, index) => {
  const key = getMediaThumbKey(feed, media, index)
  if (brokenThumbs.has(key)) return ''
  const candidates = getMediaThumbCandidates(media)
  return candidates[thumbRetryIndexes[key] || 0] || ''
}
const onMediaThumbError = (feed, index, media) => {
  const key = getMediaThumbKey(feed, media, index)
  const candidates = getMediaThumbCandidates(media)
  const nextIndex = (thumbRetryIndexes[key] || 0) + 1
  if (nextIndex < candidates.length) {
    thumbRetryIndexes[key] = nextIndex
    return
  }
  brokenThumbs.add(key)
}
const avatarUrl = (uin) =>
  uin ? `https://qlogo4.store.qq.com/qzone/${uin}/${uin}/100` : ''
const onAvatarError = (e) => {
  e.target.src = 'https://qzonestyle.gtimg.cn/qzone/em/u120.gif'
}
const uinFromQzoneUrl = (url) => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'user.qzone.qq.com') return ''
    const match = parsed.pathname.match(/^\/([^/?#]+)/)
    return match ? normalizeQzoneUin(match[1]) : ''
  } catch {
    return ''
  }
}
const openQzoneProfile = async (uin, fallbackUrl = '') => {
  const targetUin = normalizeQzoneUin(uin) || uinFromQzoneUrl(fallbackUrl)
  if (!targetUin) return
  try {
    await window.api.invoke('window:openQzoneWeb', {
      uin: userStore.Uin,
      p_skey: userStore.PSkey,
      targetUin
    })
  } catch (error) {
    console.error('打开 QQ 空间失败:', error)
    ElMessage.error('打开 QQ 空间失败')
  }
}

// ============= 统计 =============
// sub-tab 已经是分类切换主入口，二级 appType 过滤已移除
const filteredFeeds = computed(() => feeds.value)
const totalMediaCount = computed(() =>
  filteredFeeds.value.reduce((s, f) => s + (f.media?.length || 0), 0)
)
const sourceBadgeRows = computed(() =>
  sources.value
    .map((source) => ({
      key: source.key,
      label: source.label,
      count: badgeCount(source.key)
    }))
    .filter((source) => source.count > 0)
)
const getFeedKey = (feed) =>
  String(feed?.tid || `${feed?.uin || ''}-${feed?.abstime || ''}-${feed?.contentText || feed?.contentHtml || ''}`)
const appendUniqueFeeds = (nextFeeds) => {
  const seen = new Set(feeds.value.map(getFeedKey))
  const unique = nextFeeds.filter((feed) => {
    const key = getFeedKey(feed)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length) feeds.value.push(...unique)
  return unique.length
}

// 当前 sub-tab 已加载内容的聚合（推到 sidebar 显示）
const pushStats = () => {
  if (!leftRef.value?.updateFeedsStats) return
  let mediaCount = 0, imageCount = 0, videoCount = 0, cmtCount = 0, likeCount = 0, fwdCount = 0, viewCount = 0
  let mediaFeedCount = 0, commentedFeedCount = 0, likedFeedCount = 0, viewedFeedCount = 0, downloadableFeedCount = 0
  const typeCounts = {}
  const actionCounts = {}
  const authorMap = new Map()
  const times = []
  for (const f of feeds.value) {
    const mediaItems = f.media || []
    mediaCount += mediaItems.length
    imageCount += mediaItems.filter((item) => item.type !== 'video' && !item.is_video).length
    videoCount += mediaItems.filter((item) => item.type === 'video' || item.is_video).length
    cmtCount += f.cmtCount || 0
    likeCount += f.likeCount || 0
    fwdCount += f.fwdCount || 0
    viewCount += f.viewCount || 0
    if (mediaItems.length) mediaFeedCount += 1
    if (f.cmtCount > 0) commentedFeedCount += 1
    if (f.likeCount > 0) likedFeedCount += 1
    if (f.viewCount > 0) viewedFeedCount += 1
    if (mediaItems.some((item) => item.origin || item.url || item.thumb)) downloadableFeedCount += 1
    if (f.abstime) times.push(Number(f.abstime))
    const type = f.appType || '动态'
    typeCounts[type] = (typeCounts[type] || 0) + 1
    const action = f.actionVerb || f.actionTarget || ''
    if (action) actionCounts[action] = (actionCounts[action] || 0) + 1
    const authorKey = String(f.uin || f.name || 'unknown')
    const author = authorMap.get(authorKey) || {
      uin: f.uin || '',
      name: f.name || f.uin || '未知',
      avatar: f.avatar || avatarUrl(f.uin),
      count: 0,
      mediaCount: 0,
      likeCount: 0,
      cmtCount: 0
    }
    author.count += 1
    author.mediaCount += mediaItems.length
    author.likeCount += f.likeCount || 0
    author.cmtCount += f.cmtCount || 0
    authorMap.set(authorKey, author)
  }
  leftRef.value.updateFeedsStats({
    loaded: feeds.value.length,
    activeSourceKey: activeSource.value.key,
    activeSourceLabel: activeSource.value.label,
    mediaCount, imageCount, videoCount, cmtCount, likeCount, fwdCount, viewCount,
    mediaFeedCount, commentedFeedCount, likedFeedCount, viewedFeedCount, downloadableFeedCount,
    typeCounts,
    actionCounts,
    topAuthors: [...authorMap.values()]
      .sort((a, b) => b.count - a.count || b.mediaCount - a.mediaCount || b.likeCount - a.likeCount)
      .slice(0, 6),
    uniqueAuthorCount: authorMap.size,
    oldestTime: times.length ? Math.min(...times) : 0,
    latestTime: times.length ? Math.max(...times) : 0,
    sourceBadgeRows: sourceBadgeRows.value,
    ...(isFriendContext.value
      ? {
          totalViews: 0,
          todayViews: 0,
          visitorCount: 0,
          blockedCount: 0,
          mods: [],
          trend: [],
          recentVisitors: []
        }
      : {})
  })
}
watch(() => feeds.value.length, pushStats)
watch(activeKey, pushStats)

// 把访客 + 空间浏览推到 left sidebar（feeds-side 渲染）
const pushVisitorStats = () => {
  if (!leftRef.value?.updateFeedsStats) return
  leftRef.value.updateFeedsStats({
    totalViews: visitor.totalViews,
    todayViews: visitor.todayViews,
    visitorCount: visitor.count,
    blockedCount: visitor.blockedCount,
    mods: visitor.mods,
    trend: visitor.trend,
    recentVisitors: visitor.recent
  })
}

// ============= 评论 =============
const parseCommentsHtml = (html) => {
  if (!html) return []
  const doc = parser.parseFromString(html, 'text/html')
  const items = [...doc.querySelectorAll('li.comments-item')]
  const extractCommentText = (node) => {
    const cloned = node.cloneNode(true)
    cloned.querySelectorAll('a.nickname, .comments-op, .comments-user').forEach((el) => el.remove())
    return htmlToPlainText(cloned).replace(/^[:：\s]+/, '')
  }
  const flat = items.map((li) => {
    const type = li.getAttribute('data-type')
    const tid = li.getAttribute('data-tid')
    const uin = li.getAttribute('data-uin') || ''
    const nick = li.getAttribute('data-nick') || ''
    const targetUin = li.getAttribute('data-targetuin') || ''
    const targetNick = li.getAttribute('data-targetnick') || ''
    const contentEl = li.querySelector('.comments-content') || li
    const text = extractCommentText(contentEl)
    const timeText = li.querySelector('.comments-op .state, .state')?.textContent?.trim() || ''
    return { type, id: tid, uin, author: nick, text, time: timeText, targetUin, targetNick, responses: [] }
  }).filter((comment) => comment.text || comment.author || comment.uin)
  const roots = []
  const byId = new Map()
  const rootById = new Map()
  const findParent = (reply) => {
    if (!reply.id) return roots[roots.length - 1]
    const candidates = [...byId.entries()]
      .filter(([id]) => id && reply.id.startsWith(`${id}_`))
      .sort((a, b) => b[0].length - a[0].length)
    return candidates[0]?.[1] || roots[roots.length - 1]
  }

  for (const c of flat) {
    if (c.type === 'commentroot' || !roots.length) {
      if (!byId.has(c.id)) roots.push(c)
      byId.set(c.id, c)
      rootById.set(c.id, c)
    }
    else if (c.type === 'replyroot') {
      const parent = findParent(c)
      const root = rootById.get(parent?.id) || parent
      if (parent && parent !== root && !c.targetNick) {
        c.targetNick = parent.author
        c.targetUin = parent.uin
      }
      if (root) root.responses.push(c)
      else roots.push(c)
      byId.set(c.id, c)
      rootById.set(c.id, root || c)
    }
  }
  return roots
}

const countCommentTree = (comments = []) =>
  comments.reduce((sum, comment) => sum + 1 + countCommentTree(comment.responses || []), 0)

const flattenCommentIds = (comments = [], seen = new Set()) => {
  comments.forEach((comment) => {
    const key = comment.id || `${comment.uin}-${comment.time}-${comment.text}`
    if (key) seen.add(key)
    flattenCommentIds(comment.responses || [], seen)
  })
  return seen
}

const mergeCommentRoots = (base = [], incoming = []) => {
  const roots = [...base]
  const rootMap = new Map(roots.map((comment) => [comment.id || `${comment.uin}-${comment.time}-${comment.text}`, comment]))
  for (const comment of incoming) {
    const key = comment.id || `${comment.uin}-${comment.time}-${comment.text}`
    const existing = rootMap.get(key)
    if (!existing) {
      roots.push(comment)
      rootMap.set(key, comment)
      continue
    }
    const seenReplies = flattenCommentIds(existing.responses || [])
    for (const reply of comment.responses || []) {
      const replyKey = reply.id || `${reply.uin}-${reply.time}-${reply.text}`
      if (!seenReplies.has(replyKey)) {
        existing.responses = existing.responses || []
        existing.responses.push(reply)
        seenReplies.add(replyKey)
      }
    }
  }
  return roots
}

// 列表 HTML 内嵌的评论已在 normalize 阶段解出（feed.inlineComments）
// 这里只提供：什么时候要展示展开按钮 + 展开后如何拉全部评论
const visibleComments = (feed) => {
  const slot = commentsByTid[feed.tid]
  if (slot?.expanded && slot.comments?.length) return slot.comments
  return feed.inlineComments || []
}

const remainingCmtCount = (feed) => {
  const total = feed.cmtCount || 0
  const shown = countCommentTree(visibleComments(feed))
  return Math.max(0, total - shown)
}

const canExpandMore = (feed) => {
  const slot = commentsByTid[feed.tid]
  if (slot?.expanded) return false        // 已经展开过全部
  return remainingCmtCount(feed) > 0      // 内嵌之外还有评论
}

const expandMoreComments = async (feed) => {
  if (!commentsByTid[feed.tid]) {
    commentsByTid[feed.tid] = reactive({ loading: false, expanded: false, comments: [], error: '' })
  }
  const slot = commentsByTid[feed.tid]
  if (slot.loading || slot.expanded) return
  slot.loading = true
  slot.error = ''
  try {
    // hostUin = feed 作者 uin；topicId = feeds3 返回的 data-topicid（<uin>_<tid>__1）
    // feedsType=8 固定（PC 实测也接受 100，但 8 是 PC 网页默认值）
    const topicId = feed.topicId || `${feed.uin}_${feed.tid}__1`
    const authOption = feed.uin && normalizeQzoneUin(feed.uin) !== selfUin.value
      ? { skipAuthCheck: true }
      : undefined
    const pageSize = Math.max(30, Math.min(100, feed.cmtCount || 50))
    const maxPages = Math.max(1, Math.min(8, Math.ceil((feed.cmtCount || pageSize) / pageSize) + 1))
    let comments = []
    let previousCount = 0

    for (let page = 0; page < maxPages; page += 1) {
      const res = await window.QzoneAPI.getFeedComments({
        topicId,
        hostUin: feed.uin,
        feedsType: 8,
        start: page * pageSize,
        num: pageSize,
        sort: 1
      }, authOption)
      if (res?.code !== 0) {
        if (!comments.length) slot.error = res?.message || '加载评论失败'
        break
      }
      const parsed = parseCommentsHtml(res.feedsHtml)
      comments = mergeCommentRoots(comments, parsed)
      const nextCount = countCommentTree(comments)
      if (!parsed.length || nextCount === previousCount || nextCount >= (feed.cmtCount || nextCount)) break
      previousCount = nextCount
    }

    // 接口返回的 feeds HTML 是整条 feed 的 HTML（含评论 li）；如果意外为空就保留内嵌评论
    slot.comments = comments.length ? comments : (feed.inlineComments || [])
    slot.expanded = true
  } catch (e) {
    slot.error = e.message || String(e)
  } finally {
    slot.loading = false
  }
}

const onCommentAuthorClick = (target) => {
  if (target?.uin) openQzoneProfile(target.uin)
}

// ============= 下载 =============
const isFeedDownloading = (tid) => downloadingFeedIds.value.has(tid)
const setFeedDownloading = (tid, downloading) => {
  const next = new Set(downloadingFeedIds.value)
  if (downloading) next.add(tid)
  else next.delete(tid)
  downloadingFeedIds.value = next
}
const buildFeedDownloadPayload = (feed) => ({
  skey: feed.tid,
  time: feed.abstime,
  desc: (feed.contentText || feed.contentHtml || '').replace(/<[^>]+>/g, '').slice(0, 40),
  albumId: '',
  albumName: `${activeSource.value.label}/${feed.name || feed.uin || '动态'}`,
  sourceKey: feed.isFav ? 'fav' : activeKey.value,
  referer: feed.isFav
    ? `https://user.qzone.qq.com/${selfUin.value}/myhome/favorite`
    : `https://user.qzone.qq.com/${normalizeQzoneUin(feed.uin) || selfUin.value}`,
  photos: feed.media.map((media, index) => ({
    id: media.id || `${feed.tid}_${index}`,
    name: media.name || `${media.type === 'video' ? 'video' : 'photo'}_${index + 1}`,
    url: media.origin || media.url || media.thumb,
    raw: media.origin || media.url || media.thumb,
    pre: media.thumb || media.origin || media.url,
    is_video: media.type === 'video' || media.is_video,
    modifytime: media.modifytime || feed.abstime || 0,
    sourceKey: feed.isFav ? 'fav' : activeKey.value
  }))
})
const addFeedDownloadTasks = async (feedList) => {
  const groups = new Map()
  feedList.forEach((feed) => {
    if (!feed.media?.length) return
    const ownerUin = normalizeQzoneUin(feed.uin)
    const friendUin = ownerUin && ownerUin !== selfUin.value ? ownerUin : ''
    if (!groups.has(friendUin)) groups.set(friendUin, [])
    groups.get(friendUin).push(buildFeedDownloadPayload(feed))
  })

  const taskIds = []
  for (const [friendUin, feedsPayload] of groups.entries()) {
    const ids = await window.QzoneAPI.download.addFeeds({
      feeds: feedsPayload,
      uin: selfUin.value,
      friendUin: friendUin || null
    })
    taskIds.push(...(ids || []))
  }
  return taskIds
}

const downloadAll = async () => {
  if (downloadingAll.value) return
  downloadingAll.value = true
  try {
    const batch = filteredFeeds.value.filter((feed) => feed.media?.length)
    if (!batch.length) {
      ElMessage.warning('当前没有可下载的图片')
      return
    }
    const ids = await addFeedDownloadTasks(batch)
    ElMessage.success(`已添加 ${ids?.length || 0} 个下载任务（${batch.length} 条动态）`)
  } catch (e) {
    console.error('[FeedsModule] 批量下载失败', e)
    ElMessage.error(`批量下载失败：${e.message || e}`)
  } finally {
    downloadingAll.value = false
  }
}

const downloadFeed = async (feed) => {
  if (!feed?.media?.length || isFeedDownloading(feed.tid)) return
  setFeedDownloading(feed.tid, true)
  try {
    const ids = await addFeedDownloadTasks([feed])
    ElMessage.success(`已添加 ${ids?.length || 0} 个下载任务`)
  } catch (e) {
    console.error('[FeedsModule] 下载失败', e)
    ElMessage.error(`下载失败：${e.message || e}`)
  } finally {
    setFeedDownloading(feed.tid, false)
  }
}

// ============= 翻页 / 预览 =============
const resetFeedRuntime = (source) => {
  requestSeq.value += 1
  feeds.value = []
  pager.value = source.initialPager()
  hasMore.value = true
  loadError.value = ''
  loadRetryAfter.value = 0
  notifiedLoadErrors.clear()
  pageGuard.reset()
  loading.value = false
  loadingMore.value = false
  brokenThumbs.clear()
  Object.keys(thumbRetryIndexes).forEach((key) => delete thumbRetryIndexes[key])
  Object.keys(commentsByTid).forEach((key) => delete commentsByTid[key])
  pushStats()
}

const isPermanentLoadError = (message) =>
  /保密|权限|没有权限|无权|主人设置|访问受限|仅主人|登录|请先登录|未登录/.test(String(message || ''))

const notifyLoadErrorOnce = (source, message) => {
  const key = `${source.key}:${activeHostUin.value || ''}:${message}`
  if (notifiedLoadErrors.has(key)) return
  notifiedLoadErrors.add(key)
  ElMessage.error({
    message: `加载${source.label}失败：${message}`,
    grouping: true
  })
}

const handleLoadFailure = (source, message, pageKey = '') => {
  const safeMessage = message || '响应异常'
  loadError.value = safeMessage
  notifyLoadErrorOnce(source, safeMessage)
  if (isPermanentLoadError(safeMessage)) {
    hasMore.value = false
    return false
  }
  if (pageKey) {
    const failure = pageGuard.fail(pageKey)
    if (failure.shouldStop) hasMore.value = false
  }
  loadRetryAfter.value = Date.now() + 3000
  return false
}

const loadPage = async ({ reset = false } = {}) => {
  const source = activeSource.value
  if (reset) {
    resetFeedRuntime(source)
  }
  if (loading.value || loadingMore.value) return
  if (!hasMore.value) return
  if (loadRetryAfter.value && Date.now() < loadRetryAfter.value && feeds.value.length === 0) return false
  const loadId = requestSeq.value
  const loadContext = `${source.key}:${activeHostUin.value || ''}`
  const pageKey = `${loadContext}:${JSON.stringify(pager.value)}`
  if (!pageGuard.canLoad(pageKey)) return false
  const isCurrentLoad = () =>
    loadId === requestSeq.value &&
    loadContext === `${activeSource.value?.key || ''}:${activeHostUin.value || ''}`

  if (feeds.value.length === 0) loading.value = true
  else loadingMore.value = true

  try {
    const res = await source.load(pager.value)
    if (!isCurrentLoad()) return
    const ok = source.kind === 'shuoshuo' ? Array.isArray(res?.msglist) || res?.code === 0 : res?.code === 0
    if (!res || !ok) {
      return handleLoadFailure(source, res?.message || '响应异常', pageKey)
    }
    loadError.value = ''
    loadRetryAfter.value = 0
    pageGuard.succeed()
    if (source.kind === 'shuoshuo') {
      const msgList = Array.isArray(res.msglist) ? res.msglist : []
      const added = appendUniqueFeeds(msgList.map(normalizeShuoshuo))
      pager.value = {
        ...pager.value,
        pos: (pager.value.pos || 0) + msgList.length
      }
      hasMore.value = msgList.length === PAGE_SIZE && added > 0
    } else if (source.key === 'fav') {
      // 收藏：fav_list 结构不同，单独 normalize
      const favList = res.favList || []
      const added = appendUniqueFeeds(favList.map(normalizeFav))
      pager.value = {
        ...pager.value,
        start: (pager.value.start || 0) + favList.length
      }
      hasMore.value = favList.length === PAGE_SIZE && added > 0 && pager.value.start < (res.total || Infinity)
    } else {
      const previousPager = { ...pager.value }
      const rawList = res.feeds || []
      // 「与我相关」/「那年今日」里包含自己，不能像好友动态那样过滤 selfUin
      const currentSelfUin = selfUin.value
      const filterSelf = source.key === 'friend' || source.key === 'special'
      const realFeeds = rawList.filter((f) => {
        if (isJunk(f) && !(source.key === 'lastYear' && f?.html)) return false
        if (filterSelf && normalizeQzoneUin(f?.uin) === currentSelfUin) return false
        return true
      })
      const added = appendUniqueFeeds(realFeeds.map(normalize))
      if (res.pager) pager.value = { ...pager.value, ...res.pager }
      if (source.key === 'lastYear') {
        const currentYear = Number(res.pager?.year || previousPager.year || new Date().getFullYear() - 1)
        pager.value = {
          ...pager.value,
          year: res.hasMore ? currentYear : currentYear - 1,
          count: res.hasMore ? (previousPager.count || PAGE_SIZE) + PAGE_SIZE : PAGE_SIZE
        }
      }
      const pagerMoved =
        source.key !== 'aboutMe' ||
        Number(pager.value.offset || 0) > Number(previousPager.offset || 0)
      hasMore.value = source.key === 'lastYear'
        ? added > 0 && (!!res.hasMore || Number(pager.value.year) >= LAST_YEAR_MIN)
        : !!res.hasMore && rawList.length > 0 && added > 0 && pagerMoved
    }
  } catch (e) {
    if (isCurrentLoad()) {
      console.error('[FeedsModule] 加载失败', e)
      return handleLoadFailure(source, e.message || String(e) || '响应异常', pageKey)
    }
  } finally {
    if (isCurrentLoad()) {
      loading.value = false
      loadingMore.value = false
    }
  }
  return true
}

// 切换分类：清空当前列表 + 重置 pager + 拉新数据
const switchSource = async (key) => {
  if (key === activeKey.value) return
  activeKey.value = key
  await loadPage({ reset: true })
  await ensureScrollable()
}

watch(
  () => activeHostUin.value,
  async () => {
    activeKey.value = 'home'
    await loadPage({ reset: true })
    await ensureScrollable()
  }
)

// 顶部 5 类未读计数（角标）
const fetchFeedsCount = async () => {
  try {
    const res = await window.QzoneAPI.getFeedsCount({})
    if (res?.code === 0) {
      Object.assign(feedsCounts, res.counts || {})
      pushStats()
    }
  } catch {
    /* silent - 角标失败不影响主流 */
  }
}

const ensureScrollable = async (maxExtra = 12, minLoaded = 15) => {
  for (let i = 0; i < maxExtra; i++) {
    await nextTick()
    const el = scrollbarRef.value?.wrapRef
    if (!hasMore.value) return
    if (feeds.value.length >= minLoaded && el && el.scrollHeight - el.clientHeight > 200) return
    const ok = await loadPage()
    if (!ok) return
  }
}

const handleRefresh = async () => {
  await loadPage({ reset: true })
  await ensureScrollable()
  if (!isFriendContext.value) {
    fetchVisitor()
    fetchFeedsCount()
  }
}

const handleScroll = async () => {
  if (loadingMore.value || !hasMore.value) return
  const el = scrollbarRef.value?.wrapRef
  if (!el) return
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
    if (loadRetryAfter.value && Date.now() < loadRetryAfter.value) return
    const ok = await loadPage()
    if (ok) await ensureScrollable()
  }
}

const openPreview = (feed, startIdx) => {
  if (!feed.media?.length) return
  previewItems.value = feed.media.map((media, i) => ({
    type: media.type === 'video' || media.is_video ? 'video' : 'image',
    src: media.origin || media.url || media.thumb,
    thumb: media.thumb || media.origin || media.url,
    fallbackSrcs: getMediaThumbCandidates(media),
    key: `${feed.tid}-${i}`,
    title: feed.name,
    subtitle: feed.feedstime || formatTime(feed.abstime)
  }))
  previewIndex.value = startIdx
  previewVisible.value = true
}

const onContentClick = (e) => {
  const a = e.target?.closest?.('a')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href === 'javascript:;' || href.startsWith('javascript:')) {
    e.preventDefault()
  }
}

onMounted(async () => {
  await loadPage({ reset: true })
  await ensureScrollable()
  if (!isFriendContext.value) {
    fetchVisitor()
    fetchFeedsCount()
  }
})

defineExpose({ refresh: handleRefresh })
</script>

<style lang="scss" scoped>
.feeds-module {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(0, 0, 0, 0.15);
}

/* ========== 顶部精简 ========== */
.fm-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.fm-top-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.fm-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  letter-spacing: 0;
}
.fm-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}
.fm-top-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fm-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  height: 30px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

/* ========== 分类切换（sub-tab） ========== */
.fm-sources {
  display: flex;
  gap: 4px;
  padding: 10px 24px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.fm-source {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px 10px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.18s;

  &:hover:not(:disabled):not(.active) {
    color: rgba(255, 255, 255, 0.85);
  }
  &.active {
    color: #fff;
    border-bottom-color: #60a5fa;
  }
  &:disabled { cursor: not-allowed; opacity: 0.55; }

  .fm-source-icon {
    opacity: 0.85;
  }
}
.fm-source-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  margin-left: 2px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: #ef4444;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.fm-scroll { flex: 1; min-height: 0; }
.fm-wrap {
  padding: 16px 24px 32px;
}

/* ========== 单列流（瀑布流体验不佳，改回单列让卡片更舒展） ========== */
.fm-masonry {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 820px;
  margin: 0 auto;
}

/* ========== Feed Card ========== */
.fc-card {
  display: flex;
  flex-direction: column;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: background 0.18s, border-color 0.18s;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(96, 165, 250, 0.12);
  }
}

.fc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.fc-avatar-link {
  flex-shrink: 0;
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  transition: transform 0.15s;
  &:hover { transform: scale(1.06); }
}
.fc-avatar {
  display: block;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  object-fit: cover;
}
.fc-author {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fc-name {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  &:hover { color: #60a5fa; }
}
.fc-name-rich {
  min-width: 0;
  max-width: 220px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(.rich-text) {
    white-space: nowrap;
  }

  :deep(.emoji-segment) {
    width: 16px;
    height: 16px;
    vertical-align: -0.18em;
  }
}
.fc-author-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}
.fc-type-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 999px;
  color: rgba(96, 165, 250, 0.85);
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.18);

  &[data-type='相册'] { color: #34d399; background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.2); }
  &[data-type='日志'] { color: #f59e0b; background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.22); }
  &[data-type='视频'] { color: #a78bfa; background: rgba(167,139,250,0.08); border-color: rgba(167,139,250,0.22); }
}
.fc-year-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 500;
  border-radius: 999px;
  color: rgba(52, 211, 153, 0.9);
  background: rgba(52, 211, 153, 0.08);
  border: 1px solid rgba(52, 211, 153, 0.18);
}
.fc-time { white-space: nowrap; }
.fc-card-actions {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.fc-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  margin: 0 0 6px;
  padding: 3px 8px;
  color: rgba(96, 165, 250, 0.92);
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.14);
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.4;
}
.fc-action-icon {
  flex-shrink: 0;
}

.fc-content {
  margin: 2px 0 8px;
  font-size: 13.5px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.88);
  word-break: break-word;

  :deep(a) {
    color: #60a5fa;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
    vertical-align: middle;
  }
  :deep(img[src*="qzonestyle.gtimg.cn/qzone/em"]) {
    width: 16px; height: 16px;
    vertical-align: text-bottom;
    margin: 0 1px;
    border-radius: 0;
  }
  :deep(br + br) { display: none; }
}

.fc-content-rich {
  white-space: pre-line;

  :deep(.rich-text) {
    white-space: pre-line;
  }

  :deep(.emoji-segment) {
    width: 1em;
    height: 1em;
    vertical-align: -0.12em;
  }
}

/* ========== 媒体：固定 100px 密集排（朋友圈密度） ========== */
.fc-media {
  display: grid;
  grid-template-columns: repeat(auto-fill, 100px);
  gap: 4px;
  margin: 4px 0 8px;

  .fc-media-item { width: 100px; height: 100px; }

  /* 单图：300px 大图，避免一张图占满 */
  &.fc-media-n1 {
    grid-template-columns: minmax(0, 300px);
    .fc-media-item {
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 11;
    }
  }
}
.fc-media-item {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  cursor: zoom-in;
  transition: transform 0.2s;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
  &:hover img { transform: scale(1.04); }

  &.is-video {
    cursor: pointer;
    background: rgba(0, 0, 0, 0.3);
  }

  &.is-video::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.08) 48%, rgba(0, 0, 0, 0.55) 100%),
      radial-gradient(circle at center, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0) 42%);
    pointer-events: none;
  }

  &.is-video:hover .fc-video-play {
    transform: translate(-50%, -50%) scale(1.08);
    border-color: rgba(255, 255, 255, 0.95);
    background: rgba(0, 0, 0, 0.62);
  }
}
.fc-thumb-fallback {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.18), rgba(59, 130, 246, 0.08));
  color: rgba(255, 255, 255, 0.5);
  font-size: 22px;
}
.fc-video-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.fc-video-play {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.52);
  border: 1.5px solid rgba(255, 255, 255, 0.86);
  border-radius: 50%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(3px);
  transform: translate(-50%, -50%);
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;
}
.fc-video-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  min-width: 28px;
  padding: 1px 6px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.62);
  font-size: 10px;
  line-height: 1.5;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.fc-privacy {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fc-more-overlay {
  position: absolute; inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  pointer-events: none;
}
.fc-card:has(.fc-privacy) .fc-media-item img {
  filter: blur(var(--qz-privacy-media-blur));
}

/* ========== 点赞者头像行 ========== */
.fc-likers {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  margin: 2px 0;
  background: rgba(96, 165, 250, 0.06);
  border-radius: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}
.fc-likers-icon { color: #60a5fa; flex-shrink: 0; }
.fc-likers-avatars { display: flex; align-items: center; }
.fc-liker-avatar {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-left: -3px;
  transition: transform 0.15s, z-index 0s linear 0.15s;
  z-index: 1;
  &:first-child { margin-left: 0; }
  &:hover { transform: translateY(-1px) scale(1.15); z-index: 10; transition-delay: 0s; }
  img {
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 1.5px solid rgba(20, 22, 30, 0.95);
    background: rgba(255, 255, 255, 0.06);
    object-fit: cover;
    display: block;
  }
}
.fc-likers-rest { color: rgba(255, 255, 255, 0.5); }

/* ========== 底部 footer ========== */
.fc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
  min-height: 26px;
}
.fc-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.5);
  flex-wrap: wrap;
}
.fc-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.fc-stat.liked { color: #f59e0b; }
.fc-dl-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(96, 165, 250, 0.9);
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    color: #fff;
    background: rgba(96, 165, 250, 0.18);
    border-color: rgba(96, 165, 250, 0.35);
  }
  &:disabled {
    opacity: 0.55;
    cursor: progress;
  }
}
.fc-dl-btn-header {
  min-width: 42px;
  justify-content: center;
}

/* ========== 评论区（默认展示内嵌评论，按钮展开剩余） ========== */
.fc-comments-wrap {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
}
.fc-cmt-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(96, 165, 250, 0.85);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  &:hover:not(:disabled) {
    color: #93c5fd;
    background: rgba(96, 165, 250, 0.08);
  }
  &:disabled { cursor: progress; opacity: 0.7; }
}
.fc-cmt-error {
  margin-top: 6px;
  padding: 6px 10px;
  font-size: 11.5px;
  color: #f87171;
  background: rgba(248, 113, 113, 0.08);
  border-radius: 6px;
}

/* ========== 加载状态 / 末尾 ========== */
.fm-loading,
.fm-end {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 16px 0 8px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

</style>
