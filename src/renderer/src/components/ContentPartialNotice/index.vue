<template>
  <div
    class="content-partial-notice"
    :role="state?.status === 'error' ? 'alert' : 'status'"
    :aria-live="state?.status === 'error' ? 'assertive' : 'polite'"
  >
    <el-icon aria-hidden="true"><Warning /></el-icon>
    <div class="content-partial-copy">
      <strong>{{ title }}</strong>
      <span>{{ state?.description }}</span>
    </div>
    <button v-if="state?.retryable" type="button" @click="$emit('retry')">继续读取</button>
  </div>
</template>

<script setup>
import { Warning } from '@element-plus/icons-vue'

defineProps({
  state: { type: Object, required: true },
  title: { type: String, default: '仅显示已经读取的内容' }
})

defineEmits(['retry'])
</script>

<style lang="scss" scoped>
.content-partial-notice {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(760px, calc(100% - 32px));
  margin: 12px auto;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 36%, var(--theme-border));
  border-radius: 10px;
  color: var(--theme-text-secondary);
  background: color-mix(in srgb, var(--el-color-warning) 8%, var(--theme-surface));

  > .el-icon {
    flex: 0 0 auto;
    color: var(--el-color-warning);
    font-size: 17px;
  }

  button {
    flex: 0 0 auto;
    padding: 5px 10px;
    border: 1px solid var(--theme-border-strong);
    border-radius: 7px;
    color: var(--theme-text-primary);
    background: var(--theme-surface-hover);
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--theme-accent);
      border-color: var(--theme-accent);
    }
  }
}

.content-partial-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    color: var(--theme-text-primary);
    font-size: 12px;
  }

  span {
    font-size: 11px;
    line-height: 1.45;
  }
}
</style>
