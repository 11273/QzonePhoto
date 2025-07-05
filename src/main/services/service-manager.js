import logger from '@main/core/logger'

// 使用Symbol防止命名冲突
export const ServiceNames = {
  CONFIG: Symbol('ConfigService'),
  AUTH: Symbol('AuthService'),
  PHOTO: Symbol('PhotoService'),
  USER: Symbol('UserService'),
  DOWNLOAD: Symbol('DownloadService'),
  UPDATE: Symbol('UpdateService')
}

export class ServiceManager {
  constructor() {
    this.registry = new Map() // 存储服务工厂函数
    this.instances = new Map() // 存储实例化后的服务
    this.dependencyGraph = new Map() // 依赖关系图
    this.initializationState = new Map() // 跟踪初始化状态
  }

  /**
   * 注册服务工厂
   * @param {Symbol} name - 服务唯一标识
   * @param {Function} factory - 工厂函数
   * @param {Array<Symbol>} dependencies - 依赖的服务标识
   */
  register(name, factory, dependencies = []) {
    if (this.registry.has(name)) {
      throw new Error(`Service ${name.description} already registered`)
    }

    this._validateFactory(factory)
    this.dependencyGraph.set(name, new Set(dependencies))
    this.registry.set(name, { factory, dependencies })

    // logger.debug(`Registered service: ${name.description}`)
  }

  /**
   * 获取服务实例（自动解决依赖）
   */
  get(name) {
    if (!this.registry.has(name)) {
      throw new Error(`Service ${name.description} not registered`)
    }

    // 已实例化直接返回
    if (this.instances.has(name)) {
      return this.instances.get(name)
    }

    // 解析依赖树
    const dependencies = this._resolveDependencies(name)

    // 实例化服务
    const { factory } = this.registry.get(name)
    const instance = factory(...dependencies)

    // 存储实例并初始化
    this.instances.set(name, instance)
    // logger.debug(`Instantiated service: ${name.description}`)

    return instance
  }

  /**
   * 初始化所有服务（拓扑排序）
   */
  async initAll() {
    const orderedServices = this._topologicalSort()

    for (const name of orderedServices) {
      if (this.initializationState.get(name) === 'initialized') continue

      const instance = this.get(name)
      if (typeof instance.init === 'function') {
        logger.info(`Initializing service: ${name.description}`)
        await instance.init()
      }
      this.initializationState.set(name, 'initialized')
    }
  }

  /**
   * 销毁所有服务（逆拓扑排序）
   */
  async destroyAll() {
    const orderedServices = this._topologicalSort().reverse()

    for (const name of orderedServices) {
      const instance = this.instances.get(name)
      if (instance && typeof instance.destroy === 'function') {
        try {
          logger.info(`Destroying service: ${name.description}`)
          await instance.destroy()
        } catch (error) {
          logger.error(`Failed to destroy service ${name.description}:`, error)
        }
      }
      this.instances.delete(name)
      this.initializationState.delete(name)
    }
  }

  // 私有方法：验证工厂函数
  _validateFactory(factory) {
    if (typeof factory !== 'function') {
      throw new Error('Service factory must be a function')
    }
  }

  // 私有方法：依赖解析
  _resolveDependencies(name) {
    const dependencies = this.dependencyGraph.get(name)
    return Array.from(dependencies).map((depName) => this.get(depName))
  }

  // 私有方法：拓扑排序
  _topologicalSort() {
    const sorted = []
    const visited = new Set()
    const visiting = new Set()

    const visit = (name) => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name.description}`)
      }

      if (!visited.has(name)) {
        visiting.add(name)

        this.dependencyGraph.get(name).forEach((dep) => visit(dep))

        visiting.delete(name)
        visited.add(name)
        sorted.push(name)
      }
    }

    this.dependencyGraph.forEach((_, name) => visit(name))
    return sorted
  }
}
