import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_ENTRIES = 2048
// 令牌按最近一次媒体读取续期。两小时足够覆盖暂停后继续播放，
// 同时仍避免本地文件地址被长期复用。
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

const tokenToMedia = new Map()
const pathToToken = new Map()

export const getLocalMediaMimeType = (filePath) => {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.avi': 'video/x-msvideo'
  }
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

const removeToken = (token, entry = tokenToMedia.get(token)) => {
  tokenToMedia.delete(token)
  if (entry?.filePath && pathToToken.get(entry.filePath) === token) {
    pathToToken.delete(entry.filePath)
  }
}

const pruneExpiredMedia = (now = Date.now()) => {
  for (const [token, entry] of tokenToMedia) {
    if (now - entry.lastAccessedAt > TOKEN_TTL_MS) removeToken(token, entry)
  }

  while (tokenToMedia.size >= MAX_ENTRIES) {
    const oldestToken = tokenToMedia.keys().next().value
    if (!oldestToken) break
    removeToken(oldestToken)
  }
}

export const registerLocalMedia = (filePath) => {
  if (typeof filePath !== 'string' || !filePath.trim()) return null

  const normalizedPath = path.resolve(filePath)
  const now = Date.now()
  pruneExpiredMedia(now)

  const existingToken = pathToToken.get(normalizedPath)
  if (existingToken) {
    const entry = tokenToMedia.get(existingToken)
    if (entry) {
      entry.lastAccessedAt = now
      tokenToMedia.delete(existingToken)
      tokenToMedia.set(existingToken, entry)
      return existingToken
    }
    pathToToken.delete(normalizedPath)
  }

  const token = crypto.randomUUID()
  tokenToMedia.set(token, { filePath: normalizedPath, lastAccessedAt: now })
  pathToToken.set(normalizedPath, token)
  return token
}

export const resolveLocalMedia = (token) => {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null

  const entry = tokenToMedia.get(token)
  if (!entry) return null

  const now = Date.now()
  if (now - entry.lastAccessedAt > TOKEN_TTL_MS) {
    removeToken(token, entry)
    return null
  }

  entry.lastAccessedAt = now
  tokenToMedia.delete(token)
  tokenToMedia.set(token, entry)
  return entry.filePath
}

// Shared by the real Electron sessions and the isolated playback regression.
export const handleLocalMediaRequest = async (req, onError = () => {}) => {
  const url = new URL(req.url)
  if (url.hostname !== 'local') return new Response('Not found', { status: 404 })
  const filePath = resolveLocalMedia(url.pathname.replace(/^\//, ''))
  if (!filePath) return new Response('Not found', { status: 404 })
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) return new Response('Not found', { status: 404 })
    const range = req.headers.get('range')
    let start = 0
    let end = stat.size - 1
    let status = 200
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range)
      if (match) {
        start = parseInt(match[1], 10)
        end = Math.min(match[2] ? parseInt(match[2], 10) : stat.size - 1, stat.size - 1)
        if (start >= stat.size || start > end) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` }
          })
        }
        status = 206
      }
    }
    const stream = fs.createReadStream(filePath, { start, end })
    const headers = {
      'Content-Length': String(end - start + 1),
      'Content-Type': getLocalMediaMimeType(filePath),
      'Accept-Ranges': 'bytes'
    }
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
    return new Response(Readable.toWeb(stream), { status, headers })
  } catch (error) {
    onError(error)
    return new Response('Unable to read media', { status: 500 })
  }
}
