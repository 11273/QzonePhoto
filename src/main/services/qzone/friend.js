import { getFriendList } from '@main/api'

export class QzoneFriendService {
  constructor() {}
  async getFriendList({ doType, hostUin }, { uin, p_skey }) {
    return await getFriendList(uin, p_skey, hostUin, doType)
  }
}
