import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { promisify } from 'util'
import sizeOf from 'image-size'

const readFile = promisify(fs.readFile)

/**
 * 计算文件的 MD5 哈希值
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} MD5 哈希值
 */
export async function calculateFileMD5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5')
    const stream = fs.createReadStream(filePath)

    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * 从文件路径获取文件信息
 * @param {string} filePath 文件路径
 * @returns {Promise<Object>} 文件信息
 */
export async function getFileInfo(filePath) {
  // console.log('[file-processor] getFileInfo 调用，路径:', filePath)

  // 参数验证
  if (!filePath || typeof filePath !== 'string') {
    console.error('[file-processor] 无效的文件路径:', filePath)
    throw new Error(`无效的文件路径: ${filePath}`)
  }

  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('[file-processor] 文件不存在:', filePath)
      throw new Error(`文件不存在: ${filePath}`)
    }

    const stats = await fs.promises.stat(filePath)
    const fileName = path.basename(filePath)

    const result = {
      fileName,
      fileSize: stats.size,
      filePath,
      modifiedTime: stats.mtime
    }

    // console.log('[file-processor] 文件信息获取成功:', result)
    return result
  } catch (error) {
    console.error('[file-processor] getFileInfo 失败:', error)
    throw error
  }
}

/**
 * 读取文件为 Buffer
 * @param {string} filePath 文件路径
 * @returns {Promise<Buffer>} 文件 Buffer
 */
export async function readFileAsBuffer(filePath) {
  return await readFile(filePath)
}

/**
 * 获取图片尺寸信息
 * @param {string} filePath 图片文件路径
 * @returns {Promise<Object>} 包含 width 和 height 的对象
 */
/**
 * 检查文件是否为视频
 * @param {string} filePath 文件路径
 * @returns {boolean} 是否为视频文件
 */
export function isVideoFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false
  }
  const ext = filePath.toLowerCase().split('.').pop()
  const videoExtensions = ['mp4', 'mov', 'avi', 'flv', 'wmv', 'mkv', 'webm', 'mpg', 'mpeg']
  return videoExtensions.includes(ext)
}

/**
 * 获取视频时长（降级方案 - 基于文件大小预估）
 * 注意：应优先使用视频元数据服务 (video-metadata.js) 提取精确时长
 * @param {string} filePath 视频文件路径
 * @returns {Promise<number>} 视频时长（毫秒）
 */
export async function getVideoDuration(filePath) {
  try {
    if (!isVideoFile(filePath)) {
      console.warn('[file-processor] 非视频文件:', filePath)
      return 0
    }

    if (!fs.existsSync(filePath)) {
      console.warn('[file-processor] 视频文件不存在:', filePath)
      return 0
    }

    // 基于文件大小预估时长
    const stats = await fs.promises.stat(filePath)
    const fileSizeMB = stats.size / (1024 * 1024)
    // 假设平均码率 2 Mbps
    const estimatedDurationSeconds = (fileSizeMB * 8) / 2
    const durationMs = Math.max(1000, Math.round(estimatedDurationSeconds * 1000))

    console.warn('[file-processor] 使用预估时长（降级方案）:', {
      file: path.basename(filePath),
      sizeMB: fileSizeMB.toFixed(2),
      durationMs
    })

    return durationMs
  } catch (error) {
    console.error('[file-processor] getVideoDuration 失败:', error.message)
    // 最终默认值 10 秒
    return 10000
  }
}

export async function getImageDimensions(filePath) {
  try {
    // 检查文件是否存在
    if (!filePath || typeof filePath !== 'string') {
      console.warn('[file-processor] 无效的文件路径:', filePath)
      return { width: 0, height: 0 }
    }

    if (!fs.existsSync(filePath)) {
      console.warn('[file-processor] 图片文件不存在:', filePath)
      return { width: 0, height: 0 }
    }

    // 检查文件类型
    const ext = filePath.toLowerCase().split('.').pop()
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
    const videoExtensions = ['mp4', 'mov', 'avi', 'flv', 'wmv', 'mkv']

    // 如果是视频文件，返回默认尺寸（QQ空间需要非零尺寸）
    if (videoExtensions.includes(ext)) {
      console.log('[file-processor] 视频文件，返回默认尺寸:', filePath)
      return { width: 1920, height: 1080 }
    }

    // 如果既不是图片也不是视频，跳过
    if (!imageExtensions.includes(ext)) {
      console.log('[file-processor] 非图片/视频文件，跳过尺寸获取:', filePath)
      return { width: 0, height: 0 }
    }

    // 检查文件大小，避免处理过大的文件
    const stats = await fs.promises.stat(filePath)
    if (stats.size > 100 * 1024 * 1024) {
      // 100MB
      console.warn('[file-processor] 文件过大，跳过尺寸获取:', filePath, 'Size:', stats.size)
      return { width: 0, height: 0 }
    }

    // 尝试多种方式获取尺寸
    let dimensions = null

    // 方法1: 直接使用 sizeOf
    try {
      dimensions = sizeOf(filePath)
    } catch (directError) {
      console.warn('[file-processor] 直接读取失败，尝试Buffer方式:', directError.message)

      // 方法2: 先读取文件内容再解析
      try {
        const buffer = await fs.promises.readFile(filePath)
        if (buffer && buffer.length > 0) {
          dimensions = sizeOf(buffer)
        }
      } catch (bufferError) {
        console.warn('[file-processor] Buffer方式也失败:', bufferError.message)
      }
    }

    if (
      !dimensions ||
      !dimensions.width ||
      !dimensions.height ||
      dimensions.width <= 0 ||
      dimensions.height <= 0
    ) {
      console.warn('[file-processor] 无法获取有效的图片尺寸:', filePath, dimensions)
      return { width: 0, height: 0 }
    }

    // 合理性检查：尺寸不能过大
    if (dimensions.width > 50000 || dimensions.height > 50000) {
      console.warn('[file-processor] 图片尺寸异常过大:', filePath, dimensions)
      return { width: 0, height: 0 }
    }

    console.log('[file-processor] 图片尺寸获取成功:', {
      file: path.basename(filePath),
      width: dimensions.width,
      height: dimensions.height,
      type: dimensions.type
    })

    return {
      width: dimensions.width,
      height: dimensions.height
    }
  } catch (error) {
    console.error('[file-processor] getImageDimensions 失败:', {
      filePath,
      error: error.message,
      code: error.code
    })
    return { width: 0, height: 0 }
  }
}

/**
 * 将 Base64 图片保存为临时文件
 * @param {string} base64Data Base64 编码的图片数据
 * @param {string} filename 文件名
 * @returns {Promise<string>} 保存的文件路径
 */
export async function saveBase64ToTempFile(base64Data, filename) {
  try {
    const tempDir = os.tmpdir()
    const filePath = path.join(tempDir, filename)

    // 移除 Base64 前缀
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64String, 'base64')

    await fs.promises.writeFile(filePath, buffer)
    console.log('[file-processor] Base64 图片已保存:', filePath)

    return filePath
  } catch (error) {
    console.error('[file-processor] 保存 Base64 图片失败:', error)
    throw error
  }
}

/**
 * 将 Base64 封面转换为临时文件
 * 注意：应使用视频元数据服务 (video-metadata.js) 提取封面
 * @param {string} base64Cover Base64 编码的封面
 * @param {string} videoPath 视频文件路径（用于生成文件名）
 * @returns {Promise<string>} 生成的封面图路径
 */
export async function extractVideoCover(base64Cover, videoPath) {
  if (!base64Cover) {
    throw new Error('未提供视频封面数据')
  }

  const videoBasename = path.basename(videoPath, path.extname(videoPath))
  const filename = `${videoBasename}_cover_${Date.now()}.jpg`
  return saveBase64ToTempFile(base64Cover, filename)
}

/**
 * 删除临时文件
 * @param {string} filePath 文件路径
 */
export async function deleteTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
      console.log('[file-processor] 临时文件已删除:', filePath)
    }
  } catch (error) {
    console.error('[file-processor] 删除临时文件失败:', error.message)
  }
}
