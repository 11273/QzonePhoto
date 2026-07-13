import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const JPEG_EXTENSIONS = new Set(['.jpg', '.jpeg'])
const MAX_DESCRIPTION_LENGTH = 2000
const XMP_HEADER = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'utf8')
const EXIF_HEADER = Buffer.from('Exif\0\0', 'ascii')
const EXIF_TAG = {
  IMAGE_DESCRIPTION: 0x010e,
  ORIENTATION: 0x0112,
  X_RESOLUTION: 0x011a,
  Y_RESOLUTION: 0x011b,
  RESOLUTION_UNIT: 0x0128,
  EXIF_IFD_POINTER: 0x8769,
  USER_COMMENT: 0x9286,
  XP_COMMENT: 0x9c9c
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

const normalizeDescription = (description) => {
  if (typeof description !== 'string') return ''
  return [...description]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 0x20 || character === '\n' || character === '\r' || character === '\t'
    })
    .join('')
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH)
}

const createXmpPacket = (description) => {
  const text = escapeXml(description)
  return Buffer.from(
    `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${text}</rdf:li></rdf:Alt></dc:description></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`,
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

const findJpegExifSegment = (jpeg) => {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('文件不是有效的 JPEG 图片')

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
      return {
        start: offset,
        end,
        tiff: jpeg.subarray(payloadStart + EXIF_HEADER.length, end)
      }
    }

    offset = end
  }

  return null
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

const mergeDescriptionIntoExif = (sourceTiff, description) => {
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

  const imageDescription = Buffer.concat([Buffer.from(description, 'utf8'), Buffer.from([0])])
  const xpComment = Buffer.from(`${description}\0`, 'utf16le')
  const userComment = Buffer.concat([Buffer.from('UNICODE\0', 'ascii'), toUtf16be(description)])

  const retainedIfd0Entries = originalIfd0.entries.filter(
    (entry) =>
      ![EXIF_TAG.IMAGE_DESCRIPTION, EXIF_TAG.XP_COMMENT, EXIF_TAG.EXIF_IFD_POINTER].includes(
        entry.tag
      )
  )
  const retainedExifEntries = originalExifIfd.entries.filter(
    (entry) => entry.tag !== EXIF_TAG.USER_COMMENT
  )
  const baseIfd0Entries = sourceTiff
    ? []
    : [
        createIfdEntry(EXIF_TAG.ORIENTATION, TIFF_TYPE.SHORT, 1, 1, littleEndian),
        createIfdEntry(EXIF_TAG.X_RESOLUTION, TIFF_TYPE.RATIONAL, 1, 0, littleEndian),
        createIfdEntry(EXIF_TAG.Y_RESOLUTION, TIFF_TYPE.RATIONAL, 1, 0, littleEndian),
        createIfdEntry(EXIF_TAG.RESOLUTION_UNIT, TIFF_TYPE.SHORT, 1, 2, littleEndian)
      ]
  const ifd0Length = 2 + (retainedIfd0Entries.length + baseIfd0Entries.length + 3) * 12 + 4
  const exifIfdLength = 2 + (retainedExifEntries.length + 1) * 12 + 4
  const newIfd0Offset = tiff.length
  const newExifIfdOffset = newIfd0Offset + ifd0Length
  const imageDescriptionOffset = newExifIfdOffset + exifIfdLength
  const xpCommentOffset = imageDescriptionOffset + imageDescription.length
  const userCommentOffset = xpCommentOffset + xpComment.length
  const xResolutionOffset = userCommentOffset + userComment.length
  const yResolutionOffset = xResolutionOffset + 8
  baseIfd0Entries.forEach((entry) => {
    if (entry.tag === EXIF_TAG.X_RESOLUTION)
      writeUInt32(entry.raw, xResolutionOffset, 8, littleEndian)
    if (entry.tag === EXIF_TAG.Y_RESOLUTION)
      writeUInt32(entry.raw, yResolutionOffset, 8, littleEndian)
  })

  const newIfd0 = createIfd(
    [
      ...retainedIfd0Entries,
      ...baseIfd0Entries,
      createIfdEntry(
        EXIF_TAG.IMAGE_DESCRIPTION,
        TIFF_TYPE.ASCII,
        imageDescription.length,
        imageDescriptionOffset,
        littleEndian
      ),
      createIfdEntry(
        EXIF_TAG.XP_COMMENT,
        TIFF_TYPE.BYTE,
        xpComment.length,
        xpCommentOffset,
        littleEndian
      ),
      createIfdEntry(EXIF_TAG.EXIF_IFD_POINTER, TIFF_TYPE.LONG, 1, newExifIfdOffset, littleEndian)
    ],
    originalIfd0.nextOffset,
    littleEndian
  )
  const newExifIfd = createIfd(
    [
      ...retainedExifEntries,
      createIfdEntry(
        EXIF_TAG.USER_COMMENT,
        TIFF_TYPE.UNDEFINED,
        userComment.length,
        userCommentOffset,
        littleEndian
      )
    ],
    originalExifIfd.nextOffset,
    littleEndian
  )

  const result = Buffer.concat([
    tiff,
    newIfd0,
    newExifIfd,
    imageDescription,
    xpComment,
    userComment,
    (() => {
      const resolution = Buffer.alloc(16)
      writeUInt32(resolution, 72, 0, littleEndian)
      writeUInt32(resolution, 1, 4, littleEndian)
      writeUInt32(resolution, 72, 8, littleEndian)
      writeUInt32(resolution, 1, 12, littleEndian)
      return resolution
    })()
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

const writeJpegMetadata = async (filePath, description) => {
  const source = await fs.promises.readFile(filePath)
  const existingExif = findJpegExifSegment(source)
  const exifSegment = createJpegExifSegment(
    mergeDescriptionIntoExif(existingExif?.tiff, description)
  )
  const xmpSegment = createJpegXmpSegment(createXmpPacket(description))
  const updated = existingExif
    ? Buffer.concat([
        source.subarray(0, existingExif.start),
        exifSegment,
        xmpSegment,
        source.subarray(existingExif.end)
      ])
    : (() => {
        const insertAt = getJpegMetadataInsertionOffset(source)
        return Buffer.concat([
          source.subarray(0, insertAt),
          exifSegment,
          xmpSegment,
          source.subarray(insertAt)
        ])
      })()

  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`
  )
  try {
    await fs.promises.writeFile(tempPath, updated, { flag: 'wx' })
    await fs.promises.rename(tempPath, filePath)
  } catch (error) {
    await fs.promises.unlink(tempPath).catch(() => {})
    throw error
  }
}

const writeXmpSidecar = async (filePath, xmpPacket) => {
  const sidecarPath = path.join(path.dirname(filePath), `${path.parse(filePath).name}.xmp`)
  const exists = await fs.promises
    .access(sidecarPath)
    .then(() => true)
    .catch(() => false)
  if (exists) return { written: false, reason: 'sidecar-exists' }

  await fs.promises.writeFile(sidecarPath, xmpPacket, { flag: 'wx' })
  return { written: true, sidecarPath }
}

export const writeImageDescription = async (filePath, description) => {
  const normalizedDescription = normalizeDescription(description)
  if (!normalizedDescription) return { written: false, reason: 'empty-description' }

  const xmpPacket = createXmpPacket(normalizedDescription)
  if (JPEG_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    await writeJpegMetadata(filePath, normalizedDescription)
    return { written: true, format: 'embedded-exif-and-xmp' }
  }

  return writeXmpSidecar(filePath, xmpPacket)
}
