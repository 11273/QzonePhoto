<template>
  <div
    class="loading-state"
    :class="[size, variant]"
    role="status"
    aria-live="polite"
    aria-busy="true"
    :aria-label="text || '正在加载'"
  >
    <div class="loading-content">
      <div class="loading-spinner" :class="spinnerType" aria-hidden="true">
        <div v-if="spinnerType === 'ring'" class="spinner-ring"></div>
        <div v-else-if="spinnerType === 'dots'" class="spinner-dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <div v-else-if="spinnerType === 'pulse'" class="spinner-pulse"></div>
        <Icon v-else :icon="LoadingIcon" :size="iconSize" class="spinner-icon" />
      </div>

      <p v-if="text" class="loading-text">{{ text }}</p>

      <div v-if="showProgress && progress !== undefined" class="loading-progress">
        <ProgressBar :percentage="progress" size="small" variant="compact" :show-text="false" />
        <span class="progress-text">{{ progress }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import Icon from '@renderer/components/Icon/index.vue'
import ProgressBar from '@renderer/components/ProgressBar/index.vue'

const props = defineProps({
  text: {
    type: String,
    default: '加载中...'
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'minimal', 'overlay'].includes(value)
  },
  spinnerType: {
    type: String,
    default: 'icon',
    validator: (value) => ['icon', 'ring', 'dots', 'pulse'].includes(value)
  },
  progress: {
    type: Number,
    default: undefined
  },
  showProgress: {
    type: Boolean,
    default: false
  }
})

const LoadingIcon = Loading

const iconSize = computed(() => {
  const sizeMap = {
    small: 'medium',
    medium: 'large',
    large: 'xl'
  }
  return sizeMap[props.size]
})
</script>

<style scoped>
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--ds-text-primary);

  &.small {
    min-height: 64px;
    padding: 12px;
  }

  &.medium {
    min-height: 96px;
    padding: 20px;
  }

  &.large {
    min-height: 160px;
    padding: 32px;
  }

  &.minimal {
    min-height: auto;
    padding: 8px;

    .loading-content {
      flex-direction: row;
      gap: 8px;
    }

    .loading-text {
      font-size: 12px;
      margin: 0;
    }
  }

  &.overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--ds-bg-overlay);
    backdrop-filter: blur(4px);
    z-index: var(--theme-z-sticky);
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--theme-brand-border);
  border-radius: 13px;
  color: var(--theme-brand-accent);
  background:
    linear-gradient(145deg, var(--theme-material-highlight), transparent 54%),
    var(--theme-brand-soft);
  box-shadow: inset 0 1px var(--theme-material-highlight);
  transition:
    color var(--theme-duration-base) var(--theme-ease),
    border-color var(--theme-duration-base) var(--theme-ease),
    background-color var(--theme-duration-base) var(--theme-ease);
}

.loading-state.small .loading-spinner {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.loading-state.large .loading-spinner {
  width: 48px;
  height: 48px;
  border-radius: 15px;
}

.loading-state.minimal .loading-spinner {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  box-shadow: none;
}

.spinner-icon {
  animation: spin 1s linear infinite;
}

.spinner-ring {
  width: 24px;
  height: 24px;
  border: 2px solid color-mix(in srgb, currentColor 22%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-dots {
  display: flex;
  gap: 4px;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: dots 1.4s ease-in-out infinite both;

    &:nth-child(1) {
      animation-delay: -0.32s;
    }
    &:nth-child(2) {
      animation-delay: -0.16s;
    }
    &:nth-child(3) {
      animation-delay: 0s;
    }
  }
}

.spinner-pulse {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.5s ease-in-out infinite;
}

.loading-text {
  font-size: 14px;
  color: var(--theme-text-secondary);
  margin: 0;
  text-align: center;
  line-height: 1.4;
}

.loading-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 120px;
}

.progress-text {
  font-size: 12px;
  color: var(--theme-text-muted);
}

/* 动画定义 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes dots {
  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner-icon,
  .spinner-ring,
  .spinner-dots .dot,
  .spinner-pulse {
    animation: none;
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-state {
    &.medium {
      min-height: 100px;
      padding: 20px;
    }

    &.large {
      min-height: 160px;
      padding: 32px;
    }
  }

  .loading-text {
    font-size: 13px;
  }
}
</style>
