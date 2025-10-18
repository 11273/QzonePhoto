import crypto from 'crypto'
import fs from 'fs'
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
    const fileName = filePath.split('/').pop()

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

    // 检查是否为图片文件
    const ext = filePath.toLowerCase().split('.').pop()
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
    if (!imageExtensions.includes(ext)) {
      console.log('[file-processor] 非图片文件，跳过尺寸获取:', filePath)
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
      file: filePath.split('/').pop() || filePath,
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
