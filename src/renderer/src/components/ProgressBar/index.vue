<template>
  <div class="progress-container" :class="[size, variant]">
    <div v-if="showText && textPosition === 'top'" class="progress-text top">
      {{ progressText }}
    </div>

    <div class="progress-bar" :style="{ height: barHeight }">
      <div
        class="progress-fill"
        :style="{
          width: percentage + '%',
          background: gradient || color
        }"
      ></div>
    </div>

    <div v-if="showText && textPosition === 'bottom'" class="progress-text bottom">
      {{ progressText }}
    </div>

    <div v-if="showDetails" class="progress-details">
      <span>{{ percentage }}%</span>
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
    default: '#409eff'
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

const progressText = computed(() => {
  if (props.customText) return props.customText

  if (props.transferred && props.total) {
    const transferred = formatBytes(props.transferred)
    const total = formatBytes(props.total)
    const speed = props.speed ? formatBytes(props.speed) : ''
    return speed ? `${transferred} / ${total} (${speed}/s)` : `${transferred} / ${total}`
  }

  return `${props.percentage.toFixed(1)}%`
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
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #66b3ff);
  border-radius: 2px;
  transition: width 0.3s ease;
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
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }
}

.progress-text {
  color: rgba(255, 255, 255, 0.8);
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
  color: rgba(255, 255, 255, 0.6);
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
</style>
