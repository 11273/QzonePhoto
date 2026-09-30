import fs from 'fs'
import path from 'path'

const CONTENT_TYPE_MEDIA = new Map([
  ['image/jpeg', { kind: 'image', extension: '.jpg' }],
  ['image/png', { kind: 'image', extension: '.png' }],
  ['image/gif', { kind: 'image', extension: '.gif' }],
  ['image/webp', { kind: 'image', extension: '.webp' }],
  ['image/bmp', { kind: 'image', extension: '.bmp' }],
  ['image/avif', { kind: 'image', extension: '.avif' }],
  ['image/heic', { kind: 'image', extension: '.heic' }],
  ['image/heif', { kind: 'image', extension: '.heif' }],
  ['video/mp4', { kind: 'video', extension: '.mp4' }],
  ['video/quicktime', { kind: 'video', extension: '.mov' }],
  ['video/webm', { kind: 'video', extension: '.webm' }],
  ['video/x-msvideo', { kind: 'video', extension: '.avi' }]
])

const startsWithBytes = (buffer, bytes) =>
  buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)

const ascii = (buffer, start, end) => buffer.subarray(start, end).toString('ascii')

export const detectMediaSignature = (buffer, contentType = '') => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null

  const textPrefix = buffer.subarray(0, 32).toString('utf8').trimStart().toLowerCase()
  if (textPrefix.startsWith('<!doctype') || textPrefix.startsWith('<html')) return null

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return { kind: 'image', extension: '.jpg' }
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image', extension: '.png' }
  }
  if (['GIF87a', 'GIF89a'].includes(ascii(buffer, 0, 6))) {
    return { kind: 'image', extension: '.gif' }
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    return { kind: 'image', extension: '.webp' }
  }
  if (ascii(buffer, 0, 2) === 'BM') return { kind: 'image', extension: '.bmp' }

  if (buffer.length >= 12 && ascii(buffer, 4, 8) === 'ftyp') {
    const brand = ascii(buffer, 8, 12).toLowerCase()
    if (brand.startsWith('avi')) return { kind: 'image', extension: '.avif' }
    if (brand.startsWith('hei') || brand.startsWith('hev')) {
      return { kind: 'image', extension: brand.startsWith('hei') ? '.heic' : '.heif' }
    }
    if (brand === 'qt  ') return { kind: 'video', extension: '.mov' }
    return { kind: 'video', extension: '.mp4' }
  }
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: 'video', extension: '.webm' }
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'AVI ') {
    return { kind: 'video', extension: '.avi' }
  }

  const normalizedContentType = String(contentType).split(';')[0].trim().toLowerCase()
  return CONTENT_TYPE_MEDIA.get(normalizedContentType) || null
}

export const readMediaFileSignature = async (filePath, contentType = '') => {
  const handle = await fs.promises.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(32)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return detectMediaSignature(buffer.subarray(0, bytesRead), contentType)
  } finally {
    await handle.close()
  }
}

export const isExpectedMediaKind = (taskType, media) => {
  if (!media) return false
  if (taskType === 'video') return media.kind === 'video'
  if (taskType === 'image') return media.kind === 'image'
  return true
}

export const replaceMediaFilenameExtension = (filename, extension, maxLength = 220) => {
  const safeExtension = String(extension || '').startsWith('.') ? extension : `.${extension}`
  const currentExtension = path.extname(String(filename || ''))
  const stem = String(filename || 'media').slice(
    0,
    currentExtension ? -currentExtension.length : undefined
  )
  const maxStemLength = Math.max(1, maxLength - safeExtension.length)
  return `${stem.slice(0, maxStemLength)}${safeExtension}`
}
