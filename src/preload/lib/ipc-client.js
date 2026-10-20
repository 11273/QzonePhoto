import { getLocalUserInfo } from '@shared/utils/auth'
import { ipcRenderer } from 'electron'
import { getQzoneReadFailure } from '@shared/qzone-read-response'
import {
  AuthExpiredError,
  performAuthCheck,
  getLoggingOutStatus,
  setLoggingOut,
  triggerAuthExpiredCallback
} from './auth-checker'

class IpcError extends Error {
  constructor(message, code, detail) {
    super(message)
    this.name = 'IpcError'
    this.code = code
    this.detail = detail
  }
}

// contextBridge strips custom fields from Error instances. Reject with a plain
// record so renderer callers retain message/code/detail for error classification.
// Only copy the public error contract, never the IPC request or its credentials.
const toBridgeError = (error) => ({
  name: error?.name || 'IpcError',
  message: error?.message || '请求处理失败',
  ...(error?.code !== undefined ? { code: error.code } : {}),
  ...(error?.detail !== undefined ? { detail: error.detail } : {}),
  ...(error?.originalData !== undefined ? { originalData: error.originalData } : {})
})

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
  // `throwOnResponseError` 只在调用方明确需要时启用，避免改变既有接口
  // 对“返回空数据即可”的兼容语义。相册首屏属于必须可恢复的场景，应该拿到真实错误。
  call: async (
    channel,
    payload = {},
    meta = {},
    { throwOnResponseError = false, responseCheck = getQzoneReadFailure, background = false } = {}
  ) => {
    try {
      const isAppRequest = channel.startsWith('app:')
      // 自动携带认证令牌
      const context = {
        // Our private service uses its own installation/reply token, not Qzone cookies.
        headers: isAppRequest ? {} : { ...getLocalUserInfo() },
        meta: {
          timestamp: Date.now(),
          ...meta
        },
        payload
      }

      const res = await ipcRenderer.invoke(channel, context)

      const { data, error, code, message, detail } = res || {}

      if (error) {
        throw new IpcError(error.message || '请求处理失败', error.code || 'IPC_ERROR', error.detail)
      }

      if (throwOnResponseError && Number(code) !== 0) {
        throw new IpcError(message || '请求处理失败', code || 'IPC_ERROR', detail)
      }

      // 检查认证状态（支持通过 meta.skipAuthCheck 跳过）
      const authCheckResult = performAuthCheck(data, {
        ...meta,
        skipAuthCheck: isAppRequest || meta.skipAuthCheck
      })
      if (authCheckResult.expired) {
        // 使用防抖机制，避免同时多个请求触发多次登出
        if (!getLoggingOutStatus()) {
          setLoggingOut(true)
          logger.warn(`[IPC] ${channel} 检测到认证过期:`, authCheckResult.message)
          // 触发认证过期回调（通知 renderer）
          triggerAuthExpiredCallback(authCheckResult.message)
        }
        // 抛出认证过期错误
        throw new AuthExpiredError(authCheckResult.message, data)
      }

      if (throwOnResponseError) {
        const businessFailure = responseCheck(data)
        if (businessFailure) {
          throw new IpcError(businessFailure.message, businessFailure.code, businessFailure.detail)
        }
      }

      // Never dump authentication context or full responses into the console.
      if (!background) logger.debug(`[IPC] ${channel} 调用成功`)
      return data
    } catch (error) {
      // Passive checks still reject so callers preserve stale state and back off.
      // Only an explicitly initiated action should surface an error to the UI.
      if (!background) {
        logger.error(
          `[IPC] ${channel} 调用失败 [${error?.code ?? 'IPC_ERROR'}]: ${error?.message || '请求处理失败'}`
        )
      }
      throw toBridgeError(error)
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
