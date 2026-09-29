<template>
  <AppActionButton
    v-bind="$attrs"
    class="app-refresh-button"
    variant="ghost"
    :ui-size="uiSize"
    :loading="loading"
    :disabled="disabled || loading"
    :aria-label="loading ? loadingAriaLabel : $attrs['aria-label'] || label"
  >
    <template v-if="!loading" #icon>
      <el-icon><Refresh /></el-icon>
    </template>
    <span class="app-refresh-button__label">{{ loading ? loadingLabel : label }}</span>
  </AppActionButton>
</template>

<script setup>
import { Refresh } from '@element-plus/icons-vue'
import AppActionButton from '@renderer/components/AppActionButton/index.vue'

defineOptions({ inheritAttrs: false })

defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: '刷新'
  },
  loadingLabel: {
    type: String,
    default: '刷新中'
  },
  loadingAriaLabel: {
    type: String,
    default: '正在刷新'
  },
  uiSize: {
    type: String,
    default: 'compact'
  }
})
</script>

<style scoped>
.app-refresh-button.el-button {
  min-width: 76px;
}

.app-refresh-button__label {
  min-width: 3em;
  text-align: center;
  white-space: nowrap;
}
</style>
