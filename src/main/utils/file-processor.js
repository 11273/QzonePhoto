import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { promisify } from 'util'
// image-size v2 改成命名导出 + 只接受 Uint8Array（不再支持直传路径），
// v1 兼容用法（默认导出 + filePath 字符串）会报 "sizeOf is not a function"。
import { imageSize } from 'image-size'
import { AI_EXTENSIONS } from '@shared/const'

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
  return AI_EXTENSIONS.VIDEOS.includes(ext)
}

/**
 * MP4/MOV box 直接解析 mvhd 拿真实时长（毫秒），不支持的容器返回 0
 * @private
 */
async function parseMp4Duration(filePath) {
  let fh
  try {
    fh = await fs.promises.open(filePath, 'r')
    const stat = await fh.stat()
    if (stat.size < 16) return 0
    // moov 可能在文件头部（streamable mp4）或尾部，两边都扫
    const headSize = Math.min(stat.size, 4 * 1024 * 1024)
    const head = Buffer.alloc(headSize)
    await fh.read(head, 0, headSize, 0)
    let d = findMvhdDuration(head, 0, headSize)
    if (d === 0 && stat.size > headSize) {
      const tail = Buffer.alloc(headSize)
      await fh.read(tail, 0, headSize, stat.size - headSize)
      d = findMvhdDuration(tail, 0, headSize)
    }
    return d
  } catch {
    return 0
  } finally {
    if (fh) await fh.close().catch(() => {})
  }
}

function findMvhdDuration(buf, start, end) {
  // 'mvhd' = 6d 76 68 64
  for (let i = start; i < end - 32; i++) {
    if (buf[i] === 0x6d && buf[i + 1] === 0x76 && buf[i + 2] === 0x68 && buf[i + 3] === 0x64) {
      const version = buf.readUInt8(i + 4)
      if (version === 0) {
        const timescale = buf.readUInt32BE(i + 4 + 12)
        const duration = buf.readUInt32BE(i + 4 + 16)
        if (timescale > 0 && duration > 0) return Math.round((duration / timescale) * 1000)
      } else if (version === 1) {
        const timescale = buf.readUInt32BE(i + 4 + 20)
        const dh = buf.readUInt32BE(i + 4 + 24)
        const dl = buf.readUInt32BE(i + 4 + 28)
        if (timescale > 0) {
          const duration = dh * 0x100000000 + dl
          if (duration > 0) return Math.round((duration / timescale) * 1000)
        }
      }
    }
  }
  return 0
}

/**
 * 获取视频时长：优先 MP4/MOV box 精确解析，失败才退回按文件大小估算
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

    // 1) 精确：MP4/MOV 容器直接读 mvhd box
    const realDuration = await parseMp4Duration(filePath)
    if (realDuration > 0) {
      console.log('[file-processor] 通过 MP4 box 解析时长:', {
        file: path.basename(filePath),
        durationMs: realDuration
      })
      return realDuration
    }

    // 2) 拿不到精确时长（如 fMP4 mvhd=0，时长在 moof 内部）— 返回 0
    // 让上游传 iPlayTime=0 给服务端，服务端会自己根据视频解析
    // （不要按文件大小×码率估算，4K 高码率视频估算可能远超 10 分钟触发 -530 误拒）
    console.warn('[file-processor] 无法精确解析视频时长（容器格式不标准），iPlayTime 将传 0:', {
      file: path.basename(filePath)
    })
    return 0
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

    // image-size v2：imageSize(Uint8Array)，只接受 buffer
    // 大图只读文件头部 (~256KB) 就够识别格式头，避免把整张图读进内存
    let dimensions = null
    try {
      const headSize = Math.min(stats.size, 256 * 1024)
      const buf = Buffer.alloc(headSize)
      const fh = await fs.promises.open(filePath, 'r')
      try {
        await fh.read(buf, 0, headSize, 0)
      } finally {
        await fh.close().catch(() => {})
      }
      dimensions = imageSize(buf)
    } catch (e) {
      console.warn('[file-processor] 读取图片尺寸失败:', e.message)
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
 * 递归获取文件夹内照片和视频的总数
 * @param {string} dirPath 文件夹路径
 * @returns {Promise<number>} 文件总数
 */
export async function getFolderPhotoCount(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0
    const stats = await fs.promises.stat(dirPath)
    if (!stats.isDirectory()) return 0

    let count = 0
    const files = await fs.promises.readdir(dirPath)
    // 强制使用与 AI 扫描器一致的后缀过滤
    const supportedExtensions = AI_EXTENSIONS.SCAN_TARGETS

    for (const file of files) {
      const fullPath = path.join(dirPath, file)
      try {
        const fileStats = await fs.promises.stat(fullPath)
        if (fileStats.isDirectory()) {
          count += await getFolderPhotoCount(fullPath)
        } else {
          const ext = path.extname(file).toLowerCase().replace('.', '')
          if (supportedExtensions.includes(ext)) {
            count++
          }
        }
      } catch {
        // 忽略无法访问的文件
      }
    }
    return count
  } catch (error) {
    console.error('[file-processor] getFolderPhotoCount 失败:', error)
    return 0
  }
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
/**
 * 递归获取目录总大小
 * @param {string} dirPath 目录路径
 * @returns {Promise<number>} 大小（字节）
 */
export async function getDirectorySize(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0
    const stats = await fs.promises.stat(dirPath)
    if (!stats.isDirectory()) return stats.size

    const files = await fs.promises.readdir(dirPath)
    let totalSize = 0

    for (const file of files) {
      const fullPath = path.join(dirPath, file)
      const fileStats = await fs.promises.stat(fullPath)

      if (fileStats.isDirectory()) {
        totalSize += await getDirectorySize(fullPath)
      } else {
        totalSize += fileStats.size
      }
    }
    return totalSize
  } catch (error) {
    console.error('[file-processor] getDirectorySize 失败:', error)
    return 0
  }
}
