// Video URLs have different field names in albums, feeds and the video library.
// Covers must never become the download source when a detail request is unavailable.
export function resolveVideoDownloadSource(media = {}) {
  const covers = new Set(
    [media.pre, media.thumb, media.thumbnail, media.cover, media.cover_url, media.coverUrl]
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim())
  )
  const candidates = [
    media.video_download_url,
    media.video_info?.download_url,
    media.downloadUrl,
    media.video_play_url,
    media.video_info?.video_url,
    media.videoUrl,
    media.videourl,
    media.video_url,
    media.playUrl,
    media.url3,
    media.raw,
    media.origin,
    media.src,
    media.bigUrl,
    media.url
  ]
  for (const value of candidates) {
    if (typeof value !== 'string' || !value.trim()) continue
    const source = value.trim().replace(/^\/\//, 'https://')
    try {
      const url = new URL(source)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      if (/\.(?:jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i.test(url.pathname)) continue
      if (url.hostname.endsWith('.photo.store.qq.com') && /^\/psc(?:\/|$)/i.test(url.pathname))
        continue
      if (
        covers.has(value.trim()) &&
        !/\.(?:mp4|m4v|m3u8|mov|webm|avi|mkv|flv|ts)$/i.test(url.pathname)
      )
        continue
      return source
    } catch {
      // Try the next field; malformed or renderer-local URLs cannot be downloaded.
    }
  }
  return ''
}
