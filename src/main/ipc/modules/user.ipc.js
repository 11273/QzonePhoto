// eslint-disable-next-line no-unused-vars
import { QzoneUserService } from '@main/services/qzone/user'
import { ServiceNames } from '@main/services/service-manager'
import { IPC_USER } from '@shared/ipc-channels'

export function createUserHandlers(service) {
  /** @type {QzoneUserService} */
  const userService = service.get(ServiceNames.USER)

  return {
    [IPC_USER.ME_INFO]: async (_, { headers }) => {
      return userService.getMeInfo(headers)
    },
    [IPC_USER.PERSONAL_CARD]: async (_, { payload, headers }) => {
      return userService.getPersonalCard(payload, headers)
    },
    [IPC_USER.VISITOR_STATUS]: async (_, { headers }) => {
      return userService.getVisitorStatus({}, headers)
    },
    [IPC_USER.VISITOR_DETAIL]: async (_, { payload, headers }) => {
      return userService.getVisitorDetail(payload || {}, headers)
    },
    [IPC_USER.SHUOSHUO]: async (_, { payload, headers }) => {
      return userService.getShuoshuo(payload, headers)
    }
  }
}
