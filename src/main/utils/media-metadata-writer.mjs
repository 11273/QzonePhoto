import { execFile } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import ffmpegStatic from 'ffmpeg-static'
import { writeImageDescription } from './image-description-writer.mjs'
import { replaceFileSafely } from './replace-file.mjs'

const MAX_FIELD_LENGTH = 2000
const MAX_COMMENT_LENGTH = 6000
const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov'])

const normalizeText = (value, limit = MAX_FIELD_LENGTH) => {
  const cleaned = [...String(value || '')]
    .filter((character) => {
      const code = character.codePointAt(0)
      return code >= 0x20 || character === '\n' || character === '\r' || character === '\t'
    })
    .join('')
    .trim()
  return [...cleaned].slice(0, limit).join('')
}

const normalizeUin = (value) =>
  String(value || '')
    .replace(/^o/, '')
    .trim()

const formatPublishedAt = (value) => {
  const timestamp = Number(value || 0)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return { display: '', iso: '' }
  const milliseconds = timestamp < 1e12 ? timestamp * 1000 : timestamp
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) return { display: '', iso: '' }
  const pad = (number) => String(number).padStart(2, '0')
  return {
    display: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    iso: date.toISOString()
  }
}

export const buildMediaMetadata = (metadata = {}, fallbackDescription = '') => {
  const description = normalizeText(metadata.description || fallbackDescription, MAX_FIELD_LENGTH)
  const authorName = normalizeText(metadata.authorName)
  const authorUin = normalizeUin(metadata.authorUin)
  const albumName = normalizeText(metadata.albumName)
  const sourceUrl = normalizeText(metadata.sourceUrl)
  const publishedAt = formatPublishedAt(metadata.publishedAt)
  const author = [authorName, authorUin ? `QQ：${authorUin}` : ''].filter(Boolean).join(' · ')
  const lines = [
    description ? `动态：${description}` : '',
    author ? `发布者：${author}` : '',
    publishedAt.display ? `发布时间：${publishedAt.display}` : '',
    albumName ? `相册：${albumName}` : '',
    sourceUrl ? `空间链接：${sourceUrl}` : '',
    '来源：QQ 空间（由企鹅相册 - QzonePhoto 保存）'
  ].filter(Boolean)
  const comment = normalizeText(lines.join('\n'), MAX_COMMENT_LENGTH)

  return {
    description,
    comment,
    title: normalizeText(description || albumName || 'QQ 空间媒体', 512),
    authorName,
    authorUin,
    author,
    albumName,
    sourceUrl,
    keywords: ['QQ 空间', '企鹅相册', authorName, albumName].filter(Boolean).join('; '),
    publishedAt: publishedAt.display,
    publishedAtIso: publishedAt.iso
  }
}

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          error.message = `${error.message}${stderr ? `: ${stderr.trim()}` : ''}`
          reject(error)
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })

const getFfmpegPath = () => {
  const executable = typeof ffmpegStatic === 'string' ? ffmpegStatic : ''
  if (!executable) throw new Error('当前系统没有可用的视频元数据工具')
  return executable.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
}

const escapeXml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const writeFinderComment = async (filePath, comment) => {
  if (process.platform !== 'darwin' || !comment)
    return { written: false, reason: 'unsupported-platform' }
  const tempBase = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${crypto.randomUUID()}.finder-comment`
  )
  const plistPath = `${tempBase}.plist`
  const binaryPlistPath = `${tempBase}.bin`
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><string>${escapeXml(comment)}</string></plist>`
    await fs.promises.writeFile(plistPath, xml, 'utf8')
    await run('/usr/bin/plutil', ['-convert', 'binary1', '-o', binaryPlistPath, plistPath])
    const binaryPlist = await fs.promises.readFile(binaryPlistPath)
    await run('/usr/bin/xattr', [
      '-w',
      '-x',
      'com.apple.metadata:kMDItemFinderComment',
      binaryPlist.toString('hex'),
      filePath
    ])
    await run('/usr/bin/mdimport', [filePath]).catch(() => {})
    return { written: true, format: 'finder-comment' }
  } catch (error) {
    return { written: false, reason: error.message }
  } finally {
    await Promise.all([
      fs.promises.unlink(plistPath).catch(() => {}),
      fs.promises.unlink(binaryPlistPath).catch(() => {})
    ])
  }
}

export const writeVideoMetadata = async (filePath, metadata, fallbackDescription = '') => {
  const extension = path.extname(filePath).toLowerCase()
  const normalized = buildMediaMetadata(metadata, fallbackDescription)
  if (!normalized.comment) return { written: false, reason: 'empty-description' }

  const writeFallback = async (reason) => {
    const [sidecar, finderComment] = await Promise.all([
      writeImageDescription(filePath, normalized.comment, normalized),
      writeFinderComment(filePath, normalized.comment)
    ])
    return {
      written: Boolean(sidecar.written || finderComment.written),
      fallback: true,
      format: 'xmp-sidecar-and-finder-comment',
      reason,
      sidecar,
      finderComment,
      metadata: normalized
    }
  }

  if (!VIDEO_EXTENSIONS.has(extension)) return writeFallback('unsupported-video-format')

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${crypto.randomUUID()}${extension}`
  )
  const metadataArgs = [
    '-metadata',
    `title=${normalized.title}`,
    '-metadata',
    `description=${normalized.comment}`,
    '-metadata',
    `synopsis=${normalized.description || normalized.comment}`,
    '-metadata',
    `comment=${normalized.comment}`,
    '-metadata',
    `artist=${normalized.author || normalized.authorName}`,
    '-metadata',
    `author=${normalized.author || normalized.authorName}`,
    '-metadata',
    `album=${normalized.albumName}`,
    '-metadata',
    `keywords=${normalized.keywords}`,
    '-metadata',
    'copyright=QQ 空间',
    '-metadata',
    'publisher=企鹅相册 - QzonePhoto'
  ]
  if (normalized.publishedAtIso) {
    metadataArgs.push('-metadata', `date=${normalized.publishedAtIso}`)
    metadataArgs.push('-metadata', `creation_time=${normalized.publishedAtIso}`)
  }
  if (normalized.sourceUrl) metadataArgs.push('-metadata', `purl=${normalized.sourceUrl}`)

  try {
    await run(getFfmpegPath(), [
      '-nostdin',
      '-y',
      '-i',
      filePath,
      '-map',
      '0',
      '-map_metadata',
      '0',
      '-c',
      'copy',
      '-movflags',
      'use_metadata_tags',
      ...metadataArgs,
      tempPath
    ])
    await replaceFileSafely(tempPath, filePath)
    await writeFinderComment(filePath, normalized.comment)
    return { written: true, format: 'embedded-mp4-and-finder-comment', metadata: normalized }
  } catch (error) {
    await fs.promises.unlink(tempPath).catch(() => {})
    return writeFallback(error.message)
  }
}

export const writeTaskMediaMetadata = async (filePath, task) => {
  const metadata = buildMediaMetadata(task?.media_metadata, task?.metadata_description)
  if (!metadata.comment) return { written: false, reason: 'empty-description' }

  if (task?.type === 'image') {
    const result = await writeImageDescription(filePath, metadata.comment, metadata)
    await writeFinderComment(filePath, metadata.comment)
    return { ...result, metadata }
  }
  if (task?.type === 'video')
    return writeVideoMetadata(filePath, task?.media_metadata, task?.metadata_description)
  return { written: false, reason: 'unsupported-media-type' }
}
