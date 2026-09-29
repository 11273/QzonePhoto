<script>
import CustomTitleBar from '@renderer/components/CustomTitleBar/index.vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'dayjs/locale/zh-cn'
import { attachSurfaceLight } from '@renderer/utils/surface-light'
import { getThemeClock, THEME_TIME_ZONE } from '@renderer/theme/index.mjs'

export default {
  components: {
    CustomTitleBar,
    ElConfigProvider
  },
  data() {
    return {
      elementLocale: zhCn,
      detachSurfaceLight: null,
      contentScrolled: false,
      showSeasonalEntry: false,
      seasonalEntryTimer: 0
    }
  },
  watch: {
    '$route.fullPath'() {
      this.$nextTick(() => this.maybePlaySeasonalEntry())
    }
  },
  mounted() {
    this.detachSurfaceLight = attachSurfaceLight(document)
    document.addEventListener('scroll', this.handleContentScroll, true)
    this.maybePlaySeasonalEntry()
  },
  beforeUnmount() {
    this.detachSurfaceLight?.()
    document.removeEventListener('scroll', this.handleContentScroll, true)
    window.clearTimeout(this.seasonalEntryTimer)
  },
  methods: {
    handleContentScroll(event) {
      const target = event.target
      const scrollTop =
        target === document ? document.scrollingElement?.scrollTop : target?.scrollTop
      this.contentScrolled = Number(scrollTop || 0) > 4
    },
    maybePlaySeasonalEntry() {
      const root = document.documentElement
      if (this.$route.path === '/login' || root.dataset.themePhase !== 'holiday') return
      const clock = getThemeClock()
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: THEME_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(clock.now)
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
      const month = Number(values.month)
      const day = Number(values.day)
      if (month !== 10 || day < 1 || day > 7) return
      const key = `qzone.theme.entry.national-day.${values.year}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, 'played')
      this.showSeasonalEntry = true
      window.clearTimeout(this.seasonalEntryTimer)
      this.seasonalEntryTimer = window.setTimeout(() => {
        this.showSeasonalEntry = false
      }, 900)
    }
  }
}
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-container" :class="{ 'is-content-scrolled': contentScrolled }">
      <a class="skip-link" href="#main-content">跳到主要内容</a>
      <div v-if="showSeasonalEntry" class="seasonal-entry-glow" aria-hidden="true"></div>
      <!-- 自定义标题栏 -->
      <CustomTitleBar />

      <!-- 主要内容区域 -->
      <main id="main-content" class="main-content" tabindex="-1">
        <RouterView />
      </main>
    </div>
  </el-config-provider>
</template>

<style>
.app-container {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: transparent;
}

.app-container::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-canvas) 4%, transparent),
      transparent 34%
    ),
    var(--theme-background-image) var(--theme-background-position, center) / cover no-repeat,
    var(--theme-canvas);
  opacity: var(--theme-pattern-opacity);
  transition: opacity var(--theme-duration-slow) var(--theme-ease);
}

.app-container .custom-title-bar {
  background: color-mix(in srgb, var(--theme-canvas) 36%, transparent);
  -webkit-backdrop-filter: blur(14px) saturate(122%);
  backdrop-filter: blur(14px) saturate(122%);
}

.app-container .custom-title-bar::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -12px;
  left: 0;
  z-index: -1;
  height: 14px;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--theme-canvas) 34%, transparent),
    transparent
  );
  opacity: 0;
  transition: opacity var(--theme-duration-fast) var(--theme-ease);
}

.app-container.is-content-scrolled .custom-title-bar::after {
  opacity: 1;
}

.seasonal-entry-glow {
  position: fixed;
  inset: 36px 0 auto;
  z-index: var(--theme-z-sticky);
  height: 92px;
  pointer-events: none;
  background:
    radial-gradient(
      circle at 42% 0,
      color-mix(in srgb, var(--theme-brand-accent) 24%, transparent),
      transparent 36%
    ),
    radial-gradient(
      circle at 58% 0,
      color-mix(in srgb, var(--theme-brand) 14%, transparent),
      transparent 42%
    );
  opacity: 0;
  animation: seasonal-entry-glow 860ms var(--theme-ease) both;
}

@keyframes seasonal-entry-glow {
  0% {
    opacity: 0;
    transform: translateY(-8px);
  }
  32% {
    opacity: 0.72;
  }
  100% {
    opacity: 0;
    transform: translateY(4px);
  }
}

.skip-link {
  position: fixed;
  top: 6px;
  left: 50%;
  z-index: var(--theme-z-toast);
  padding: 7px 12px;
  border: 1px solid var(--theme-brand-border);
  border-radius: var(--theme-radius-sm);
  color: var(--theme-text-primary);
  background: var(--theme-surface-overlay);
  box-shadow: var(--theme-shadow-md);
  transform: translate(-50%, -150%);
  transition: transform var(--theme-duration-fast) var(--theme-ease);
}

.skip-link:focus {
  transform: translate(-50%, 0);
}

.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden; /* 防止主容器出现滚动条 */
  display: flex;
  flex-direction: column;
}

@media (prefers-reduced-motion: reduce) {
  .seasonal-entry-glow {
    animation: none;
    display: none;
  }
}

/* 确保内部内容正确处理滚动 */
.main-content > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto; /* 让具体的内容组件自己处理滚动 */
}

/* 调整Element Plus通知位置，避免被标题栏遮挡 */
.el-notification {
  top: 50px !important; /* 标题栏高度34px + 16px间距 */
}

/* 调整Element Plus消息提示位置 */
.el-message {
  top: 50px !important;
}

/* 调整Element Plus确认框位置 */
.el-message-box__wrapper {
  padding-top: 60px;
}
</style>
