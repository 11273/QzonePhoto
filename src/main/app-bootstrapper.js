import logger from '@main/core/logger'
import windowManager from '@main/core/window'
import { registerIPC } from '@main/ipc'
import { registerService } from '@main/services'
// import { ServiceNames } from '@main/services/service-manager'
import { app } from 'electron'

export class ApplicationBootstrapper {
  /**
   * 应用启动引导器，负责初始化关键组件
   */
  constructor() {
    // 注册错误监控
    this.#setupErrorHandlers()
    this.services = null
    this.ipc = null
  }

  /**
   * 启动应用初始化流程
   */
  async bootstrap() {
    try {
      // 注册服务
      this.services = await registerService()

      // 将服务管理器传递给窗口管理器
      windowManager.setServices(this.services)

      // 注册 IPC
      this.ipc = await registerIPC(this.services)

      // 启动主窗口（窗口管理器会自动绑定需要窗口引用的服务）
      await windowManager.createMainWindow()

      // 自动检查更新 - 启用自动检查功能
      // const updateService = this.services.get(ServiceNames.UPDATE)
      // if (updateService && typeof updateService.checkForUpdates === 'function') {
      //   // 延迟检查更新，确保窗口已完全加载
      //   setTimeout(async () => {
      //     try {
      //       logger.info('[更新] 开始自动检查更新...')
      //       await updateService.checkForUpdates()
      //       logger.info('[更新] 自动检查更新完成')
      //     } catch (error) {
      //       logger.error('自动检查更新失败:', error)
      //     }
      //   }, 1500) // 延迟1.5秒确保界面完全加载
      // }

      logger.info('Application bootstrapped successfully')
    } catch (error) {
      logger.error('Application bootstrap failed:', error)
      await this.shutdown()
    }
  }

  /**
   * 关闭流程
   */
  async shutdown() {
    const shutdownActions = [() => this.services?.destroyAll(), () => this.ipc?.destroyAll()]

    for (const action of shutdownActions) {
      try {
        await action()
      } catch (shutdownError) {
        logger.error('关闭操作失败:', shutdownError)
      }
    }

    await windowManager.destroyAllWindows()

    if (!app.isReady()) return

    setTimeout(() => {
      if (!app.isReady()) return
      app.exit(1)
    }, 1000)
  }

  // 错误监控设置
  #setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
      logger.error(`未捕获的异常: ${error.message}`, error.stack)
    })

    process.on('unhandledRejection', (reason) => {
      logger.error(`未处理的拒绝: ${reason}`, reason.stack)
    })
  }
}
