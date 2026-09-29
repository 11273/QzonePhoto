<template>
  <header class="content-module-header">
    <div class="content-module-heading">
      <h2 class="content-module-title">{{ title }}</h2>
      <span v-if="subtitle" class="content-module-subtitle">{{ subtitle }}</span>
      <slot name="meta"></slot>
    </div>
    <div v-if="$slots.actions" class="content-module-actions">
      <slot name="actions"></slot>
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  }
})
</script>

<style lang="scss" scoped>
.content-module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 54px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--theme-border-subtle);
  background: var(--theme-surface-soft);
  flex-shrink: 0;
  transition:
    background-color var(--theme-duration) var(--theme-ease),
    border-color var(--theme-duration) var(--theme-ease);
}

.content-module-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.content-module-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-module-subtitle {
  flex: 0 0 auto;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.content-module-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

@media (max-width: 780px) {
  .content-module-header {
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 9px 16px;
  }

  .content-module-actions {
    width: 100%;
    overflow-x: auto;
    justify-content: flex-start;
    scrollbar-width: none;
  }

  .content-module-actions::-webkit-scrollbar {
    display: none;
  }
}
</style>
