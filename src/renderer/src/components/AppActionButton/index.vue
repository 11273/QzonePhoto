<template>
  <el-button
    v-bind="$attrs"
    :size="elementSize"
    :loading="loading"
    :disabled="disabled"
    :class="['app-action-button', `is-${variant}`, `is-${uiSize}`, { 'is-icon-only': iconOnly }]"
  >
    <slot name="icon" />
    <slot />
  </el-button>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  variant: {
    type: String,
    default: 'neutral',
    validator: (value) => ['neutral', 'ghost', 'primary', 'warning', 'danger'].includes(value)
  },
  uiSize: {
    type: String,
    default: 'default',
    validator: (value) => ['compact', 'default', 'large'].includes(value)
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const elementSize = computed(() => (props.uiSize === 'compact' ? 'small' : 'default'))
</script>

<style lang="scss" scoped>
.app-action-button.el-button {
  --action-height: var(--theme-control);
  --action-padding: 12px;
  --action-radius: var(--theme-radius-md);

  height: var(--action-height);
  min-height: var(--action-height);
  margin: 0;
  padding: 0 var(--action-padding);
  gap: 6px;
  border-radius: var(--action-radius);
  border-color: var(--theme-border);
  color: var(--theme-text-secondary);
  background: var(--theme-surface-soft);
  box-shadow: none;
  font-weight: 500;
  transition:
    color var(--theme-duration-fast) var(--theme-ease),
    background-color var(--theme-duration-fast) var(--theme-ease),
    border-color var(--theme-duration-fast) var(--theme-ease),
    transform var(--theme-duration-fast) var(--theme-ease);

  &.is-compact {
    --action-height: var(--theme-control-sm);
    --action-padding: 10px;
    --action-radius: var(--theme-radius-sm);
  }

  &.is-large {
    --action-height: var(--theme-control-lg);
    --action-padding: 16px;
  }

  &.is-icon-only {
    width: var(--action-height);
    min-width: var(--action-height);
    padding: 0;
  }

  &:hover:not(.is-disabled),
  &:focus-visible:not(.is-disabled) {
    color: var(--theme-text-primary);
    background: var(--theme-surface-hover);
    border-color: var(--theme-border-strong);
  }

  &:active:not(.is-disabled) {
    transform: scale(0.97);
    background: var(--theme-surface-active);
  }

  &:focus-visible {
    /* AppActionButton 经常位于弹窗和圆角工具栏边缘，使用内嵌焦点环避免被裁剪。 */
    outline: none;
    box-shadow: inset 0 0 0 2px var(--theme-focus);
  }

  &.is-ghost {
    border-color: transparent;
    background: transparent;
  }

  &.is-primary {
    color: var(--theme-text-inverse);
    background: var(--theme-brand);
    border-color: var(--theme-brand);

    &:hover:not(.is-disabled),
    &:focus-visible:not(.is-disabled) {
      color: var(--theme-text-inverse);
      background: var(--theme-brand-hover);
      border-color: var(--theme-brand-hover);
    }
  }

  &.is-danger {
    color: var(--theme-danger-text);
    background: var(--theme-danger-soft);
    border-color: var(--theme-danger-border);

    &:hover:not(.is-disabled),
    &:focus-visible:not(.is-disabled) {
      color: var(--theme-text-inverse);
      background: var(--theme-danger);
      border-color: var(--theme-danger);
    }
  }

  &.is-warning {
    color: var(--theme-warning-text);
    background: var(--theme-warning-soft);
    border-color: var(--theme-warning-border);

    &:hover:not(.is-disabled),
    &:focus-visible:not(.is-disabled) {
      color: var(--theme-warning-text);
      background: color-mix(in srgb, var(--theme-warning-soft) 72%, var(--theme-warning) 28%);
      border-color: var(--theme-warning);
    }
  }

  &.is-disabled,
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  :deep(.el-icon) {
    flex: 0 0 auto;
    margin: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-action-button.el-button {
    transition: none;
  }
}
</style>
