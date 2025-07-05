<template>
  <div class="stat-card" :class="[size, { primary: isPrimary }]">
    <div v-if="icon" class="stat-icon">{{ icon }}</div>
    <div class="stat-content">
      <div class="stat-value" :class="valueType">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: {
    type: String,
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
  }
})
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  min-width: 0;
  transition: all 0.2s ease;

  &.primary {
    .stat-value {
      color: #60a5fa;
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
  font-size: 16px;
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
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.2;

  &.level {
    color: #fbbf24;
    text-shadow: 0 0 3px rgba(251, 191, 36, 0.3);
  }

  &.growth {
    color: #10b981;
    text-shadow: 0 0 3px rgba(16, 185, 129, 0.3);
  }

  &.speed {
    color: #f59e0b;
    text-shadow: 0 0 3px rgba(245, 158, 11, 0.3);
  }

  &.vip {
    color: #8b5cf6;
    text-shadow: 0 0 3px rgba(139, 92, 246, 0.3);
  }
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.2;
  letter-spacing: 0.01em;
}
</style>
