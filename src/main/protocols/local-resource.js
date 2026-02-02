import { protocol, session } from 'electron'
import { existsSync, createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import logger from '@main/core/logger'

/**
 * 注册本地资源协议处理器
 * 解决 webSecurity: true 下无法直接加载 file:// 资源的问题
 */
export function registerLocalResourceProtocol() {
  const SCHEME = 'qzone-local'

  const handler = async (request) => {
    try {
      // 这里的处理逻辑必须极其稳健，防止 hostname 转换导致的路径丢失
      const urlString = request.url

      // 1. 提取路径：直接移除协议头部分
      // qzone-local:///Users/xxx -> /Users/xxx
      // qzone-local://Users/xxx  -> Users/xxx -> /Users/xxx
      let filePath = decodeURIComponent(urlString.replace(`${SCHEME}://`, ''))

      // 2. 补齐开头的斜杠 (主要是处理 //Users 转为 /Users 的情况)
      filePath = filePath.replace(/^[/\\]*/, '/')

      // 3. 安全检查 (只允许读取文件)
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        logger.error(`[Protocol] 404 文件不存在: ${filePath}`)
        return new Response('File Not Found', { status: 404 })
      }

      const stats = statSync(filePath)
      const nodeStream = createReadStream(filePath)
      const webStream = Readable.toWeb(nodeStream)

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Length': stats.size.toString(),
          'Content-Type': 'image/jpeg', // 这里的图片基本都是 jpeg/png，浏览器通常能自适应
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
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
