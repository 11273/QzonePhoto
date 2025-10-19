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
    this.isShuttingDown = false
    this.shutdownPromise = null
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
    // 防止重复执行
    if (this.isShuttingDown) {
      logger.info('[Bootstrapper] 已在关闭中，返回现有Promise')
      return this.shutdownPromise
    }

    this.isShuttingDown = true

    this.shutdownPromise = (async () => {
      try {
        logger.info('[Bootstrapper] 开始关闭服务...')

        // 按顺序清理资源
        const shutdownActions = [
          { name: 'Services', action: () => this.services?.destroyAll() },
          { name: 'IPC', action: () => this.ipc?.destroyAll() },
          { name: 'Windows', action: () => windowManager.destroyAllWindows() }
        ]

        for (const { name, action } of shutdownActions) {
          try {
            logger.info(`[Bootstrapper] 关闭 ${name}...`)
            await action()
          } catch (shutdownError) {
            logger.error(`[Bootstrapper] 关闭 ${name} 失败:`, shutdownError)
            // 继续执行其他清理操作
          }
        }

        logger.info('[Bootstrapper] 关闭流程完成')
      } catch (error) {
        logger.error('[Bootstrapper] 关闭流程异常:', error)
      } finally {
        this.isShuttingDown = false
      }
    })()

    return this.shutdownPromise
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
