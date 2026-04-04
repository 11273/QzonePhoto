import { defineStore } from 'pinia'
import { useDownloadStore } from '@renderer/store/download.store'

export const useAIStore = defineStore('ai', {
  state: () => ({
    // 状态标识
    systemStatus: 'STOPPED', // 对应后端的 AI_SYSTEM_STATUS
    analysisStatus: 'IDLE', // Enum: 'IDLE', 'CHECKING', 'DOWNLOADING', 'INDEXING', 'ANALYZING', 'FINISHED'
    isReady: false, // AI 环境是否就绪
    isModelReady: false, // 模型是否下载完成
    isScanning: false, // 是否正在扫描
    initError: null, // 初始化错误信息
    pendingCount: 0, // 待处理任务数量
    userPaused: false, // 是否被用户手动暂停

    // 进度信息
    progress: {
      current: 0,
      total: 0,
      message: '',
      thumbnail: '',
      faces: []
    },
    isLoading: false, // 是否正在加载数据 (用于 UI Loading 效果)
    selectedFilter: { type: 'overview', value: null }, // 默认选中的过滤器: { type: 'overview' | 'all' | 'folder', value: string | null }
    folderCounts: {}, // 每个扫描路径对应的照片数量: { [path: string]: number }
    // 兼容旧代码进度信息 (可选保留或重构)
    processedCount: 0,
    scanProgress: 0, // 0-100
    speed: 0,
    storageUsed: 0,

    // GPU 与硬件状态
    gpuStatus: {
      active: false,
      backend: 'cpu',
      human: 'cpu',
      tooltip: '当前使用 CPU 运行 (速度较慢)'
    },

    // 性能监控 (CPU/Mem)
    performance: {
      cpu: 0,
      memory: 0,
      memoryVal: '0.0'
    },

    // 模型管理
    modelName: '隐私计算引擎',
    modelStatus: {
      downloading: false,
      progress: 0,
      totalSize: 0,
      downloadedSize: 0,
      currentFile: ''
    },

    // 扫描路径管理
    customPaths: [], // 用户额外添加的文件夹路径 (字符串数组)
    recognizedDefaultPath: '', // 记录上次确认过的默认路径，用于比对变更
    /** 扫描范围内发现的照片总数 (实时估算) @type {number} */
    totalPhotoCount: 0,
    /** 上次同步成功的时间 */
    lastScanTime: localStorage.getItem('ai-last-scan-time') || '',
    /** 识别到的人物列表 (聚类结果) */
    detectedPeople: []
  }),

  getters: {
    /** 已处理的照片总数 (扫描中) */
    totalCount: (state) => state.totalPhotoCount || state.progress.total || 0,
    // 合并默认下载路径和自定义路径
    allScanPaths(state) {
      const downloadStore = useDownloadStore()
      const defaultPath = downloadStore.downloadPath

      const paths = []

      // 1. 默认路径 (来自 useDownloadStore().downloadPath)
      if (defaultPath) {
        paths.push({
          id: 'default',
          type: 'default',
          path: defaultPath,
          enabled: true,
          label: '默认下载位置',
          deletable: false
        })
      }

      // 2. 自定义路径
      state.customPaths.forEach((p, index) => {
        paths.push({
          id: `custom_${index}`,
          type: 'custom',
          path: p,
          enabled: true,
          label: p.split(/[/\\]/).pop() || p,
          deletable: true
        })
      })

      return paths
    },

    gpuDisplayName(state) {
      if (state.performance.gpu && (state.performance.gpu.name || state.performance.gpu.model)) {
        const name = state.performance.gpu.name || state.performance.gpu.model
        return name.replace('Apple ', '').replace('(TM)', '').trim()
      }
      // Fallback
      if (state.gpuStatus.backend === 'webgpu') return 'WebGPU Metal'
      if (state.gpuStatus.backend === 'webgl') return 'WebGL'
      return 'CPU'
    },

    /** 发现的人物总数 */
    personCount: (state) => state.detectedPeople?.length || 0,

    // 仅获取纯路径数组 (用于传给后端扫描)
    activeScanPathStrings() {
      // 注意：这里需要调用 getter allScanPaths 而不是访问 state.scanPaths (不存在)
      return this.allScanPaths.filter((p) => p.enabled).map((p) => p.path)
    },

    // 兼容旧代码
    scanPaths() {
      return this.allScanPaths
    }
  },

  actions: {
    // 初始化 AI 环境
    async init() {
      if (this.isReady) return

      try {
        console.log('[AI Store] 监听后台 AI 推送与状态同步...')

        // 确保下载路径已初始化
        const downloadStore = useDownloadStore()
        if (!downloadStore.downloadPath) {
          await downloadStore.initDownloadPath()
        }

        // 1. 监听全局状态变化
        window.QzoneAPI.ai.onStatusChange(({ status, msg }) => {
          console.log(
            `[AI Store] 收到状态变更: ${this.systemStatus} -> ${status} (${msg || '无消息'})`
          )
          this.systemStatus = status

          // 映射旧状态以保持 UI 兼容
          if (status === 'MODEL_MISSING') {
            this.isModelReady = false
            this.analysisStatus = 'IDLE' // 显示 Onboarding
          } else if (status === 'READY') {
            this.isModelReady = true
            this.analysisStatus = 'FINISHED'
            this.isScanning = false // 确保 UI 知道扫描结束
            this.refreshPendingCount()
          } else if (status === 'ANALYZING') {
            this.analysisStatus = 'ANALYZING'
            this.isScanning = true // 修复：分析中也应该开启扫描状态以显示进度条
          } else if (status === 'SCANNING') {
            this.analysisStatus = 'INDEXING'
            this.isScanning = true
          } else if (status === 'DOWNLOADING') {
            this.analysisStatus = 'DOWNLOADING'
          }
        })

        // 2. 监听进度推送 (模型下载、静默扫描、分析)
        window.QzoneAPI.ai.onScanProgress((progress) => {
          if (progress.status === 'SCAN_COMPLETE' || progress.status === 'COMPLETE') {
            this.isScanning = false
            this.refreshPendingCount()
            return
          }

          if (progress.status === 'STOPPED') {
            this.isScanning = false
            return
          }

          if (progress.isDownloading) {
            this.modelStatus.downloading = true
            this.modelStatus.progress = progress.percent || progress.progress || 0
            if (progress.detail) this.modelStatus.currentFile = progress.detail
            this.analysisStatus = 'DOWNLOADING'
            return
          }

          // 正常同步进度
          this.progress.current = progress.current || 0
          this.progress.total = progress.total || 0
          this.progress.message = progress.message || ''
          this.progress.thumbnail = progress.thumbnail || ''

          // 计算百分比以驱动 UI 进度条
          if (this.progress.total > 0) {
            const percent = (this.progress.current / this.progress.total) * 100
            // 使用 Math.ceil 让 1/632 至少显示 1%，而不是 0%
            this.scanProgress = Math.min(100, Math.max(0, percent > 0 ? Math.ceil(percent) : 0))
          }

          if (progress.filePath) {
            const fileName = progress.filePath.split(/[/\\]/).pop()
            this.currentAnalysisTag = `正在处理: ${fileName}`
          }

          if (progress.speed) this.speed = progress.speed
        })

        // 3. 监听硬件性能监控
        if (window.QzoneAPI?.app?.onMonitorStats) {
          window.QzoneAPI.app.onMonitorStats((stats) => {
            this.performance.cpu = stats.cpu || 0
            this.performance.memory = stats.memory || 0
            this.performance.memoryVal = stats.memoryVal || '0.0'
          })
          window.QzoneAPI.app.startMonitor()
        }

        // 4. 初始同步
        // 主动获取 AIService 的当前状态 (解决 UI 晚于 Ready 事件的问题)
        const statusRes = await window.QzoneAPI.ai.getServiceStatus()
        if (statusRes && statusRes.data && statusRes.data.status) {
          console.log('[AI Store] 初始状态同步:', statusRes.data.status)
          this.systemStatus = statusRes.data.status

          if (this.systemStatus === 'READY') {
            this.isModelReady = true
            this.analysisStatus = 'FINISHED'
            // 如果已经就绪，同步一次人物和存储信息
            this.fetchFaceGroups()
            this.refreshStorageSize()
          }
        }

        await this.checkEngineHealth()
        await this.refreshPendingCount()
        this.updateTotalPhotoCount()

        this.isReady = true
        this.loadScanPaths()
        return true
      } catch (error) {
        console.error('[AI Store] 初始化监听失败:', error)
        return false
      }
    },

    // 开启/关闭防止休眠
    async toggleSleepBlocker(enable) {
      try {
        if (enable) {
          await window.QzoneAPI.ai.startBlockSleep()
        } else {
          await window.QzoneAPI.ai.stopBlockSleep()
        }
      } catch (error) {
        console.error('[AI Store] 切换休眠状态失败:', error)
      }
    },

    // 启动全局分析
    async startGlobalAnalysis() {
      if (this.systemStatus !== 'READY') {
        console.warn('[AI Store] 引擎未就绪，无法启动分析:', this.systemStatus)
        return false
      }

      try {
        await this.toggleSleepBlocker(true)
        // 重置进度状态，确保 UI 从 0% 开始
        this.scanProgress = 0
        this.progress.current = 0
        this.progress.total = 0

        const res = await window.QzoneAPI.ai.startGlobalAnalysis()
        if (res?.data) {
          this.analysisStatus = 'ANALYZING'
          return true
        }
        return false
      } catch (err) {
        console.error('[AI Store] 启动分析器失败:', err)
        return false
      }
    },

    // 刷新待处理计数
    async refreshPendingCount() {
      try {
        const res = await window.QzoneAPI.ai.getPendingCount()
        this.pendingCount = res?.data || 0
        // 同时刷新存储占用，因为扫描/分析通常伴随着数据增长
        this.refreshStorageSize()
        return this.pendingCount
      } catch (err) {
        console.error('[AI Store] 获取待处理计数失败:', err)
        return 0
      }
    },

    // 刷新存储占用空间
    async refreshStorageSize() {
      try {
        const res = await window.QzoneAPI.ai.getStorageSize()
        this.storageUsed = res?.data || 0
        return this.storageUsed
      } catch (err) {
        console.error('[AI Store] 获取存储大小失败:', err)
        return 0
      }
    },

    // 停止扫描/分析
    async stopScan() {
      try {
        await window.QzoneAPI.ai.stopScan()
        this.isScanning = false
        this.analysisStatus = 'READY'
        return true
      } catch (err) {
        console.error('[AI Store] 停止扫描失败:', err)
        return false
      }
    },

    // 启动扫描 (重定向到后台扫描)
    async startScan(paths) {
      try {
        const res = await window.QzoneAPI.ai.startBackgroundScan(paths)
        return res?.data || false
      } catch (error) {
        console.error('[AI Store] 启动后台扫描出错:', error)
        return false
      }
    },

    // 触发增量同步 (Page Enter)
    async triggerDiffSync() {
      // 如果正在扫描或分析，跳过
      if (
        this.isScanning ||
        this.analysisStatus === 'SCANNING' ||
        this.analysisStatus === 'ANALYZING'
      ) {
        console.log('[AI Store] 引擎忙，跳过自动同步')
        return
      }

      console.log('[AI Store] 触发自动增量同步...')
      const paths = this.activeScanPathStrings
      if (paths.length === 0) return

      console.log(`[AI Store] 触发自动增量同步, 路径总数: ${paths.length}, 详情:`, paths)
      try {
        // 调用后端 diff 逻辑
        const res = await window.QzoneAPI.ai.startBackgroundScan(paths)

        if (res && res.newCount > 0) {
          console.log(`[AI Store] 发现 ${res.newCount} 张新照片，等待手动启动分析`)
          this.refreshPendingCount()
        }
      } catch (e) {
        console.error('自动同步失败', e)
      }
    },

    // 检查引擎健康状态 (Active Health Check)
    async checkEngineHealth() {
      try {
        const status = await window.QzoneAPI.ai.checkStatus()

        // 1. 如果完全离线 (false)
        if (!status) {
          if (this.isModelReady) {
            console.warn('[AI Store] 监测到 AI 引擎离线，重置状态')
            this.initError = 'AI 引擎意外离线'
            this.isModelReady = false
            this.analysisStatus = 'IDLE'
          }
          return false
        }

        // 2. 如果在线，检查模型状态
        const realStatus = status.data || status
        if (realStatus.models) {
          const { human } = realStatus.models
          const allReady = !!human

          // 保存统计数据
          if (realStatus.storageUsed !== undefined) {
            this.storageUsed = realStatus.storageUsed
          }

          // 更新 GPU 状态
          if (realStatus.backends) {
            const { human: hBackend, gpuAvailable } = realStatus.backends
            this.gpuStatus.human = hBackend
            this.gpuStatus.active = hBackend === 'webgpu'
            this.gpuStatus.backend = hBackend

            let tooltip = `Engine: ${hBackend.toUpperCase()}`
            if (!gpuAvailable) {
              tooltip += ' | ⚠️ 硬件不支持 WebGPU'
            } else if (hBackend !== 'webgpu') {
              tooltip += ' | 💡 建议开启 GPU 加速'
            }
            this.gpuStatus.tooltip = tooltip
          } else if (realStatus.backend) {
            // 兼容旧逻辑
            this.gpuStatus.active = realStatus.backend === 'webgpu'
            this.gpuStatus.backend = realStatus.backend
            this.gpuStatus.tooltip = this.gpuStatus.active
              ? `AI 硬件加速已开启 (${this.gpuStatus.backend.toUpperCase()})`
              : '当前使用 CPU 运行 (速度较慢)'
          }

          console.log('[AI Store] 引擎状态检查 (已解构):', realStatus)

          // 生成详细的错误信息
          if (!allReady) {
            this.initError = `AI 引擎模型加载失败`
          }

          if (this.isModelReady && !allReady) {
            console.warn('[AI Store] AI 引擎在线但模型未就绪 (可能是 Worker 重启)')
            this.isModelReady = false
            this.analysisStatus = 'IDLE'
          }
          // 如果 store 认为未就绪，但在 worker 里已经就绪了 (比如刷新页面)，则恢复就绪状态
          else if (!this.isModelReady && allReady) {
            console.log('[AI Store] 检测到 AI 引擎已就绪，自动恢复状态')
            this.isModelReady = true
            this.initError = null // 清除错误
            this.analysisStatus = 'FINISHED' // 或 READY
          }
          return allReady
        }

        return true // Fallback for simple boolean
      } catch (e) {
        console.error('[AI Store] 健康检查失败:', e)
        this.isModelReady = false
        return false
      }
    },

    // 启动 AI 引擎初始化
    async startInitialization(onCompleted = () => {}) {
      if (this.modelStatus.downloading) return false

      this.modelStatus.downloading = true
      this.modelStatus.progress = 0
      this.analysisStatus = 'DOWNLOADING'
      this.initError = null // 重置错误

      try {
        // 1. 调用后端初始化接口 (会自动触发下载)
        const result = await window.QzoneAPI.ai.initWorkerEnvironment()

        console.log('[AI Store] 初始化返回:', result)

        // 主进程返回格式: { data: { type: 'INIT_SUCCESS', backend: 'webgpu' } }
        if (result && result.data) {
          const { type, backend } = result.data

          if (type === 'INIT_SUCCESS') {
            this.isModelReady = true

            // 实时同步后端状态
            if (result.data.backends) {
              const { human } = result.data.backends
              this.gpuStatus.human = human
              this.gpuStatus.active = human === 'webgpu'
              this.gpuStatus.backend = human
              this.gpuStatus.tooltip = `Engine: ${human.toUpperCase()}`
            } else {
              this.gpuStatus.active = backend === 'webgpu'
              this.gpuStatus.backend = backend || 'cpu'
              this.gpuStatus.tooltip = this.gpuStatus.active
                ? `AI 硬件加速已开启 (${this.gpuStatus.backend.toUpperCase()})`
                : '当前使用 CPU 运行 (速度较慢)'
            }

            this.modelStatus.downloading = false
            this.analysisStatus = 'FINISHED'
            this.initError = null

            // 2. 触发回调
            if (onCompleted) onCompleted()
            return true
          }
        }

        // 如果没有返回预期格式，检查引擎状态
        console.warn('[AI Store] 初始化返回格式异常，检查引擎状态...')
        await this.checkEngineHealth()
        return this.isModelReady
      } catch (error) {
        console.error('[AI Store] 初始化 AI 引擎失败:', error)
        this.modelStatus.downloading = false
        this.modelStatus.currentFile = '初始化失败'
        this.analysisStatus = 'IDLE' // 保持在 IDLE 状态，确保 UI 停留在 Onboarding
        this.isModelReady = false // 确保不进入主界面

        // 提取友好的错误信息
        let errorMsg = error.message || String(error)
        errorMsg = errorMsg.replace(/^Error:\s*/i, '')

        // 解析常见错误
        if (errorMsg.includes('not valid JSON') || errorMsg.includes('Unexpected token')) {
          errorMsg = 'AI 模型文件加载失败，可能已损坏'
        }

        this.initError = errorMsg
        return false
      }
    },

    // 加载扫描路径设置
    loadScanPaths() {
      try {
        const savedPaths = localStorage.getItem('ai-custom-paths')
        if (savedPaths) {
          const parsed = JSON.parse(savedPaths)
          // 兼容旧格式 (如果旧格式是对象数组，提取 path 属性；否则直接使用字符串数组)
          this.customPaths = Array.isArray(parsed)
            ? parsed.map((p) => (typeof p === 'string' ? p : p.path))
            : []
        }

        // 开启实时监控
        this.syncWatchPaths()

        // 加载完路径后更新各文件夹的照片数量
        this.updateTotalPhotoCount()
      } catch (e) {
        console.error('加载 AI 路径设置失败', e)
        this.customPaths = []
      }
    },

    // 添加自定义路径
    async addCustomPath(path) {
      if (!path) return { success: false, message: '路径不能为空' }

      // 1. 获取所有当前已有的路径
      const allPaths = this.activeScanPathStrings

      // 2. 检查是否完全重复
      if (allPaths.includes(path)) {
        return { success: false, message: '该路径已在扫描范围内' }
      }

      // 3. 检查嵌套关系
      for (const existing of allPaths) {
        if (path.startsWith(existing + '/') || path.startsWith(existing + '\\')) {
          return { success: false, message: `已包含父级目录: ${existing}` }
        }
        if (existing.startsWith(path + '/') || existing.startsWith(path + '\\')) {
          return { success: false, message: `已包含子级目录: ${existing}` }
        }
      }

      this.customPaths.push(path)
      localStorage.setItem('ai-custom-paths', JSON.stringify(this.customPaths))

      // 更新实时监控
      this.syncWatchPaths()

      await this.updateTotalPhotoCount()
      return { success: true }
    },

    // 移除自定义路径
    async removeCustomPath(path) {
      this.customPaths = this.customPaths.filter((p) => p !== path)
      if (this.selectedFilter.type === 'folder' && this.selectedFilter.value === path) {
        this.selectedFilter = { type: 'all', value: null }
      }
      localStorage.setItem('ai-custom-paths', JSON.stringify(this.customPaths))

      // 更新实时监控
      this.syncWatchPaths()

      await this.updateTotalPhotoCount()
    },

    // 设置选中的过滤器
    /**
     * 设置当前选择的筛选器
     * @param {'overview'|'all'|'folder'|'label'} type 类型
     * @param {string|null} value 值
     */
    setSelectedFilter(type, value = null) {
      this.selectedFilter = { type, value }
    },

    // 更新已确认的默认路径 (用户接受变更后调用)
    confirmDefaultPathChange(newPath) {
      if (!newPath) return

      // 如果之前已经有记录过默认路径，且与当前新路径不同
      if (this.recognizedDefaultPath && this.recognizedDefaultPath !== newPath) {
        console.log(`[AI Store] 默认路径已变更: ${this.recognizedDefaultPath} -> ${newPath}`)

        // 将旧的默认路径移动到自定义路径列表中，确保其继续被扫描
        const oldPath = this.recognizedDefaultPath
        const isAlreadyInCustom = this.customPaths.includes(oldPath)

        if (!isAlreadyInCustom) {
          this.customPaths.push(oldPath)
          this._savePaths()
        }
      }

      this.recognizedDefaultPath = newPath
      localStorage.setItem('ai-recognized-default-path', newPath)

      // 如果默认路径变更，也要更新监控
      this.syncWatchPaths()
    },

    /**
     * 同步监控路径到主进程
     */
    syncWatchPaths() {
      const paths = this.activeScanPathStrings
      if (window.QzoneAPI?.ai?.setWatchPaths) {
        window.QzoneAPI.ai.setWatchPaths([...paths])
      }
    },

    // 内部保存方法
    _savePaths() {
      localStorage.setItem('ai-custom-paths', JSON.stringify(this.customPaths))
    },

    /**
     * 获取人物聚类列表 (人物墙)
     */
    async fetchFaceGroups() {
      try {
        const res = await window.QzoneAPI.ai.getFaceGroups()
        console.log('[AI Store] 接收到人物分组数据:', res?.data)
        this.detectedPeople = res?.data || []
        return this.detectedPeople
      } catch (err) {
        console.error('[AI Store] 获取人物列表失败:', err)
        return []
      }
    },

    /**
     * 触发整理人物 (执行聚类)
     */
    async organizePeople() {
      try {
        console.log('[AI Store] 开始触发后端聚类整理...')
        const res = await window.QzoneAPI.ai.clusterFaces()
        console.log('[AI Store] 后端聚类完成, 结果:', res)
        if (res?.success) {
          await this.fetchFaceGroups()
        }
        return res
      } catch (err) {
        console.error('[AI Store] 整理人物失败:', err)
        return { success: false, msg: err.message }
      }
    },

    /**
     * 根据人物 ID 获取关联照片
     */
    async fetchPhotosByFace(groupId) {
      if (!groupId) return []
      try {
        const res = await window.QzoneAPI.ai.getPhotosByFace(groupId)
        return res?.data || []
      } catch (err) {
        console.error('[AI Store] 获取人物关联照片失败:', err)
        return []
      }
    },

    /**
     * 根据文件夹路径获取照片
     */
    async fetchPhotosByFolder(folderPath) {
      if (!folderPath) return []
      try {
        // 这里我们假设后端有一个 getPhotosByFolder 接口
        const res = await window.QzoneAPI.ai.getPhotosByFolder(folderPath)
        return res?.data || []
      } catch (err) {
        console.error('[AI Store] 获取文件夹照片失败:', err)
        return []
      }
    },

    /**
     * 实时计算扫描范围内的照片总数
     */
    async updateTotalPhotoCount() {
      const paths = this.scanPaths.map((p) => p.path)
      let total = 0
      const counts = {}
      for (const p of paths) {
        try {
          const res = await window.QzoneAPI.getFolderPhotoCount({ dirPath: p })
          counts[p] = res || 0
          total += res || 0
        } catch (err) {
          console.error(`计算路径 ${p} 文件数量失败`, err)
        }
      }
      this.totalPhotoCount = total
      this.folderCounts = counts
    },

    // 获取 GPU 信息
    async fetchGPUInfo() {
      try {
        const info = await window.QzoneAPI.app.getGPUInfo()
        console.log('[AI Store] GPU Info:', info)
        if (info && info.gpuDevice && info.gpuDevice.length > 0) {
          // 通常第一个是主 GPU
          const primary = info.gpuDevice[0]
          // try parsing driver info strings if standard strings are empty
          // Electron 的 gpuDevice 对象包含 vendorId, deviceId, driverVendor, driverVersion 等
          // 但不一定直接有 friendly name。但在 mac 上通常能获取到。
          // 我们尝试保存整个对象，UI 层去解析
          this.performance.gpu = primary
        }
      } catch (e) {
        console.error('Failed to fetch GPU info', e)
      }
    }
  }
})
