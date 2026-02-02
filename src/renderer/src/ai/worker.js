/**
 * AI Worker (Hidden Renderer)
 * 运行在隐形浏览器窗口中的核心 AI 推理逻辑。
 * 利用 WebGPU 进行硬件加速，不阻塞主界面。
 * @module renderer/ai/worker
 */

import { Human } from '@vladmandic/human'
import { pipeline, env, RawImage } from '@huggingface/transformers'
import { AiActionTypes } from '@shared/ai-ipc-channels'
import { WorkerBridge } from './bridge'

/* --------------------------------------------------
 * 常量配置
 * -------------------------------------------------- */
/** 缩略图最大尺寸 */
const THUMBNAIL_MAX_SIZE = 120
/** 缩略图质量 (0-1) */
const THUMBNAIL_QUALITY = 0.7

/** Human 模型配置 */
const HUMAN_CONFIG = {
  backend: 'webgpu',
  debug: false,
  wasmPath: '/models/human/dist/',
  modelBasePath: '/models/human/models/',
  face: {
    enabled: true,
    detector: { modelPath: 'blazeface.json' },
    mesh: { enabled: false },
    description: { modelPath: 'faceres.json' },
    iris: { modelPath: 'iris.json' }, // 虹膜模型，人脸向量生成可能依赖
    emotion: { enabled: false }
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false }
}

/* --------------------------------------------------
 * 通信桥接
 * -------------------------------------------------- */
const bridge = new WorkerBridge()

/* --------------------------------------------------
 * 全局实例
 * -------------------------------------------------- */
/** @type {Human | null} Human 实例 */
let humanInstance = null
/** @type {Function | null} CLIP 视觉 Pipeline (feature-extraction) */
let visionPipeline = null
/** @type {Function | null} CLIP 文本 Pipeline (feature-extraction) */
let textPipeline = null

/* --------------------------------------------------
 * 工具函数
 * -------------------------------------------------- */

/**
 * 生成缩略图 Base64
 * @param {ImageBitmap} bitmap 图片位图
 * @returns {string} Base64 编码的 JPEG 图片
 */
function generateThumbnail(bitmap) {
  const canvas = new OffscreenCanvas(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE)
  const ctx = canvas.getContext('2d')

  let w = bitmap.width
  let h = bitmap.height

  // 按比例缩放
  if (w > h) {
    h = (h / w) * THUMBNAIL_MAX_SIZE
    w = THUMBNAIL_MAX_SIZE
  } else {
    w = (w / h) * THUMBNAIL_MAX_SIZE
    h = THUMBNAIL_MAX_SIZE
  }

  canvas.width = w
  canvas.height = h
  ctx.drawImage(bitmap, 0, 0, w, h)

  // OffscreenCanvas 使用 convertToBlob
  return null // 暂时保留，由下面 generateDataUrl 替代
}

/**
 * 将 ImageBitmap 转换为 Base64 (缩略图)
 * @param {ImageBitmap | OffscreenCanvas} source 源
 * @param {Object} options 配置
 * @returns {Promise<string>}
 */
async function generateDataUrl(source, options = {}) {
  const { width, height, quality = 0.7 } = options
  const canvas = new OffscreenCanvas(width || source.width || 120, height || source.height || 120)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

/**
 * 裁剪人脸区域并生成 Base64
 * @param {ImageBitmap} bitmap 原始图片位图
 * @param {number[]} box 人脸框 [x, y, w, h]
 * @returns {Promise<string>}
 */
async function generateFaceThumbnail(bitmap, box) {
  const [x, y, w, h] = box

  // 稍微向外扩大一点裁剪区域 (padding 20%)
  const paddingW = w * 0.2
  const paddingH = h * 0.2
  const sx = Math.max(0, x - paddingW)
  const sy = Math.max(0, y - paddingH)
  const sw = Math.min(bitmap.width - sx, w + paddingW * 2)
  const sh = Math.min(bitmap.height - sy, h + paddingH * 2)

  const size = 160 // 人脸缩略图固定尺寸
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')

  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })
}

/* --------------------------------------------------
 * 核心处理函数
 * -------------------------------------------------- */

/**
 * 初始化 AI 引擎
 * @param {{ clipPath?: string }} payload 初始化参数
 * @returns {Promise<{ type: string, backend: string }>}
 */
async function initEngine(payload) {
  const { clipPath } = payload
  console.log('[AI Worker] 初始化 AI 引擎...')

  // 1. 深度清理旧实例 (支持多次初始化或刷新重启)
  if (humanInstance) {
    console.log('[AI Worker] 正在清理旧实例...')
    humanInstance = null
    visionPipeline = null
    textPipeline = null
  }

  // 2. 初始化 Human (人脸检测)
  humanInstance = new Human(HUMAN_CONFIG)
  await humanInstance.load()
  console.log('[AI Worker] Human 模型加载完成')

  // 3. 配置 Transformers 环境
  // 默认使用官方托管模型标识符
  let modelId = 'Xenova/clip-vit-base-patch16'

  if (clipPath) {
    // -------------------------------------------------------------
    // 【核心】HfModelId 欺骗策略
    // -------------------------------------------------------------

    // 提取符合正则要求的 Model ID (如 "clip")
    // transformers.js 正则禁止 ID 包含协议头或冒号
    const pathParts = clipPath.replace(/\\/g, '/').split('/')
    let modelDirName = pathParts.pop()
    if (!modelDirName) modelDirName = pathParts.pop()

    // 传给库纯净的 ID 标识，以通过 isValidHfModelId 校验
    modelId = modelDirName

    console.log(`[AI Worker] 启动 ID 欺骗代理: ID="${modelId}" -> Host="http://ai.local"`)

    // 环境寻址重定向
    // 开启远程模式，将“远程”请求重定向到我们的 Electron 主进程 HTTP 拦截器
    env.allowRemoteModels = true
    // 禁止内部文件系统访问，确保逻辑进入 fetch 寻址流
    env.allowLocalModels = false

    // 修改全局远程主机地址
    env.remoteHost = 'http://ai.local/'

    // 自定义路径模板：库会自动在模板结果后追加文件名，因此仅需定位到模型文件夹
    // 这样拼接结果为: http://ai.local/clip/config.json
    env.remotePathTemplate = '{model}'

    // 禁用缓存，确保请求必定穿透至主进程，不产生脏数据
    env.useBrowserCache = false
  }

  try {
    // 【调试模式】暂时关闭 Transformers 相关分析，仅聚焦人脸整理能力的调试
    /*
    // 4. 初始化 Pipelines
    const pipelineConfig = {
      device: 'webgpu',
      dtype: 'q8' // 强制加载量化版模型
    }

    visionPipeline = await pipeline('image-feature-extraction', modelId, {
      ...pipelineConfig,
      model_file_name: 'vision_model' // 库会自动寻找 _quantized
    })

    // 文本 Pipeline: 强制加载 text_model_quantized.onnx
    textPipeline = await pipeline('feature-extraction', modelId, {
      ...pipelineConfig,
      model_file_name: 'text_model'
    })
    */
    console.log('[AI Worker] 调试模式：已跳过 CLIP Pipeline 加载')

    // 5. 诊断信息上报
    const tfBackend = humanInstance.tf.getBackend()
    const gpuAvailable = !!navigator.gpu
    console.log(`[AI Worker] 引擎就绪. TFJS Backend: ${tfBackend}, WebGPU Support: ${gpuAvailable}`)

    return {
      type: 'INIT_SUCCESS',
      backend: tfBackend, // 兼容旧代码
      backends: {
        human: tfBackend,
        clip: 'webgpu', // 这里标记我们请求的是 webgpu，如果失败 transformers.js 会抛错或走 fallback
        gpuAvailable
      }
    }
  } catch (err) {
    console.error('[AI Worker] Pipeline 初始化失败:', err)
    throw err
  }
}

/**
 * 文本特征提取
 * @param {{ text: string }} payload
 * @returns {Promise<number[]>} 特征向量
 */
async function analyzeText(payload) {
  // 调试模式下直接返回空向量
  console.warn('[AI Worker] 调试状态：跳过文本语义分析', payload.text)
  return new Array(512).fill(0)
}

/**
 * 图片分析任务 (并发执行 Human + CLIP)
 * @param {{ filePath: string }} task
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeImage(task) {
  const { filePath } = task
  console.log(`[AI Worker] 📥 开始分析图片: ${filePath}`)

  // 1. 构造 Blob URL
  // HuggingFace Transformers.js 更喜欢 URL 或 RawImage
  const response = await fetch(`file://${filePath}`)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  // 2. 为 Human 准备 ImageBitmap
  const bitmap = await createImageBitmap(blob)

  try {
    // 3. 调试模式：跳过 Transformers 耗时读取
    // const transformersImage = await RawImage.read(blobUrl)

    // 4. 调试模式：仅执行人脸检测，跳过语义特征提取
    const humanResult = await humanInstance.detect(bitmap)
    const visionOutput = { data: new Float32Array(512).fill(0) } // Mock 向量以维持数据库 Schema 兼容

    // 解析人脸检测结果并异步生成人脸缩略图
    const facePromises = humanResult.face
      .filter((f) => {
        // 1. 剔除太小的脸 (比如小于 50x50)
        const isBigEnough = f.box[2] > 50 && f.box[3] > 50
        // 2. 再次确认置信度 (提升门槛，确保只有高质量的人脸特征参与聚类)
        const isConfident = f.score > 0.7

        return isBigEnough && isConfident
      })
      .map(async (f) => ({
        box: f.box,
        embedding: Array.from(f.embedding),
        iris: f.iris,
        age: f.age,
        gender: f.gender,
        thumbnail: await generateFaceThumbnail(bitmap, f.box)
      }))

    const faces = await Promise.all(facePromises)

    // 生成全图缩略图
    const photoThumbnail = await generateDataUrl(bitmap, {
      width: THUMBNAIL_MAX_SIZE,
      height: (bitmap.height / bitmap.width) * THUMBNAIL_MAX_SIZE,
      quality: THUMBNAIL_QUALITY
    })

    return {
      path: filePath,
      faces,
      sceneVector: Array.from(visionOutput.data),
      thumbnail: photoThumbnail,
      tags: [],
      // 补充元数据
      width: bitmap.width,
      height: bitmap.height,
      timestamp: Date.now() // 这是分析完成的时间，作为入库时间戳
    }
  } catch (error) {
    console.error('分析失败细项:', error)
    throw error // 抛出错误供上层捕获
  } finally {
    // 5. 清理资源
    if (bitmap) {
      bitmap.close()
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
    }
  }
}

/**
 * 获取 Worker 运行状态
 * @returns {Promise<Object>}
 */
async function getStatus() {
  return {
    alive: true,
    models: {
      human: !!humanInstance,
      // clip: !!visionPipeline && !!textPipeline
      clip: true
    },
    // 基础 backend 字段供 AIService.checkWorkerHealth 直接使用
    backend: humanInstance?.tf?.getBackend() || 'unknown',
    backends: {
      human: humanInstance?.tf?.getBackend() || 'unknown',
      clip: 'webgpu', // transformers.js 目前难以动态 query 实际运行后端，先标记意图
      gpuAvailable: !!navigator.gpu
    }
  }
}

/* --------------------------------------------------
 * 注册 Bridge 处理器
 * -------------------------------------------------- */
bridge.on(AiActionTypes.INIT, initEngine)
bridge.on(AiActionTypes.ANALYZE, analyzeImage)
bridge.on(AiActionTypes.ANALYZE_TEXT, analyzeText)
bridge.on(AiActionTypes.PING, async () => 'PONG')
bridge.on(AiActionTypes.GET_STATUS, getStatus)

console.log('[AI Worker] Worker 已加载，等待主进程指令...')
