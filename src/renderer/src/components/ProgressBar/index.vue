<template>
  <div
    class="progress-container"
    :class="[size, variant]"
    role="progressbar"
    :aria-label="customText || '任务进度'"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="safePercentage"
  >
    <div v-if="showText && textPosition === 'top'" class="progress-text top">
      {{ progressText }}
    </div>

    <div class="progress-bar" :style="{ height: barHeight }">
      <div
        class="progress-fill"
        :style="{
          width: safePercentage + '%',
          background: gradient || color
        }"
      ></div>
    </div>

    <div v-if="showText && textPosition === 'bottom'" class="progress-text bottom">
      {{ progressText }}
    </div>

    <div v-if="showDetails" class="progress-details">
      <span>{{ safePercentage }}%</span>
      <span v-if="transferred && total"
        >{{ formatBytes(transferred) }} / {{ formatBytes(total) }}</span
      >
      <span v-if="speed">{{ formatBytes(speed) }}/s</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatBytes } from '@renderer/utils/formatters'

const props = defineProps({
  percentage: {
    type: Number,
    default: 0,
    validator: (value) => value >= 0 && value <= 100
  },
  color: {
    type: String,
    default: 'var(--theme-brand)'
  },
  gradient: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'compact', 'detailed'].includes(value)
  },
  showText: {
    type: Boolean,
    default: true
  },
  textPosition: {
    type: String,
    default: 'bottom',
    validator: (value) => ['top', 'bottom', 'inline'].includes(value)
  },
  showDetails: {
    type: Boolean,
    default: false
  },
  transferred: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  speed: {
    type: Number,
    default: 0
  },
  customText: {
    type: String,
    default: ''
  }
})

const barHeight = computed(() => {
  const heights = {
    small: '3px',
    medium: '4px',
    large: '6px'
  }
  return heights[props.size]
})

const safePercentage = computed(() => Math.min(100, Math.max(0, Number(props.percentage) || 0)))

const progressText = computed(() => {
  if (props.customText) return props.customText

  if (props.transferred && props.total) {
    const transferred = formatBytes(props.transferred)
    const total = formatBytes(props.total)
    const speed = props.speed ? formatBytes(props.speed) : ''
    return speed ? `${transferred} / ${total} (${speed}/s)` : `${transferred} / ${total}`
  }

  return `${safePercentage.value.toFixed(1)}%`
})
</script>

<style scoped>
.progress-container {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.small {
    gap: 2px;
    .progress-text {
      font-size: 10px;
    }
  }

  &.large {
    gap: 6px;
    .progress-text {
      font-size: 12px;
    }
  }

  &.compact {
    gap: 2px;
  }

  &.detailed {
    gap: 6px;
  }
}

.progress-bar {
  width: 100%;
  background: var(--theme-surface-active);
  border-radius: var(--theme-radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--theme-radius-pill);
  transition: width var(--theme-duration-slow) var(--theme-ease);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--theme-border-strong) 50%,
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }
}

.progress-text {
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;

  &.top {
    align-self: flex-start;
  }

  &.bottom {
    align-self: center;
  }
}

.progress-details {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--theme-text-muted);
  margin-top: 2px;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill,
  .progress-fill::after {
    animation: none;
    transition: none;
  }
}
</style>
