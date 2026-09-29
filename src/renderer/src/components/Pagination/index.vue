<template>
  <nav :class="{ hidden: hidden }" aria-label="分页导航">
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :background="background"
      :layout="layout"
      :page-sizes="pageSizes"
      :total="total"
      v-bind="$attrs"
      size="small"
      class="py-1"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </nav>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  total: {
    required: true,
    type: Number
  },
  page: {
    type: Number,
    default: 1
  },
  limit: {
    type: Number,
    default: 20
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 30, 50]
  },
  layout: {
    type: String,
    default: 'total, sizes, prev, pager, next, jumper'
  },
  background: {
    type: Boolean,
    default: true
  },
  hidden: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:page', 'update:limit', 'pagination'])

// 计算属性实现双向绑定
const currentPage = computed({
  get: () => props.page,
  set: (val) => emit('update:page', val)
})

const pageSize = computed({
  get: () => props.limit,
  set: (val) => emit('update:limit', val)
})

const handleSizeChange = (val) => {
  emit('pagination', { page: currentPage.value, limit: val })
}

const handleCurrentChange = (val) => {
  emit('pagination', { page: val, limit: pageSize.value })
}
</script>

<style scoped>
nav {
  display: flex;
  justify-content: center;
  width: 100%;
  min-width: 0;
  padding-block: var(--theme-space-2);
  overflow-x: auto;
  scrollbar-width: thin;
}

nav.hidden {
  display: none;
}

:deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--theme-space-1);
  color: var(--theme-text-secondary);
}

:deep(.el-pagination.is-background .btn-prev),
:deep(.el-pagination.is-background .btn-next),
:deep(.el-pagination.is-background .el-pager li) {
  min-width: var(--theme-control-sm);
  height: var(--theme-control-sm);
  margin: 0;
  color: var(--theme-text-secondary);
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border-subtle);
  border-radius: var(--theme-radius-sm);
}

:deep(.el-pagination.is-background .el-pager li.is-active) {
  color: var(--theme-text-inverse);
  background: var(--theme-brand);
  border-color: var(--theme-brand);
}

:deep(.el-pagination button:focus-visible),
:deep(.el-pagination li:focus-visible) {
  outline: 2px solid var(--theme-focus);
  outline-offset: 2px;
}

@media (max-width: 720px) {
  :deep(.el-pagination__sizes),
  :deep(.el-pagination__jump) {
    margin-inline: var(--theme-space-1);
  }
}
</style>
