import { ipcMain } from 'electron'
import { AI_IPC_CHANNEL, AiActionTypes, AiTargets } from '@shared/ai-ipc-channels'

/**
 * Worker 通信桥
 * 负责主进程与 AI Worker 之间的双向通信 (Request/Response 模型)
 */
class WorkerBridge {
  constructor() {
    this.window = null
    this.pendingRequests = new Map()
    this._initListener()
    this.isReady = false
  }

  /**
   * 设置 Worker 窗口实例
   * @param {BrowserWindow} win
   */
  setWindow(win) {
    this.window = win
    this.isReady = true
  }

  /**
   * 初始化 IPC 监听
   * @private
   */
  _initListener() {
    ipcMain.on(AI_IPC_CHANNEL, (_, envelope) => {
      const { id, type, target, payload, error, isResponse } = envelope

      // 只处理发给 Main 的响应消息
      if (target === AiTargets.MAIN && isResponse && this.pendingRequests.has(id)) {
        const { resolve, reject, timer } = this.pendingRequests.get(id)
        clearTimeout(timer)
        this.pendingRequests.delete(id)

        if (type === AiActionTypes.ERROR || error) {
          reject(new Error(error || 'Worker returned error'))
        } else {
          resolve(payload)
        }
      }
    })
  }

  /**
   * 发送请求给 Worker
   * @param {string} type Action Type
   * @param {any} [payload={}] Data
   * @param {number} [timeout=30000] Timeout in ms
   * @returns {Promise<any>}
   */
  send(type, payload = {}, timeout = 30000) {
    if (!this.window || this.window.isDestroyed()) {
      return Promise.reject(new Error('Worker window not available'))
    }

    const id = Math.random().toString(36).substring(7)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Bridge Timeout: ${type}`))
        }
      }, timeout)

      this.pendingRequests.set(id, { resolve, reject, timer })

      try {
        this.window.webContents.send(AI_IPC_CHANNEL, {
          id,
          type,
          target: AiTargets.WORKER,
          source: AiTargets.MAIN,
          payload
        })
      } catch (err) {
        clearTimeout(timer)
        this.pendingRequests.delete(id)
        reject(err)
      }
    })
  }
}

export const bridge = new WorkerBridge()
