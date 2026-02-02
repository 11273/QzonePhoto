import { protocol, app, net } from 'electron'
import { join, normalize, extname } from 'path'
import { createReadStream, existsSync, statSync, mkdirSync } from 'fs'
import { Readable } from 'stream'
import logger from '@main/core/logger'

/** @type {Record<string, string>} MIME 类型映射表 */
const MIME_TYPES = {
  '.json': 'application/json',
  '.onnx': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm'
}

/**
 * 根据文件后缀获取 MIME 类型
 * @param {string} filePath 文件路径
 * @returns {string} MIME 类型
 */
const getMimeType = (filePath) => {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

/**
 * 注册 AI 模型协议处理器
 * 通过拦截 https://ai.local 域名欺骗 transformers.js，解决其对 URL 协议的硬编码校验
 */
export function registerAiModelsProtocol() {
  const userDataPath = app.getPath('userData')
  const baseDir = join(userDataPath, 'ai-models')
  const CUSTOM_HOST = 'ai.local' // 自定义拦截域名

  // 确保目录存在
  if (!existsSync(baseDir)) {
    try {
      mkdirSync(baseDir, { recursive: true })
      logger.warn(`[AI Protocol] 已创建缺失的模型根目录: ${baseDir}`)
    } catch (error) {
      logger.error(`[AI Protocol] 创建模型根目录失败: ${baseDir}`, error)
    }
  }

  logger.warn(`[AI Protocol] 正在注册 HTTP 拦截器，重定向域名: ${CUSTOM_HOST}`)

  try {
    // 拦截 http 协议
    protocol.handle('http', async (request) => {
      try {
        const url = new URL(request.url)

        // 1. 只拦截特定域名，其余网络流量安全透传
        if (url.hostname !== CUSTOM_HOST) {
          return net.fetch(request, { bypassCustomProtocolHandlers: true })
        }

        // 2. 解析路径 (例如: http://ai.local/clip/config.json -> /clip/config.json)
        let relativePath = decodeURIComponent(url.pathname)
        // 移除多余的斜杠
        relativePath = relativePath.replace(/^[/\\]+/, '')

        const fullPath = normalize(join(baseDir, relativePath))

        logger.debug(`[AI-HTTP] 拦截: ${request.url} -> ${fullPath}`)

        // 3. 安全检查
        if (!fullPath.startsWith(baseDir)) {
          logger.error(`[AI-HTTP] 403 权限拒绝: ${fullPath} 基准路径: ${baseDir}`)
          return new Response('Forbidden', { status: 403 })
        }

        // 4. 读取本地文件并返回响应
        if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
          logger.error(`[AI-HTTP] 404 文件不存在: ${fullPath}`)
          return new Response(`Not Found: ${relativePath}`, { status: 404 })
        }

        const stats = statSync(fullPath)
        const nodeStream = createReadStream(fullPath)
        const webStream = Readable.toWeb(nodeStream)

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Type': getMimeType(fullPath),
            'Content-Length': stats.size.toString(),
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store' // 禁用缓存，强制穿透
          }
        })
      } catch (error) {
        logger.error(`[AI-HTTP] 拦截处理出错: ${request.url}`, error)
        return new Response('Internal Error', { status: 500 })
      }
    })

    logger.warn(`[AI Protocol] HTTP 拦截器部署成功: http://${CUSTOM_HOST} -> ${baseDir}`)
  } catch (err) {
    logger.error(`[AI Protocol] 注册拦截器失败:`, err)
  }
}
