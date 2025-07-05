<template>
  <div class="loading-state" :class="[size, variant]">
    <div class="loading-content">
      <div class="loading-spinner" :class="spinnerType">
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
  color: rgba(255, 255, 255, 0.8);

  &.small {
    min-height: 80px;
    padding: 16px;
  }

  &.medium {
    min-height: 120px;
    padding: 24px;
  }

  &.large {
    min-height: 200px;
    padding: 40px;
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
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-icon {
  animation: spin 1s linear infinite;
}

.spinner-ring {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top: 3px solid currentColor;
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
  color: rgba(255, 255, 255, 0.7);
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
  color: rgba(255, 255, 255, 0.6);
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
