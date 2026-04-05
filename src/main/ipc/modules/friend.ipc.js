// eslint-disable-next-line no-unused-vars
import { QzoneFriendService } from '@main/services/qzone/friend'
import { ServiceNames } from '@main/services/service-manager'
import { IPC_FRIEND } from '@shared/ipc-channels'

export function createFriendHandlers(service) {
  /** @type {QzoneFriendService} */
  const friendService = service.get(ServiceNames.FRIEND)

  return {
    [IPC_FRIEND.GET_FRIEND_LIST]: async (_, { payload, headers }) => {
      return friendService.getFriendList(payload, headers)
    }
  }
}
