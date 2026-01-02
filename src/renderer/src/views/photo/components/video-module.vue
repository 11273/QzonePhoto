<template>
  <div class="video-module">
    <div class="module-header">
      <h2 class="module-title">我的视频</h2>
    </div>
    <div class="module-content">
      <EmptyState icon="🎬" title="我的视频" description="视频模块开发中..." />
    </div>
  </div>
</template>

<script setup>
import EmptyState from '@renderer/components/EmptyState/index.vue'
</script>

<style lang="scss" scoped>
.video-module {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
}

.module-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 100%);
}

.module-title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  line-height: 1.3;
}

.module-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}
</style>
