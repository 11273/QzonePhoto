// eslint-disable-next-line no-unused-vars
import { AutoUpdateManager } from '@main/core/update'
import { IPC_UPDATE } from '@shared/ipc-channels'
import logger from '@main/core/logger'
import { ServiceNames } from '@main/services/service-manager'

/**
 * 创建更新相关的IPC处理器
 * @param {Object} service - 服务实例（预留参数）
 * @returns {Object} IPC处理器映射
 */
export function createUpdateHandlers(service) {
  /** @type {AutoUpdateManager} */
  const updateManager = service.get(ServiceNames.UPDATE)

  return {
    [IPC_UPDATE.CHECK_UPDATE]: async () => {
      logger.info('IPC: 检查更新')
      return updateManager.checkForUpdates()
    },

    [IPC_UPDATE.DOWNLOAD_UPDATE]: async () => {
      logger.info('IPC: 下载更新')
      return updateManager.downloadUpdate()
    },

    [IPC_UPDATE.CANCEL_DOWNLOAD]: async () => {
      logger.info('IPC: 取消下载更新')
      return updateManager.cancelDownload()
    },

    [IPC_UPDATE.INSTALL_UPDATE]: async () => {
      logger.info('IPC: 安装更新')
      return updateManager.quitAndInstall()
    },

    [IPC_UPDATE.GET_PROGRESS]: async () => {
      return updateManager.getDownloadProgress()
    },

    [IPC_UPDATE.GET_STATUS]: async () => {
      logger.info('IPC: 获取更新状态')
      return updateManager.getDownloadStatus()
    }
  }
}
