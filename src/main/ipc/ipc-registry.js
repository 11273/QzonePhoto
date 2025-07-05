// import { is } from '@electron-toolkit/utils'
import logger from '@main/core/logger'
import { validateChannel } from '@shared/ipc-channels'
import { ipcMain } from 'electron'

export class IpcRegistry {
  constructor() {
    this.handlers = new Map()
  }

  // 类型安全的注册方法
  async register(channel, handler) {
    // 检查通道名是否有效
    if (!channel) {
      logger.error('IPC注册失败: 通道名为空或undefined')
      return
    }

    validateChannel(channel) // 调用白名单验证

    // 如果已存在，先移除旧的处理器
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel)
      this.handlers.delete(channel)
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`移除已存在的IPC处理器: ${channel}`)
      }
    }

    // 包装handler增加错误处理
    const wrappedHandler = async (...args) => {
      try {
        const result = await handler(...args)
        return {
          code: 0,
          message: 'success',
          data: result ?? null
        }
      } catch (error) {
        logger.error(`IPC处理失败 [${channel}]`, error)
        return {
          code: error?.code || 500,
          message: error?.message || '未知错误',
          data: null
        }
      }
    }

    ipcMain.handle(channel, wrappedHandler)
    this.handlers.set(channel, wrappedHandler)

    // if (is.dev) {
    //   logger.debug(`注册IPC处理器: ${channel}`)
    // }
  }

  // 统一注销所有handlers
  async destroyAll() {
    for (const [channel] of this.handlers) {
      ipcMain.removeHandler(channel)
    }
    this.handlers.clear()
  }
}
