import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './user.store'

// 顶层 Tab：0=QQ 分组 1=我在意谁 2=谁在意我
export const FRIEND_TAB = { QQ_GROUP: 0, CARE: 1, CARE_BY: 2 }
const ALL_GROUP_ID = -1

export const useFriendStore = defineStore('friend', () => {
  const userStore = useUserStore()

  const currentTab = ref(FRIEND_TAB.QQ_GROUP)
  const searchQuery = ref('')
  const loading = ref(false)
  const tabLoading = ref(false)

  // === QQ 分组 + 好友 ===
  const groups = ref([]) // [{ gpid, gpname }]
  const friends = ref([]) // [{ uin, groupid, name, remark, img, yellow, online, v6 }]
  const selectedGroupId = ref(ALL_GROUP_ID)
  const qqLoaded = ref(false)

  // === 亲密度列表 ===
  const careList = ref([]) // 我在意谁
  const careByList = ref([]) // 谁在意我
  const careLoaded = ref({ 1: false, 2: false })

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
    try {
      const res = await window.QzoneAPI.getQQFriends(
        { hostUin: userStore.userInfo.uin },
        { skipAuthCheck: true }
      )
      // follow_flag=1 时"特别关心"的好友会在 items 里出现两次，按 uin 去重
      friends.value = dedupByUin(res?.data?.items)
      groups.value = res?.data?.gpnames || []
      qqLoaded.value = true
    } catch (error) {
      console.error('[FriendStore] 获取 QQ 好友失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 获取好友亲密度列表
  const fetchFriendList = async (doType) => {
    loading.value = true
    try {
      const res = await window.QzoneAPI.getFriendList(
        { doType, hostUin: userStore.userInfo.uin },
        { skipAuthCheck: true }
      )
      const items = dedupByUin(res?.data?.items_list)
      if (doType === 1) careList.value = items
      else careByList.value = items
      careLoaded.value[doType] = true
      return items
    } catch (error) {
      console.error('[FriendStore] 获取好友列表失败:', error)
      return []
    } finally {
      loading.value = false
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
  }

  return {
    FRIEND_TAB,
    ALL_GROUP_ID,
    currentTab,
    searchQuery,
    loading,
    tabLoading,
    groups,
    friends,
    selectedGroupId,
    qqLoaded,
    careList,
    careByList,
    selectedFriend,
    friendAlbums,
    albumsLoading,
    groupOptions,
    filteredList,
    fetchQQFriends,
    fetchFriendList,
    switchTab,
    selectGroup,
    selectFriend,
    fetchFriendAlbums,
    reset
  }
})
