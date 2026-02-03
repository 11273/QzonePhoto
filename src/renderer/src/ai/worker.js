/**
 * AI Worker (Hidden Renderer)
 * 运行在隐形浏览器窗口中的核心 AI 推理逻辑。
 * 利用 WebGPU 进行硬件加速，不阻塞主界面。
 * @module renderer/ai/worker
 */

import { Human } from '@vladmandic/human'
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

/* --------------------------------------------------
 * 工具函数
 * -------------------------------------------------- */

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
 * @returns {Promise<{ type: string, backend: string }>}
 */
async function initEngine() {
  console.log('[AI Worker] 初始化 AI 引擎...')

  // 1. 深度清理旧实例
  if (humanInstance) {
    console.log('[AI Worker] 正在清理旧实例...')
    humanInstance = null
  }

  // 2. 初始化 Human (人脸检测)
  humanInstance = new Human(HUMAN_CONFIG)
  await humanInstance.load()
  console.log('[AI Worker] Human 模型加载完成')

  try {
    // 3. 诊断信息上报
    const tfBackend = humanInstance.tf.getBackend()
    const gpuAvailable = !!navigator.gpu
    console.log(`[AI Worker] 引擎就绪. TFJS Backend: ${tfBackend}, WebGPU Support: ${gpuAvailable}`)

    return {
      type: 'INIT_SUCCESS',
      backend: tfBackend,
      backends: {
        human: tfBackend,
        gpuAvailable
      }
    }
  } catch (err) {
    console.error('[AI Worker] 初始化失败:', err)
    throw err
  }
}

/**
 * 图片分析任务 (仅人脸检测)
 * @param {{ filePath: string }} task
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeImage(task) {
  const { filePath } = task
  console.log(`[AI Worker] 📥 开始分析图片 (仅人脸): ${filePath}`)

  // 1. 构造 Blob URL
  const response = await fetch(`file://${filePath}`)
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)

  // 2. 为 Human 准备 ImageBitmap
  const bitmap = await createImageBitmap(blob)

  try {
    // 3. 仅执行人脸检测
    const humanResult = await humanInstance.detect(bitmap)

    // 解析人脸检测结果并异步生成人脸缩略图
    const facePromises = humanResult.face
      .filter((f) => {
        // 剔除置信度低或尺寸太小的脸
        return f.box[2] > 50 && f.box[3] > 50 && f.score > 0.7
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
      thumbnail: photoThumbnail,
      width: bitmap.width,
      height: bitmap.height,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('分析失败:', error)
    throw error
  } finally {
    if (bitmap) bitmap.close()
    if (blobUrl) URL.revokeObjectURL(blobUrl)
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
      human: !!humanInstance
    },
    backend: humanInstance?.tf?.getBackend() || 'unknown',
    backends: {
      human: humanInstance?.tf?.getBackend() || 'unknown',
      gpuAvailable: !!navigator.gpu
    }
  }
}

/* --------------------------------------------------
 * 注册 Bridge 处理器
 * -------------------------------------------------- */
bridge.on(AiActionTypes.INIT, initEngine)
bridge.on(AiActionTypes.ANALYZE, analyzeImage)
bridge.on(AiActionTypes.PING, async () => 'PONG')
bridge.on(AiActionTypes.GET_STATUS, getStatus)

console.log('[AI Worker] Worker 已加载，等待主进程指令...')
