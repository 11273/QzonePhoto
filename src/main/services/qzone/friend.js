import { getFriendList, getQQFriends } from '@main/api'

export class QzoneFriendService {
  constructor() {}
  async getFriendList({ doType, hostUin }, { uin, p_skey }) {
    return await getFriendList(uin, p_skey, hostUin, doType)
  }
  async getQQFriends({ hostUin }, { uin, p_skey }) {
    return await getQQFriends(uin, p_skey, hostUin)
  }
}
