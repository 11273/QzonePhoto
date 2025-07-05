<template>
  <div class="empty-state" :class="[size, variant]">
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
import Icon from '@renderer/components/Icon/index.vue'

const props = defineProps({
  icon: {
    type: [String, Object],
    default: '📭'
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
  color: rgba(255, 255, 255, 0.6);

  &.small {
    min-height: 120px;
    padding: 20px;
  }

  &.medium {
    min-height: 200px;
    padding: 40px 20px;
  }

  &.large {
    min-height: 300px;
    padding: 60px 20px;
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
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(10px);
  }
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.6;
  filter: grayscale(0.3);
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.empty-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 20px 0;
  line-height: 1.5;
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
      min-height: 160px;
      padding: 30px 16px;
    }

    &.large {
      min-height: 220px;
      padding: 40px 16px;
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
