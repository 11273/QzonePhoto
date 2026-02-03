/**
 * AI Bridge 工具类
 * 封装 AI 隐藏窗口与主进程的 IPC 通信
 * 支持 invoke (请求/响应) 和 emit (单向推送)
 * @module preload/lib/ai-bridge
 */

import { ipcRenderer } from 'electron'
import { AI_IPC_CHANNEL, AiActionTypes, AiTargets } from '@shared/ai-ipc-channels'

/**
 * @typedef {import('@shared/ai-ipc-channels').AiEnvelope} AiEnvelope
 */

/**
 * AI 通信桥接器
 * 用于 AI 隐藏窗口 (Worker) 与主进程之间的通信
 */
export class AiBridge {
  constructor() {
    /** 来源标识 @type {'worker' | 'renderer'} */
    this.source = AiTargets.WORKER

    /** 待处理请求映射 @type {Map<string, {resolve: Function, reject: Function, timer: number}>} */
    this.pendingRequests = new Map()

    /** 动作处理器映射 @type {Map<string, Function>} */
    this.handlers = new Map()

    // 监听统一消息通道
    ipcRenderer.on(AI_IPC_CHANNEL, (event, envelope) => {
      this._handleMessage(envelope)
    })
  }

  /**
   * 发起请求并等待响应 (invoke 模式)
   * @param {'main' | 'renderer'} target - 目标进程
   * @param {string} type - 动作类型 (AiActionTypes)
   * @param {any} [payload={}] - 业务数据
   * @param {number} [timeout=60000] - 超时时间 (毫秒)
   * @returns {Promise<any>} 响应数据
   */
  async invoke(target, type, payload = {}, timeout = 60000) {
    const id = crypto.randomUUID()

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`[AI Bridge] 请求超时: ${type} (${timeout}ms)`))
        }
      }, timeout)

      this.pendingRequests.set(id, { resolve, reject, timer })

      this._send({
        id,
        type,
        target,
        source: this.source,
        payload,
        isResponse: false
      })
    })
  }

  /**
   * 发送单向消息 (无需响应)
   * @param {'main' | 'renderer'} target - 目标进程
   * @param {string} type - 动作类型
   * @param {any} [payload={}] - 业务数据
   */
  emit(target, type, payload = {}) {
    this._send({
      id: null,
      type,
      target,
      source: this.source,
      payload,
      isResponse: false
    })
  }

  /**
   * 注册动作处理器
   * @param {string} type - 动作类型 (AiActionTypes)
   * @param {Function} handler - 异步处理函数，接收 payload 返回结果
   */
  on(type, handler) {
    this.handlers.set(type, handler)
  }

  /**
   * 发送消息到主进程
   * @private
   * @param {AiEnvelope} envelope
   */
  _send(envelope) {
    const safePayload = this._sanitizeForLog(envelope.payload)
    console.log(`[AI Bridge] 📤 发送: ${envelope.type} → ${envelope.target}`, safePayload)
    ipcRenderer.send(AI_IPC_CHANNEL, envelope)
  }

  /**
   * 处理收到的消息
   * @private
   * @param {AiEnvelope} envelope
   */
  async _handleMessage(envelope) {
    const { id, type, payload, error, source, isResponse } = envelope
    const safePayload = this._sanitizeForLog(payload)
    console.log(`[AI Bridge] 📥 收到: ${type} ← ${source}`, safePayload)

    // 1. 处理响应消息 (匹配 pending 请求)
    if (isResponse && id && this.pendingRequests.has(id)) {
      const { resolve, reject, timer } = this.pendingRequests.get(id)
      clearTimeout(timer)
      this.pendingRequests.delete(id)

      if (error) {
        reject(new Error(error))
      } else {
        resolve(payload)
      }
      return
    }

    // 2. 处理 RESULT 类型 (兼容旧响应格式)
    if (type === AiActionTypes.RESULT && id && this.pendingRequests.has(id)) {
      const { resolve, timer } = this.pendingRequests.get(id)
      clearTimeout(timer)
      this.pendingRequests.delete(id)
      resolve(payload)
      return
    }

    // 3. 处理 ERROR 类型 (兼容旧响应格式)
    if (type === AiActionTypes.ERROR && id && this.pendingRequests.has(id)) {
      const { reject, timer } = this.pendingRequests.get(id)
      clearTimeout(timer)
      this.pendingRequests.delete(id)
      reject(new Error(error || payload?.message || '未知错误'))
      return
    }

    // 4. 处理请求消息 (调用注册的 handler)
    if (this.handlers.has(type)) {
      try {
        const handler = this.handlers.get(type)
        const result = await handler(payload)

        // 如果有 id，则需要回复响应
        if (id) {
          this._send({
            id,
            type: AiActionTypes.RESULT,
            target: source,
            source: this.source,
            payload: result,
            isResponse: true
          })
        }
      } catch (err) {
        console.error(`[AI Bridge] 处理 ${type} 失败:`, err)
        if (id) {
          this._send({
            id,
            type: AiActionTypes.ERROR,
            target: source,
            source: this.source,
            error: err.message,
            isResponse: true
          })
        }
      }
    }
  }

  /**
   * 清理敏感/大型数据用于日志输出
   * @private
   */
  _sanitizeForLog(payload) {
    if (!payload || typeof payload !== 'object') return payload

    const clone = { ...payload }

    // 截断 Base64 图片
    if (clone.thumbnail && typeof clone.thumbnail === 'string') {
      clone.thumbnail = `[Base64 ${clone.thumbnail.length} bytes]`
    }
    if (Array.isArray(clone.faces)) {
      clone.faces = `[Faces ${clone.faces.length}]`
    }

    return clone
  }
}
