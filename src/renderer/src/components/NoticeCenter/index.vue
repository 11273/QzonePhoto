<template>
  <el-dialog
    :model-value="visible"
    width="620px"
    align-center
    append-to-body
    modal-class="notice-center-overlay"
    class="notice-center ds-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="nc-header">
        <div class="nc-icon">
          <Megaphone :size="19" />
        </div>
        <div>
          <div class="nc-title">公告中心</div>
          <div class="nc-subtitle">功能状态、接口波动和重要提醒都会放在这里。</div>
        </div>
      </div>
    </template>

    <div v-if="notices.length === 0" class="nc-empty">
      <Bell :size="28" />
      <div class="nc-empty-title">暂无公告</div>
      <div class="nc-empty-desc">有重要变化时会在这里同步。</div>
    </div>

    <div v-else class="nc-body">
      <div class="nc-list">
        <button
          v-for="notice in notices"
          :key="noticeKey(notice)"
          class="nc-list-item"
          :class="{ active: selectedId === notice.id, unread: !isDismissed(notice) }"
          type="button"
          @click="selectNotice(notice)"
        >
          <span class="nc-level-dot" :class="notice.level"></span>
          <span class="nc-list-main">
            <span class="nc-list-title">{{ notice.title }}</span>
            <span class="nc-list-time">{{ formatTime(notice.updatedAt || notice.startsAt) }}</span>
          </span>
        </button>
      </div>

      <article v-if="selectedNotice" class="nc-detail" :class="selectedNotice.level">
        <div class="nc-detail-top">
          <span class="nc-badge">{{ levelLabel(selectedNotice.level) }}</span>
          <span v-if="selectedNotice.active !== false" class="nc-status">进行中</span>
          <span v-else class="nc-status muted">历史</span>
        </div>

        <h3>{{ selectedNotice.title }}</h3>
        <p>{{ selectedNotice.content }}</p>

        <div class="nc-meta">
          <span v-if="selectedNotice.startsAt">开始 {{ formatTime(selectedNotice.startsAt) }}</span>
          <span v-if="selectedNotice.endsAt">截止 {{ formatTime(selectedNotice.endsAt) }}</span>
        </div>

        <div class="nc-actions">
          <el-button v-if="selectedNotice.actionUrl" text class="nc-link" @click="openNoticeLink">
            {{ selectedNotice.actionText || '查看详情' }}
            <ExternalLink :size="18" />
          </el-button>
          <el-button type="primary" @click="confirmCurrentNotice">知道了</el-button>
        </div>
      </article>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Bell, Megaphone, ExternalLink } from '@lucide/vue'
import { IPC_SHELL } from '@shared/ipc-channels'

const props = defineProps({
  visible: { type: Boolean, default: false },
  notices: { type: Array, default: () => [] },
  activeNotice: { type: Object, default: null }
})

const emit = defineEmits(['update:visible', 'dismiss'])

const selectedId = ref('')

const selectedNotice = computed(
  () => props.notices.find((notice) => notice.id === selectedId.value) || props.notices[0] || null
)

watch(
  () => [props.visible, props.notices, props.activeNotice],
  () => {
    if (!props.visible) return
    selectedId.value = props.activeNotice?.id || props.notices[0]?.id || ''
  },
  { immediate: true }
)

const noticeKey = (notice) => `${notice.id}:${notice.updatedAt || ''}`

const storageKey = (notice) => `qzone.notice.dismissed.${notice.id}.${notice.updatedAt || ''}`

const isDismissed = (notice) => notice.dismissible !== false && localStorage.getItem(storageKey(notice))

const selectNotice = (notice) => {
  selectedId.value = notice.id
}

const confirmCurrentNotice = () => {
  if (selectedNotice.value) {
    emit('dismiss', selectedNotice.value)
  }
  emit('update:visible', false)
}

const openNoticeLink = async () => {
  if (!selectedNotice.value?.actionUrl) return
  await window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, selectedNotice.value.actionUrl)
}

const levelLabel = (level) => {
  const labels = {
    success: '更新',
    warning: '提醒',
    error: '重要',
    info: '公告'
  }
  return labels[level] || '公告'
}

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
</script>

<style scoped>
.nc-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nc-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.26);
}

.nc-title {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.94);
}

.nc-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.nc-empty {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.48);
}

.nc-empty-title {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.78);
  font-weight: 700;
}

.nc-empty-desc {
  font-size: 12px;
}

.nc-body {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 14px;
  min-height: 300px;
}

.nc-list {
  padding: 6px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.07);
  max-height: 360px;
  overflow: auto;
}

.nc-list-item {
  width: 100%;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  text-align: left;
  cursor: pointer;
}

.nc-list-item:hover,
.nc-list-item.active {
  background: rgba(96, 165, 250, 0.13);
  color: rgba(255, 255, 255, 0.95);
}

.nc-list-item.unread .nc-list-title {
  color: rgba(255, 255, 255, 0.96);
}

.nc-level-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: #60a5fa;
  flex: 0 0 auto;
}

.nc-level-dot.warning {
  background: #f59e0b;
}

.nc-level-dot.error {
  background: #fb7185;
}

.nc-level-dot.success {
  background: #34d399;
}

.nc-list-main {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.nc-list-title {
  font-size: 13px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-list-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

.nc-detail {
  min-width: 0;
  padding: 18px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(255, 255, 255, 0.035)),
    rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(96, 165, 250, 0.18);
}

.nc-detail.warning {
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(255, 255, 255, 0.035)),
    rgba(255, 255, 255, 0.035);
  border-color: rgba(245, 158, 11, 0.24);
}

.nc-detail.error {
  background:
    linear-gradient(135deg, rgba(251, 113, 133, 0.16), rgba(255, 255, 255, 0.035)),
    rgba(255, 255, 255, 0.035);
  border-color: rgba(251, 113, 133, 0.24);
}

.nc-detail.success {
  background:
    linear-gradient(135deg, rgba(52, 211, 153, 0.14), rgba(255, 255, 255, 0.035)),
    rgba(255, 255, 255, 0.035);
  border-color: rgba(52, 211, 153, 0.22);
}

.nc-detail-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nc-badge,
.nc-status {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.76);
}

.nc-status.muted {
  color: rgba(255, 255, 255, 0.45);
}

.nc-detail h3 {
  margin: 14px 0 10px;
  font-size: 20px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.95);
}

.nc-detail p {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.nc-meta {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 12px;
}

.nc-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}

.nc-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 720px) {
  .nc-body {
    grid-template-columns: 1fr;
  }

  .nc-list {
    max-height: 150px;
  }
}
</style>
