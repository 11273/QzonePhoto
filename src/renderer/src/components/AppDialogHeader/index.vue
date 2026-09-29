<template>
  <div class="app-dialog-heading">
    <div class="app-dialog-heading__copy">
      <h2>{{ title }}</h2>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="app-dialog-heading__actions">
      <slot name="actions" />
      <span v-if="$slots.actions" class="app-dialog-heading__divider" aria-hidden="true"></span>
      <AppActionButton
        variant="ghost"
        ui-size="default"
        icon-only
        :aria-label="closeLabel"
        :title="closeLabel"
        @click="$emit('close')"
      >
        <template #icon
          ><el-icon><Close /></el-icon
        ></template>
      </AppActionButton>
    </div>
  </div>
</template>

<script setup>
import { Close } from '@element-plus/icons-vue'
import AppActionButton from '@renderer/components/AppActionButton/index.vue'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  closeLabel: { type: String, default: '关闭' }
})

defineEmits(['close'])
</script>

<style lang="scss" scoped>
.app-dialog-heading {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.app-dialog-heading__copy {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;

  h2,
  p {
    margin: 0;
  }

  h2 {
    color: var(--theme-text-primary);
    font-size: 16px;
    line-height: 1.25;
    font-weight: 650;
  }

  p {
    overflow: hidden;
    color: var(--theme-text-muted);
    font-size: 12px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.app-dialog-heading__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-dialog-heading__divider {
  width: 1px;
  height: 20px;
  margin: 0 2px;
  background: var(--theme-border-subtle);
}

@media (max-width: 760px) {
  .app-dialog-heading__copy p {
    display: none;
  }
}
</style>
