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
              aria-label="选择联系人名单备份范围"
              title="备份好友、群成员或亲密度名单，不包含相册"
            >
              <el-icon v-if="backupBusy" class="is-loading"><Loading /></el-icon>
              <DatabaseBackup v-else :size="13" />
              <span>{{ backupButtonText }}</span>
              <ChevronDown v-if="!backupBusy" :size="11" />
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="option in contactBackupOptions"
                  :key="option.command"
                  :command="option.command"
                  :disabled="option.disabled"
                  :divided="option.divided"
                >
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
            <span>我在意谁</span>
          </button>
          <button
            class="sub-tab"
            :class="{ active: friendStore.currentTab === FRIEND_TAB.CARE_BY }"
            type="button"
            role="tab"
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
            <span>谁在意我</span>
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
            @change="handleFriendGroupChange"
          >
            <el-option
              v-for="opt in friendStore.groupOptions"
              :key="opt.gpid"
              :value="opt.gpid"
              :label="`${opt.gpname} (${opt.count})`"
            />
          </el-select>
          <el-tooltip
            :content="
              canBatchDownload
                ? `下载分组「${currentGroupName}」的好友相册（${batchScopeCount} 人）`
                : '请先选择一个具体好友分组'
            "
            placement="top"
            :show-after="300"
          >
            <button
              class="batch-group-btn"
              type="button"
              :class="{ active: batchActive }"
              :disabled="!canBatchDownload || batchActive"
              :aria-label="`下载分组 ${currentGroupName} 的全部好友相册`"
              @click="handleBatchDownload"
            >
              <Images :size="13" />
              <span>相册下载</span>
            </button>
          </el-tooltip>
        </div>

        <div v-if="friendStore.currentScope === CONTACT_SCOPE.GROUPS" class="drawer-group-select">
          <el-select
            :model-value="friendStore.selectedQQGroup?.id || ''"
            size="small"
            placement="bottom-start"
            popper-class="friend-group-popper"
            placeholder="选择群"
            filterable
            @change="friendStore.selectQQGroupById"
          >
            <el-option
              v-for="group in friendStore.qqGroups"
              :key="group.id"
              :value="group.id"
              :label="groupOptionLabel(group)"
            />
          </el-select>
        </div>

        <!-- 搜索 + 输入 QQ 号入口 -->
        <div class="drawer-search">
          <el-input
            v-model="friendStore.searchQuery"
            :placeholder="searchPlaceholder"
            :prefix-icon="Search"
            size="small"
            clearable
            @input="handleContactSearchInput"
          />
          <el-tooltip content="查找 QQ 号并进入好友空间" placement="top" :show-after="300">
            <button
              class="enter-by-uin-btn"
              type="button"
              aria-label="查找 QQ 号并进入好友空间"
              @click="enterByUinVisible = true"
            >
              <UserSearch :size="15" />
            </button>
          </el-tooltip>
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
            <div
              v-for="friend in friendStore.filteredList"
              :key="friend.uin"
              class="drawer-friend-item"
              :class="{ active: activeFriend?.uin === friend.uin }"
              role="button"
              tabindex="0"
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
            <div
              v-if="friendStore.filteredList.length === 0 && !friendStore.currentListError"
              class="drawer-empty"
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
            <div
              v-if="friendStore.groupLoading || friendStore.groupMembersLoading"
              class="drawer-loading"
              role="status"
              aria-live="polite"
            >
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>{{ friendStore.groupLoading ? '正在加载群...' : '正在加载群成员...' }}</span>
            </div>
            <template v-else>
              <div v-if="friendStore.groupError" class="drawer-error" role="alert">
                <span>{{ friendStore.groupError }}</span>
                <button type="button" @click="friendStore.retryQQGroups()">重试</button>
              </div>

              <template v-if="friendStore.selectedQQGroup">
                <div
                  v-for="member in friendStore.visibleQQGroupMembers"
                  :key="member.uin"
                  class="drawer-friend-item"
                  :class="{ active: activeFriend?.uin === member.uin }"
                  role="button"
                  tabindex="0"
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
                </div>
                <div
                  v-if="!friendStore.groupError && friendStore.filteredQQGroupMembers.length === 0"
                  class="drawer-empty"
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
              <div v-else-if="!friendStore.groupError" class="drawer-empty">暂无可见群</div>
            </template>
          </div>
        </template>
      </div>
    </transition>

    <!-- 输入 QQ 号进入空间 -->
    <EnterByUinDialog v-model:visible="enterByUinVisible" @enter-friend="handleEnterFromUin" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Search, Loading } from '@element-plus/icons-vue'
import {
  ChevronDown,
  ChevronRight,
  DatabaseBackup,
  HeartHandshake,
  Images,
  Users,
  UserSearch,
  UsersRound
} from '@lucide/vue'
import { useFriendStore, FRIEND_TAB, CONTACT_SCOPE } from '@renderer/store/friend.store'
import { useUserStore } from '@renderer/store/user.store'
import { useDownloadStore } from '@renderer/store/download.store'
import { copyToClipboard, generateUniqueAlbumName } from '@renderer/utils'
import { resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'
import { retryPageRequest, shouldContinuePagination } from '@renderer/utils/paginationGuard'
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
    return friendStore.selectedQQGroup
      ? friendStore.qqGroups.length + ' 个群 · ' + friendStore.groupMembers.length + ' 位可见成员'
      : friendStore.qqGroups.length + ' 个群'
  }
  if (friendStore.currentScope === CONTACT_SCOPE.INTIMACY) {
    return '在意 ' + friendStore.careList.length + ' · 被在意 ' + friendStore.careByList.length
  }
  return friendStore.friends.length + ' 位好友'
})

const backupBusy = computed(() => backupStarting.value)
const backupButtonText = computed(() => (backupStarting.value ? '备份中' : '名单备份'))
const contactBackupOptions = computed(() => {
  const allContacts = {
    command: 'all',
    label: '全部联系人资料',
    description: '好友、群成员和亲密度，不含相册',
    divided: true
  }

  if (friendStore.currentScope === CONTACT_SCOPE.GROUPS) {
    return [
      {
        command: 'groups',
        label: '全部群与成员',
        description: '所有群列表和可见成员，不含相册'
      },
      {
        command: 'current-group',
        label: '当前群成员',
        description: friendStore.selectedQQGroup
          ? `仅备份「${friendStore.selectedQQGroup.name}」的可见成员`
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
        label: '全部亲密度名单',
        description: '包含「我在意谁」和「谁在意我」'
      },
      {
        command: 'current-intimacy',
        label: '当前亲密度名单',
        description: `只备份「${currentLabel}」`
      },
      allContacts
    ]
  }

  const selectedGroupIsSpecific = friendStore.selectedGroupId !== friendStore.ALL_GROUP_ID
  return [
    {
      command: 'friends',
      label: '全部好友名单',
      description: '备份所有好友分组，不含相册'
    },
    {
      command: 'current-friend-group',
      label: '当前好友分组',
      description: selectedGroupIsSpecific
        ? `仅备份「${currentGroupName.value}」名单，不含相册`
        : '请先选择一个具体分组',
      disabled: !selectedGroupIsSpecific
    },
    allContacts
  ]
})
const searchPlaceholder = computed(() =>
  friendStore.currentScope === CONTACT_SCOPE.GROUPS
    ? '搜索群成员昵称或 QQ 号...'
    : '搜索备注、昵称或 QQ 号...'
)
const groupMemberProgress = computed(
  () => friendStore.visibleQQGroupMembers.length + '/' + friendStore.filteredQQGroupMembers.length
)

const groupOptionLabel = (group) =>
  Number.isFinite(group.memberCount) ? group.name + ' (' + group.memberCount + ')' : group.name

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

  try {
    await ElMessageBox.confirm(
      `即将批量下载分组「${currentGroupName.value}」中 ${friends.length} 位好友的全部相册，` +
        `期间将逐位拉取相册并加入下载队列，可点击进度栏「取消」中途停止。是否继续？`,
      '批量下载分组相册',
      {
        confirmButtonText: '开始下载',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

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

  for (let i = 0; i < friends.length; i++) {
    if (batchCancelled.value) break
    const friend = friends[i]
    batchProgress.value.current = i + 1
    batchProgress.value.friendName = stripEmoji(primaryName(friend)) || String(friend.uin)
    try {
      const counts = await downloadFriendAllAlbums(friend)
      batchProgress.value.addedAlbums += counts.added
      batchProgress.value.skippedAlbums += counts.skipped
    } catch (err) {
      console.error('[FriendDrawer] 批量下载好友失败', friend.uin, err)
      batchProgress.value.failedFriends += 1
    }
    if (!batchCancelled.value) await new Promise((r) => setTimeout(r, 200))
  }

  const { addedAlbums, skippedAlbums, failedFriends } = batchProgress.value
  if (batchCancelled.value) {
    ElMessage.warning(`已取消批量下载，已加入 ${addedAlbums} 个相册`)
  } else if (addedAlbums > 0) {
    ElMessage.success(
      `分组「${currentGroupName.value}」批量下载完成！成功加入 ${addedAlbums} 个相册` +
        (skippedAlbums > 0 ? `，跳过 ${skippedAlbums} 个空/无权限相册` : '') +
        (failedFriends > 0 ? `，${failedFriends} 位好友处理失败` : '')
    )
    downloadStore.showManager()
  } else {
    ElMessage.warning(
      `批量下载结束：未加入任何相册` +
        (skippedAlbums > 0 ? `（跳过 ${skippedAlbums} 个空/无权限相册）` : '') +
        (failedFriends > 0 ? `，${failedFriends} 位好友处理失败` : '')
    )
  }

  batchActive.value = false
  batchCancelling.value = false
  batchCancelled.value = false
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
const downloadFriendAllAlbums = async (friend) => {
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
          await window.QzoneAPI.download.addAlbum({
            album: {
              id: album.id,
              name: generateUniqueAlbumName(album),
              total: album.total,
              desc: album.desc
            },
            photos: photoList,
            uin: resolveSelfQzoneUin(userStore) || 'unknown',
            albumId: album.id,
            friendUin: friend.uin
          })
          addedPhotos += photoList.length
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
  border-radius: var(--ds-radius-lg);
}

.drawer-trigger:focus-visible {
  outline: 2px solid var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
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
  border: 1px solid rgba(96, 165, 250, 0.54);
  border-radius: var(--ds-radius-lg);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.26), rgba(59, 130, 246, 0.1));
  box-shadow: inset 3px 0 0 #60a5fa;
  color: #bfdbfe;
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.drawer-back-btn:disabled {
  pointer-events: none;
}

.drawer-back-btn:hover {
  color: #fff;
  border-color: rgba(96, 165, 250, 0.78);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.36), rgba(59, 130, 246, 0.16));
  box-shadow:
    inset 3px 0 0 #93c5fd,
    0 0 0 3px rgba(96, 165, 250, 0.08);
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
  min-height: 36px;
  padding: 7px 6px;
  appearance: none;
  border-radius: var(--ds-radius-lg);
  border: 1px solid rgba(96, 165, 250, 0.28);
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.08) 0%, rgba(96, 165, 250, 0.03) 100%);
  color: rgba(255, 255, 255, 0.58);
  font: inherit;
  cursor: pointer;
  transition: var(--ds-transition-all);
  user-select: none;
}

.trigger-bar:hover,
.trigger-bar.active {
  border-color: var(--qz-active-border, rgba(251, 146, 60, 0.38));
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.16) 0%, rgba(249, 115, 22, 0.06) 100%);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.06);
}

.trigger-icon {
  flex-shrink: 0;
}

.trigger-icon.friend {
  color: #f87171;
}

.trigger-icon.group {
  color: #60a5fa;
}

.trigger-icon.intimacy {
  color: #fb923c;
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

/* ===== 输入 QQ 号入口（搜索栏右侧小按钮） ===== */
.enter-by-uin-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--qz-active-border, rgba(251, 146, 60, 0.38));
  border-radius: 6px;
  background: var(--qz-active-soft, rgba(249, 115, 22, 0.14));
  color: var(--qz-active, #fb923c);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  font-size: 13px;
}

.enter-by-uin-btn:hover {
  background: rgba(249, 115, 22, 0.22);
  border-color: var(--qz-active, #fb923c);
  transform: scale(1.05);
}

.enter-by-uin-btn:active {
  transform: scale(0.95);
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
  padding: 7px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  appearance: none;
  border: 0;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  white-space: nowrap;
}

.sub-tab:focus-visible,
.trigger-bar:focus-visible,
.contact-backup-btn:focus-visible,
.group-load-more:focus-visible,
.batch-group-btn:focus-visible,
.enter-by-uin-btn:focus-visible,
.batch-cancel-btn:focus-visible,
.drawer-back-btn:focus-visible,
.drawer-friend-item:focus-visible {
  outline: 2px solid var(--qz-focus-ring, rgba(251, 146, 60, 0.72));
  outline-offset: 2px;
}

.tab-heart {
  width: 10px;
  height: 10px;
}

.sub-tab:hover {
  color: rgba(255, 255, 255, 0.6);
}

.sub-tab.active {
  background: var(--qz-active-soft, rgba(249, 115, 22, 0.14));
  color: var(--qz-active-text, #fed7aa);
  font-weight: 600;
}

/* ===== 分组选择器 ===== */
.drawer-group-select {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 10px 6px;
  flex-shrink: 0;
}

.drawer-group-select :deep(.el-select) {
  flex: 1;
  min-width: 0;
}

/* 当前好友分组相册下载 */
.batch-group-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 6px;
  background: rgba(96, 165, 250, 0.09);
  color: #bfdbfe;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
  font: inherit;
  font-size: 10px;
  white-space: nowrap;
}

.batch-group-btn:hover:not(:disabled) {
  border-color: rgba(96, 165, 250, 0.55);
  background: rgba(96, 165, 250, 0.16);
  color: #eff6ff;
}

.batch-group-btn:disabled,
.batch-group-btn.active {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 批量下载进度条 */
.batch-progress-strip {
  flex-shrink: 0;
  padding: 8px 10px 6px;
  background: rgba(249, 115, 22, 0.06);
  border-bottom: 1px solid var(--qz-active-border, rgba(251, 146, 60, 0.38));
}

.batch-progress-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-spinner {
  font-size: 14px;
  color: var(--qz-active, #fb923c);
  flex-shrink: 0;
}

.batch-progress-texts {
  flex: 1;
  min-width: 0;
}

.batch-progress-line {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.85);
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
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.25;
}

.batch-progress-friend {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--qz-active-text, #fed7aa);
}

.batch-progress-stat {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.batch-cancel-btn {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  padding: 6px 12px;
  min-height: 28px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.batch-cancel-btn:hover:not(:disabled) {
  border-color: rgba(248, 113, 113, 0.5);
  color: #f87171;
}

.batch-cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-progress-bar {
  margin-top: 6px;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.batch-progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #f87171 0%, #fb923c 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
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
  color: var(--ds-text-quaternary);
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    transform 0.12s ease;
}

.drawer-friend-item:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(2px);
}

.drawer-friend-item.active {
  background: var(--qz-active-soft, rgba(249, 115, 22, 0.14));
}
.drawer-friend-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--qz-active, #fb923c);
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

/* ===== 联系人面板标题 ===== */
.contact-panel-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin: 8px 10px 6px;
  padding: 7px 8px;
  border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 8px;
  background: rgba(249, 115, 22, 0.04);
}

.contact-panel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #93c5fd;
  background: rgba(96, 165, 250, 0.12);
}

.contact-panel-icon {
  width: 28px;
  height: 28px;
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
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-panel-heading-text span {
  overflow: hidden;
  margin-top: 1px;
  color: rgba(255, 255, 255, 0.34);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-backup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 4px;
  min-width: 82px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--qz-active-border, rgba(251, 146, 60, 0.34));
  border-radius: 7px;
  color: var(--qz-active-text, #fed7aa);
  background: var(--qz-active-soft, rgba(249, 115, 22, 0.12));
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.contact-backup-btn:hover:not(:disabled) {
  border-color: var(--qz-active, #fb923c);
  background: rgba(249, 115, 22, 0.2);
}

.contact-backup-btn:disabled {
  opacity: 0.72;
  cursor: progress;
}

.qq-group-chevron {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.2);
}

.drawer-friend-item:hover .qq-group-chevron {
  color: var(--qz-active, #fb923c);
}

.group-load-more {
  width: calc(100% - 8px);
  min-height: 34px;
  margin: 6px 4px 2px;
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.58);
  background: rgba(96, 165, 250, 0.06);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.group-load-more span {
  margin-left: 5px;
  color: rgba(255, 255, 255, 0.3);
  font-variant-numeric: tabular-nums;
}

.group-load-more:hover {
  border-color: rgba(96, 165, 250, 0.35);
  color: #bfdbfe;
  background: rgba(96, 165, 250, 0.1);
}

.drawer-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 2px 4px 6px;
  padding: 7px 8px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.58);
  background: rgba(248, 113, 113, 0.08);
  font-size: 11px;
}

.drawer-error button {
  flex-shrink: 0;
  padding: 3px 7px;
  border: 1px solid rgba(248, 113, 113, 0.24);
  border-radius: 5px;
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.08);
  cursor: pointer;
  font: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .drawer-overlay,
  .drawer-back-slot,
  .drawer-back-btn,
  .trigger-bar,
  .contact-backup-btn,
  .drawer-panel,
  .sub-tab,
  .batch-group-btn,
  .enter-by-uin-btn,
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

  .drawer-friend-item:hover,
  .batch-group-btn:hover,
  .enter-by-uin-btn:hover {
    transform: none !important;
  }
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

.contact-backup-popper.el-popper {
  min-width: 220px;
  background: rgba(22, 22, 26, 0.98);
  border: 1px solid rgba(96, 165, 250, 0.22);
}

.contact-backup-popper .el-dropdown-menu {
  padding: 4px;
  background: transparent;
}

.contact-backup-popper .el-dropdown-menu__item {
  min-height: 44px;
  padding: 5px 9px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
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
  color: rgba(255, 255, 255, 0.84);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.45;
}

.contact-backup-option span {
  color: rgba(255, 255, 255, 0.36);
  font-size: 9px;
  line-height: 1.45;
}

.contact-backup-popper .el-dropdown-menu__item.is-disabled .contact-backup-option strong,
.contact-backup-popper .el-dropdown-menu__item.is-disabled .contact-backup-option span {
  color: rgba(255, 255, 255, 0.22);
}

.contact-backup-popper .el-dropdown-menu__item:not(.is-disabled):focus,
.contact-backup-popper .el-dropdown-menu__item:not(.is-disabled):hover {
  color: #bfdbfe;
  background: rgba(96, 165, 250, 0.12);
}

.contact-backup-popper
  .el-dropdown-menu__item:not(.is-disabled):hover
  .contact-backup-option
  strong {
  color: #dbeafe;
}
</style>
