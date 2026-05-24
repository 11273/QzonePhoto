/**
 * HTTP/2 客户端 —— 专门给分片上传用
 *
 * QQ 空间上传接口 (h5.qzone.qq.com) 服务端原生支持 HTTP/2，浏览器自动用 H2
 * 单连接多路复用并发上传几十路 stream；axios + Node http(s) 默认走 HTTP/1.1，
 * 6 路 keep-alive 也跟不上。视频几千个 16KB 分片差距尤其明显。
 *
 * 实现要点：
 *  - 每个 origin 维护一个共享 ClientHttp2Session，复用 TCP/TLS
 *  - 自动处理 GOAWAY / error / close 重连
 *  - 自动解压 gzip 响应
 *  - 返回结构兼容 axios：{ status, data }
 */

import http2 from 'node:http2'
import zlib from 'node:zlib'

const sessions = new Map() // origin -> ClientHttp2Session

function getSession(origin) {
  let s = sessions.get(origin)
  if (s && !s.closed && !s.destroyed) return s

  s = http2.connect(origin, { settings: { enablePush: false } })
  s.setMaxListeners(0)
  // 远端建议关闭时主动放弃这个 session，下次重建
  const drop = () => {
    if (sessions.get(origin) === s) sessions.delete(origin)
  }
  s.on('error', drop)
  s.on('close', drop)
  s.on('goaway', drop)
  sessions.set(origin, s)
  return s
}

function decodeBody(buf, encoding) {
  if (!encoding) return buf
  const enc = encoding.toLowerCase()
  try {
    if (enc === 'gzip') return zlib.gunzipSync(buf)
    if (enc === 'deflate') return zlib.inflateSync(buf)
    if (enc === 'br') return zlib.brotliDecompressSync(buf)
  } catch {
    // ignore decompression failure，回退到原始 buffer
  }
  return buf
}

// H2 spec 定义的可安全重试错误码：服务端明确告知 stream 没被处理
// NGHTTP2_REFUSED_STREAM (0x7): "stream not processed, safe to retry"
// NGHTTP2_ENHANCE_YOUR_CALM (0xb): 限流，但休息一下重试通常也行
const RETRYABLE_H2_CODES = new Set(['NGHTTP2_REFUSED_STREAM', 'NGHTTP2_ENHANCE_YOUR_CALM'])

function isRetryableH2Error(err) {
  if (!err) return false
  // Node http2 错误 code 形如 'ERR_HTTP2_STREAM_ERROR'，detail 写在 message 里
  const msg = err.message || ''
  for (const code of RETRYABLE_H2_CODES) {
    if (msg.includes(code)) return true
  }
  // GOAWAY 之后的请求会被立即拒，重建 session 后可重试
  if (msg.includes('GOAWAY') || msg.includes('ERR_HTTP2_GOAWAY')) return true
  // session 已 closed/destroyed
  if (msg.includes('ERR_HTTP2_INVALID_SESSION')) return true
  return false
}

function doRequest(origin, reqHeaders, payload) {
  const session = getSession(origin)
  return new Promise((resolve, reject) => {
    let stream
    try {
      stream = session.request(reqHeaders)
    } catch (e) {
      reject(e)
      return
    }
    let status = 0
    let respEncoding = null
    const chunks = []
    stream.on('response', (h) => {
      status = h[':status'] || 0
      respEncoding = h['content-encoding'] || null
    })
    stream.on('data', (c) => chunks.push(c))
    stream.on('end', () => {
      const raw = Buffer.concat(chunks)
      const decoded = decodeBody(raw, respEncoding)
      const text = decoded.toString('utf-8')
      let data = text
      try {
        data = JSON.parse(text)
      } catch {
        // 非 JSON 响应，原样返回
      }
      resolve({ status, data })
    })
    stream.on('error', (e) => {
      // 暴露原始 error code，便于上层判断重试
      reject(e)
    })
    stream.end(payload)
  })
}

/**
 * 通过 HTTP/2 发 POST 请求；REFUSED_STREAM 等可重试错误自动重建 session 重试
 * @param {string} url 完整 URL
 * @param {string|Buffer|object} body 请求体（object 自动 JSON.stringify）
 * @param {Object} headers 请求头（小写 key）
 * @returns {Promise<{status:number, data:any}>}
 */
export async function h2Post(url, body, headers = {}) {
  const u = new URL(url)
  const reqHeaders = {
    ':method': 'POST',
    ':path': u.pathname + u.search,
    ':scheme': u.protocol.slice(0, -1),
    ':authority': u.host,
    'accept-encoding': 'gzip'
  }
  for (const [k, v] of Object.entries(headers)) {
    if (v != null) reqHeaders[k.toLowerCase()] = String(v)
  }
  const payload = Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body)

  const maxAttempts = 4
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await doRequest(u.origin, reqHeaders, payload)
    } catch (e) {
      lastErr = e
      if (!isRetryableH2Error(e) || attempt === maxAttempts) throw e
      // 触发当前 session 重建：close 后下次 getSession 会建新的
      const cur = sessions.get(u.origin)
      if (cur && !cur.closed && !cur.destroyed) {
        try {
          cur.close()
        } catch {
          // ignore
        }
      }
      sessions.delete(u.origin)
      // 指数退避（50ms / 100ms / 200ms）
      await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt - 1)))
    }
  }
  throw lastErr
}

/**
 * 关闭所有 H2 session（应用退出时调用）
 */
export function closeAllH2Sessions() {
  for (const s of sessions.values()) {
    try {
      s.close()
    } catch {
      // ignore
    }
  }
  sessions.clear()
}
