import fs from 'fs'
import path from 'path'
import logger from '@main/core/logger'
import { AI_CONFIG } from './model-config'
import { getRemoteFileSize, downloadStream } from '@main/utils/network-helper'

export class ModelDownloader {
  constructor(options = {}) {
    this.onProgress = options.onProgress || (() => {})
    this.downloadedBytes = 0
    this.totalBytes = 0
    this.startTime = 0
    this.lastNotifyTime = 0
  }

  async start(modelId = 'human') {
    this.startTime = Date.now()
    logger.info(`[Downloader] 开始检查模型: ${modelId}...`)

    const { baseDir, mirrors } = AI_CONFIG
    const modelConfig = AI_CONFIG[modelId]

    if (!modelConfig) {
      logger.info(`[Downloader] 未找到模型配置 [${modelId}]，跳过下载`)
      return true
    }

    const fileList = modelConfig.fileList || [modelConfig.fileName]

    // 1. 预检所有文件大小
    logger.info(`[Downloader] 正在获取 [${modelId}] 模型元数据...`)
    const downloadTasks = []
    let totalSize = 0

    for (const fileName of fileList) {
      const remotePath = `${modelConfig.id}/resolve/main/${fileName}`
      let activeUrl = null
      let fileSize = 0

      for (const mirror of mirrors) {
        const url = `${mirror}/${remotePath}`
        const size = await getRemoteFileSize(url)
        if (size > 0) {
          activeUrl = url
          fileSize = size
          break
        }
      }

      if (!activeUrl) {
        throw new Error(`无法连接到模型镜像源: ${fileName}`)
      }

      totalSize += fileSize
      downloadTasks.push({
        fileName,
        activeUrl,
        fileSize,
        targetFile: path.join(baseDir, modelConfig.saveDir, fileName)
      })
    }

    this.totalBytes = totalSize
    logger.info(
      `[Downloader] 锁定源，总计文件数: ${downloadTasks.length}, 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`
    )

    // 2. 依次下载
    for (const task of downloadTasks) {
      const { targetFile, activeUrl, fileSize, fileName } = task

      // 确保目录存在
      fs.mkdirSync(path.dirname(targetFile), { recursive: true })

      if (fs.existsSync(targetFile)) {
        const stats = fs.statSync(targetFile)
        if (stats.size === fileSize) {
          logger.info(`[Downloader] 文件已存在且完整: ${fileName}`)
          this.downloadedBytes += fileSize
          this._notify(this.downloadedBytes, this.totalBytes)
          continue
        }
      }

      logger.info(`[Downloader] 正在下载: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
      try {
        await downloadStream(activeUrl, targetFile, (chunkSize) => {
          this.downloadedBytes += chunkSize
          this._notify(this.downloadedBytes, this.totalBytes)
        })
      } catch (error) {
        logger.error(`[Downloader] 下载失败: ${fileName}, ${error.message}`)
        if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile)
        throw error
      }
    }

    logger.info('[Downloader] 所有模型文件下载完成')
    return true
  }

  // 简单的进度通知封装
  _notify(downloaded, total) {
    const now = Date.now()
    // 200ms 节流，或者下载完成时强制通知
    if (now - this.lastNotifyTime > 200 || downloaded >= total) {
      const percent = total > 0 ? (downloaded / total) * 100 : 0
      const duration = (now - this.startTime) / 1000
      const speed =
        duration > 0 ? (downloaded / 1024 / 1024 / duration).toFixed(1) + ' MB/s' : '0 MB/s'

      this.onProgress({
        percent: parseFloat(percent.toFixed(1)),
        downloadedStr: `${(downloaded / 1024 / 1024).toFixed(1)} MB`,
        totalStr: `${(total / 1024 / 1024).toFixed(1)} MB`,
        speed
      })
      this.lastNotifyTime = now
    }
  }
}
