/**
 * AI 隐藏窗口 Preload 脚本
 * 为 Worker 进程暴露安全的 IPC 通信 API
 * @module preload/ai
 */

import { contextBridge, ipcRenderer } from 'electron'
import { AI_IPC_CHANNEL } from '@shared/ai-ipc-channels'

try {
  /**
   * 暴露给 AI 隐藏窗口的 API
   * 通过 window.api 访问
   */
  const api = {
    /**
     * 发送消息到主进程
     * @param {import('@shared/ai-ipc-channels').AiEnvelope} envelope - 消息信封
     */
    send: (envelope) => {
      ipcRenderer.send(AI_IPC_CHANNEL, envelope)
    },

    /**
     * 监听主进程消息
     * @param {Function} callback - 回调函数，接收消息信封
     * @returns {Function} 取消监听函数
     */
    on: (callback) => {
      const subscription = (event, envelope) => callback(envelope)
      ipcRenderer.on(AI_IPC_CHANNEL, subscription)
      return () => ipcRenderer.removeListener(AI_IPC_CHANNEL, subscription)
    },

    /**
     * 移除所有监听器
     */
    off: () => {
      ipcRenderer.removeAllListeners(AI_IPC_CHANNEL)
    }
  }

  contextBridge.exposeInMainWorld('api', api)

  console.log('[AI Preload] API 暴露成功')
} catch (error) {
  console.error('[AI Preload] 暴露 API 失败:', error)
  console.error('[AI Preload] 错误堆栈:', error.stack)
}
