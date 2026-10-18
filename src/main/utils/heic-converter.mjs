import crypto from 'crypto'
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { pathToFileURL } from 'url'
import { Worker } from 'worker_threads'

const HEIC_EXTENSIONS = new Set(['.heic', '.heif'])
const DEFAULT_JPEG_QUALITY = 0.92
const MAX_HEIC_INPUT_BYTES = 100 * 1024 * 1024
const MAX_JPEG_OUTPUT_BYTES = 500 * 1024 * 1024
const CACHE_DIRECTORY_NAME = 'heic-upload-cache'
const CONVERSION_TIMEOUT_MS = 2 * 60 * 1000
const conversionPromises = new Map()
const pendingWorkerJobs = new Map()
const require = createRequire(import.meta.url)
const heicConvertModulePath = require.resolve('heic-convert')
const heicConvertModuleUrl = pathToFileURL(heicConvertModulePath).href
let decoderWorker = null
let nextWorkerJobId = 1

const decoderWorkerSource = `
(async () => {
  const { parentPort, workerData } = await import('node:worker_threads')
  const importedModule = await import(workerData.moduleUrl)
  const convertHeic = importedModule.default || importedModule
  let queue = Promise.resolve()

  parentPort.on('message', (message) => {
    queue = queue.then(async () => {
      try {
        const input = Buffer.from(
          message.input.buffer,
          message.input.byteOffset,
          message.input.byteLength
        )
        const converted = await convertHeic({
          buffer: input,
          format: 'JPEG',
          quality: message.quality
        })
        const output = Uint8Array.from(converted)
        parentPort.postMessage({ id: message.id, output }, [output.buffer])
      } catch (error) {
        parentPort.postMessage({
          id: message.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })
  })
})()
`

const rejectPendingWorkerJobs = (error) => {
  for (const job of pendingWorkerJobs.values()) {
    clearTimeout(job.timer)
    job.reject(error)
  }
  pendingWorkerJobs.clear()
}

const resetDecoderWorker = (error = null) => {
  const worker = decoderWorker
  decoderWorker = null
  if (worker) void worker.terminate().catch(() => {})
  if (error) rejectPendingWorkerJobs(error)
}

const getDecoderWorker = () => {
  if (decoderWorker) return decoderWorker

  const worker = new Worker(decoderWorkerSource, {
    eval: true,
    workerData: { moduleUrl: heicConvertModuleUrl }
  })
  worker.on('message', (message) => {
    const job = pendingWorkerJobs.get(message.id)
    if (!job) return
    clearTimeout(job.timer)
    pendingWorkerJobs.delete(message.id)
    if (message.error) job.reject(new Error(message.error))
    else job.resolve(Buffer.from(message.output))
  })
  worker.on('error', (error) => {
    if (decoderWorker === worker) resetDecoderWorker(error)
  })
  worker.on('exit', (code) => {
    if (decoderWorker !== worker) return
    decoderWorker = null
    if (pendingWorkerJobs.size > 0) {
      rejectPendingWorkerJobs(new Error(`HEIC 解码进程意外退出（${code}）`))
    }
  })
  worker.unref()
  decoderWorker = worker
  return worker
}

const decodeHeicInWorker = (input, quality) =>
  new Promise((resolve, reject) => {
    const worker = getDecoderWorker()
    const id = nextWorkerJobId++
    // 独立拷贝后再转移，避免小文件复用 Node Buffer 池时把共享 ArrayBuffer 一并分离。
    const transferableInput = Uint8Array.from(input)
    const timer = setTimeout(() => {
      if (!pendingWorkerJobs.delete(id)) return
      reject(new Error('HEIC 转换超时'))
      resetDecoderWorker(new Error('HEIC 解码进程已重置'))
    }, CONVERSION_TIMEOUT_MS)

    pendingWorkerJobs.set(id, { resolve, reject, timer })
    try {
      worker.postMessage({ id, input: transferableInput, quality }, [transferableInput.buffer])
    } catch (error) {
      clearTimeout(timer)
      pendingWorkerJobs.delete(id)
      reject(error)
    }
  })

export const isHeicImage = (filePath = '') =>
  HEIC_EXTENSIONS.has(path.extname(String(filePath)).toLowerCase())

export const toJpegFilename = (filename = '') => {
  const basename = path.basename(String(filename))
  const stem = basename.slice(0, Math.max(0, basename.length - path.extname(basename).length))
  return `${stem || 'photo'}.jpg`
}

export const getHeicUploadCacheDirectory = (userDataPath) =>
  path.join(userDataPath, CACHE_DIRECTORY_NAME)

const assertReadableHeic = async (filePath) => {
  if (!isHeicImage(filePath)) throw new Error('文件不是 HEIC/HEIF 图片')

  const stat = await fs.promises.stat(filePath)
  if (!stat.isFile()) throw new Error('所选路径不是文件')
  if (stat.size <= 0) throw new Error('图片内容为空')
  if (stat.size > MAX_HEIC_INPUT_BYTES) {
    throw new Error('HEIC 图片超过 100 MB，无法安全转换')
  }
  return stat
}

const isValidJpeg = async (filePath) => {
  try {
    const file = await fs.promises.open(filePath, 'r')
    try {
      const header = Buffer.alloc(3)
      const { bytesRead } = await file.read(header, 0, header.length, 0)
      return bytesRead === 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    } finally {
      await file.close()
    }
  } catch {
    return false
  }
}

export const convertHeicToJpegBuffer = async (
  filePath,
  { quality = DEFAULT_JPEG_QUALITY } = {}
) => {
  await assertReadableHeic(filePath)
  const input = await fs.promises.readFile(filePath)

  let output
  try {
    output = await decodeHeicInWorker(input, quality)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`无法解码 HEIC 图片${detail ? `：${detail}` : ''}`)
  }

  if (output.length < 3 || output[0] !== 0xff || output[1] !== 0xd8 || output[2] !== 0xff) {
    throw new Error('HEIC 转换结果不是有效的 JPEG 图片')
  }
  if (output.length > MAX_JPEG_OUTPUT_BYTES) {
    throw new Error('转换后的 JPEG 超过 500 MB，无法上传')
  }
  return output
}

const cacheKeyFor = (filePath, stat) =>
  crypto
    .createHash('sha256')
    .update(`${path.resolve(filePath)}\0${stat.size}\0${stat.mtimeMs}`)
    .digest('hex')

/**
 * 将 HEIC/HEIF 转成上传接口可识别的 JPEG 缓存文件。原文件不会被修改。
 */
export const prepareHeicForUpload = async (filePath, cacheDirectory) => {
  const stat = await assertReadableHeic(filePath)
  const cacheKey = cacheKeyFor(filePath, stat)
  const outputPath = path.join(cacheDirectory, `${cacheKey}.jpg`)

  if (await isValidJpeg(outputPath)) {
    const outputStat = await fs.promises.stat(outputPath)
    return {
      filePath: outputPath,
      filename: toJpegFilename(filePath),
      fileSize: outputStat.size,
      sourceFilePath: filePath,
      sourceFilename: path.basename(filePath),
      convertedFromHeic: true
    }
  }

  const pending = conversionPromises.get(outputPath)
  if (pending) return pending

  const conversion = (async () => {
    await fs.promises.mkdir(cacheDirectory, { recursive: true, mode: 0o700 })
    const jpeg = await convertHeicToJpegBuffer(filePath)
    const temporaryPath = `${outputPath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`

    try {
      await fs.promises.writeFile(temporaryPath, jpeg, { mode: 0o600 })
      try {
        await fs.promises.rename(temporaryPath, outputPath)
      } catch {
        if (!(await isValidJpeg(outputPath))) {
          // Windows 不允许 rename 覆盖已有文件；清掉损坏缓存后再原子替换。
          await fs.promises.unlink(outputPath).catch((unlinkError) => {
            if (unlinkError?.code !== 'ENOENT') throw unlinkError
          })
          await fs.promises.rename(temporaryPath, outputPath)
        }
      }
    } finally {
      await fs.promises.unlink(temporaryPath).catch(() => {})
    }

    return {
      filePath: outputPath,
      filename: toJpegFilename(filePath),
      fileSize: jpeg.length,
      sourceFilePath: filePath,
      sourceFilename: path.basename(filePath),
      convertedFromHeic: true
    }
  })()

  conversionPromises.set(outputPath, conversion)
  try {
    return await conversion
  } finally {
    conversionPromises.delete(outputPath)
  }
}

export const removePreparedHeicFile = async (filePath, cacheDirectory) => {
  if (!filePath || !cacheDirectory) return false
  const resolvedFile = path.resolve(filePath)
  const resolvedCache = path.resolve(cacheDirectory)
  if (
    path.dirname(resolvedFile) !== resolvedCache ||
    !/^[a-f0-9]{64}\.jpg$/i.test(path.basename(resolvedFile))
  ) {
    return false
  }
  try {
    await fs.promises.unlink(resolvedFile)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

export const cleanupExpiredHeicCache = async (
  cacheDirectory,
  { maxAgeMs = 30 * 24 * 60 * 60 * 1000, now = Date.now() } = {}
) => {
  let entries
  try {
    entries = await fs.promises.readdir(cacheDirectory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return 0
    throw error
  }

  let removed = 0
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.jpg(?:\.tmp-.+)?$/i.test(entry.name)) continue
    const filePath = path.join(cacheDirectory, entry.name)
    try {
      const stat = await fs.promises.stat(filePath)
      if (now - stat.mtimeMs < maxAgeMs) continue
      await fs.promises.unlink(filePath)
      removed += 1
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return removed
}
