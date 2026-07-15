import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = 4173
const WEBSITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../website')
const REAL_WEBSITE_ROOT = await realpath(WEBSITE_ROOT)

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
}

const redirects = new Map([
  ['/features', '/features/'],
  ['/privacy', '/privacy/']
])

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', `http://${HOST}:${PORT}`).pathname)
  } catch {
    sendText(response, 400, 'Bad Request')
    return
  }

  const redirect = redirects.get(pathname)
  if (redirect) {
    response.writeHead(308, { Location: redirect, 'Cache-Control': 'no-store' })
    response.end()
    return
  }

  const localPath = mapRequestPath(pathname)
  if (!localPath) {
    await sendNotFound(response, request.method)
    return
  }

  try {
    const realFilePath = await realpath(localPath)
    if (!isInsideWebsiteRoot(realFilePath)) {
      await sendNotFound(response, request.method)
      return
    }

    const fileStats = await stat(realFilePath)
    if (!fileStats.isFile()) {
      await sendNotFound(response, request.method)
      return
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': fileStats.size,
      'Content-Type':
        CONTENT_TYPES[path.extname(realFilePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    const stream = createReadStream(realFilePath)
    stream.on('error', (error) => {
      console.error('[website] Failed to read file:', error)
      response.destroy(error)
    })
    stream.pipe(response)
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      await sendNotFound(response, request.method)
      return
    }
    console.error('[website] Failed to serve request:', error)
    sendText(response, 500, 'Internal Server Error')
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[website] http://${HOST}:${PORT} 已被占用，请先关闭占用该端口的程序。`)
  } else {
    console.error('[website] 启动失败:', error)
  }
  process.exitCode = 1
})

server.listen(PORT, HOST, () => {
  console.log(`[website] 本地官网：http://localhost:${PORT}`)
  console.log('[website] 按 Control + C 停止服务')
})

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

function mapRequestPath(pathname) {
  let relativePath = pathname
  if (relativePath.endsWith('/')) relativePath += 'index.html'

  const resolvedPath = path.resolve(WEBSITE_ROOT, `.${relativePath}`)
  if (resolvedPath !== WEBSITE_ROOT && !resolvedPath.startsWith(`${WEBSITE_ROOT}${path.sep}`))
    return ''
  return resolvedPath
}

function isInsideWebsiteRoot(filePath) {
  return filePath === REAL_WEBSITE_ROOT || filePath.startsWith(`${REAL_WEBSITE_ROOT}${path.sep}`)
}

function sendText(response, status, message) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  })
  response.end(message)
}

async function sendNotFound(response, method) {
  try {
    const content = await readFile(path.join(REAL_WEBSITE_ROOT, '404.html'))
    response.writeHead(404, {
      'Cache-Control': 'no-store',
      'Content-Length': content.length,
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    })
    response.end(method === 'HEAD' ? undefined : content)
  } catch {
    sendText(response, 404, 'Not Found')
  }
}

function shutdown() {
  server.close(() => process.exit(0))
}
