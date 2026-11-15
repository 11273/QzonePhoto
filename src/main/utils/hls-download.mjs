import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as delay } from 'node:timers/promises'
import ffmpegStatic from 'ffmpeg-static'

export const isHlsDownload = (url, contentType = '') =>
  /\.m3u8(?:$|[?#])/i.test(url) || /(?:mpegurl|vnd\.apple\.mpegurl)/i.test(contentType)

export async function requestHlsResource(request, token, signal) {
  for (let attempt = 0; ; attempt++) {
    token.throwIfRequested()
    try {
      return await request()
    } catch (error) {
      error.response?.data?.destroy?.()
      const retryable =
        [404, 408, 429, 500, 502, 503, 504].includes(error.response?.status) ||
        (!error.response &&
          ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNABORTED'].includes(error.code))
      if (attempt >= 3 || !retryable || token.reason || signal?.aborted) throw error
      const retryAfter = Number(error.response?.headers?.['retry-after']) || 0
      const controller = new AbortController()
      const cancel = () => controller.abort()
      token.subscribe(cancel)
      try {
        await delay(Math.min(30000, Math.max(1000 * 2 ** attempt, retryAfter * 1000)), undefined, {
          signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
        })
      } catch (error) {
        token.throwIfRequested()
        throw error
      } finally {
        token.unsubscribe(cancel)
      }
    }
  }
}

// Do not let a 200 response containing an error page replace a TS/fMP4 segment.
// Encrypted segments, keys and nonzero byte ranges must retain their raw bytes.
const verifySegment = () => {
  let prefix = Buffer.alloc(0)
  let verified = false
  const invalid = () =>
    Object.assign(new Error('视频分段内容无效或不完整，请刷新视频列表后重试'), {
      code: 'INVALID_HLS_SEGMENT'
    })
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (verified) return callback(null, chunk)
      prefix = Buffer.concat([prefix, chunk])
      if (prefix.length < 8) return callback()
      const box = prefix.toString('ascii', 4, 8)
      const valid =
        prefix[0] === 0x47 ||
        prefix[4] === 0x47 ||
        ['ftyp', 'styp', 'moof', 'sidx', 'moov', 'free'].includes(box) ||
        (prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0) ||
        prefix.toString('ascii', 0, 3) === 'ID3' ||
        (prefix[0] === 0x0b && prefix[1] === 0x77)
      if (!valid) return callback(invalid())
      verified = true
      callback(null, prefix)
      prefix = null
    },
    flush(callback) {
      callback(verified ? null : invalid())
    }
  })
}

// FFmpeg handles HLS variants, encryption and byte ranges. Its only network access
// is this private loopback bridge: every remote byte uses our normal HTTP client,
// credential rules, shared download limiter and cancellation token.
export async function downloadHlsVideo({
  url,
  filePath,
  response,
  fetchResource,
  limiter,
  cancelToken,
  onData
}) {
  const tempPath = path.join(path.dirname(filePath), `.qzonephoto-${randomUUID()}.mp4`)
  const resources = new Map()
  const addresses = new Map()
  const prefix = `/${randomUUID()}/`
  const controllers = new Set()
  let child
  let firstResponse = response
  let failure
  let waitMs = 0
  let killTimer
  let origin

  const stop = () => {
    firstResponse?.data.destroy()
    for (const controller of controllers) controller.abort()
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill()
      killTimer ||= setTimeout(() => child.kill('SIGKILL'), 1000)
      killTimer.unref()
    }
  }
  const resourceAddress = (value, base, verify = false) => {
    const target = new URL(value, base)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
      throw new Error('视频播放列表包含不支持的分段地址')
    }
    if (!addresses.has(target.href)) {
      if (resources.size >= 100000) throw new Error('视频播放列表的分段数量过多')
      const extension = path.posix.extname(target.pathname)
      const suffix = /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension : '.ts'
      const route = `${prefix}${resources.size}${suffix}`
      resources.set(route, { url: target.href, verify })
      addresses.set(target.href, `${origin}${route}`)
    }
    return addresses.get(target.href)
  }

  const rewritePlaylist = (text, base) => {
    const lines = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/)
    if (lines[0] !== '#EXTM3U') throw new Error('视频地址没有返回有效的播放列表')
    if (lines.some((line) => line.startsWith('#EXTINF:')) && !lines.includes('#EXT-X-ENDLIST')) {
      throw new Error('当前视频仍在直播，请结束后再下载')
    }
    let encrypted = false
    return lines
      .map((line) => {
        if (line.startsWith('#EXT-X-KEY:')) encrypted = !/METHOD=NONE(?:,|$)/.test(line)
        return !line || line.startsWith('#')
          ? line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${resourceAddress(uri, base)}"`)
          : resourceAddress(line.trim(), base, !encrypted)
      })
      .join('\n')
  }

  const serve = async (req, res) => {
    const target = resources.get(req.url)
    if (!target || req.method !== 'GET') {
      res.writeHead(404).end()
      return
    }
    const controller = new AbortController()
    controllers.add(controller)
    res.on('close', () => controller.abort())
    let upstream
    let transfer
    try {
      cancelToken.token.throwIfRequested()
      upstream =
        firstResponse ||
        (await requestHlsResource(
          () => fetchResource(target.url, req.headers.range, controller.signal),
          cancelToken.token,
          controller.signal
        ))
      if (firstResponse) firstResponse = null
      const contentType = String(upstream.headers['content-type'] || '')
      const finalUrl = upstream.request?.res?.responseUrl || target.url
      const playlistResponse =
        isHlsDownload(target.url, contentType) || isHlsDownload(finalUrl, contentType)
      if (
        !playlistResponse &&
        /^(?:text\/|application\/(?:json|xml|xhtml\+xml))/i.test(contentType)
      ) {
        throw new Error('视频分段返回了非媒体内容，请刷新视频列表后重试')
      }
      transfer = limiter.createStream()
      transfer.on('data', onData)
      upstream.data.on('error', (error) => {
        if (!controller.signal.aborted && !res.destroyed) failure ||= error
      })
      if (playlistResponse) {
        const chunks = []
        let size = 0
        await pipeline(upstream.data, transfer, async (source) => {
          for await (const chunk of source) {
            size += chunk.length
            if (size > 1024 * 1024) throw new Error('视频播放列表过大')
            chunks.push(chunk)
          }
        })
        const playlist = rewritePlaylist(Buffer.concat(chunks).toString('utf8'), finalUrl)
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' }).end(playlist)
      } else {
        const headers = {}
        for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
          if (upstream.headers[name]) headers[name] = upstream.headers[name]
        }
        res.writeHead(upstream.status, headers)
        const nonzeroRange = /^bytes=[1-9]\d*-/.test(req.headers.range || '')
        if (target.verify && !nonzeroRange) {
          const verifier = verifySegment()
          verifier.on('error', (error) => {
            if (error.code === 'INVALID_HLS_SEGMENT') failure ||= error
          })
          await pipeline(upstream.data, transfer, verifier, res)
        } else await pipeline(upstream.data, transfer, res)
      }
    } catch (error) {
      // A normal FFmpeg probe/seek can close a response before consuming it.
      if (!controller.signal.aborted) failure ||= error
      upstream?.data?.destroy()
      res.destroy()
      if (failure) stop()
    } finally {
      waitMs += transfer?.waitMs || 0
      controllers.delete(controller)
    }
  }
  const server = http.createServer((req, res) => void serve(req, res))
  try {
    cancelToken.token.throwIfRequested()
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    origin = `http://127.0.0.1:${server.address().port}`
    const source = resourceAddress(url, url)
    cancelToken.token.subscribe(stop)
    cancelToken.token.throwIfRequested()
    const executable =
      typeof ffmpegStatic === 'string'
        ? ffmpegStatic.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
        : ''
    if (!executable) throw new Error('当前系统没有可用的视频合并工具')
    await new Promise((resolve, reject) => {
      let mediaError = false
      child = spawn(
        executable,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-protocol_whitelist',
          'http,tcp,crypto',
          '-f',
          'hls',
          '-i',
          source,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          tempPath
        ],
        { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
      )
      // Keep diagnostics bounded and private. A demux error must not silently
      // produce a short but otherwise valid MP4 if FFmpeg skipped a segment.
      child.stderr.on('data', () => {
        mediaError = true
      })
      child.once('error', reject)
      child.once('close', (code) => {
        if (cancelToken.token.reason) reject(cancelToken.token.reason)
        else if (failure) reject(failure)
        else if (code !== 0 || mediaError)
          reject(new Error('视频分段合并失败，请刷新视频列表后重试'))
        else resolve()
      })
    })
    cancelToken.token.throwIfRequested()
    await fs.rename(tempPath, filePath)
    return { contentType: 'video/mp4', rateLimitWaitMs: waitMs }
  } finally {
    stop()
    cancelToken.token.unsubscribe(stop)
    clearTimeout(killTimer)
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await fs.unlink(tempPath).catch(() => {})
  }
}
