<template>
  <div class="friend-drawer" :class="{ expanded: isExpanded }">
    <!-- 遮罩（展开时点击关闭） -->
    <transition name="overlay-fade">
      <button
        v-if="isExpanded"
        class="drawer-overlay"
        type="button"
        aria-label="关闭好友面板"
        @click="closeDrawer"
      ></button>
    </transition>

    <!-- 触发按钮 -->
    <div class="drawer-trigger" :class="{ compact: activeFriend }">
      <div class="drawer-back-slot" :class="{ visible: activeFriend }">
        <button
          class="drawer-back-btn"
          type="button"
          title="返回我的空间"
          aria-label="直接返回我的空间"
          :aria-hidden="!activeFriend"
          :tabindex="activeFriend ? 0 : -1"
          :disabled="!activeFriend"
          @click.stop="emit('exit-friend')"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
      </div>
      <div class="contact-trigger-group" role="group" aria-label="联系人">
        <button
          ref="friendsTriggerRef"
          class="trigger-bar"
          :class="{
            active: isExpanded && friendStore.currentScope === CONTACT_SCOPE.FRIENDS
          }"
          type="button"
          aria-label="好友"
          title="好友"
          :aria-expanded="isExpanded && friendStore.currentScope === CONTACT_SCOPE.FRIENDS"
          aria-controls="friend-drawer-panel"
          @click="toggleDrawer(CONTACT_SCOPE.FRIENDS)"
        >
          <Users :size="14" class="trigger-icon friend" />
          <span class="trigger-label">好友</span>
        </button>
        <button
          ref="groupsTriggerRef"
          class="trigger-bar"
          :class="{
            active: isExpanded && friendStore.currentScope === CONTACT_SCOPE.GROUPS
          }"
          type="button"
          aria-label="群"
          title="群"
          :aria-expanded="isExpanded && friendStore.currentScope === CONTACT_SCOPE.GROUPS"
          aria-controls="friend-drawer-panel"
          @click="toggleDrawer(CONTACT_SCOPE.GROUPS)"
        >
          <UsersRound :size="14" class="trigger-icon group" />
          <span class="trigger-label">群</span>
        </button>
        <button
          ref="intimacyTriggerRef"
          class="trigger-bar"
          :class="{
            active: isExpanded && friendStore.currentScope === CONTACT_SCOPE.INTIMACY
          }"
          type="button"
          aria-label="亲密度"
          title="亲密度"
          :aria-expanded="isExpanded && friendStore.currentScope === CONTACT_SCOPE.INTIMACY"
          aria-controls="friend-drawer-panel"
          @click="toggleDrawer(CONTACT_SCOPE.INTIMACY)"
        >
          <HeartHandshake :size="14" class="trigger-icon intimacy" />
          <span class="trigger-label">亲密度</span>
        </button>
      </div>
    </div>

    <!-- 展开面板 — 绝对定位向上展开，不影响布局 -->
    <transition name="panel-slide">
      <div
        v-show="isExpanded"
        id="friend-drawer-panel"
        class="drawer-panel"
        role="region"
        :aria-label="drawerPanelLabel"
      >
        <div class="contact-panel-heading">
          <span class="contact-panel-icon">
            <Users v-if="friendStore.currentScope === CONTACT_SCOPE.FRIENDS" :size="15" />
            <UsersRound v-else-if="friendStore.currentScope === CONTACT_SCOPE.GROUPS" :size="15" />
            <HeartHandshake v-else :size="15" />
          </span>
          <div class="contact-panel-heading-text">
            <strong>{{ contactScopeTitle }}</strong>
            <span :title="contactScopeSummary">{{ contactScopeSummary }}</span>
          </div>
          <el-dropdown
            class="contact-backup-dropdown"
            placement="bottom-end"
            trigger="click"
            popper-class="contact-backup-popper"
            :disabled="backupBusy"
            @command="handleContactBackup"
          >
            <button
              class="contact-backup-btn"
              type="button"
              :disabled="backupBusy"
              :aria-label="backupMenuTitle"
              :title="`${backupMenuTitle}，不包含照片、视频或相册`"
            >
              <el-icon v-if="backupBusy" class="is-loading"><Loading /></el-icon>
              <DatabaseBackup v-else :size="14" />
              <span>{{ backupBusy ? '正在备份' : '备份名单' }}</span>
              <ChevronDown v-if="!backupBusy" :size="12" class="backup-chevron" />
            </button>
            <template #dropdown>
              <div class="contact-backup-menu-intro">
                <strong>{{ backupMenuTitle }}</strong>
                <span>保存联系人资料为本地文件，不包含照片、视频或相册。</span>
              </div>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in contactBackupOptions"
                  :key="option.command"
                  :command="option.command"
                  :disabled="option.disabled"
                  :divided="option.divided"
                >
                  <FileDown :size="14" class="contact-backup-option-icon" />
                  <div class="contact-backup-option">
                    <strong>{{ option.label }}</strong>
                    <span>{{ option.description }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 批量下载分组进度条（贴顶，跨整个面板宽度） -->
        <div
          v-if="batchActive && friendStore.currentScope === CONTACT_SCOPE.FRIENDS"
          class="batch-progress-strip"
          role="status"
          aria-live="polite"
        >
          <div class="batch-progress-info">
            <el-icon class="batch-spinner is-loading"><Loading /></el-icon>
            <div class="batch-progress-texts">
              <div class="batch-progress-line">
                分组「{{ currentGroupName }}」 {{ batchProgress.current }}/{{ batchProgress.total }}
              </div>
              <div class="batch-progress-sub">
                <span class="batch-progress-friend">{{
                  batchProgress.friendName || '准备中...'
                }}</span>
                <span class="batch-progress-stat"
                  >已入队 {{ batchProgress.addedAlbums }} 个相册</span
                >
              </div>
            </div>
            <button
              class="batch-cancel-btn"
              type="button"
              :disabled="batchCancelling"
              @click="cancelBatchDownload"
            >
              {{ batchCancelling ? '取消中' : '取消' }}
            </button>
          </div>
          <div class="batch-progress-bar">
            <div
              class="batch-progress-bar-fill"
              :style="{ width: batchProgressPercent + '%' }"
            ></div>
          </div>
        </div>

        <!-- 顶层 Tab -->
        <div
          v-if="friendStore.currentScope === CONTACT_SCOPE.INTIMACY"
          class="drawer-sub-tabs"
          role="tablist"
          aria-label="亲密度分类"
        >
          <button
            class="sub-tab"
            :class="{ active: friendStore.currentTab === FRIEND_TAB.CARE }"
            type="button"
            role="tab"
            :aria-label="intimacyTabAriaLabel(FRIEND_TAB.CARE)"
            :aria-selected="friendStore.currentTab === FRIEND_TAB.CARE"
            :tabindex="friendStore.currentTab === FRIEND_TAB.CARE ? 0 : -1"
            @click="friendStore.switchTab(FRIEND_TAB.CARE)"
            @keydown="handleDrawerTabKeydown($event, 0)"
          >
            <svg class="tab-heart" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
              />
            </svg>
            <span class="sub-tab-label">我在意谁</span>
          </button>
          <button
            class="sub-tab"
            :class="{ active: friendStore.currentTab === FRIEND_TAB.CARE_BY }"
            type="button"
            role="tab"
            :aria-label="intimacyTabAriaLabel(FRIEND_TAB.CARE_BY)"
            :aria-selected="friendStore.currentTab === FRIEND_TAB.CARE_BY"
            :tabindex="friendStore.currentTab === FRIEND_TAB.CARE_BY ? 0 : -1"
            @click="friendStore.switchTab(FRIEND_TAB.CARE_BY)"
            @keydown="handleDrawerTabKeydown($event, 1)"
          >
            <svg class="tab-heart" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 1.9.5 2.5 1.3.6-.8 1.5-1.3 2.5-1.3C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z"
              />
            </svg>
            <span class="sub-tab-label">谁在意我</span>
          </button>
        </div>

        <!-- 分组选择器（仅 QQ 分组 Tab 下显示） -->
        <div
          v-if="
            friendStore.currentScope === CONTACT_SCOPE.FRIENDS &&
            friendStore.currentTab === FRIEND_TAB.QQ_GROUP
          "
          class="drawer-group-select"
        >
          <el-select
            :model-value="friendStore.selectedGroupId"
            size="small"
            placement="bottom-start"
            popper-class="friend-group-popper"
            aria-label="选择要浏览的好友分组"
            @change="handleFriendGroupChange"
          >
            <el-option
              v-for="opt in friendStore.groupOptions"
              :key="opt.gpid"
              :value="opt.gpid"
              :label="friendGroupOptionLabel(opt)"
            />
          </el-select>
          <button
            v-if="friendStore.selectedGroupId !== friendStore.ALL_GROUP_ID"
            type="button"
            class="contact-inline-action download"
            :disabled="!canBatchDownload || batchActive"
            :aria-label="`下载「${currentGroupName}」好友的可见相册`"
            :title="`下载「${currentGroupName}」好友的可见相册`"
            @click="handleBatchDownload"
          >
            <el-icon v-if="batchActive" class="is-loading"><Loading /></el-icon>
            <Download v-else :size="14" />
            <span>{{ batchActive ? '处理中' : '下载' }}</span>
          </button>
        </div>

        <div v-if="friendStore.currentScope === CONTACT_SCOPE.GROUPS" class="drawer-group-select">
          <el-select
            :model-value="friendStore.selectedQQGroup?.id || ''"
            size="small"
            placement="bottom-start"
            popper-class="friend-group-popper"
            placeholder="选择要查看的群"
            loading-text="正在加载群列表"
            :class="{ 'is-loading': friendStore.groupLoading }"
            :loading="friendStore.groupLoading"
            :disabled="friendStore.groupLoading"
            :suffix-icon="friendStore.groupLoading ? Loading : ArrowDown"
            filterable
            @change="friendStore.selectQQGroupById"
          >
            <el-option
              v-for="group in friendStore.qqGroups"
              :key="group.id"
              :value="group.id"
              :label="groupOptionLabel(group)"
            >
              <span class="group-option-label" :title="groupOptionLabel(group)">
                {{ groupOptionLabel(group) }}
              </span>
            </el-option>
          </el-select>
        </div>

        <!-- 好友搜索；群成员仅在选定群后显示本地筛选。亲密度不提供搜索入口。 -->
        <div
          v-if="
            friendStore.currentScope === CONTACT_SCOPE.FRIENDS ||
            (friendStore.currentScope === CONTACT_SCOPE.GROUPS && friendStore.selectedQQGroup)
          "
          class="drawer-search"
        >
          <el-input
            v-model="friendStore.searchQuery"
            :placeholder="searchPlaceholder"
            :aria-label="searchAriaLabel"
            :prefix-icon="Search"
            size="small"
            clearable
            @input="handleContactSearchInput"
          />
          <button
            v-if="friendStore.currentScope === CONTACT_SCOPE.FRIENDS"
            type="button"
            class="contact-inline-action find-space"
            aria-label="按 QQ 号查找并进入空间"
            title="输入 QQ 号并进入对应空间"
            @click="enterByUinVisible = true"
          >
            <UserRoundSearch :size="16" />
          </button>
        </div>

        <!-- 好友列表 -->
        <div
          v-if="friendStore.currentScope !== CONTACT_SCOPE.GROUPS"
          ref="contactListRef"
          class="drawer-list"
          @scroll.passive="handleContactListScroll"
        >
          <div
            v-if="
              friendStore.loading ||
              (!friendStore.currentListLoaded && !friendStore.currentListError)
            "
            class="drawer-loading"
            role="status"
            aria-live="polite"
          >
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>正在加载名单...</span>
          </div>
          <template v-else>
            <div
              v-if="friendStore.tabLoading"
              class="tab-loading-overlay"
              role="status"
              aria-label="正在加载好友列表"
            >
              <el-icon class="is-loading"><Loading /></el-icon>
            </div>
            <div v-if="friendStore.currentListError" class="drawer-error" role="alert">
              <span>{{ friendStore.currentListError }}</span>
              <button type="button" @click="friendStore.retryCurrentList()">重试</button>
            </div>
            <button
              v-for="friend in friendStore.filteredList"
              :key="friend.uin"
              class="drawer-friend-item"
              :class="{ active: activeFriend?.uin === friend.uin }"
              type="button"
              :aria-current="activeFriend?.uin === friend.uin ? 'true' : undefined"
              :title="`${friend.name}（${friend.uin}）— 右键复制 QQ 号`"
              @click="handleEnter(friend)"
              @keydown.enter.prevent="handleEnter(friend)"
              @keydown.space.prevent="handleEnter(friend)"
              @contextmenu.prevent="copyToClipboard(friend.uin, 'QQ 号')"
            >
              <el-avatar :size="30" :src="avatarUrl(friend)">
                {{ stripEmoji(primaryName(friend))?.[0] || '?' }}
              </el-avatar>
              <div class="friend-detail">
                <div class="friend-name">
                  <QzoneDisplayName :name="primaryName(friend)" />
                </div>
                <div v-if="secondaryName(friend)" class="friend-sub">
                  <QzoneDisplayName :name="secondaryName(friend)" />
                </div>
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
            </button>
            <div
              v-if="friendStore.filteredList.length === 0 && !friendStore.currentListError"
              class="drawer-empty"
              role="status"
            >
              {{ friendStore.currentScope === CONTACT_SCOPE.FRIENDS ? '暂无匹配好友' : '暂无记录' }}
            </div>
          </template>
        </div>

        <template v-else>
          <div
            ref="contactListRef"
            class="drawer-list group-list"
            @scroll.passive="handleContactListScroll"
          >
            <div v-if="friendStore.groupError" class="drawer-error" role="alert">
              <span>{{ friendStore.groupError }}</span>
              <button type="button" @click="friendStore.retryQQGroups()">重试</button>
            </div>

            <template v-if="friendStore.selectedQQGroup">
              <div
                v-if="friendStore.groupMembersLoading"
                class="drawer-loading group-members-loading"
                role="status"
                aria-live="polite"
              >
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>正在加载「{{ friendStore.selectedQQGroup.name }}」的成员...</span>
              </div>
              <template v-else>
                <button
                  v-for="member in friendStore.visibleQQGroupMembers"
                  :key="member.uin"
                  class="drawer-friend-item"
                  :class="{ active: activeFriend?.uin === member.uin }"
                  type="button"
                  :aria-current="activeFriend?.uin === member.uin ? 'true' : undefined"
                  :title="`${primaryName(member) || `QQ ${member.uin}`} — 进入空间`"
                  @click="handleGroupMemberEnter(member)"
                  @keydown.enter.prevent="handleGroupMemberEnter(member)"
                  @keydown.space.prevent="handleGroupMemberEnter(member)"
                  @contextmenu.prevent="copyToClipboard(member.uin, 'QQ 号')"
                >
                  <el-avatar :size="30" :src="avatarUrl(member)">
                    {{ stripEmoji(primaryName(member))?.[0] || '?' }}
                  </el-avatar>
                  <div class="friend-detail">
                    <div class="friend-name">
                      {{ primaryName(member) || `QQ ${member.uin}` }}
                    </div>
                    <div v-if="secondaryName(member)" class="friend-sub">
                      {{ secondaryName(member) }}
                    </div>
                  </div>
                  <ChevronRight :size="13" class="qq-group-chevron" />
                </button>
                <div
                  v-if="!friendStore.groupError && friendStore.filteredQQGroupMembers.length === 0"
                  class="drawer-empty"
                  role="status"
                >
                  暂无可见群成员
                </div>
                <button
                  v-if="friendStore.hasMoreQQGroupMembers"
                  class="group-load-more"
                  type="button"
                  @click="friendStore.loadMoreQQGroupMembers()"
                >
                  继续加载
                  <span>{{ groupMemberProgress }}</span>
                </button>
              </template>
            </template>
            <div
              v-else-if="
                !friendStore.groupLoading &&
                !friendStore.groupError &&
                friendStore.qqGroups.length === 0
              "
              class="drawer-empty"
              role="status"
            >
              暂无可查看的群
            </div>
            <div
              v-else-if="!friendStore.groupLoading && !friendStore.groupError"
              class="group-pick-empty"
              role="status"
            >
              <span class="group-pick-icon" aria-hidden="true">
                <UsersRound :size="22" />
              </span>
              <strong>选择要查看的群</strong>
              <span>选择后加载该群的可见成员</span>
            </div>
          </div>
        </template>
      </div>
    </transition>

    <!-- 输入 QQ 号进入空间 -->
    <EnterByUinDialog v-model:visible="enterByUinVisible" @enter-friend="handleEnterFromUin" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, ArrowLeft, Search, Loading } from '@element-plus/icons-vue'
import {
  ChevronDown,
  ChevronRight,
  DatabaseBackup,
  Download,
  FileDown,
  HeartHandshake,
  UserRoundSearch,
  Users,
  UsersRound
} from '@lucide/vue'
import { useFriendStore, FRIEND_TAB, CONTACT_SCOPE } from '@renderer/store/friend.store'
import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import QzoneDisplayName from '@renderer/components/QzoneDisplayName/index.vue'
import { copyToClipboard, generateUniqueAlbumName } from '@renderer/utils'
import { resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'
import { retryPageRequest, shouldContinuePagination } from '@renderer/utils/paginationGuard'
import {
  batchSummaryText,
  batchTaskIds,
  finishDownloadBatch,
  openDownloadBatchOptions
} from '@renderer/utils/downloadBatch'
import EnterByUinDialog from './enter-by-uin-dialog.vue'

defineProps({
  activeFriend: { type: Object, default: null }
})

const emit = defineEmits(['enter-friend', 'exit-friend'])
const friendStore = useFriendStore()
const userStore = useUserStore()
const downloadStore = useDownloadStore()

const isExpanded = ref(false)
const enterByUinVisible = ref(false)
const backupStarting = ref(false)
const contactListRef = ref(null)
const friendsTriggerRef = ref(null)
const groupsTriggerRef = ref(null)
const intimacyTriggerRef = ref(null)
const lastTriggerScope = ref(CONTACT_SCOPE.FRIENDS)

const drawerPanelLabel = computed(() => {
  if (friendStore.currentScope === CONTACT_SCOPE.GROUPS) return '群面板'
  if (friendStore.currentScope === CONTACT_SCOPE.INTIMACY) return '亲密度面板'
  return '好友面板'
})

const contactScopeTitle = computed(() => {
  if (friendStore.currentScope === CONTACT_SCOPE.GROUPS) return '群成员'
  if (friendStore.currentScope === CONTACT_SCOPE.INTIMACY) return '亲密度'
  return '好友列表'
})

const contactScopeSummary = computed(() => {
  if (friendStore.currentScope === CONTACT_SCOPE.GROUPS) {
    if (friendStore.groupError) return '群列表暂不可用'
    if (friendStore.groupLoading || !friendStore.groupsLoaded) return '正在获取群列表'
    if (friendStore.selectedQQGroup && friendStore.groupMembersLoading) {
      return `${friendStore.qqGroups.length} 个群 · 正在获取成员`
    }
    return friendStore.selectedQQGroup
      ? `${friendStore.qqGroups.length} 个群 · ${friendStore.groupMembers.length} 位可见成员`
      : `${friendStore.qqGroups.length} 个群`
  }
  if (friendStore.currentScope === CONTACT_SCOPE.INTIMACY) {
    const isCare = friendStore.currentTab === FRIEND_TAB.CARE
    const doType = isCare ? 1 : 2
    if (friendStore.intimacyErrors?.[doType]) return '人数暂不可用'
    if (!friendStore.careLoaded?.[doType]) return '正在获取人数'
    const count = isCare ? friendStore.careList.length : friendStore.careByList.length
    return `${count} 位`
  }
  if (friendStore.friendError) return '好友人数暂不可用'
  if (friendStore.loading || !friendStore.qqLoaded) return '正在获取好友'
  return `${friendStore.friends.length} 位好友`
})

const backupBusy = computed(() => backupStarting.value)
const backupMenuTitle = computed(() => {
  if (friendStore.currentScope === CONTACT_SCOPE.GROUPS) return '备份群与成员名单'
  if (friendStore.currentScope === CONTACT_SCOPE.INTIMACY) return '备份亲密度名单'
  return '备份好友名单'
})
const contactBackupOptions = computed(() => {
  const allContacts = {
    command: 'all',
    label: '备份全部联系人资料',
    description: '同时保存好友、群成员和亲密度名单',
    divided: true
  }

  if (friendStore.currentScope === CONTACT_SCOPE.GROUPS) {
    return [
      {
        command: 'groups',
        label: '备份全部群名单',
        description: '保存所有群及当前可读取的成员'
      },
      {
        command: 'current-group',
        label: '备份当前群成员',
        description: friendStore.selectedQQGroup
          ? `只保存「${friendStore.selectedQQGroup.name}」的可见成员`
          : '请先选择一个群',
        disabled: !friendStore.selectedQQGroup
      },
      allContacts
    ]
  }

  if (friendStore.currentScope === CONTACT_SCOPE.INTIMACY) {
    const currentLabel = friendStore.currentTab === FRIEND_TAB.CARE ? '我在意谁' : '谁在意我'
    return [
      {
        command: 'intimacy',
        label: '备份全部亲密度名单',
        description: '同时保存「我在意谁」和「谁在意我」'
      },
      {
        command: 'current-intimacy',
        label: `备份「${currentLabel}」`,
        description: '只保存当前正在查看的名单'
      },
      allContacts
    ]
  }

  const selectedGroupIsSpecific = friendStore.selectedGroupId !== friendStore.ALL_GROUP_ID
  return [
    {
      command: 'friends',
      label: '备份全部好友名单',
      description: '保存所有分组中的好友、备注和 QQ 号'
    },
    {
      command: 'current-friend-group',
      label: '备份当前分组名单',
      description: selectedGroupIsSpecific
        ? `只保存「${currentGroupName.value}」中的好友资料`
        : '请先选择一个具体分组',
      disabled: !selectedGroupIsSpecific
    },
    allContacts
  ]
})
const searchPlaceholder = computed(() =>
  friendStore.currentScope === CONTACT_SCOPE.GROUPS ? '群成员昵称或 QQ 号' : '搜索好友'
)
const searchAriaLabel = computed(() =>
  friendStore.currentScope === CONTACT_SCOPE.GROUPS
    ? '筛选当前群成员的昵称或 QQ 号'
    : '搜索好友昵称、备注或 QQ 号'
)
const groupMemberProgress = computed(
  () => friendStore.visibleQQGroupMembers.length + '/' + friendStore.filteredQQGroupMembers.length
)

const groupOptionLabel = (group) =>
  Number.isFinite(group.memberCount) ? group.name + ' (' + group.memberCount + ')' : group.name

const friendGroupOptionLabel = (group) =>
  group.gpid === friendStore.ALL_GROUP_ID
    ? friendStore.loading || !friendStore.qqLoaded
      ? '全部好友 · —'
      : `全部好友 · ${group.count} 位`
    : `${group.gpname} · ${group.count} 位`

const intimacyCount = (tab) => {
  const doType = tab === FRIEND_TAB.CARE ? 1 : 2
  if (!friendStore.careLoaded?.[doType]) return '-'
  return tab === FRIEND_TAB.CARE ? friendStore.careList.length : friendStore.careByList.length
}

const intimacyTabAriaLabel = (tab) => {
  const label = tab === FRIEND_TAB.CARE ? '我在意谁' : '谁在意我'
  const count = intimacyCount(tab)
  return count === '-' ? label : `${label}，${count} 位`
}

const handleEnterFromUin = (friend) => {
  rememberContactListPosition()
  emit('enter-friend', friend)
  isExpanded.value = false
}

// ===== 批量下载分组好友相册 =====
const batchActive = ref(false)
const batchCancelling = ref(false)
const batchCancelled = ref(false)
const batchProgress = ref({
  current: 0,
  total: 0,
  friendName: '',
  addedAlbums: 0,
  skippedAlbums: 0,
  failedFriends: 0
})

const batchScopeFriends = computed(() =>
  friendStore.friends.filter((friend) => friend.groupid === friendStore.selectedGroupId)
)
const batchScopeCount = computed(() => batchScopeFriends.value.length)

const canBatchDownload = computed(
  () =>
    friendStore.currentTab === FRIEND_TAB.QQ_GROUP &&
    friendStore.selectedGroupId !== friendStore.ALL_GROUP_ID &&
    batchScopeCount.value > 0
)

const currentGroupName = computed(() => {
  const opt = friendStore.groupOptions.find((o) => o.gpid === friendStore.selectedGroupId)
  return opt?.gpname || '当前分组'
})

const batchProgressPercent = computed(() => {
  const { current, total } = batchProgress.value
  if (!total) return 0
  return Math.min(100, Math.round((current / total) * 100))
})

const handleBatchDownload = async () => {
  if (!canBatchDownload.value || batchActive.value) return
  const friends = batchScopeFriends.value.slice()
  if (!friends.length) return

  const downloadBatch = await openDownloadBatchOptions({
    label: `好友分组：${currentGroupName.value}`,
    sourceType: 'friend-albums'
  })
  if (!downloadBatch) return

  batchActive.value = true
  batchCancelling.value = false
  batchCancelled.value = false
  batchProgress.value = {
    current: 0,
    total: friends.length,
    friendName: '',
    addedAlbums: 0,
    skippedAlbums: 0,
    failedFriends: 0
  }

  ElMessage.info(`开始批量下载分组「${currentGroupName.value}」(${friends.length} 位好友)`)
  let batchFinished = false

  try {
    for (let i = 0; i < friends.length; i++) {
      if (batchCancelled.value) break
      const friend = friends[i]
      batchProgress.value.current = i + 1
      batchProgress.value.friendName = stripEmoji(primaryName(friend)) || String(friend.uin)
      try {
        const counts = await downloadFriendAllAlbums(friend, downloadBatch)
        batchProgress.value.addedAlbums += counts.added
        batchProgress.value.skippedAlbums += counts.skipped
      } catch (err) {
        console.error('[FriendDrawer] 批量下载好友失败', friend.uin, err)
        batchProgress.value.failedFriends += 1
      }
      if (!batchCancelled.value) await new Promise((r) => setTimeout(r, 200))
    }

    const { addedAlbums, skippedAlbums, failedFriends } = batchProgress.value
    const batchSummary = await finishDownloadBatch(downloadBatch, batchCancelled.value)
    batchFinished = true
    if (batchCancelled.value) {
      ElMessage.warning(`已取消批量下载；${batchSummaryText(batchSummary)}`)
    } else if (addedAlbums > 0) {
      ElMessage.success(batchSummaryText(batchSummary))
      downloadStore.showManager()
    } else if (batchSummary?.scanned > 0 && batchSummary?.matched === 0) {
      ElMessage.warning(`所选日期没有匹配内容，共检查 ${batchSummary.scanned} 项`)
    } else {
      ElMessage.warning(
        `批量下载结束：未加入任何相册` +
          (skippedAlbums > 0 ? `（跳过 ${skippedAlbums} 个空/无权限相册）` : '') +
          (failedFriends > 0 ? `，${failedFriends} 位好友处理失败` : '')
      )
    }
  } catch (error) {
    console.error('[FriendDrawer] 好友分组批量下载失败', error)
    ElMessage.error('好友分组批量下载失败，请重试')
  } finally {
    if (!batchFinished) await finishDownloadBatch(downloadBatch, true).catch(() => null)
    batchActive.value = false
    batchCancelling.value = false
    batchCancelled.value = false
  }
}

const cancelBatchDownload = () => {
  if (!batchActive.value || batchCancelling.value) return
  batchCancelling.value = true
  batchCancelled.value = true
  ElMessage.info('正在停止批量下载（当前相册完成后停止）...')
}

// 拉取好友全部相册列表；以服务端总数/游标为终点，不设会截断大空间的固定页数。
const fetchAllAlbumsForFriend = async (friendUin) => {
  const collected = []
  const seen = new Set()
  const pageNum = 100
  let pageStart = 0

  while (!batchCancelled.value) {
    if (batchCancelled.value) break
    try {
      const res = await retryPageRequest(
        () =>
          window.QzoneAPI.getPhotoList(
            { hostUin: friendUin, pageStart, pageNum },
            { skipAuthCheck: true }
          ),
        { attempts: 3, delayMs: 400 }
      )
      if (res?.code !== undefined && res.code !== 0) break
      const data = res?.data || {}
      let albums = []
      if (Array.isArray(data.albumListModeSort) && data.albumListModeSort.length) {
        albums = data.albumListModeSort
      } else if (Array.isArray(data.albumListModeClass) && data.albumListModeClass.length) {
        albums = data.albumListModeClass.flatMap((c) => c.albumList || [])
      } else if (Array.isArray(data.albumList)) {
        albums = data.albumList
      }

      for (const a of albums) {
        if (a?.id && !seen.has(a.id)) {
          seen.add(a.id)
          collected.push(a)
        }
      }

      const total = Number(data.albumsInUser) || 0
      const nextPageStartValue = Number(data.nextPageStartModeSort ?? data.nextPageStart)
      const nextPageStart =
        Number.isFinite(nextPageStartValue) && nextPageStartValue > pageStart
          ? nextPageStartValue
          : pageStart + albums.length
      const hasMore = shouldContinuePagination({
        serverHasMore: data.hasMore ?? data.hasmore,
        cursorMoved: nextPageStart > pageStart,
        itemCount: albums.length,
        pageSize: pageNum,
        nextOffset: nextPageStart,
        total
      })
      if (!hasMore) break
      pageStart = nextPageStart
      await new Promise((r) => setTimeout(r, 80))
    } catch (err) {
      console.error('[FriendDrawer] 拉取好友相册列表失败', friendUin, err)
      break
    }
  }
  return collected
}

// 流式获取好友某相册照片并加入下载队列
const downloadFriendAllAlbums = async (friend, downloadBatch = null) => {
  let added = 0
  let skipped = 0

  const albums = await fetchAllAlbumsForFriend(friend.uin)
  if (!albums.length) return { added, skipped }

  for (const album of albums) {
    if (batchCancelled.value) break
    if (downloadStore.isAlbumDownloading(album.id) || downloadStore.isAlbumFetching(album.id)) {
      skipped++
      continue
    }

    downloadStore.startAlbumFetch(album.id, album.total || 0)
    let addedPhotos = 0
    let pageStart = 0
    const batchSize = 100

    while (!batchCancelled.value) {
      try {
        const detail = await retryPageRequest(
          () =>
            window.QzoneAPI.getPhotoByTopicId(
              { hostUin: friend.uin, topicId: album.id, pageStart, pageNum: batchSize },
              { skipAuthCheck: true }
            ),
          { attempts: 3, delayMs: 400 }
        )
        if (detail?.code !== undefined && detail.code !== 0) break

        const photoData = detail?.data || {}
        const photoList = Array.isArray(photoData.photoList) ? photoData.photoList : []
        const nextPageStartValue = Number(photoData.nextPageStart)
        const nextPageStart =
          Number.isFinite(nextPageStartValue) && nextPageStartValue >= pageStart
            ? nextPageStartValue
            : pageStart + batchSize
        const totalPhotos = Number(album.total)
        const hasMore = shouldContinuePagination({
          serverHasMore: photoData.hasMore,
          cursorMoved: nextPageStart > pageStart,
          itemCount: photoList.length,
          pageSize: batchSize,
          nextOffset: nextPageStart,
          total: totalPhotos
        })

        if (photoList.length > 0) {
          const result = await window.QzoneAPI.download.addAlbum({
            album: {
              id: album.id,
              name: generateUniqueAlbumName(album),
              total: album.total,
              desc: album.desc
            },
            photos: photoList,
            uin: resolveSelfQzoneUin(userStore) || 'unknown',
            albumId: album.id,
            friendUin: friend.uin,
            batch: downloadBatch
          })
          addedPhotos += batchTaskIds(result).length
        }

        const processedCount =
          Number.isFinite(totalPhotos) && totalPhotos > 0
            ? Math.min(totalPhotos, nextPageStart)
            : nextPageStart
        downloadStore.updateFetchProgress(album.id, processedCount)

        if (!hasMore) break
        pageStart = nextPageStart
        await new Promise((r) => setTimeout(r, 100))
      } catch (err) {
        console.error('[FriendDrawer] 拉取相册照片失败', album.id, err)
        break
      }
    }

    downloadStore.setAlbumFetching(album.id, false)
    downloadStore.resetAlbumState(album.id)
    if (addedPhotos > 0) added++
    else skipped++
    await new Promise((r) => setTimeout(r, 150))
  }

  return { added, skipped }
}

const stripEmoji = (name) => (name || '').replace(/\[em\]e\d+\[\/em\]/g, '')
// 有备注：备注为主、昵称为辅；无备注：只显示昵称
const primaryName = (f) => (f.remark?.trim() ? f.remark : f.name || '')
const secondaryName = (f) =>
  f.remark?.trim() && f.name?.trim() && f.remark.trim() !== f.name.trim() ? f.name : ''
// QQ 接口返回 /30 小图，渲染时升级为 /100
const avatarUrl = (friend) => (friend.img || '').replace(/\/30(\?|$)/, '/100$1')

const handleContactListScroll = (event) => {
  const target = event.currentTarget
  friendStore.setScopeScrollPosition(friendStore.currentScope, target.scrollTop)
  if (friendStore.currentScope !== CONTACT_SCOPE.GROUPS) return
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 72) {
    friendStore.loadMoreQQGroupMembers()
  }
}

const rememberContactListPosition = () => {
  if (!contactListRef.value) return
  friendStore.setScopeScrollPosition(friendStore.currentScope, contactListRef.value.scrollTop)
}

const restoreContactListPosition = async (scope = friendStore.currentScope) => {
  await nextTick()
  if (!isExpanded.value || friendStore.currentScope !== scope || !contactListRef.value) return
  contactListRef.value.scrollTop = friendStore.scopeScrollPositions[scope] || 0
}

const resetContactListPosition = async (scope = friendStore.currentScope) => {
  friendStore.setScopeScrollPosition(scope, 0)
  await nextTick()
  if (friendStore.currentScope === scope && contactListRef.value) {
    contactListRef.value.scrollTop = 0
  }
}

const closeDrawer = () => {
  rememberContactListPosition()
  isExpanded.value = false
  nextTick(() => {
    const triggerMap = {
      [CONTACT_SCOPE.FRIENDS]: friendsTriggerRef.value,
      [CONTACT_SCOPE.GROUPS]: groupsTriggerRef.value,
      [CONTACT_SCOPE.INTIMACY]: intimacyTriggerRef.value
    }
    triggerMap[lastTriggerScope.value]?.focus?.()
  })
}

const handleDrawerEscape = (event) => {
  if (event.key !== 'Escape' || !isExpanded.value || enterByUinVisible.value) return
  const nestedPopups = document.querySelectorAll('.friend-group-popper, .contact-backup-popper')
  const hasVisibleNestedPopup = Array.from(nestedPopups).some((popup) => {
    const style = window.getComputedStyle(popup)
    return (
      popup.getClientRects().length > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    )
  })
  if (hasVisibleNestedPopup) return
  event.preventDefault()
  event.stopPropagation()
  closeDrawer()
}

const handleContactSearchInput = (value) => {
  const scope = friendStore.currentScope
  friendStore.setScopeSearchQuery(scope, value)
  if (scope === CONTACT_SCOPE.GROUPS) friendStore.resetQQGroupMemberPagination()
  resetContactListPosition(scope)
}

const handleFriendGroupChange = (groupId) => {
  friendStore.selectGroup(groupId)
  resetContactListPosition(CONTACT_SCOPE.FRIENDS)
}

const toggleDrawer = async (scope = friendStore.currentScope) => {
  lastTriggerScope.value = scope
  if (isExpanded.value && friendStore.currentScope === scope) {
    closeDrawer()
    return
  }

  if (isExpanded.value) rememberContactListPosition()
  isExpanded.value = true
  await friendStore.switchScope(scope)
  await restoreContactListPosition(scope)
  if (scope === CONTACT_SCOPE.FRIENDS && !friendStore.qqLoaded) {
    // 等面板滑入动画完成后再加载，避免 loading 状态变化导致动画卡顿
    setTimeout(async () => {
      await friendStore.fetchQQFriends()
      await restoreContactListPosition(scope)
    }, 350)
  }
}

onMounted(() => window.addEventListener('keydown', handleDrawerEscape, true))
onUnmounted(() => window.removeEventListener('keydown', handleDrawerEscape, true))

const drawerTabs = [FRIEND_TAB.CARE, FRIEND_TAB.CARE_BY]
const handleDrawerTabKeydown = (event, currentIndex) => {
  const key = event.key
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
  event.preventDefault()

  let nextIndex = currentIndex
  if (key === 'Home') nextIndex = 0
  else if (key === 'End') nextIndex = drawerTabs.length - 1
  else if (key === 'ArrowLeft')
    nextIndex = (currentIndex - 1 + drawerTabs.length) % drawerTabs.length
  else nextIndex = (currentIndex + 1) % drawerTabs.length

  friendStore.switchTab(drawerTabs[nextIndex])
  event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')?.[nextIndex]?.focus()
}

const handleEnter = (friend) => {
  rememberContactListPosition()
  emit('enter-friend', friend)
  isExpanded.value = false
}

const handleGroupMemberEnter = (member) => {
  handleEnter({
    ...member,
    name: member.name || member.remark || `QQ ${member.uin}`,
    source: 'qq-group',
    groupName: friendStore.selectedQQGroup?.name || ''
  })
}

const handleContactBackup = async (scope = 'all') => {
  if (backupBusy.value) return
  backupStarting.value = true
  try {
    const result = await friendStore.startContactBackup(scope, {
      onTaskCreated: () => downloadStore.showManager()
    })
    if (!result.success) {
      ElMessage.error(result.message)
      return
    }
    const fileCount = result?.fileNames?.length || 0
    if (result?.warningCount) {
      ElMessage.warning(
        `已保存 ${fileCount} 个文件；${result.warningCount} 项暂时无法读取，其他可用内容已保留`
      )
    } else {
      ElMessage.success(`已保存 ${fileCount} 个备份文件，可在下载管理中打开位置`)
    }
  } finally {
    backupStarting.value = false
  }
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
  padding: 0;
  border: 0;
  background: transparent;
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
  position: relative;
  z-index: 101;
  padding: 6px 8px 8px;
  display: flex;
  align-items: center;
  border-radius: var(--theme-radius-lg);
}

.drawer-trigger:focus-visible {
  outline: 2px solid var(--theme-focus);
  outline-offset: -2px;
}

.drawer-back-slot {
  width: 36px;
  flex: 0 0 36px;
  margin-right: 8px;
  opacity: 1;
  transform: translateX(0) scale(1);
  overflow: hidden;
  transition:
    width 0.18s ease,
    flex-basis 0.18s ease,
    margin-right 0.18s ease,
    opacity 0.16s ease,
    transform 0.18s ease;
}

.drawer-back-slot:not(.visible) {
  width: 0;
  flex-basis: 0;
  margin-right: 0;
  opacity: 0;
  transform: translateX(-6px) scale(0.96);
}

.drawer-back-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--theme-border-strong);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface-soft);
  color: var(--theme-text-secondary);
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.drawer-back-btn:disabled {
  pointer-events: none;
}

.drawer-back-btn:hover {
  color: var(--theme-brand-accent);
  border-color: var(--theme-brand-border);
  background: var(--theme-brand-soft);
  box-shadow: 0 0 0 3px var(--theme-focus-ring);
}

.drawer-back-btn .el-icon {
  font-size: 15px;
}

.contact-trigger-group {
  width: 100%;
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.trigger-bar {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 36px;
  min-height: 36px;
  padding: 7px 6px;
  appearance: none;
  border-radius: var(--theme-radius-lg);
  border: 1px solid var(--theme-border-subtle);
  background: var(--theme-surface-soft);
  color: var(--theme-text-muted);
  font: inherit;
  cursor: pointer;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft);
  user-select: none;
}

.trigger-bar:hover {
  border-color: var(--theme-border-strong);
  background: var(--theme-surface-hover);
  color: var(--theme-text-primary);
}

.trigger-bar.active {
  border-color: var(--theme-brand-border);
  background: var(--theme-brand-soft);
  color: var(--qz-active-text);
}

.trigger-icon {
  flex-shrink: 0;
}

.trigger-icon {
  color: inherit;
}

.trigger-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  color: inherit;
}

.drawer-trigger.compact .trigger-label {
  display: none;
}

.drawer-trigger.compact .trigger-bar {
  padding-right: 4px;
  padding-left: 4px;
}

/* ===== 展开面板 — 绝对定位向上弹出，覆盖整个菜单区域 ===== */
.drawer-panel {
  --contact-control-height: 34px;
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(145deg, var(--theme-material-highlight), transparent 30%),
    var(--theme-material-thick);
  -webkit-backdrop-filter: blur(var(--theme-material-blur-strong))
    saturate(var(--theme-material-saturation));
  backdrop-filter: blur(var(--theme-material-blur-strong))
    saturate(var(--theme-material-saturation));
  border: 1px solid var(--theme-material-border);
  border-bottom: none;
  border-radius: var(--theme-radius-lg) var(--theme-radius-lg) 0 0;
  box-shadow:
    inset 0 1px 0 var(--theme-material-highlight),
    var(--theme-shadow-lg);
  height: clamp(320px, 56vh, 560px);
  max-height: calc(100vh - 190px);
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  min-height: var(--contact-control-height);
  padding: 2px;
  margin: 0 9px 6px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border-subtle);
  border-radius: 6px;
  flex-shrink: 0;
}

.sub-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  height: calc(var(--contact-control-height) - 4px);
  min-height: calc(var(--contact-control-height) - 4px);
  padding: 0 6px;
  overflow: hidden;
  font-size: 12px;
  color: var(--theme-text-muted);
  appearance: none;
  border: 0;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.sub-tab:focus-visible,
.trigger-bar:focus-visible,
.contact-backup-btn:focus-visible,
.contact-inline-action:focus-visible,
.group-load-more:focus-visible,
.batch-cancel-btn:focus-visible,
.drawer-back-btn:focus-visible,
.drawer-friend-item:focus-visible {
  outline: 2px solid var(--theme-focus);
  outline-offset: 2px;
}

.tab-heart {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
}

.sub-tab-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-tab:hover {
  color: var(--theme-text-secondary);
}

.sub-tab.active {
  background: var(--theme-brand-soft);
  color: var(--qz-active-text);
  font-weight: 600;
}

/* ===== 分组选择器 ===== */
.drawer-group-select {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 9px 6px;
  min-height: var(--contact-control-height);
  padding: 0;
  flex-shrink: 0;
}

.drawer-group-select :deep(.el-select) {
  flex: 1;
  min-width: 0;
}

.contact-inline-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 0 0 auto;
  min-height: var(--contact-control-height);
  padding: 0 9px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  color: var(--theme-text-secondary);
  background: var(--theme-surface-soft);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.contact-inline-action svg,
.contact-inline-action .el-icon {
  flex: 0 0 auto;
}

.contact-inline-action span {
  white-space: nowrap;
}

.contact-inline-action:hover:not(:disabled) {
  color: var(--theme-text-primary);
  border-color: var(--theme-border-strong);
  background: var(--theme-surface-hover);
}

.contact-inline-action.download:not(:disabled) {
  color: var(--theme-brand-text);
  border-color: var(--theme-brand-border);
  background: var(--theme-brand-soft);
}

.contact-inline-action.download:hover:not(:disabled) {
  color: var(--qz-active-text);
  background: var(--theme-brand-soft-hover);
}

.contact-inline-action:disabled {
  color: var(--theme-text-subtle);
  border-color: var(--theme-border-subtle);
  background: var(--theme-surface-soft);
  cursor: not-allowed;
  opacity: 0.58;
}

.contact-inline-action.download {
  min-width: 58px;
}

.contact-inline-action.find-space {
  width: var(--contact-control-height);
  min-width: var(--contact-control-height);
  height: var(--contact-control-height);
  min-height: var(--contact-control-height);
  padding: 0;
}

/* 批量下载进度条 */
.batch-progress-strip {
  flex-shrink: 0;
  padding: 8px 10px 6px;
  background: var(--theme-brand-soft);
  border-bottom: 1px solid var(--theme-brand-border);
}

.batch-progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-spinner {
  font-size: 14px;
  color: var(--theme-brand-accent);
  flex-shrink: 0;
}

.batch-progress-texts {
  flex: 1;
  min-width: 0;
}

.batch-progress-line {
  font-size: 11px;
  color: var(--theme-text-primary);
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-progress-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 10px;
  color: var(--theme-text-muted);
  line-height: 1.25;
}

.batch-progress-friend {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-brand-text);
}

.batch-progress-stat {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.batch-cancel-btn {
  flex-shrink: 0;
  border: 1px solid var(--theme-border);
  background: var(--theme-surface-soft);
  color: var(--theme-text-secondary);
  font-size: 12px;
  padding: 6px 12px;
  min-height: 28px;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.batch-cancel-btn:hover:not(:disabled) {
  border-color: var(--theme-danger-border);
  color: var(--theme-danger-text);
}

.batch-cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-progress-bar {
  margin-top: 6px;
  height: 3px;
  background: var(--theme-border-subtle);
  border-radius: 2px;
  overflow: hidden;
}

.batch-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--theme-brand) 0%, var(--theme-brand-accent) 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.drawer-group-select :deep(.el-select__wrapper) {
  background: var(--theme-surface-soft);
  border: 0;
  box-shadow: 0 0 0 1px var(--theme-border) inset;
  min-height: var(--contact-control-height);
  border-radius: 6px;
}

.drawer-group-select :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--theme-border-strong) inset;
}

.drawer-group-select :deep(.el-select__wrapper.is-focused) {
  box-shadow:
    0 0 0 1px var(--theme-brand-accent) inset,
    0 0 0 2px color-mix(in srgb, var(--theme-focus-ring) 72%, transparent);
}

.drawer-group-select :deep(.el-select__input:focus-visible) {
  outline: none;
}

.drawer-group-select :deep(.el-select.is-loading .el-select__caret) {
  color: var(--theme-brand-accent);
  animation: group-select-loading 0.8s linear infinite;
}

.drawer-group-select :deep(.el-select__placeholder),
.drawer-group-select :deep(.el-select__placeholder span) {
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.drawer-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 10px 6px;
  flex-shrink: 0;
}

.drawer-search :deep(.el-input) {
  flex: 1;
  min-width: 0;
}

.drawer-search :deep(.el-input__wrapper) {
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border-subtle);
  box-shadow: none;
  height: var(--contact-control-height);
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.drawer-search :deep(.el-input__wrapper:hover),
.drawer-search :deep(.el-input__wrapper.is-focus) {
  border-color: var(--theme-brand-border);
}

.drawer-search :deep(.el-input__inner) {
  color: var(--theme-text-primary);
  font-size: 11px;
}

.drawer-search :deep(.el-input__inner::placeholder) {
  color: var(--ds-text-quaternary);
}

.drawer-search :deep(.el-input__prefix .el-icon) {
  color: var(--theme-text-muted);
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
  background: var(--theme-border-subtle);
  border-radius: 3px;
}

.drawer-list::-webkit-scrollbar-thumb:hover {
  background: var(--theme-border-strong);
}

.drawer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 40px 0;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.group-members-loading {
  min-height: 128px;
  padding-inline: 14px;
  text-align: center;
}

.group-pick-empty {
  display: flex;
  min-height: 176px;
  padding: 24px 20px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--theme-text-muted);
  text-align: center;
}

.group-pick-empty strong {
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 650;
}

.group-pick-empty > span:last-child {
  max-width: 260px;
  font-size: 11px;
  line-height: 1.55;
}

.group-pick-icon {
  display: inline-flex;
  width: 42px;
  height: 42px;
  margin-bottom: 2px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--theme-material-border);
  border-radius: 14px;
  color: var(--theme-brand-accent);
  background:
    linear-gradient(145deg, var(--theme-material-highlight), transparent 55%),
    var(--theme-material-thin);
  box-shadow:
    inset 0 1px var(--theme-material-highlight),
    var(--theme-shadow-sm);
  -webkit-backdrop-filter: blur(var(--theme-material-blur));
  backdrop-filter: blur(var(--theme-material-blur));
}

.drawer-loading .el-icon {
  color: var(--theme-brand-accent);
}

@keyframes group-select-loading {
  to {
    transform: rotate(360deg);
  }
}

.tab-loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--theme-surface) 72%, transparent);
  z-index: 2;
  border-radius: 6px;
}

.tab-loading-overlay .el-icon {
  font-size: 18px;
  color: var(--theme-brand-accent);
}

/* ===== 好友项 ===== */
.drawer-friend-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  width: 100%;
  border-radius: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.drawer-friend-item:hover {
  background: var(--theme-surface-hover);
}

.drawer-friend-item.active {
  background: var(--theme-brand-soft);
}
.drawer-friend-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--theme-brand-accent);
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
  color: var(--theme-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
  font-weight: 500;
}

.friend-sub {
  font-size: 10px;
  color: var(--theme-text-muted);
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
  background: var(--theme-success);
  flex-shrink: 0;
  box-shadow: 0 0 4px var(--theme-success-border);
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
  color: var(--theme-border-subtle);
  transition: color 0.15s ease;
}

.drawer-friend-item:hover .score-heart,
.drawer-friend-item.active .score-heart {
  color: var(--theme-danger);
}

.score-value {
  font-size: 11px;
  color: var(--theme-border-strong);
  font-variant-numeric: tabular-nums;
  transition: color 0.15s ease;
}

.drawer-friend-item:hover .score-value {
  color: var(--theme-text-muted);
}

.drawer-friend-item.active .score-value {
  color: var(--theme-danger);
}

.drawer-empty {
  text-align: center;
  margin: 8px 4px;
  padding: 24px 12px;
  color: var(--theme-text-muted);
  border: 1px dashed var(--theme-border-subtle);
  border-radius: var(--theme-radius-md);
  background: var(--theme-surface-soft);
  font-size: 12px;
}

/* ===== 联系人面板标题 ===== */
.contact-panel-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin: 7px 9px 5px;
  padding: 3px 2px;
}

.contact-panel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--theme-brand-accent);
  background: color-mix(in srgb, var(--theme-brand-soft-hover) 72%, transparent);
}

.contact-panel-icon {
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border-subtle);
  border-radius: 8px;
}

.contact-panel-heading-text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.contact-panel-heading-text strong {
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-panel-heading-text span {
  display: block;
  overflow: hidden;
  margin-top: 1px;
  color: var(--theme-text-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-backup-dropdown {
  flex: 0 0 auto;
  min-width: 0;
}

.contact-backup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex-shrink: 0;
  min-width: 84px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--theme-border);
  border-radius: 7px;
  color: var(--theme-text-secondary);
  background: var(--theme-surface-raised);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.contact-backup-btn span {
  white-space: nowrap;
}

.contact-backup-btn .backup-chevron {
  color: var(--theme-text-subtle);
  transition: transform var(--ds-dur-fast) var(--ds-ease-soft);
}

.contact-backup-dropdown:deep(.el-tooltip__trigger[aria-expanded='true']) .backup-chevron {
  transform: rotate(180deg);
}

.contact-backup-btn:hover:not(:disabled) {
  color: var(--theme-text-primary);
  border-color: var(--theme-brand-border);
  background: var(--theme-brand-soft-hover);
}

.contact-backup-btn:disabled {
  opacity: 0.72;
  cursor: progress;
}

.qq-group-chevron {
  flex-shrink: 0;
  color: var(--theme-border-strong);
}

.drawer-friend-item:hover .qq-group-chevron {
  color: var(--theme-brand-accent);
}

.group-load-more {
  width: calc(100% - 8px);
  min-height: 34px;
  margin: 6px 4px 2px;
  border: 1px solid var(--theme-info-border);
  border-radius: 7px;
  color: var(--theme-info-text);
  background: var(--theme-info-soft);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition:
    color var(--ds-dur-fast) var(--ds-ease-soft),
    background-color var(--ds-dur-fast) var(--ds-ease-soft),
    border-color var(--ds-dur-fast) var(--ds-ease-soft);
}

.group-load-more span {
  margin-left: 5px;
  color: var(--theme-text-muted);
  font-variant-numeric: tabular-nums;
}

.group-load-more:hover {
  border-color: var(--theme-info);
  color: var(--theme-text-primary);
  background: color-mix(in srgb, var(--theme-info-soft) 80%, var(--theme-info) 20%);
}

.drawer-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 2px 4px 6px;
  padding: 7px 8px;
  border-radius: 6px;
  color: var(--theme-danger-text);
  background: var(--theme-danger-soft);
  border: 1px solid var(--theme-danger-border);
  font-size: 11px;
}

.drawer-error button {
  flex-shrink: 0;
  padding: 3px 7px;
  border: 1px solid var(--theme-danger-border);
  border-radius: 5px;
  color: var(--theme-danger-text);
  background: color-mix(in srgb, var(--theme-danger-soft) 72%, var(--theme-surface) 28%);
  cursor: pointer;
  font: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .drawer-overlay,
  .drawer-back-slot,
  .drawer-back-btn,
  .trigger-bar,
  .contact-backup-btn,
  .contact-inline-action,
  .drawer-panel,
  .sub-tab,
  .drawer-friend-item,
  .group-load-more,
  .score-heart,
  .score-value {
    animation: none !important;
    transition: none !important;
  }

  .batch-spinner {
    animation: none !important;
  }

  .drawer-group-select :deep(.el-select.is-loading .el-select__caret) {
    animation: none !important;
  }

  .drawer-friend-item:hover {
    transform: none !important;
  }
}
</style>

<style>
.friend-group-popper.el-popper {
  background: var(--theme-surface-overlay);
  border: 1px solid var(--theme-border);
}

.friend-group-popper .el-select-dropdown__item {
  color: var(--theme-text-secondary);
  font-size: 12px;
  height: 28px;
  line-height: 28px;
  padding: 0 12px;
}

.friend-group-popper .group-option-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-group-popper .el-select-dropdown__item.is-hovering {
  background: var(--theme-surface-hover);
  color: var(--theme-text-primary);
}

.friend-group-popper .el-select-dropdown__item.is-selected {
  color: var(--theme-brand-accent);
  font-weight: 600;
  background: var(--theme-brand-soft);
}

.contact-backup-popper.el-popper {
  min-width: 272px;
  background: var(--theme-surface-overlay);
  border: 1px solid var(--theme-border);
}

.contact-backup-menu-intro {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 4px 4px 2px;
  padding: 7px 9px 9px;
  border-bottom: 1px solid var(--theme-border-subtle);
}

.contact-backup-menu-intro strong {
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
}

.contact-backup-menu-intro span {
  color: var(--theme-text-muted);
  font-size: 9px;
  line-height: 1.55;
}

.contact-backup-popper .el-dropdown-menu {
  padding: 4px;
  background: transparent;
}

.contact-backup-popper .el-dropdown-menu__item {
  min-height: 44px;
  padding: 5px 9px;
  border-radius: 5px;
  color: var(--theme-text-secondary);
  font-size: 11px;
}

.contact-backup-option-icon {
  flex: 0 0 auto;
  margin-right: 8px;
  color: var(--theme-text-muted);
}

.contact-backup-option {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.contact-backup-option strong,
.contact-backup-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-backup-option strong {
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
}

.contact-backup-option span {
  color: var(--theme-text-subtle);
  font-size: 9px;
  line-height: 1.45;
}

.contact-backup-popper .el-dropdown-menu__item.is-disabled .contact-backup-option strong,
.contact-backup-popper .el-dropdown-menu__item.is-disabled .contact-backup-option span {
  color: var(--theme-border-strong);
}

.contact-backup-popper .el-dropdown-menu__item:not(.is-disabled):focus,
.contact-backup-popper .el-dropdown-menu__item:not(.is-disabled):hover {
  color: var(--theme-text-primary);
  background: var(--theme-surface-hover);
}

.contact-backup-popper
  .el-dropdown-menu__item:not(.is-disabled):hover
  .contact-backup-option
  strong {
  color: var(--theme-text-primary);
}
</style>
