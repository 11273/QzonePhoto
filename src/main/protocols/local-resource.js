import { protocol, session } from 'electron'
import path from 'path'
import { existsSync, createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import logger from '@main/core/logger'

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm'
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function resolveLocalPath(urlString, scheme) {
  const url = new URL(urlString)

  if (url.hostname === 'local') {
    return decodeURIComponent(url.pathname.replace(/^\//, ''))
  }

  let filePath = decodeURIComponent(urlString.replace(`${scheme}://`, ''))
  filePath = filePath.replace(/^[/\\]*/, '/')
  return filePath
}

/**
 * 注册本地资源协议处理器
 * 解决 webSecurity: true 下无法直接加载 file:// 资源的问题
 */
export function registerLocalResourceProtocol() {
  const SCHEME = 'qzone-local'

  const handler = async (request) => {
    try {
      const filePath = resolveLocalPath(request.url, SCHEME)

      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        logger.error(`[Protocol] 404 文件不存在: ${filePath}`)
        return new Response('File Not Found', { status: 404 })
      }

      const stats = statSync(filePath)
      const range = request.headers.get('range')
      let start = 0
      let end = stats.size - 1
      let status = 200

      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range)
        if (match) {
          start = parseInt(match[1], 10)
          end = match[2] ? parseInt(match[2], 10) : stats.size - 1
          status = 206
        }
      }

      const nodeStream = createReadStream(filePath, { start, end })
      const webStream = Readable.toWeb(nodeStream)
      const headers = {
        'Content-Length': String(end - start + 1),
        'Content-Type': getMimeType(filePath),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*'
      }

      if (status === 206) {
        headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`
      }

      return new Response(webStream, {
        status,
        headers
      })
    } catch (error) {
      logger.error('[Protocol] 处理本地资源请求失败:', error)
      return new Response('Internal Protocol Error', { status: 500 })
    }
  }

  // A. 全局注册 (默认 Session)
  logger.warn(`[Protocol] 正在注册全局 ${SCHEME}:// 协议`)
  protocol.handle(SCHEME, handler)

  // B. 为持久化 Session 注册 (解决主窗口使用 partition: persist:qzone 时 handle 失效的问题)
  try {
    const qzoneSession = session.fromPartition('persist:qzone')
    if (qzoneSession) {
      logger.warn(`[Protocol] 正在为 persist:qzone 分区注册 ${SCHEME}:// 协议`)
      qzoneSession.protocol.handle(SCHEME, handler)
    }
  } catch (err) {
    logger.error('[Protocol] 尝试为分区 Session 注册协议失败:', err)
  }
}
