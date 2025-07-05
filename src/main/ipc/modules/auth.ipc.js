// eslint-disable-next-line no-unused-vars
import { QzoneAuthService } from '@main/services/qzone/auth'
import { ServiceNames } from '@main/services/service-manager'
import { IPC_AUTH } from '@shared/ipc-channels'
export function createAuthHandlers(service) {
  /** @type {QzoneAuthService} */
  const authService = service.get(ServiceNames.AUTH)

  return {
    [IPC_AUTH.GET_QR]: async () => {
      return authService.getQrcodeImg()
    },
    [IPC_AUTH.LISTEN_QR]: (_, { payload }) => {
      return authService.listenScanResult(payload)
    },
    [IPC_AUTH.LOGIN_INFO]: (_, { payload }) => {
      return authService.getLoginInfo(payload)
    },
    [IPC_AUTH.LOCAL_UNIS]: () => {
      return authService.getLocalUnis()
    },
    [IPC_AUTH.LOCAL_LOGIN]: (_, { payload }) => {
      return authService.localLogin(payload)
    }
  }
}
