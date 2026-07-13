import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { replaceFileSafely } from './replace-file.mjs'

const MAX_DESCRIPTION_LENGTH = 2000
const XMP_HEADER = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'utf8')
const EXIF_HEADER = Buffer.from('Exif\0\0', 'ascii')
const EXIF_TAG = {
  IMAGE_DESCRIPTION: 0x010e,
  ARTIST: 0x013b,
  COPYRIGHT: 0x8298,
  ORIENTATION: 0x0112,
  X_RESOLUTION: 0x011a,
  Y_RESOLUTION: 0x011b,
  RESOLUTION_UNIT: 0x0128,
  EXIF_IFD_POINTER: 0x8769,
  DATE_TIME_ORIGINAL: 0x9003,
  DATE_TIME_DIGITIZED: 0x9004,
  USER_COMMENT: 0x9286,
  XP_TITLE: 0x9c9b,
  XP_COMMENT: 0x9c9c,
  XP_AUTHOR: 0x9c9d,
  XP_KEYWORDS: 0x9c9e,
  XP_SUBJECT: 0x9c9f
}
const TIFF_TYPE = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  UNDEFINED: 7
}

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const normalizeText = (value, limit = MAX_DESCRIPTION_LENGTH) => {
  if (typeof value !== 'string') return ''
  const cleaned = [...value]
    .filter((character) => {
      const code = character.codePointAt(0)
      return code >= 0x20 || character === '\n' || character === '\r' || character === '\t'
    })
    .join('')
    .trim()
  return [...cleaned].slice(0, limit).join('')
}

const createXmpPacket = (metadata) => {
  const description = escapeXml(metadata.comment)
  const title = escapeXml(metadata.description || metadata.title)
  const author = escapeXml(metadata.author)
  const sourceUrl = escapeXml(metadata.sourceUrl)
  const publishedAt = escapeXml(metadata.publishedAtIso)
  const authorUin = escapeXml(metadata.authorUin)
  const albumName = escapeXml(metadata.albumName)
  const metadataHash = escapeXml(metadata.metadataHash)
  return Buffer.from(
    `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:qzonephoto="https://qzonephoto.getgit.one/ns/metadata/1.0/" qzonephoto:generated="true"${metadataHash ? ` qzonephoto:metadataHash="${metadataHash}"` : ''}${authorUin ? ` qzonephoto:authorUin="${authorUin}"` : ''}${albumName ? ` qzonephoto:albumName="${albumName}"` : ''}${publishedAt ? ` xmp:CreateDate="${publishedAt}"` : ''}><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt></dc:description>${title ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>` : ''}${author ? `<dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>` : ''}${sourceUrl ? `<dc:source>${sourceUrl}</dc:source>` : ''}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`,
    'utf8'
  )
}

const createJpegXmpSegment = (xmpPacket) => {
  const payload = Buffer.concat([XMP_HEADER, xmpPacket])
  if (payload.length + 2 > 0xffff) throw new Error('图片说明过长')
  const header = Buffer.alloc(4)
  header.writeUInt16BE(0xffe1, 0)
  header.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([header, payload])
}

const isStandaloneJpegMarker = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)

const isManagedXmpPacket = (packet) => {
  const text = packet.toString('utf8')
  if (text.includes('qzonephoto:generated="true"')) return true

  // 兼容早期版本生成的、尚未带 qzonephoto 命名空间的单字段 XMP。
  return /^<\?xpacket begin="[^"]*" id="W5M0MpCehiHzreSzNTczkc9d"\?><x:xmpmeta xmlns:x="adobe:ns:meta\/"><rdf:RDF xmlns:rdf="http:\/\/www\.w3\.org\/1999\/02\/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http:\/\/purl\.org\/dc\/elements\/1\.1\/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">[\s\S]*<\/rdf:li><\/rdf:Alt><\/dc:description><\/rdf:Description><\/rdf:RDF><\/x:xmpmeta><\?xpacket end="w"\?>$/.test(
    text
  )
}

const scanJpegMetadataSegments = (jpeg) => {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('文件不是有效的 JPEG 图片')

  let exif = null
  const managedXmp = []
  let offset = 2
  while (offset + 4 <= jpeg.length) {
    if (jpeg[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = jpeg[offset + 1]
    if (marker === 0xff) {
      offset += 1
      continue
    }
    if (marker === 0xda || marker === 0xd9) break
    if (isStandaloneJpegMarker(marker)) {
      offset += 2
      continue
    }

    const segmentLength = jpeg.readUInt16BE(offset + 2)
    const end = offset + 2 + segmentLength
    if (segmentLength < 2 || end > jpeg.length) throw new Error('JPEG 元数据段无效')

    const payloadStart = offset + 4
    if (
      marker === 0xe1 &&
      jpeg.subarray(payloadStart, payloadStart + EXIF_HEADER.length).equals(EXIF_HEADER)
    ) {
      if (!exif)
        exif = {
          start: offset,
          end,
          tiff: jpeg.subarray(payloadStart + EXIF_HEADER.length, end)
        }
    } else if (
      marker === 0xe1 &&
      jpeg.subarray(payloadStart, payloadStart + XMP_HEADER.length).equals(XMP_HEADER) &&
      isManagedXmpPacket(jpeg.subarray(payloadStart + XMP_HEADER.length, end))
    ) {
      const packet = jpeg.subarray(payloadStart + XMP_HEADER.length, end)
      const hashMatch = packet.toString('utf8').match(/qzonephoto:metadataHash="([a-f0-9]{64})"/)
      managedXmp.push({
        start: offset,
        end,
        metadataHash: hashMatch?.[1] || ''
      })
    }

    offset = end
  }

  return { exif, managedXmp }
}

const getJpegMetadataInsertionOffset = (jpeg) => {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('文件不是有效的 JPEG 图片')
  if (jpeg[2] !== 0xff || jpeg[3] !== 0xe0) return 2

  const jfifLength = jpeg.readUInt16BE(4)
  const offset = 2 + 2 + jfifLength
  if (jfifLength < 2 || offset > jpeg.length) throw new Error('JPEG JFIF 段无效')
  return offset
}

const getTiffEndian = (tiff) => {
  const marker = tiff.subarray(0, 2).toString('ascii')
  if (marker === 'II') return true
  if (marker === 'MM') return false
  throw new Error('EXIF 字节序无效')
}

const readUInt16 = (buffer, offset, littleEndian) =>
  littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset)

const readUInt32 = (buffer, offset, littleEndian) =>
  littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset)

const writeUInt16 = (buffer, value, offset, littleEndian) =>
  littleEndian ? buffer.writeUInt16LE(value, offset) : buffer.writeUInt16BE(value, offset)

const writeUInt32 = (buffer, value, offset, littleEndian) =>
  littleEndian ? buffer.writeUInt32LE(value, offset) : buffer.writeUInt32BE(value, offset)

const readIfd = (tiff, offset, littleEndian) => {
  if (offset < 8 || offset + 2 > tiff.length) throw new Error('EXIF IFD 偏移无效')

  const entryCount = readUInt16(tiff, offset, littleEndian)
  const entriesStart = offset + 2
  const nextOffsetPosition = entriesStart + entryCount * 12
  if (nextOffsetPosition + 4 > tiff.length) throw new Error('EXIF IFD 数据无效')

  const entries = []
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = entriesStart + index * 12
    entries.push({
      tag: readUInt16(tiff, entryOffset, littleEndian),
      raw: Buffer.from(tiff.subarray(entryOffset, entryOffset + 12))
    })
  }

  return {
    entries,
    nextOffset: readUInt32(tiff, nextOffsetPosition, littleEndian)
  }
}

const createIfdEntry = (tag, type, count, valueOffset, littleEndian) => {
  const entry = Buffer.alloc(12)
  writeUInt16(entry, tag, 0, littleEndian)
  writeUInt16(entry, type, 2, littleEndian)
  writeUInt32(entry, count, 4, littleEndian)
  writeUInt32(entry, valueOffset, 8, littleEndian)
  return { tag, raw: entry }
}

const createIfd = (entries, nextOffset, littleEndian) => {
  const sortedEntries = [...entries].sort((left, right) => left.tag - right.tag)
  const ifd = Buffer.alloc(2 + sortedEntries.length * 12 + 4)
  writeUInt16(ifd, sortedEntries.length, 0, littleEndian)
  sortedEntries.forEach((entry, index) => entry.raw.copy(ifd, 2 + index * 12))
  writeUInt32(ifd, nextOffset, ifd.length - 4, littleEndian)
  return ifd
}

const toUtf16be = (value) => {
  const littleEndian = Buffer.from(value, 'utf16le')
  for (let index = 0; index < littleEndian.length; index += 2) {
    ;[littleEndian[index], littleEndian[index + 1]] = [littleEndian[index + 1], littleEndian[index]]
  }
  return littleEndian
}

const createInitialTiff = () => {
  const tiff = Buffer.alloc(14)
  tiff.write('II', 0, 'ascii')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(0, 8)
  tiff.writeUInt32LE(0, 10)
  return tiff
}

const toAsciiValue = (value) => Buffer.concat([Buffer.from(value, 'utf8'), Buffer.from([0])])
const toXpValue = (value) => Buffer.from(`${value}\0`, 'utf16le')

const createResolutionValue = (littleEndian) => {
  const resolution = Buffer.alloc(8)
  writeUInt32(resolution, 72, 0, littleEndian)
  writeUInt32(resolution, 1, 4, littleEndian)
  return resolution
}

const toExifDateTime = (value) => {
  if (!value) return ''
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}:${match[3]} ${match[4]}:${match[5]}:${match[6]}` : ''
}

const mergeDescriptionIntoExif = (sourceTiff, metadata) => {
  const tiff = sourceTiff ? Buffer.from(sourceTiff) : createInitialTiff()
  const littleEndian = getTiffEndian(tiff)
  if (readUInt16(tiff, 2, littleEndian) !== 42) throw new Error('EXIF TIFF 标识无效')

  const ifd0Offset = readUInt32(tiff, 4, littleEndian)
  const originalIfd0 = readIfd(tiff, ifd0Offset, littleEndian)
  const existingExifPointer = originalIfd0.entries.find(
    (entry) => entry.tag === EXIF_TAG.EXIF_IFD_POINTER
  )
  const existingExifOffset = existingExifPointer
    ? readUInt32(existingExifPointer.raw, 8, littleEndian)
    : 0
  const originalExifIfd = existingExifOffset
    ? readIfd(tiff, existingExifOffset, littleEndian)
    : { entries: [], nextOffset: 0 }

  const dateTimeOriginal = toExifDateTime(metadata.publishedAt || metadata.publishedAtIso)
  const keywords = ['QQ 空间', '企鹅相册', metadata.authorName, metadata.albumName]
    .filter(Boolean)
    .join('; ')
  const ifd0ValueSpecs = [
    {
      tag: EXIF_TAG.IMAGE_DESCRIPTION,
      type: TIFF_TYPE.ASCII,
      value: toAsciiValue(metadata.comment)
    },
    { tag: EXIF_TAG.XP_COMMENT, type: TIFF_TYPE.BYTE, value: toXpValue(metadata.comment) },
    ...(metadata.title
      ? [{ tag: EXIF_TAG.XP_TITLE, type: TIFF_TYPE.BYTE, value: toXpValue(metadata.title) }]
      : []),
    ...(metadata.author
      ? [
          { tag: EXIF_TAG.ARTIST, type: TIFF_TYPE.ASCII, value: toAsciiValue(metadata.author) },
          { tag: EXIF_TAG.XP_AUTHOR, type: TIFF_TYPE.BYTE, value: toXpValue(metadata.author) }
        ]
      : []),
    ...(keywords
      ? [{ tag: EXIF_TAG.XP_KEYWORDS, type: TIFF_TYPE.BYTE, value: toXpValue(keywords) }]
      : []),
    ...(metadata.description
      ? [
          {
            tag: EXIF_TAG.XP_SUBJECT,
            type: TIFF_TYPE.BYTE,
            value: toXpValue(metadata.description)
          }
        ]
      : []),
    {
      tag: EXIF_TAG.COPYRIGHT,
      type: TIFF_TYPE.ASCII,
      value: toAsciiValue('内容来自 QQ 空间')
    },
    ...(!sourceTiff
      ? [
          {
            tag: EXIF_TAG.X_RESOLUTION,
            type: TIFF_TYPE.RATIONAL,
            count: 1,
            value: createResolutionValue(littleEndian)
          },
          {
            tag: EXIF_TAG.Y_RESOLUTION,
            type: TIFF_TYPE.RATIONAL,
            count: 1,
            value: createResolutionValue(littleEndian)
          }
        ]
      : [])
  ]
  const exifValueSpecs = [
    {
      tag: EXIF_TAG.USER_COMMENT,
      type: TIFF_TYPE.UNDEFINED,
      value: Buffer.concat([Buffer.from('UNICODE\0', 'ascii'), toUtf16be(metadata.comment)])
    },
    ...(dateTimeOriginal
      ? [
          {
            tag: EXIF_TAG.DATE_TIME_ORIGINAL,
            type: TIFF_TYPE.ASCII,
            value: toAsciiValue(dateTimeOriginal)
          },
          {
            tag: EXIF_TAG.DATE_TIME_DIGITIZED,
            type: TIFF_TYPE.ASCII,
            value: toAsciiValue(dateTimeOriginal)
          }
        ]
      : [])
  ]

  const updatedIfd0Tags = new Set([
    EXIF_TAG.IMAGE_DESCRIPTION,
    EXIF_TAG.ARTIST,
    EXIF_TAG.COPYRIGHT,
    EXIF_TAG.XP_TITLE,
    EXIF_TAG.XP_COMMENT,
    EXIF_TAG.XP_AUTHOR,
    EXIF_TAG.XP_KEYWORDS,
    EXIF_TAG.XP_SUBJECT,
    EXIF_TAG.EXIF_IFD_POINTER
  ])
  const retainedIfd0Entries = originalIfd0.entries.filter(
    (entry) => !updatedIfd0Tags.has(entry.tag)
  )
  const updatedExifTags = new Set([
    EXIF_TAG.USER_COMMENT,
    EXIF_TAG.DATE_TIME_ORIGINAL,
    EXIF_TAG.DATE_TIME_DIGITIZED
  ])
  const retainedExifEntries = originalExifIfd.entries.filter(
    (entry) => !updatedExifTags.has(entry.tag)
  )
  const inlineIfd0Entries = sourceTiff
    ? []
    : [
        createIfdEntry(EXIF_TAG.ORIENTATION, TIFF_TYPE.SHORT, 1, 1, littleEndian),
        createIfdEntry(EXIF_TAG.RESOLUTION_UNIT, TIFF_TYPE.SHORT, 1, 2, littleEndian)
      ]
  const ifd0Length =
    2 + (retainedIfd0Entries.length + inlineIfd0Entries.length + ifd0ValueSpecs.length + 1) * 12 + 4
  const exifIfdLength = 2 + (retainedExifEntries.length + exifValueSpecs.length) * 12 + 4
  const newIfd0Offset = tiff.length
  const newExifIfdOffset = newIfd0Offset + ifd0Length
  let valueOffset = newExifIfdOffset + exifIfdLength
  const createValueEntries = (specs) =>
    specs.map((spec) => {
      const entry = createIfdEntry(
        spec.tag,
        spec.type,
        spec.count || spec.value.length,
        valueOffset,
        littleEndian
      )
      valueOffset += spec.value.length
      return entry
    })
  const ifd0ValueEntries = createValueEntries(ifd0ValueSpecs)
  const exifValueEntries = createValueEntries(exifValueSpecs)

  const newIfd0 = createIfd(
    [
      ...retainedIfd0Entries,
      ...inlineIfd0Entries,
      ...ifd0ValueEntries,
      createIfdEntry(EXIF_TAG.EXIF_IFD_POINTER, TIFF_TYPE.LONG, 1, newExifIfdOffset, littleEndian)
    ],
    originalIfd0.nextOffset,
    littleEndian
  )
  const newExifIfd = createIfd(
    [...retainedExifEntries, ...exifValueEntries],
    originalExifIfd.nextOffset,
    littleEndian
  )

  const result = Buffer.concat([
    tiff,
    newIfd0,
    newExifIfd,
    ...ifd0ValueSpecs.map((spec) => spec.value),
    ...exifValueSpecs.map((spec) => spec.value)
  ])
  writeUInt32(result, newIfd0Offset, 4, littleEndian)
  return result
}

const createJpegExifSegment = (tiff) => {
  const payload = Buffer.concat([EXIF_HEADER, tiff])
  if (payload.length + 2 > 0xffff) throw new Error('图片说明过长')

  const header = Buffer.alloc(4)
  header.writeUInt16BE(0xffe1, 0)
  header.writeUInt16BE(payload.length + 2, 2)
  return Buffer.concat([header, payload])
}

const replaceJpegMetadataSegments = (source, ranges, insertionOffset, replacement) => {
  const chunks = []
  let cursor = 0
  let inserted = false

  ;[...ranges]
    .sort((left, right) => left.start - right.start)
    .forEach((range) => {
      if (!inserted && insertionOffset <= range.start) {
        chunks.push(source.subarray(cursor, insertionOffset), replacement)
        cursor = insertionOffset
        inserted = true
      }
      if (cursor < range.start) chunks.push(source.subarray(cursor, range.start))
      cursor = Math.max(cursor, range.end)
    })

  if (!inserted) {
    chunks.push(source.subarray(cursor, insertionOffset), replacement)
    cursor = insertionOffset
  }
  chunks.push(source.subarray(cursor))
  return Buffer.concat(chunks)
}

const writeJpegMetadata = async (filePath, metadata) => {
  const source = await fs.promises.readFile(filePath)
  const { exif: existingExif, managedXmp } = scanJpegMetadataSegments(source)
  const metadataHash = crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex')
  if (existingExif && managedXmp.length === 1 && managedXmp[0].metadataHash === metadataHash)
    return false

  const completeMetadata = { ...metadata, metadataHash }
  const exifSegment = createJpegExifSegment(
    mergeDescriptionIntoExif(existingExif?.tiff, completeMetadata)
  )
  const xmpSegment = createJpegXmpSegment(createXmpPacket(completeMetadata))
  const insertionOffset = existingExif?.start || getJpegMetadataInsertionOffset(source)
  const updated = replaceJpegMetadataSegments(
    source,
    [...(existingExif ? [existingExif] : []), ...managedXmp],
    insertionOffset,
    Buffer.concat([exifSegment, xmpSegment])
  )

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`
  )
  try {
    await fs.promises.writeFile(tempPath, updated, { flag: 'wx' })
    await replaceFileSafely(tempPath, filePath)
    return true
  } catch (error) {
    await fs.promises.unlink(tempPath).catch(() => {})
    throw error
  }
}

const writeXmpSidecar = async (filePath, xmpPacket) => {
  const sidecarPath = path.join(path.dirname(filePath), `${path.parse(filePath).name}.xmp`)
  const existing = await fs.promises.readFile(sidecarPath).catch(() => null)
  if (existing && !existing.includes(Buffer.from('qzonephoto:generated="true"', 'utf8'))) {
    return { written: false, reason: 'sidecar-exists' }
  }

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(sidecarPath)}.${crypto.randomUUID()}.tmp`
  )
  try {
    await fs.promises.writeFile(tempPath, xmpPacket, { flag: 'wx' })
    if (existing) await replaceFileSafely(tempPath, sidecarPath)
    else await fs.promises.rename(tempPath, sidecarPath)
  } catch (error) {
    await fs.promises.unlink(tempPath).catch(() => {})
    throw error
  }
  return { written: true, sidecarPath }
}

export const writeImageDescription = async (filePath, description, details = {}) => {
  const comment = normalizeText(description, 6000)
  if (!comment) return { written: false, reason: 'empty-description' }

  const metadata = {
    comment,
    description: normalizeText(details.description || '', MAX_DESCRIPTION_LENGTH),
    title: normalizeText(details.title || details.description || comment, 512),
    author: normalizeText(details.author || details.authorName || '', 512),
    authorName: normalizeText(details.authorName || '', 512),
    authorUin: normalizeText(details.authorUin || '', 64),
    albumName: normalizeText(details.albumName || '', 512),
    sourceUrl: normalizeText(details.sourceUrl || '', 2000),
    publishedAt: normalizeText(details.publishedAt || '', 64),
    publishedAtIso: normalizeText(details.publishedAtIso || '', 64)
  }

  const xmpPacket = createXmpPacket(metadata)
  const handle = await fs.promises.open(filePath, 'r')
  const signature = Buffer.alloc(2)
  try {
    await handle.read(signature, 0, signature.length, 0)
  } finally {
    await handle.close()
  }
  if (signature[0] === 0xff && signature[1] === 0xd8) {
    try {
      const changed = await writeJpegMetadata(filePath, metadata)
      return { written: true, changed, format: 'embedded-exif-and-xmp' }
    } catch (error) {
      const fallback = await writeXmpSidecar(filePath, xmpPacket)
      return {
        ...fallback,
        fallback: true,
        format: 'xmp-sidecar-fallback',
        embeddedError: error.message
      }
    }
  }

  return writeXmpSidecar(filePath, xmpPacket)
}
