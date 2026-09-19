import { getFriendList, getQQFriends, getQQGroups, getQQGroupMembers } from '@main/api'

export class QzoneFriendService {
  constructor() {}
  async getFriendList({ doType, hostUin }, { uin, p_skey }) {
    return await getFriendList(uin, p_skey, hostUin, doType)
  }
  async getQQFriends({ hostUin }, { uin, p_skey }) {
    return await getQQFriends(uin, p_skey, hostUin)
  }
  async getQQGroups({ hostUin }, { uin, p_skey }) {
    return await getQQGroups(uin, p_skey, hostUin)
  }
  async getQQGroupMembers({ hostUin, groupId }, { uin, p_skey }) {
    return await getQQGroupMembers(uin, p_skey, hostUin, groupId)
  }
}
