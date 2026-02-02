/**
 * AI 智能相册 IPC 通道定义
 * 遵循项目 IPC 规范：单一通道 + ActionType 路由
 * @module shared/ai-ipc-channels
 */

/**
 * AI IPC 统一消息通道
 * 所有 Main ↔ Worker ↔ Renderer 通信均通过此通道
 * @constant {string}
 */
export const AI_IPC_CHANNEL = 'ai:message'

/**
 * AI 动作类型枚举
 * 用于区分消息业务逻辑
 * @readonly
 * @enum {string}
 */
export const AiActionTypes = {
  // ================== 生命周期 ==================
  /** 心跳检测请求 */
  PING: 'PING',
  /** 心跳检测响应 */
  PONG: 'PONG',
  /** 初始化 AI 引擎 */
  INIT: 'INIT',
  /** Worker 就绪信号 */
  READY: 'READY',
  /** 获取 Worker 运行状态 */
  GET_STATUS: 'GET_STATUS',

  // ================== 任务执行 ==================
  /** 分析图片 (人脸 + 场景向量) */
  ANALYZE: 'ANALYZE',
  /** 分析文本 (生成搜索向量) */
  ANALYZE_TEXT: 'ANALYZE_TEXT',

  // ================== 响应类型 ==================
  /** 成功响应 */
  RESULT: 'RESULT',
  /** 错误响应 */
  ERROR: 'ERROR',
  /** 进度推送 */
  PROGRESS: 'PROGRESS'
}

/**
 * 消息目标方枚举
 * 用于路由消息到正确的进程
 * @readonly
 * @enum {string}
 */
export const AiTargets = {
  /** 主进程 (AIService) */
  MAIN: 'main',
  /** 隐藏窗口 (Worker) */
  WORKER: 'worker',
  /** 主渲染进程 (UI) */
  RENDERER: 'renderer'
}

/**
 * AI IPC 消息信封结构
 * @typedef {Object} AiEnvelope
 * @property {string} id - 唯一请求 ID (UUID)，用于 Promise 匹配
 * @property {string} type - 动作类型 (AiActionTypes)
 * @property {'main' | 'worker' | 'renderer'} target - 消息目标方
 * @property {'main' | 'worker' | 'renderer'} source - 消息来源方
 * @property {any} payload - 业务数据
 * @property {string} [error] - 错误信息 (仅响应消息)
 * @property {boolean} [isResponse] - 是否为响应消息
 */
