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
        <div class="nc-header-main">
          <div class="nc-icon">
            <Megaphone :size="19" />
          </div>
          <div>
            <div class="nc-title">公告中心</div>
            <div class="nc-subtitle">功能状态、接口波动和重要提醒都会放在这里。</div>
          </div>
        </div>

        <div v-if="notices.length > 0" class="nc-header-actions">
          <span class="nc-unread-summary" :class="{ empty: unreadCount === 0 }">
            {{ unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读' }}
          </span>
          <button v-if="unreadCount > 0" class="nc-mark-all" type="button" @click="markAllRead">
            全部已读
          </button>
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
            <span class="nc-list-title-row">
              <span class="nc-list-title">{{ notice.title }}</span>
              <span v-if="!isDismissed(notice)" class="nc-unread-pill">未读</span>
            </span>
            <span class="nc-list-time">{{ formatTime(notice.updatedAt || notice.startsAt) }}</span>
          </span>
        </button>
      </div>

      <article v-if="selectedNotice" class="nc-detail" :class="selectedNotice.level">
        <div class="nc-detail-top">
          <span class="nc-badge">{{ levelLabel(selectedNotice.level) }}</span>
          <span v-if="selectedNoticeUnread" class="nc-status unread">未读</span>
          <span v-if="selectedNotice.active !== false" class="nc-status">进行中</span>
          <span v-else class="nc-status muted">历史</span>
        </div>

        <div class="nc-detail-body">
          <h3>{{ selectedNotice.title }}</h3>
          <p>{{ selectedNotice.content }}</p>

          <div class="nc-meta">
            <span v-if="selectedNotice.startsAt"
              >开始 {{ formatTime(selectedNotice.startsAt) }}</span
            >
            <span v-if="selectedNotice.endsAt">截止 {{ formatTime(selectedNotice.endsAt) }}</span>
          </div>
        </div>

        <div class="nc-actions">
          <el-button v-if="selectedNotice.actionUrl" text class="nc-link" @click="openNoticeLink">
            {{ selectedNotice.actionText || '查看详情' }}
            <ExternalLink :size="18" />
          </el-button>
          <el-button type="primary" @click="confirmCurrentNotice">{{
            primaryActionText
          }}</el-button>
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
const readVersion = ref(0)

const selectedNotice = computed(
  () => props.notices.find((notice) => notice.id === selectedId.value) || props.notices[0] || null
)
const unreadNotices = computed(() => props.notices.filter((notice) => !isDismissed(notice)))
const unreadCount = computed(() => unreadNotices.value.length)
const selectedNoticeUnread = computed(() =>
  selectedNotice.value ? !isDismissed(selectedNotice.value) : false
)
const primaryActionText = computed(() => {
  if (!selectedNoticeUnread.value) return '关闭'
  return unreadCount.value > 1 ? '已读并看下一条' : '标为已读'
})

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

const isDismissed = (notice) => {
  readVersion.value
  return notice.dismissible !== false && localStorage.getItem(storageKey(notice)) === '1'
}

const selectNotice = (notice) => {
  selectedId.value = notice.id
}

const confirmCurrentNotice = () => {
  if (!selectedNotice.value) {
    emit('update:visible', false)
    return
  }

  if (!selectedNoticeUnread.value) {
    emit('update:visible', false)
    return
  }

  const currentId = selectedNotice.value.id
  emit('dismiss', selectedNotice.value)
  readVersion.value += 1

  const nextUnread = unreadNotices.value.find((notice) => notice.id !== currentId)
  if (nextUnread) {
    selectedId.value = nextUnread.id
  }
}

const markAllRead = () => {
  if (unreadNotices.value.length === 0) return
  unreadNotices.value.forEach((notice) => emit('dismiss', notice))
  readVersion.value += 1
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
  justify-content: space-between;
  gap: 16px;
}

.nc-header-main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.nc-header-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nc-unread-summary {
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(251, 113, 133, 0.14);
  border: 1px solid rgba(251, 113, 133, 0.26);
  color: #fecdd3;
  font-size: 12px;
  font-weight: 650;
}

.nc-unread-summary.empty {
  background: rgba(52, 211, 153, 0.12);
  border-color: rgba(52, 211, 153, 0.22);
  color: #a7f3d0;
}

.nc-mark-all {
  height: 28px;
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.nc-mark-all:hover:not(:disabled) {
  background: rgba(96, 165, 250, 0.16);
  border-color: rgba(96, 165, 250, 0.28);
  color: #fff;
}

.nc-mark-all:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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

.nc-list-item.unread {
  background: rgba(251, 113, 133, 0.055);
}

.nc-list-item.unread.active {
  background: linear-gradient(90deg, rgba(251, 113, 133, 0.14), rgba(96, 165, 250, 0.13));
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

.nc-list-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nc-list-title {
  min-width: 0;
  font-size: 13px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc-unread-pill {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(251, 113, 133, 0.18);
  border: 1px solid rgba(251, 113, 133, 0.25);
  color: #fecdd3;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
}

.nc-list-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

.nc-detail {
  min-width: 0;
  height: 360px;
  padding: 18px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
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
  flex: 0 0 auto;
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

.nc-status.unread {
  background: rgba(251, 113, 133, 0.15);
  color: #fecdd3;
}

.nc-detail-body {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 14px;
  overflow-y: auto;
  padding-right: 4px;
}

.nc-detail-body::-webkit-scrollbar {
  width: 6px;
}

.nc-detail-body::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.nc-detail-body::-webkit-scrollbar-track {
  background: transparent;
}

.nc-detail h3 {
  margin: 0 0 10px;
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
  margin-top: 16px;
  padding-top: 16px;
  flex: 0 0 auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.nc-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 720px) {
  .nc-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .nc-header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .nc-body {
    grid-template-columns: 1fr;
  }

  .nc-list {
    max-height: 150px;
  }
}
</style>
