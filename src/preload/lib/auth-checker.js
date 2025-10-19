/**
 * 认证状态检查器
 * 用于统一处理 QZone API 返回的认证过期状态
 */

// 自定义认证过期错误
export class AuthExpiredError extends Error {
  constructor(message, originalData) {
    super(message)
    this.name = 'AuthExpiredError'
    this.code = -3000
    this.originalData = originalData
  }
}

// 需要检查的认证过期状态码配置（可扩展）
const AUTH_EXPIRED_CODES = [-3000]

// 防抖标志：避免同时多个请求触发多次登出
let isLoggingOut = false

// 认证过期回调函数（由外部注册）
let authExpiredCallback = null

/**
 * 重置登出标志（主要用于测试或特殊场景）
 */
export function resetLoggingOutFlag() {
  isLoggingOut = false
}

/**
 * 获取当前登出状态
 */
export function getLoggingOutStatus() {
  return isLoggingOut
}

/**
 * 设置登出状态
 */
export function setLoggingOut(status) {
  isLoggingOut = status
}

/**
 * 注册认证过期回调
 * @param {Function} callback - 认证过期时的回调函数
 */
export function registerAuthExpiredCallback(callback) {
  if (typeof callback === 'function') {
    authExpiredCallback = callback
  }
}

/**
 * 触发认证过期回调
 * @param {string} message - 错误消息
 */
export function triggerAuthExpiredCallback(message) {
  if (typeof authExpiredCallback === 'function') {
    try {
      authExpiredCallback(message)
    } catch (error) {
      console.error('[AuthChecker] 执行认证过期回调失败:', error)
    }
  }
}

/**
 * 从响应数据中提取错误信息
 * @param {*} data - 响应数据
 * @returns {string} 错误信息
 */
export function extractErrorMessage(data) {
  // 优先从嵌套的 data.message 中获取
  if (data?.data?.message) {
    return data.data.message
  }

  // 其次从顶层 message 中获取
  if (data?.message) {
    return data.message
  }

  // 默认消息
  return '登录已过期，请重新登录'
}

/**
 * 检查响应数据是否包含认证过期状态码
 * @param {*} data - 响应数据
 * @returns {boolean} 是否认证过期
 */
export function checkAuthExpired(data) {
  if (!data) {
    return false
  }

  // 检查嵌套结构：data.data.code
  if (data.data && typeof data.data.code === 'number') {
    if (AUTH_EXPIRED_CODES.includes(data.data.code)) {
      return true
    }
  }

  // 检查顶层结构：data.code
  if (typeof data.code === 'number') {
    if (AUTH_EXPIRED_CODES.includes(data.code)) {
      return true
    }
  }

  return false
}

/**
 * 执行认证状态检查并处理
 * @param {*} data - 响应数据
 * @param {Object} options - 选项
 * @param {boolean} options.skipAuthCheck - 是否跳过认证检查
 * @returns {Object} { expired: boolean, message: string }
 */
export function performAuthCheck(data, options = {}) {
  // 如果配置了跳过检查，直接返回
  if (options.skipAuthCheck === true) {
    return { expired: false, message: '' }
  }

  // 检查是否认证过期
  const expired = checkAuthExpired(data)

  if (expired) {
    const message = extractErrorMessage(data)
    return { expired: true, message }
  }

  return { expired: false, message: '' }
}
