// import { is } from '@electron-toolkit/utils'
// import { format } from 'date-fns'
// import { app } from 'electron'
// import log from 'electron-log/main'
// import path from 'path'

/*
TODO 
1. 自动打包日志
2. 所有进程都共用日志
*/

// 常量定义
const SENSITIVE_KEYS = ['password', 'token', 'creditCard']
const REDACTED_TEXT = '​**​*REDACTED​**​*'

// 日志级别定义
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

class Logger {
  static #instance = null
  #logLevel = LOG_LEVELS.info

  constructor() {
    if (Logger.#instance) {
      return Logger.#instance
    }

    this.#initialize()
    Logger.#instance = this
  }

  static getInstance() {
    if (!Logger.#instance) {
      Logger.#instance = new Logger()
    }
    return Logger.#instance
  }

  #initialize() {
    // 根据环境设置日志级别
    if (process.env.NODE_ENV === 'production') {
      this.#logLevel = LOG_LEVELS.warn // 生产环境只输出warn和error
    } else {
      this.#logLevel = LOG_LEVELS.debug // 开发环境输出所有级别
    }
  }

  // 检查是否应该输出日志
  #shouldLog(level) {
    return LOG_LEVELS[level] <= this.#logLevel
  }

  // 公共日志方法 - 改为使用普通console
  emergency(...args) {
    if (this.#shouldLog('error')) {
      this.#processLogArgs('error', ['emergency'], args)
    }
  }

  alert(...args) {
    if (this.#shouldLog('error')) {
      this.#processLogArgs('error', ['alert'], args)
    }
  }

  critical(...args) {
    if (this.#shouldLog('error')) {
      this.#processLogArgs('error', ['critical'], args)
    }
  }

  error(...args) {
    if (this.#shouldLog('error')) {
      this.#processLogArgs('error', ['error'], args)
    }
  }

  warn(...args) {
    if (this.#shouldLog('warn')) {
      this.#processLogArgs('warn', ['warning'], args)
    }
  }

  info(...args) {
    if (this.#shouldLog('info')) {
      this.#processLogArgs('info', ['info'], args)
    }
  }

  debug(...args) {
    if (this.#shouldLog('debug')) {
      this.#processLogArgs('debug', ['debug'], args)
    }
  }

  #processLogArgs(level, tags, args) {
    const data = this.#parseArguments(args)
    this.#logWithConsole({
      ...data,
      level,
      tags: [...(data.tags || []), ...tags]
    })
  }

  #parseArguments(args) {
    const data = {}

    if (typeof args[0] === 'string') {
      data.message = args[0]
      // 处理第二个参数：可能是 Error 或 context
      if (args[1] instanceof Error) {
        data.error = args[1]
        data.context = args[2] || {}
      } else {
        data.context = args[1] || {}
      }
    } else if (typeof args[0] === 'object') {
      // 保持对原有对象参数的兼容
      Object.assign(data, args[0])
    }

    return data
  }

  // 日志处理核心 - 改为使用console
  #logWithConsole(data) {
    // const redactedContext = this.#redactSensitiveData(data.context || {})
    const message = data.message
    const timestamp = new Date().toISOString()

    const logPrefix = `[${timestamp}] [${data.level.toUpperCase()}]`
    const logMessage = `${logPrefix} ${message}`

    // 构建完整的日志信息
    const logParts = [logMessage]

    // 添加上下文信息（如果有且不为空）
    // if (redactedContext && Object.keys(redactedContext).length > 0) {
    //   logParts.push('\n上下文:', JSON.stringify(redactedContext, null, 2))
    // }

    // 添加错误堆栈（如果有）
    if (data.error) {
      logParts.push('\n错误堆栈:', data.error.stack || data.error.message || String(data.error))
    }

    const fullLogMessage = logParts.join(' ')

    // 根据日志级别使用不同的console方法
    switch (data.level) {
      case 'error':
        console.error(fullLogMessage)
        break
      case 'warn':
        console.warn(fullLogMessage)
        break
      case 'debug':
        console.debug(fullLogMessage)
        break
      default:
        console.log(fullLogMessage)
    }
  }

  #redactSensitiveData(context) {
    if (!context || typeof context !== 'object') {
      return context
    }

    // 处理Error对象
    if (context instanceof Error) {
      return {
        name: context.name,
        message: context.message,
        stack: context.stack
      }
    }

    return Object.keys(context).reduce((acc, key) => {
      const value = context[key]

      // 脱敏处理
      if (SENSITIVE_KEYS.includes(key)) {
        acc[key] = REDACTED_TEXT
      } else if (value instanceof Error) {
        // 处理嵌套的Error对象
        acc[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack
        }
      } else if (typeof value === 'object' && value !== null) {
        // 递归处理嵌套对象
        acc[key] = this.#redactSensitiveData(value)
      } else {
        acc[key] = value
      }

      return acc
    }, {})
  }

  // 性能监控 - 根据环境决定是否输出
  performanceMetric(name, duration) {
    if (this.#shouldLog('info')) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [PERFORMANCE] ${name}: ${duration}ms`)
    }
  }

  // 设置日志级别的方法（可选）
  setLogLevel(level) {
    if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, level)) {
      this.#logLevel = LOG_LEVELS[level]
    }
  }

  // 获取当前日志级别
  getLogLevel() {
    return Object.keys(LOG_LEVELS).find((key) => LOG_LEVELS[key] === this.#logLevel)
  }
}

/** @type {Logger} 初始化单例 */
const logger = Logger.getInstance()

export default logger
