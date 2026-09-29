<template>
  <div class="stat-card" :class="[size, { primary: isPrimary, clickable: clickable }]">
    <div v-if="icon" class="stat-icon">
      <Icon :icon="icon" :size="cardIconSize" />
    </div>
    <div class="stat-content">
      <div class="stat-value" :class="valueType">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '@renderer/components/Icon/index.vue'

const props = defineProps({
  icon: {
    type: [String, Object, Function],
    default: ''
  },
  value: {
    type: [String, Number],
    required: true
  },
  label: {
    type: String,
    required: true
  },
  valueType: {
    type: String,
    default: '',
    validator: (value) => ['', 'level', 'growth', 'speed', 'vip'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  clickable: {
    type: Boolean,
    default: false
  }
})

const cardIconSize = computed(() => {
  const sizeMap = {
    small: 'small',
    medium: 'medium',
    large: 'large'
  }
  return sizeMap[props.size]
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  min-width: 0;
  transition: var(--ds-transition-all);

  &.clickable {
    cursor: pointer;
    padding: 8px 12px;
    border-radius: var(--ds-radius-lg);

    &:hover {
      background: var(--ds-bg-3);
    }
  }

  &.primary {
    .stat-value {
      color: var(--theme-brand-accent);
      font-weight: 700;
    }
    .stat-icon {
      transform: scale(1.1);
    }
  }

  &.small {
    gap: 6px;
    padding: 4px 0;

    .stat-icon {
      font-size: 12px;
    }

    .stat-value {
      font-size: 10px;
    }

    .stat-label {
      font-size: 10px;
    }
  }

  &.large {
    gap: 12px;
    padding: 12px 0;

    .stat-icon {
      font-size: 20px;
    }

    .stat-value {
      font-size: 16px;
    }

    .stat-label {
      font-size: 13px;
    }
  }
}

.stat-icon {
  opacity: 0.9;
  flex-shrink: 0;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--ds-text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;

  &.level {
    color: var(--ds-accent-yellow);
    text-shadow: 0 0 3px var(--theme-warning-soft);
  }

  &.growth {
    color: var(--theme-success);
  }

  &.speed {
    color: var(--theme-warning);
  }

  &.vip {
    color: var(--theme-brand-accent);
  }
}

.stat-label {
  font-size: 11px;
  color: var(--ds-text-tertiary);
  line-height: 1.2;
  letter-spacing: 0.01em;
}
</style>
