const STORAGE_KEY = 'qzone-feed-description-cache-v2'
const MAX_ENTRIES = 2000
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const normalizeUrl = (value) => {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return ''
  }
}

const getPhotoKeys = (photo) => {
  const keys = [
    photo?.lloc,
    photo?.picKey,
    photo?.id,
    normalizeUrl(photo?.raw),
    normalizeUrl(photo?.url)
  ]
  return [...new Set(keys.filter((key) => typeof key === 'string' && key.trim()))]
}

const readCache = () => {
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const cutoff = Date.now() - MAX_AGE_MS
    return Object.fromEntries(
      Object.entries(cache).filter(([, value]) => value?.updatedAt >= cutoff && value?.metadata)
    )
  } catch {
    return {}
  }
}

const saveCache = (cache) => {
  const entries = Object.entries(cache)
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // 本地缓存不可用不影响照片浏览或下载。
  }
}

export const cacheFeedDescriptions = (hostUin, feeds) => {
  if (!hostUin || !Array.isArray(feeds)) return
  const cache = readCache()
  const updatedAt = Date.now()

  feeds.forEach((feed) => {
    const description = String(feed?.text || feed?.albumTitle || '').trim()
    const authorUin = String(feed?.owner?.uin || hostUin || '').replace(/^o/, '')
    const metadata = {
      description,
      authorName: String(feed?.owner?.nick || feed?.owner?.name || '').trim(),
      authorUin,
      publishedAt: Number(feed?.time || 0),
      albumName: String(feed?.albumName || feed?.albumTitle || '').trim(),
      sourceUrl: authorUin ? `https://user.qzone.qq.com/${authorUin}` : ''
    }
    ;(feed.media || []).forEach((media) => {
      getPhotoKeys(media).forEach((key) => {
        cache[`${hostUin}:${key}`] = { metadata, updatedAt }
      })
    })
  })

  saveCache(cache)
}

export const findCachedFeedMetadata = (hostUin, photo) => {
  if (!hostUin || !photo) return null
  const cache = readCache()
  for (const key of getPhotoKeys(photo)) {
    const metadata = cache[`${hostUin}:${key}`]?.metadata
    if (metadata) return metadata
  }
  return null
}

export const findCachedFeedDescription = (hostUin, photo) =>
  findCachedFeedMetadata(hostUin, photo)?.description || ''
