import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useUserStore } from './user.store'

export const useFriendStore = defineStore('friend', () => {
  const userStore = useUserStore()
  // 好友列表数据
  const careList = ref([]) // 我在意谁
  const careByList = ref([]) // 谁在意我
  const currentTab = ref(1) // 1=我在意谁 2=谁在意我
  const loading = ref(false)
  const tabLoading = ref(false) // Tab 切换时的加载状态（不影响抽屉高度）
  const searchQuery = ref('')

  // 选中的好友
  const selectedFriend = ref(null)

  // 好友相册数据
  const friendAlbums = ref([])
  const albumsLoading = ref(false)

  // 当前列表
  const currentList = computed(() => {
    return currentTab.value === 1 ? careList.value : careByList.value
  })

  // 搜索过滤
  const filteredList = computed(() => {
    const list = currentList.value
    if (!searchQuery.value) return list
    const q = searchQuery.value.toLowerCase()
    return list.filter((f) => f.name.toLowerCase().includes(q) || String(f.uin).includes(q))
  })

  // 获取好友列表
  const fetchFriendList = async (doType) => {
    loading.value = true
    try {
      const res = await window.QzoneAPI.getFriendList(
        { doType, hostUin: userStore.userInfo.uin },
        { skipAuthCheck: true }
      )
      const items = res?.data?.items_list || []
      if (doType === 1) {
        careList.value = items
      } else {
        careByList.value = items
      }
      return items
    } catch (error) {
      console.error('[FriendStore] 获取好友列表失败:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  // 切换 Tab（不触发全局 loading，避免抽屉跳动）
  const switchTab = async (doType) => {
    currentTab.value = doType
    const list = doType === 1 ? careList.value : careByList.value
    if (list.length === 0) {
      // 用 tabLoading 而不是全局 loading，保持抽屉高度稳定
      tabLoading.value = true
      try {
        const res = await window.QzoneAPI.getFriendList(
          { doType, hostUin: userStore.userInfo.uin },
          { skipAuthCheck: true }
        )
        const items = res?.data?.items_list || []
        if (doType === 1) {
          careList.value = items
        } else {
          careByList.value = items
        }
      } catch (error) {
        console.error('[FriendStore] 切换Tab加载失败:', error)
      } finally {
        tabLoading.value = false
      }
    }
  }

  // 选中好友
  const selectFriend = (friend) => {
    selectedFriend.value = friend
    friendAlbums.value = []
    if (friend) {
      fetchFriendAlbums(friend.uin)
    }
  }

  // 从API响应中提取相册列表（兼容 sort/class 两种模式）
  const extractAlbums = (data) => {
    if (!data) return []
    // mode 2: 按排序返回
    if (data.albumListModeSort?.length) return data.albumListModeSort
    // mode 3: 按分类返回，需要展开
    if (data.albumListModeClass?.length) {
      return data.albumListModeClass.flatMap((cat) => cat.albumList || [])
    }
    return data.albumList || []
  }

  // 获取好友相册列表（复用现有 getPhotoList 接口）
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

  // 重置
  const reset = () => {
    selectedFriend.value = null
    friendAlbums.value = []
    searchQuery.value = ''
  }

  return {
    careList,
    careByList,
    currentTab,
    loading,
    tabLoading,
    searchQuery,
    selectedFriend,
    friendAlbums,
    albumsLoading,
    currentList,
    filteredList,
    fetchFriendList,
    switchTab,
    selectFriend,
    fetchFriendAlbums,
    reset
  }
})
