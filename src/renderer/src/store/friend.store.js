import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './user.store'
import { resolveSelfQzoneUin } from '@renderer/utils/qzone-identity'
import {
  normalizeQQGroupMembers,
  normalizeQQGroups,
  paginateQQGroupMembers,
  QQ_GROUP_MEMBER_PAGE_SIZE
} from '@shared/qq-group'

// 顶层 Tab：0=QQ 分组 1=我在意谁 2=谁在意我
export const FRIEND_TAB = { QQ_GROUP: 0, CARE: 1, CARE_BY: 2 }
export const CONTACT_SCOPE = {
  FRIENDS: 'friends',
  GROUPS: 'groups',
  INTIMACY: 'intimacy'
}
const ALL_GROUP_ID = -1

export const useFriendStore = defineStore('friend', () => {
  const userStore = useUserStore()

  const currentTab = ref(FRIEND_TAB.QQ_GROUP)
  const currentScope = ref(CONTACT_SCOPE.FRIENDS)
  const searchQuery = ref('')
  const scopeSearchQueries = ref({
    [CONTACT_SCOPE.FRIENDS]: '',
    [CONTACT_SCOPE.GROUPS]: '',
    [CONTACT_SCOPE.INTIMACY]: ''
  })
  const scopeScrollPositions = ref({
    [CONTACT_SCOPE.FRIENDS]: 0,
    [CONTACT_SCOPE.GROUPS]: 0,
    [CONTACT_SCOPE.INTIMACY]: 0
  })
  const intimacyTab = ref(FRIEND_TAB.CARE)
  const loading = ref(false)
  const tabLoading = ref(false)

  // === QQ 分组 + 好友 ===
  const groups = ref([]) // [{ gpid, gpname }]
  const friends = ref([]) // [{ uin, groupid, name, remark, img, yellow, online, v6 }]
  const selectedGroupId = ref(ALL_GROUP_ID)
  const qqLoaded = ref(false)
  const friendError = ref('')

  // === QQ 群 + 群成员（按需加载，不与好友分组混用） ===
  const qqGroups = ref([]) // [{ id, name, memberCount? }]
  const selectedQQGroup = ref(null)
  const groupMembers = ref([])
  const groupsLoaded = ref(false)
  const groupLoading = ref(false)
  const groupMembersLoading = ref(false)
  const groupError = ref('')
  const groupMemberCache = new Map()
  const completeGroupMemberCache = new Set()
  const preferredQQGroupId = ref('')
  const visibleGroupMemberLimit = ref(QQ_GROUP_MEMBER_PAGE_SIZE)

  // === 亲密度列表 ===
  const careList = ref([]) // 我在意谁
  const careByList = ref([]) // 谁在意我
  const careLoaded = ref({ 1: false, 2: false })
  const intimacyErrors = ref({ 1: '', 2: '' })

  const currentListError = computed(() => {
    if (currentTab.value === FRIEND_TAB.QQ_GROUP) return friendError.value
    const doType = currentTab.value === FRIEND_TAB.CARE ? 1 : 2
    return intimacyErrors.value[doType] || ''
  })
  const currentListLoaded = computed(() => {
    if (currentTab.value === FRIEND_TAB.QQ_GROUP) return qqLoaded.value
    return careLoaded.value[currentTab.value === FRIEND_TAB.CARE ? 1 : 2] === true
  })

  // 选中的好友 & 相册
  const selectedFriend = ref(null)
  const friendAlbums = ref([])
  const albumsLoading = ref(false)

  // 含"全部好友"的分组列表
  const groupOptions = computed(() => [
    { gpid: ALL_GROUP_ID, gpname: '全部好友', count: friends.value.length },
    ...groups.value.map((g) => ({
      gpid: g.gpid,
      gpname: g.gpname,
      count: friends.value.filter((f) => f.groupid === g.gpid).length
    }))
  ])

  // 当前 tab 对应的源数据
  const filteredList = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const match = (f) =>
      !q ||
      (f.name || '').toLowerCase().includes(q) ||
      (f.remark || '').toLowerCase().includes(q) ||
      String(f.uin).includes(q)

    if (currentTab.value === FRIEND_TAB.QQ_GROUP) {
      const base =
        selectedGroupId.value === ALL_GROUP_ID
          ? friends.value
          : friends.value.filter((f) => f.groupid === selectedGroupId.value)
      return base.filter(match)
    }
    const src = currentTab.value === FRIEND_TAB.CARE ? careList.value : careByList.value
    return src.filter(match)
  })

  const filteredQQGroupMembers = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return groupMembers.value
    return groupMembers.value.filter(
      (member) =>
        (member.name || '').toLowerCase().includes(q) ||
        (member.remark || '').toLowerCase().includes(q) ||
        member.uin.includes(q)
    )
  })

  const visibleQQGroupMembers = computed(() =>
    paginateQQGroupMembers(filteredQQGroupMembers.value, visibleGroupMemberLimit.value)
  )

  const hasMoreQQGroupMembers = computed(
    () => visibleQQGroupMembers.value.length < filteredQQGroupMembers.value.length
  )

  // 按 uin 去重，保留首个出现项
  const dedupByUin = (arr) => {
    const seen = new Set()
    const out = []
    for (const it of arr || []) {
      if (it?.uin == null || seen.has(it.uin)) continue
      seen.add(it.uin)
      out.push(it)
    }
    return out
  }

  // 获取 QQ 好友及分组
  const fetchQQFriends = async () => {
    loading.value = true
    friendError.value = ''
    try {
      const res = await window.QzoneAPI.getQQFriends(
        { hostUin: resolveSelfQzoneUin(userStore) },
        { skipAuthCheck: true }
      )
      if (res?.code !== undefined && Number(res.code) !== 0) {
        throw new Error('friend-list-unavailable')
      }
      if (!Array.isArray(res?.data?.items) && !Array.isArray(res?.data?.gpnames)) {
        throw new Error('friend-list-invalid')
      }
      // follow_flag=1 时"特别关心"的好友会在 items 里出现两次，按 uin 去重
      friends.value = dedupByUin(res?.data?.items)
      groups.value = res?.data?.gpnames || []
      qqLoaded.value = true
    } catch (error) {
      console.error('[FriendStore] 获取 QQ 好友失败:', error)
      friendError.value = '好友列表暂时无法加载，请稍后重试'
    } finally {
      loading.value = false
    }
  }

  const updateQQGroupCount = (groupId, count) => {
    qqGroups.value = qqGroups.value.map((group) =>
      group.id === groupId ? { ...group, memberCount: count } : group
    )
    if (selectedQQGroup.value?.id === groupId) {
      selectedQQGroup.value = { ...selectedQQGroup.value, memberCount: count }
    }
  }

  // 获取当前账号在 QQ 空间积分页可见的群。首屏附带的群成员会直接缓存。
  const fetchQQGroups = async ({ force = false } = {}) => {
    if (groupsLoaded.value && !force) return qqGroups.value
    groupLoading.value = true
    groupError.value = ''
    try {
      const hostUin = resolveSelfQzoneUin(userStore)
      const res = await window.QzoneAPI.getQQGroups({ hostUin }, { skipAuthCheck: true })
      if (res?.code !== undefined && Number(res.code) !== 0)
        throw new Error('group-list-unavailable')

      const { groups: visibleGroups, defaultGroupId } = normalizeQQGroups(res)
      preferredQQGroupId.value = defaultGroupId
      qqGroups.value = visibleGroups.map((group) => ({
        ...group,
        memberCount: groupMemberCache.get(group.id)?.length
      }))

      if (defaultGroupId) {
        const initialMembers = normalizeQQGroupMembers(res, defaultGroupId)
        if (initialMembers.length) {
          groupMemberCache.set(defaultGroupId, initialMembers)
          updateQQGroupCount(defaultGroupId, initialMembers.length)
        }
      }
      groupsLoaded.value = true
      return qqGroups.value
    } catch {
      console.error('[FriendStore] 获取 QQ 群失败')
      groupError.value = '群列表暂时无法加载，请稍后重试'
      return []
    } finally {
      groupLoading.value = false
    }
  }

  const fetchQQGroupMembers = async (group, { force = false } = {}) => {
    if (!group?.id) return []
    const cached = groupMemberCache.get(group.id)
    if (cached && completeGroupMemberCache.has(group.id) && !force) {
      groupMembers.value = cached
      return cached
    }

    groupMembersLoading.value = true
    groupError.value = ''
    if (!cached) groupMembers.value = []
    try {
      const hostUin = resolveSelfQzoneUin(userStore)
      const res = await window.QzoneAPI.getQQGroupMembers(
        { hostUin, groupId: group.id },
        { skipAuthCheck: true }
      )
      if (res?.code !== undefined && Number(res.code) !== 0) {
        throw new Error('group-members-unavailable')
      }
      const members = normalizeQQGroupMembers(res, group.id)
      groupMemberCache.set(group.id, members)
      completeGroupMemberCache.add(group.id)
      groupMembers.value = members
      updateQQGroupCount(group.id, members.length)
      return members
    } catch {
      console.error('[FriendStore] 获取 QQ 群成员失败')
      groupError.value = '群成员暂时无法加载，请稍后重试'
      if (cached) groupMembers.value = cached
      return cached || []
    } finally {
      groupMembersLoading.value = false
    }
  }

  const switchScope = async (scope) => {
    scopeSearchQueries.value[currentScope.value] = searchQuery.value
    currentScope.value = scope
    searchQuery.value = scopeSearchQueries.value[scope] || ''
    groupError.value = ''
    if (scope === CONTACT_SCOPE.FRIENDS) {
      currentTab.value = FRIEND_TAB.QQ_GROUP
      return
    }
    if (scope === CONTACT_SCOPE.GROUPS) {
      if (!groupsLoaded.value) await fetchQQGroups()
      if (!selectedQQGroup.value && qqGroups.value.length) {
        const preferredGroup =
          qqGroups.value.find((group) => group.id === preferredQQGroupId.value) || qqGroups.value[0]
        await selectQQGroup(preferredGroup)
      }
      return
    }
    currentTab.value = intimacyTab.value
    await switchTab(currentTab.value)
  }

  const setScopeSearchQuery = (scope, value) => {
    if (!Object.values(CONTACT_SCOPE).includes(scope)) return
    const query = String(value || '')
    scopeSearchQueries.value[scope] = query
    if (currentScope.value === scope) searchQuery.value = query
  }

  const setScopeScrollPosition = (scope, scrollTop) => {
    if (!Object.values(CONTACT_SCOPE).includes(scope)) return
    const value = Number(scrollTop)
    scopeScrollPositions.value[scope] = Number.isFinite(value) ? Math.max(0, value) : 0
  }

  const selectQQGroup = async (group) => {
    if (!group?.id) return
    selectedQQGroup.value = group
    setScopeSearchQuery(CONTACT_SCOPE.GROUPS, '')
    setScopeScrollPosition(CONTACT_SCOPE.GROUPS, 0)
    groupError.value = ''
    visibleGroupMemberLimit.value = QQ_GROUP_MEMBER_PAGE_SIZE
    await fetchQQGroupMembers(group)
  }

  const selectQQGroupById = async (groupId) => {
    const group = qqGroups.value.find((item) => item.id === String(groupId))
    if (group) await selectQQGroup(group)
  }

  const resetQQGroupMemberPagination = () => {
    visibleGroupMemberLimit.value = QQ_GROUP_MEMBER_PAGE_SIZE
  }

  const loadMoreQQGroupMembers = () => {
    if (!hasMoreQQGroupMembers.value) return
    visibleGroupMemberLimit.value += QQ_GROUP_MEMBER_PAGE_SIZE
  }

  const retryQQGroups = () => {
    if (selectedQQGroup.value) {
      return fetchQQGroupMembers(selectedQQGroup.value, { force: true })
    }
    return fetchQQGroups({ force: true })
  }

  const readGroupMembersForBackup = async (group) => {
    const cached = groupMemberCache.get(group.id)
    if (cached && completeGroupMemberCache.has(group.id)) {
      return { members: cached, status: '已读取', requested: false }
    }

    try {
      const hostUin = resolveSelfQzoneUin(userStore)
      const res = await window.QzoneAPI.getQQGroupMembers(
        { hostUin, groupId: group.id },
        { skipAuthCheck: true }
      )
      if (res?.code !== undefined && Number(res.code) !== 0) {
        throw new Error('group-members-unavailable')
      }
      const members = normalizeQQGroupMembers(res, group.id)
      groupMemberCache.set(group.id, members)
      completeGroupMemberCache.add(group.id)
      updateQQGroupCount(group.id, members.length)
      if (selectedQQGroup.value?.id === group.id) groupMembers.value = members
      return { members, status: '已读取', requested: true }
    } catch {
      return {
        members: cached || [],
        status: cached?.length ? '读取失败（已保留缓存）' : '读取失败',
        requested: true
      }
    }
  }

  // 备份与当前面板的筛选、搜索和可见分页无关；只在用户主动备份时遍历所选范围。
  const collectContactBackup = async (scope = 'all', { onProgress } = {}) => {
    const supportedScopes = new Set([
      'all',
      'friends',
      'current-friend-group',
      'groups',
      'current-group',
      'intimacy',
      'current-intimacy'
    ])
    const normalizedScope = supportedScopes.has(scope) ? scope : 'all'
    const notify = async (progress, detail) => {
      if (typeof onProgress !== 'function') return
      try {
        await onProgress({ progress, detail })
      } catch (error) {
        console.warn('[FriendStore] 备份进度更新失败，继续收集数据:', error?.message || error)
      }
    }
    const profile = userStore.userInfo || {}
    const snapshot = {
      scope: normalizedScope,
      owner: {
        uin: resolveSelfQzoneUin(userStore),
        name: String(profile.nick || profile.nickname || profile.name || '').trim()
      },
      warnings: []
    }
    const addWarning = (type, message, id = '') => {
      snapshot.warnings.push({ type, message, id: String(id || '') })
    }
    const includeFriends = ['all', 'friends', 'current-friend-group'].includes(normalizedScope)
    const includeGroups = ['all', 'groups', 'current-group'].includes(normalizedScope)
    const includeIntimacy = ['all', 'intimacy', 'current-intimacy'].includes(normalizedScope)

    if (includeFriends) {
      const currentFriendGroupOnly = normalizedScope === 'current-friend-group'
      if (currentFriendGroupOnly && selectedGroupId.value === ALL_GROUP_ID) {
        addWarning('friends', '未选择具体好友分组，当前分组名单未备份')
      } else {
        await notify(8, currentFriendGroupOnly ? '正在读取当前好友分组' : '正在读取全部好友')
        if (!qqLoaded.value) await fetchQQFriends()
        if (!qqLoaded.value) {
          addWarning('friends', '好友名单暂时无法读取，已继续备份其他可用内容')
        } else {
          const friendGroupNames = new Map(groups.value.map((group) => [group.gpid, group.gpname]))
          const friendGroupsToRead = currentFriendGroupOnly
            ? groups.value.filter((group) => group.gpid === selectedGroupId.value)
            : groups.value
          const friendsToRead = currentFriendGroupOnly
            ? friends.value.filter((friend) => friend.groupid === selectedGroupId.value)
            : friends.value
          snapshot.friendGroups = friendGroupsToRead.map((group) => ({
            id: group.gpid,
            name: group.gpname,
            count: friendsToRead.filter((friend) => friend.groupid === group.gpid).length
          }))
          snapshot.friends = friendsToRead.map((friend) => ({
            ...friend,
            groupName: friendGroupNames.get(friend.groupid) || '未分组'
          }))
        }
      }
    }

    if (includeGroups) {
      await notify(
        includeFriends ? 16 : 8,
        normalizedScope === 'current-group' ? '正在读取当前群成员' : '正在读取全部群列表'
      )
      if (!groupsLoaded.value) await fetchQQGroups()
      if (!groupsLoaded.value) {
        addWarning('groups', '群列表暂时无法读取，已继续备份其他可用内容')
      } else {
        const groupsToRead =
          normalizedScope === 'current-group'
            ? selectedQQGroup.value
              ? [selectedQQGroup.value]
              : []
            : qqGroups.value
        if (normalizedScope === 'current-group' && groupsToRead.length === 0) {
          addWarning('groups', '未选择具体群，当前群成员未备份')
        }

        const collectedGroups = []
        const collectedMembers = []
        const progressStart = includeFriends ? 18 : 10
        const progressEnd = includeIntimacy ? 82 : 88
        const progressStep = Math.max(1, Math.ceil(groupsToRead.length / 20))

        for (let index = 0; index < groupsToRead.length; index += 1) {
          const group = groupsToRead[index]
          if (index === 0 || index === groupsToRead.length - 1 || index % progressStep === 0) {
            const progress = Math.round(
              progressStart +
                ((progressEnd - progressStart) * index) / Math.max(1, groupsToRead.length)
            )
            await notify(progress, `正在读取群成员 ${index + 1}/${groupsToRead.length}`)
          }

          const result = await readGroupMembersForBackup(group)
          if (result.status.startsWith('读取失败')) {
            addWarning('group', `群「${group.name || group.id}」成员未能完整读取`, group.id)
          }
          collectedGroups.push({
            ...group,
            memberCount: result.members.length,
            status: result.status
          })
          collectedMembers.push(
            ...result.members.map((member) => ({
              ...member,
              groupName: group.name
            }))
          )

          if (result.requested && index < groupsToRead.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 120))
          }
        }

        snapshot.groups = collectedGroups
        snapshot.groupMembers = collectedMembers
      }
    }

    if (includeIntimacy) {
      const currentIntimacyOnly = normalizedScope === 'current-intimacy'
      const currentDoType = currentTab.value === FRIEND_TAB.CARE_BY ? 2 : 1
      if (currentIntimacyOnly) snapshot.intimacyType = currentDoType === 2 ? 'care-by' : 'care'
      await notify(86, currentIntimacyOnly ? '正在读取当前亲密度列表' : '正在读取全部亲密度列表')
      if ((!currentIntimacyOnly || currentDoType === 1) && !careLoaded.value[1]) {
        await fetchFriendList(1)
      }
      if ((!currentIntimacyOnly || currentDoType === 2) && !careLoaded.value[2]) {
        await fetchFriendList(2)
      }
      if ((!currentIntimacyOnly || currentDoType === 1) && !careLoaded.value[1]) {
        addWarning('intimacy', '「我在意谁」名单暂时无法读取')
      }
      if ((!currentIntimacyOnly || currentDoType === 2) && !careLoaded.value[2]) {
        addWarning('intimacy', '「谁在意我」名单暂时无法读取')
      }
      snapshot.care =
        currentIntimacyOnly && currentDoType !== 1
          ? []
          : careList.value.map((person) => ({ ...person }))
      snapshot.careBy =
        currentIntimacyOnly && currentDoType !== 2
          ? []
          : careByList.value.map((person) => ({ ...person }))
    }

    await notify(90, '正在聚合联系人数据')
    return snapshot
  }

  const startContactBackup = async (scope = 'all', { onTaskCreated } = {}) => {
    let taskId = ''
    try {
      const task = await window.QzoneAPI.download.startContactBackup({ scope })
      taskId = task?.taskId || ''
      if (!taskId) throw new Error('backup-task-create-failed')
      if (typeof onTaskCreated === 'function') await onTaskCreated({ taskId })

      await window.QzoneAPI.download.updateContactBackup({
        taskId,
        progress: 3,
        detail: '正在准备联系人数据'
      })
      const snapshot = await collectContactBackup(scope, {
        onProgress: ({ progress, detail }) =>
          window.QzoneAPI.download.updateContactBackup({ taskId, progress, detail })
      })
      // Vue 的响应式 Proxy 无法可靠穿过 Electron IPC；在传输边界转换为纯数据。
      const serializableSnapshot = JSON.parse(JSON.stringify(snapshot))
      const result = await window.QzoneAPI.download.finishContactBackup({
        taskId,
        snapshot: serializableSnapshot
      })
      if (result?.error) throw new Error(result.error)
      return { success: true, taskId, ...result }
    } catch (error) {
      console.error('[FriendStore] 联系人备份失败:', error?.message || error)
      if (taskId) {
        try {
          await window.QzoneAPI.download.failContactBackup({
            taskId,
            message: '备份未完成，请重试'
          })
        } catch {
          // 任务状态写入失败时仍返回可恢复的界面提示。
        }
      }
      return {
        success: false,
        taskId,
        message: taskId ? '备份未完成，请在下载管理中重试' : '备份任务创建失败，请稍后重试'
      }
    }
  }

  // 获取好友亲密度列表
  const fetchFriendList = async (doType) => {
    intimacyErrors.value[doType] = ''
    try {
      const res = await window.QzoneAPI.getFriendList(
        { doType, hostUin: resolveSelfQzoneUin(userStore) },
        { skipAuthCheck: true }
      )
      if (res?.code !== undefined && Number(res.code) !== 0) {
        throw new Error('intimacy-list-unavailable')
      }
      if (!Array.isArray(res?.data?.items_list)) {
        throw new Error('intimacy-list-invalid')
      }
      const items = dedupByUin(res?.data?.items_list)
      if (doType === 1) careList.value = items
      else careByList.value = items
      careLoaded.value[doType] = true
      return items
    } catch (error) {
      console.error('[FriendStore] 获取好友列表失败:', error)
      intimacyErrors.value[doType] = '亲密度名单暂时无法加载，请稍后重试'
      return []
    }
  }

  const retryCurrentList = async () => {
    if (currentTab.value === FRIEND_TAB.QQ_GROUP) return fetchQQFriends()
    tabLoading.value = true
    try {
      return await fetchFriendList(currentTab.value === FRIEND_TAB.CARE ? 1 : 2)
    } finally {
      tabLoading.value = false
    }
  }

  // 切换顶层 Tab，按需拉取数据（不触发全局 loading，避免抽屉跳动）
  const switchTab = async (tab) => {
    currentTab.value = tab
    if (tab === FRIEND_TAB.QQ_GROUP) {
      if (!qqLoaded.value) {
        tabLoading.value = true
        try {
          await fetchQQFriends()
        } finally {
          tabLoading.value = false
        }
      }
      return
    }
    intimacyTab.value = tab
    const doType = tab === FRIEND_TAB.CARE ? 1 : 2
    if (!careLoaded.value[doType]) {
      tabLoading.value = true
      try {
        await fetchFriendList(doType)
      } finally {
        tabLoading.value = false
      }
    }
  }

  const selectGroup = (gpid) => {
    selectedGroupId.value = gpid
    setScopeScrollPosition(CONTACT_SCOPE.FRIENDS, 0)
  }

  // 选中好友
  const selectFriend = (friend) => {
    selectedFriend.value = friend
    friendAlbums.value = []
    if (friend) {
      fetchFriendAlbums(friend.uin)
    }
  }

  // 从 API 响应中提取相册列表（兼容 sort/class 两种模式）
  const extractAlbums = (data) => {
    if (!data) return []
    if (data.albumListModeSort?.length) return data.albumListModeSort
    if (data.albumListModeClass?.length) {
      return data.albumListModeClass.flatMap((cat) => cat.albumList || [])
    }
    return data.albumList || []
  }

  // 获取好友相册列表
  const fetchFriendAlbums = async (friendUin) => {
    albumsLoading.value = true
    try {
      const res = await window.QzoneAPI.getPhotoList(
        { hostUin: friendUin, pageStart: 0, pageNum: 100 },
        { skipAuthCheck: true }
      )
      friendAlbums.value = extractAlbums(res?.data)
    } catch (error) {
      console.error('[FriendStore] 获取好友相册失败:', error)
      friendAlbums.value = []
    } finally {
      albumsLoading.value = false
    }
  }

  const reset = () => {
    selectedFriend.value = null
    friendAlbums.value = []
    searchQuery.value = ''
    scopeSearchQueries.value = {
      [CONTACT_SCOPE.FRIENDS]: '',
      [CONTACT_SCOPE.GROUPS]: '',
      [CONTACT_SCOPE.INTIMACY]: ''
    }
    scopeScrollPositions.value = {
      [CONTACT_SCOPE.FRIENDS]: 0,
      [CONTACT_SCOPE.GROUPS]: 0,
      [CONTACT_SCOPE.INTIMACY]: 0
    }
    intimacyTab.value = FRIEND_TAB.CARE
    currentScope.value = CONTACT_SCOPE.FRIENDS
    qqGroups.value = []
    selectedQQGroup.value = null
    groupMembers.value = []
    groupsLoaded.value = false
    groupError.value = ''
    friendError.value = ''
    intimacyErrors.value = { 1: '', 2: '' }
    groupMemberCache.clear()
    completeGroupMemberCache.clear()
    preferredQQGroupId.value = ''
    visibleGroupMemberLimit.value = QQ_GROUP_MEMBER_PAGE_SIZE
  }

  return {
    FRIEND_TAB,
    CONTACT_SCOPE,
    ALL_GROUP_ID,
    currentTab,
    currentScope,
    searchQuery,
    scopeSearchQueries,
    scopeScrollPositions,
    loading,
    tabLoading,
    groups,
    friends,
    selectedGroupId,
    qqLoaded,
    friendError,
    qqGroups,
    selectedQQGroup,
    groupMembers,
    groupsLoaded,
    groupLoading,
    groupMembersLoading,
    groupError,
    careList,
    careByList,
    intimacyErrors,
    currentListError,
    currentListLoaded,
    selectedFriend,
    friendAlbums,
    albumsLoading,
    groupOptions,
    filteredList,
    filteredQQGroupMembers,
    visibleQQGroupMembers,
    hasMoreQQGroupMembers,
    fetchQQFriends,
    fetchQQGroups,
    fetchQQGroupMembers,
    fetchFriendList,
    retryCurrentList,
    switchTab,
    switchScope,
    setScopeSearchQuery,
    setScopeScrollPosition,
    selectQQGroup,
    selectQQGroupById,
    resetQQGroupMemberPagination,
    loadMoreQQGroupMembers,
    retryQQGroups,
    collectContactBackup,
    startContactBackup,
    selectGroup,
    selectFriend,
    fetchFriendAlbums,
    reset
  }
})
