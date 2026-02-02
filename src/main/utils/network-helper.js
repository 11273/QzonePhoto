import axios from 'axios'
import fs from 'fs'
import { pipeline } from 'stream/promises'

/**
 * 获取远程文件大小 (HEAD 请求)
 * @param {string} url - 远程文件 URL
 * @returns {Promise<number>} 文件大小，失败返回 0
 */
export async function getRemoteFileSize(url) {
  try {
    const res = await axios.head(url, { timeout: 5000 })
    return parseInt(res.headers['content-length'] || 0, 10)
  } catch {
    return 0
  }
}

/**
 * 流式下载文件
 * @param {string} url - 下载地址
 * @param {string} savePath - 保存路径
 * @param {Function} [onProgress] - 进度回调 (chunkSize) => void
 */
export async function downloadStream(url, savePath, onProgress) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 600000 // 10分钟超时
  })

  // 监听数据流更新进度
  if (onProgress) {
    response.data.on('data', (chunk) => {
      onProgress(chunk.length)
    })
  }

  // 使用 pipeline 管理流，自动处理错误和关闭文件
  const writer = fs.createWriteStream(savePath)
  await pipeline(response.data, writer)
}
