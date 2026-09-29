const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toUnixSeconds(value) {
  if (value === null || value === undefined || value === '') return 0

  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric > 10_000_000_000 ? numeric / 1000 : numeric)
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0
}

function dateBoundary(value, endOfDay = false) {
  if (!value) return 0
  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'
    return toUnixSeconds(`${value}${suffix}`)
  }
  return toUnixSeconds(value)
}

export function normalizeDownloadDateRange(input = {}) {
  const startValue = input.start || input.startDate
  const endValue = input.end || input.endDate
  const start = dateBoundary(startValue)
  const end = dateBoundary(endValue, true)

  if (!start && !end) return null
  if (start && end && start > end) {
    return {
      start: dateBoundary(endValue),
      end: dateBoundary(startValue, true)
    }
  }

  return { start, end }
}

export function normalizeDownloadBatch(input = {}) {
  const id = String(input.id || input.batchId || '').trim()
  if (!id) return null

  return {
    id,
    label:
      String(input.label || '批量下载')
        .trim()
        .slice(0, 80) || '批量下载',
    sourceType:
      String(input.sourceType || 'media')
        .trim()
        .slice(0, 30) || 'media',
    autoStart: input.autoStart !== false,
    dateRange: normalizeDownloadDateRange(input.dateRange || input)
  }
}

export function getMediaUploadTimestamp(media = {}) {
  const candidates = [
    ['upload', media.uploadtime],
    ['upload', media.uploadTime],
    ['modified', media.modifytime],
    ['shot', media.rawshoottime],
    ['shot', media.shoottime]
  ]

  for (const [source, value] of candidates) {
    const timestamp = toUnixSeconds(value)
    if (timestamp) return { timestamp, source }
  }

  return { timestamp: 0, source: 'missing' }
}

export function getFeedTimestamp(feed = {}) {
  const timestamp = toUnixSeconds(feed.time || feed.abstime || feed.publishTime)
  return { timestamp, source: timestamp ? 'published' : 'missing' }
}

export function timestampMatchesRange(timestamp, range) {
  if (!range) return true
  if (!timestamp) return false
  if (range.start && timestamp < range.start) return false
  if (range.end && timestamp > range.end) return false
  return true
}

export function filterAlbumMediaByDate(mediaList, dateRange) {
  const items = Array.isArray(mediaList) ? mediaList : []
  const range = normalizeDownloadDateRange(dateRange || {})
  if (!range) {
    return {
      items: [...items],
      scanned: items.length,
      matched: items.length,
      skipped: 0,
      missingTime: 0
    }
  }

  const matchedItems = []
  let missingTime = 0

  items.forEach((item) => {
    const { timestamp } = getMediaUploadTimestamp(item)
    if (!timestamp) missingTime += 1
    if (timestampMatchesRange(timestamp, range)) matchedItems.push(item)
  })

  return {
    items: matchedItems,
    scanned: items.length,
    matched: matchedItems.length,
    skipped: items.length - matchedItems.length,
    missingTime
  }
}

export function filterFeedsByDate(feeds, dateRange) {
  const items = Array.isArray(feeds) ? feeds : []
  const range = normalizeDownloadDateRange(dateRange || {})
  const mediaCount = (feed) => (Array.isArray(feed?.photos) ? feed.photos.length : 0)

  if (!range) {
    const matched = items.reduce((total, feed) => total + mediaCount(feed), 0)
    return { items: [...items], scanned: matched, matched, skipped: 0, missingTime: 0 }
  }

  const matchedItems = []
  let scanned = 0
  let matched = 0
  let missingTime = 0

  items.forEach((feed) => {
    const count = mediaCount(feed)
    if (feed?.dateMode === 'media') {
      const mediaResult = filterAlbumMediaByDate(feed.photos, range)
      scanned += mediaResult.scanned
      matched += mediaResult.matched
      missingTime += mediaResult.missingTime
      if (mediaResult.items.length) matchedItems.push({ ...feed, photos: mediaResult.items })
      return
    }

    scanned += count
    const { timestamp } = getFeedTimestamp(feed)
    if (!timestamp) missingTime += count
    if (timestampMatchesRange(timestamp, range)) {
      matchedItems.push(feed)
      matched += count
    }
  })

  return {
    items: matchedItems,
    scanned,
    matched,
    skipped: scanned - matched,
    missingTime
  }
}

export function buildImageDownloadCandidates(photo = {}) {
  const candidates = [
    { url: photo.raw, quality: 'original' },
    { url: photo.url, quality: 'standard' },
    { url: photo.pre, quality: 'preview' }
  ]
  const seen = new Set()

  return candidates.filter((candidate) => {
    const url = String(candidate.url || '').trim()
    if (!url || seen.has(url)) return false
    candidate.url = url
    seen.add(url)
    return true
  })
}

export function downloadBatchTaskStatus(batch, waitingStatus = 'waiting', pausedStatus = 'paused') {
  return normalizeDownloadBatch(batch || {})?.autoStart === false ? pausedStatus : waitingStatus
}

export function shouldFallbackDownload({
  type,
  candidateIndex = 0,
  candidateCount = 0,
  httpStatus = 0,
  networkError = false,
  cancelled = false
} = {}) {
  if (type !== 'image' || cancelled || candidateIndex >= candidateCount - 1) return false
  return [401, 403, 404, 410].includes(Number(httpStatus)) || Boolean(networkError)
}

export function downloadTaskIds(result) {
  if (Array.isArray(result)) return result
  return Array.isArray(result?.taskIds) ? result.taskIds : []
}

export function formatDownloadBatchDateRange(batch = {}) {
  const range = normalizeDownloadDateRange(batch.dateRange || batch)
  if (!range) return '全部日期'

  const format = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp * 1000)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const start = format(range.start)
  const end = format(range.end)
  if (start && end) return `${start} 至 ${end}`
  return start ? `${start} 起` : `${end} 止`
}
