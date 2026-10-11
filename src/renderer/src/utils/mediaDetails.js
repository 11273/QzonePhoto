const firstValue = (...values) =>
  values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      typeof value !== 'object' &&
      String(value).trim() !== ''
  )

const cleanText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'object') return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

const formatTimestamp = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /\d{4}[年./-]\d{1,2}/.test(value)) return cleanText(value)

  const numeric = Number(value)
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return cleanText(value)

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

const formatSize = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /[a-z]/i.test(value)) return cleanText(value)
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const level = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** level
  return `${Number(size.toFixed(level === 0 ? 0 : 2))} ${units[level]}`
}

const formatDuration = (value) => {
  const total = Math.round(Number(value) || 0)
  if (total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

const row = (label, value) => ({ label, value: cleanText(value) })

/**
 * 将相册、动态等来源不完全一致的媒体字段整理成同一套按需详情。
 * context 只放当前页面明确知道的语义，避免在预览组件里猜业务字段。
 */
export const buildMediaDetailRows = (media = {}, context = {}) => {
  const width = Number(firstValue(media.width, media.picWidth, media.pic_width)) || 0
  const height = Number(firstValue(media.height, media.picHeight, media.pic_height)) || 0
  const dimensions = width && height ? `${width} × ${height}` : ''
  const type = context.type || (media.type === 'video' || media.is_video ? '视频' : '照片')
  const description = firstValue(context.description, media.desc, media.description, media.summary)
  const location = firstValue(context.location, media.poiName, media.poi_name, media.location)
  const shotAt = firstValue(context.shotAt, media.rawshoottime, media.shoottime, media.shootTime)
  const uploadedAt = firstValue(
    context.uploadedAt,
    media.uploadtime,
    media.uploadTime,
    media.modifytime,
    media.modifyTime
  )
  const size = firstValue(context.size, media.size, media.photocubage, media.fileSize)
  const duration = firstValue(context.duration, media.duration, media.video_time, media.videotime)

  return [
    row('类型', type),
    row('相册', context.albumName),
    row('发布者', context.author),
    row('发布时间', formatTimestamp(context.publishedAt)),
    row('拍摄时间', formatTimestamp(shotAt)),
    row('上传时间', formatTimestamp(uploadedAt)),
    row('尺寸', dimensions),
    row('大小', formatSize(size)),
    row('时长', formatDuration(duration)),
    row('地点', location),
    row('描述', description),
    row('评论', context.commentCount),
    row('点赞', context.likeCount),
    row('浏览', context.viewCount),
    row('批次', firstValue(context.batchId, media.batchId, media.batch_id))
  ].filter((item) => item.value && item.value !== '0')
}

export const __mediaDetailTestUtils = { formatTimestamp, formatSize, formatDuration }
