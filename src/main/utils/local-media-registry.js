import crypto from 'crypto'
import path from 'path'

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_ENTRIES = 2048
// 令牌按最近一次媒体读取续期。两小时足够覆盖暂停后继续播放，
// 同时仍避免本地文件地址被长期复用。
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

const tokenToMedia = new Map()
const pathToToken = new Map()

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
