import { DownloadService } from '@main/services/main/download'
import { QzoneAuthService } from '@main/services/qzone/auth'
import { QzonePhotoService } from '@main/services/qzone/photo'
import { QzoneUserService } from '@main/services/qzone/user'
import { ServiceManager, ServiceNames } from '@main/services/service-manager'
import { AutoUpdateManager } from '@main/core/update'

export async function registerService() {
  // 初始化注册器
  /** @type {ServiceManager} */
  const services = new ServiceManager()

  // 业务逻辑服务
  services.register(ServiceNames.AUTH, () => new QzoneAuthService())

  services.register(ServiceNames.PHOTO, () => new QzonePhotoService())

  services.register(ServiceNames.USER, () => new QzoneUserService())

  services.register(ServiceNames.DOWNLOAD, () => new DownloadService())

  // 更新服务
  services.register(ServiceNames.UPDATE, () => new AutoUpdateManager())

  // 初始化所有
  await services.initAll()

  // 设置下载服务的服务管理器引用
  const downloadService = services.get(ServiceNames.DOWNLOAD)
  if (downloadService) {
    downloadService.setServiceManager(services)
  }

  return services
}
