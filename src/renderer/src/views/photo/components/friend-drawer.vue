<template>
  <div class="friend-drawer" :class="{ expanded: isExpanded }">
    <!-- 遮罩（展开时点击关闭） -->
    <transition name="overlay-fade">
      <div v-if="isExpanded" class="drawer-overlay" @click="isExpanded = false"></div>
    </transition>

    <!-- 触发按钮 -->
    <div class="drawer-trigger" @click="toggleDrawer">
      <div class="trigger-bar" :class="{ active: isExpanded }">
        <svg class="trigger-heart" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
          />
        </svg>
        <span class="trigger-label">好友</span>
        <el-icon class="trigger-arrow" :class="{ flipped: isExpanded }">
          <ArrowUp />
        </el-icon>
      </div>
    </div>

    <!-- 展开面板 — 绝对定位向上展开，不影响布局 -->
    <transition name="panel-slide">
      <div v-show="isExpanded" class="drawer-panel">
        <!-- 顶层 Tab -->
        <div class="drawer-sub-tabs">
          <div
            class="sub-tab"
            :class="{ active: friendStore.currentTab === FRIEND_TAB.QQ_GROUP }"
            @click="friendStore.switchTab(FRIEND_TAB.QQ_GROUP)"
          >
            <svg class="tab-heart" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z"
              />
            </svg>
            <span>分组</span>
          </div>
          <div
            class="sub-tab"
            :class="{ active: friendStore.currentTab === FRIEND_TAB.CARE }"
            @click="friendStore.switchTab(FRIEND_TAB.CARE)"
          >
            <svg class="tab-heart" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
              />
            </svg>
            <span>我在意谁</span>
          </div>
          <div
            class="sub-tab"
            :class="{ active: friendStore.currentTab === FRIEND_TAB.CARE_BY }"
            @click="friendStore.switchTab(FRIEND_TAB.CARE_BY)"
          >
            <svg class="tab-heart" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
              />
            </svg>
            <span>谁在意我</span>
          </div>
        </div>

        <!-- 分组选择器（仅 QQ 分组 Tab 下显示） -->
        <div v-if="friendStore.currentTab === FRIEND_TAB.QQ_GROUP" class="drawer-group-select">
          <el-select
            v-model="friendStore.selectedGroupId"
            size="small"
            placement="bottom-start"
            popper-class="friend-group-popper"
          >
            <el-option
              v-for="opt in friendStore.groupOptions"
              :key="opt.gpid"
              :value="opt.gpid"
              :label="`${opt.gpname} (${opt.count})`"
            />
          </el-select>
        </div>

        <!-- 搜索 -->
        <div class="drawer-search">
          <el-input
            v-model="friendStore.searchQuery"
            placeholder="搜索备注/昵称/QQ号..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>

        <!-- 好友列表 -->
        <div class="drawer-list">
          <div v-if="friendStore.loading" class="drawer-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>加载中...</span>
          </div>
          <template v-else>
            <div v-if="friendStore.tabLoading" class="tab-loading-overlay">
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
            <div
              v-for="friend in friendStore.filteredList"
              :key="friend.uin"
              class="drawer-friend-item"
              :class="{ active: activeFriend?.uin === friend.uin }"
              @click="handleEnter(friend)"
            >
              <el-avatar :size="30" :src="avatarUrl(friend)">
                {{ stripEmoji(primaryName(friend))?.[0] || '?' }}
              </el-avatar>
              <div class="friend-detail">
                <!-- eslint-disable-next-line vue/no-v-html -- 名称已做 HTML 转义，仅注入表情 img 标签 -->
                <div class="friend-name" v-html="renderName(primaryName(friend))"></div>
                <!-- eslint-disable-next-line vue/no-v-html -- 同上 -->
                <div
                  v-if="secondaryName(friend)"
                  class="friend-sub"
                  v-html="renderName(secondaryName(friend))"
                ></div>
              </div>
              <span
                v-if="friendStore.currentTab === FRIEND_TAB.QQ_GROUP && friend.online"
                class="friend-online-dot"
                title="在线"
              ></span>
              <div
                v-if="friendStore.currentTab !== FRIEND_TAB.QQ_GROUP && friend.score != null"
                class="friend-score-badge"
              >
                <svg class="score-heart" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
                  />
                </svg>
                <span class="score-value">{{ friend.score }}</span>
              </div>
            </div>
            <div v-if="friendStore.filteredList.length === 0" class="drawer-empty">
              暂无匹配好友
            </div>
          </template>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ArrowUp, Search, Loading } from '@element-plus/icons-vue'
import { useFriendStore, FRIEND_TAB } from '@renderer/store/friend.store'

defineProps({
  activeFriend: { type: Object, default: null }
})

const emit = defineEmits(['enter-friend'])
const friendStore = useFriendStore()

const isExpanded = ref(false)

const stripEmoji = (name) => (name || '').replace(/\[em\]e\d+\[\/em\]/g, '')
const renderName = (name) => {
  if (!name) return ''
  const escaped = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(
    /\[em\](e\d+)\[\/em\]/g,
    (_, code) =>
      `<img src="https://qzonestyle.gtimg.cn/qzone/em/${code}.gif" class="friend-emoji" alt="" />`
  )
}
// 有备注：备注为主、昵称为辅；无备注：只显示昵称
const primaryName = (f) => (f.remark?.trim() ? f.remark : f.name || '')
const secondaryName = (f) => (f.remark?.trim() ? f.name || '' : '')
// QQ 接口返回 /30 小图，渲染时升级为 /100
const avatarUrl = (friend) => (friend.img || '').replace(/\/30(\?|$)/, '/100$1')

const toggleDrawer = () => {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value && !friendStore.qqLoaded) {
    // 等面板滑入动画完成后再加载，避免 loading 状态变化导致动画卡顿
    setTimeout(() => friendStore.fetchQQFriends(), 350)
  }
}

const handleEnter = (friend) => {
  emit('enter-friend', friend)
  isExpanded.value = false
}

defineExpose({ toggleDrawer })
</script>

<style scoped>
/* ===== 整体容器 ===== */
.friend-drawer {
  position: relative;
  flex-shrink: 0;
}

/* ===== 遮罩 ===== */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* ===== 触发按钮 ===== */
.drawer-trigger {
  padding: 6px 8px 8px;
}

.trigger-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.18);
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.06) 0%, rgba(248, 113, 113, 0.02) 100%);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.trigger-bar:hover,
.trigger-bar.active {
  border-color: rgba(248, 113, 113, 0.35);
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.1) 0%, rgba(248, 113, 113, 0.04) 100%);
}

.trigger-heart {
  width: 12px;
  height: 12px;
  color: #f87171;
  flex-shrink: 0;
}

.trigger-label {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
}

.trigger-arrow {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  transition:
    transform 0.3s ease,
    color 0.2s ease;
}

.trigger-bar:hover .trigger-arrow {
  color: rgba(248, 113, 113, 0.5);
}

.trigger-arrow.flipped {
  transform: rotate(180deg);
  color: #f87171;
}

/* ===== 展开面板 — 绝对定位向上弹出，覆盖整个菜单区域 ===== */
.drawer-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: rgba(22, 22, 26, 0.97);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(248, 113, 113, 0.15);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  box-shadow:
    0 -8px 32px rgba(0, 0, 0, 0.4),
    0 -2px 8px rgba(248, 113, 113, 0.06);
  height: calc(100vh - 260px);
}

.panel-slide-enter-active {
  transition:
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease;
}
.panel-slide-leave-active {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.15s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateY(12px);
  opacity: 0;
}

/* ===== 顶层 Tab ===== */
.drawer-sub-tabs {
  display: flex;
  gap: 3px;
  padding: 3px;
  margin: 10px 10px 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  flex-shrink: 0;
}

.sub-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 5px 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  white-space: nowrap;
}

.tab-heart {
  width: 10px;
  height: 10px;
}

.sub-tab:hover {
  color: rgba(255, 255, 255, 0.6);
}

.sub-tab.active {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  font-weight: 600;
}

/* ===== 分组选择器 ===== */
.drawer-group-select {
  margin: 0 10px 6px;
  flex-shrink: 0;
}

.drawer-group-select :deep(.el-select) {
  width: 100%;
}

.drawer-group-select :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(248, 113, 113, 0.18);
  box-shadow: none;
  min-height: 28px;
  border-radius: 6px;
}

.drawer-group-select :deep(.el-select__wrapper:hover),
.drawer-group-select :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(248, 113, 113, 0.4);
}

.drawer-group-select :deep(.el-select__placeholder),
.drawer-group-select :deep(.el-select__placeholder span) {
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-weight: 500;
}

.drawer-search {
  margin: 0 10px 6px;
  flex-shrink: 0;
}

.drawer-search :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: none;
  height: 28px;
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.drawer-search :deep(.el-input__wrapper:hover),
.drawer-search :deep(.el-input__wrapper.is-focus) {
  border-color: rgba(248, 113, 113, 0.25);
}

.drawer-search :deep(.el-input__inner) {
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
}

.drawer-search :deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.2);
}

.drawer-search :deep(.el-input__prefix .el-icon) {
  color: rgba(255, 255, 255, 0.2);
}

/* ===== 好友列表 ===== */
.drawer-list {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  min-height: 0;
  padding: 0 6px 8px;
  position: relative;
}

.drawer-list::-webkit-scrollbar {
  width: 3px;
}

.drawer-list::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
}

.drawer-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

.drawer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 40px 0;
  color: rgba(255, 255, 255, 0.25);
  font-size: 12px;
}

.drawer-loading .el-icon {
  color: #f87171;
}

.tab-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 22, 26, 0.6);
  z-index: 2;
  border-radius: 6px;
}

.tab-loading-overlay .el-icon {
  font-size: 18px;
  color: #f87171;
}

/* ===== 好友项 ===== */
.drawer-friend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.drawer-friend-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.drawer-friend-item.active {
  background: rgba(248, 113, 113, 0.08);
}

.drawer-friend-item :deep(.el-avatar) {
  flex-shrink: 0;
}

.friend-detail {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
  font-weight: 500;
}

.friend-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
  margin-top: 1px;
}

.friend-name :deep(.friend-emoji),
.friend-sub :deep(.friend-emoji) {
  width: 14px;
  height: 14px;
  vertical-align: text-bottom;
  margin: 0 1px;
}

.friend-online-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.6);
}

.friend-score-badge {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 3px;
}

.score-heart {
  width: 10px;
  height: 10px;
  color: rgba(255, 255, 255, 0.08);
  transition: color 0.15s ease;
}

.drawer-friend-item:hover .score-heart,
.drawer-friend-item.active .score-heart {
  color: #f87171;
}

.score-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.2);
  font-variant-numeric: tabular-nums;
  transition: color 0.15s ease;
}

.drawer-friend-item:hover .score-value {
  color: rgba(255, 255, 255, 0.45);
}

.drawer-friend-item.active .score-value {
  color: #f87171;
}

.drawer-empty {
  text-align: center;
  padding: 32px 0;
  color: rgba(255, 255, 255, 0.18);
  font-size: 12px;
}
</style>

<style>
.friend-group-popper.el-popper {
  background: rgba(22, 22, 26, 0.98);
  border: 1px solid rgba(248, 113, 113, 0.18);
}

.friend-group-popper .el-select-dropdown__item {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  height: 28px;
  line-height: 28px;
  padding: 0 12px;
}

.friend-group-popper .el-select-dropdown__item.is-hovering {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
}

.friend-group-popper .el-select-dropdown__item.is-selected {
  color: #f87171;
  font-weight: 600;
  background: rgba(248, 113, 113, 0.08);
}
</style>
