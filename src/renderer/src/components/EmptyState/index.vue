<template>
  <div class="empty-state" :class="[size, variant]" :role="semanticRole" :aria-live="ariaLive">
    <div class="empty-content">
      <div v-if="icon" class="empty-icon">
        <Icon :icon="icon" :size="iconSize" />
      </div>

      <h3 v-if="title" class="empty-title">{{ title }}</h3>

      <p v-if="description" class="empty-description">{{ description }}</p>

      <div v-if="$slots.default" class="empty-actions">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Inbox } from '@lucide/vue'
import Icon from '@renderer/components/Icon/index.vue'

const props = defineProps({
  icon: {
    type: [String, Object, Function],
    default: Inbox
  },
  title: {
    type: String,
    default: '暂无数据'
  },
  description: {
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
    validator: (value) => ['default', 'minimal', 'card'].includes(value)
  },
  semanticRole: {
    type: String,
    default: 'status',
    validator: (value) => ['status', 'alert'].includes(value)
  },
  ariaLive: {
    type: String,
    default: 'polite',
    validator: (value) => ['off', 'polite', 'assertive'].includes(value)
  }
})

const iconSize = computed(() => {
  const sizeMap = {
    small: 'large',
    medium: 'xl',
    large: 'xl'
  }
  return sizeMap[props.size]
})
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--ds-text-secondary);

  &.small {
    min-height: 96px;
    padding: 16px;
  }

  &.medium {
    min-height: 136px;
    padding: 24px 20px;
  }

  &.large {
    min-height: 176px;
    padding: 32px 20px;
  }

  &.minimal {
    .empty-content {
      text-align: left;
    }

    .empty-icon {
      display: none;
    }

    .empty-title {
      font-size: 14px;
      margin-bottom: 4px;
    }

    .empty-description {
      font-size: 12px;
    }
  }

  &.card {
    background: var(--theme-surface-soft);
    border: 1px solid var(--theme-border-subtle);
    border-radius: var(--theme-radius-lg);
    backdrop-filter: blur(10px);
  }
}

.empty-content {
  text-align: center;
  max-width: 440px;
}

.empty-icon {
  margin-bottom: 12px;
  color: var(--theme-brand-accent);
  opacity: 0.76;
  filter: grayscale(0.3);
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ds-text-primary);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.empty-description {
  font-size: 13px;
  color: var(--ds-text-tertiary);
  margin: 0 0 16px 0;
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .empty-state {
    &.medium {
      min-height: 128px;
      padding: 24px 16px;
    }

    &.large {
      min-height: 168px;
      padding: 32px 16px;
    }
  }

  .empty-title {
    font-size: 16px;
  }

  .empty-description {
    font-size: 13px;
  }

  .empty-actions {
    flex-direction: column;
    align-items: center;
  }
}
</style>
