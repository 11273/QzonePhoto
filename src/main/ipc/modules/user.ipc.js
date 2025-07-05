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
    }
  }
}
