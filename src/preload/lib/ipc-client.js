import { getLocalUserInfo } from '@shared/utils/auth'
import { ipcRenderer } from 'electron'

class IpcError extends Error {
  constructor(message, code, detail) {
    super(message)
    this.name = 'IpcError'
    this.code = code
    this.detail = detail
  }
}

// 日志工具：根据环境决定是否输出
const logger = {
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args)
    }
  },
  info: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(...args)
    }
  },
  warn: (...args) => {
    console.warn(...args)
  },
  error: (...args) => {
    console.error(...args)
  }
}

export const ipcClient = {
  call: async (channel, payload = {}, meta = {}) => {
    try {
      // 自动携带认证令牌
      const context = {
        headers: {
          ...getLocalUserInfo()
        },
        meta: {
          timestamp: Date.now(),
          ...meta
        },
        payload
      }
      logger.debug(`[IPC] 调用 ${channel} 通道, payload:`, payload, context)

      const res = await ipcRenderer.invoke(channel, context)

      logger.debug(`[IPC] ${channel} 调用成功, 返回数据:`, res)

      const { data, error } = res

      if (error) {
        throw new IpcError(error.message || '请求处理失败', error.code || 'IPC_ERROR', error.detail)
      }

      return data
    } catch (error) {
      logger.error(`[IPC] ${channel} 调用失败:`, error)
      throw error // 保留原始错误堆栈
    }
  },

  on: (channel, callback) => {
    logger.debug(`[IPC] 注册监听 ${channel} 通道`)

    const wrappedCallback = (event, ...args) => {
      logger.debug(`[IPC] 收到 ${channel} 事件:`, args)
      callback(...args)
    }

    ipcRenderer.on(channel, wrappedCallback)

    // 返回取消监听的方法
    return () => {
      logger.debug(`[IPC] 取消监听 ${channel} 通道`)
      ipcRenderer.removeListener(channel, wrappedCallback)
    }
  },

  once: (channel, callback) => {
    logger.debug(`[IPC] 注册一次性监听 ${channel} 通道`)

    const wrappedCallback = (event, ...args) => {
      logger.debug(`[IPC] 收到 ${channel} 事件 (一次性):`, args)
      callback(...args)
    }

    ipcRenderer.once(channel, wrappedCallback)
  },

  removeAllListeners: (channel) => {
    logger.debug(`[IPC] 移除 ${channel} 通道的所有监听器`)
    ipcRenderer.removeAllListeners(channel)
  }
}
