import crypto from 'crypto'
import path from 'path'

const tokenToPath = new Map()
const pathToToken = new Map()

export function registerLocalMedia(filePath) {
  const normalizedPath = path.resolve(filePath)
  const existingToken = pathToToken.get(normalizedPath)
  if (existingToken) return existingToken

  const token = crypto.randomUUID()
  tokenToPath.set(token, normalizedPath)
  pathToToken.set(normalizedPath, token)
  return token
}

export function resolveLocalMedia(token) {
  return tokenToPath.get(token) || null
}
