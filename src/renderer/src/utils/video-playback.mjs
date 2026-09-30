const firstSource = (...values) =>
  values.find((value) => typeof value === 'string' && value.trim())?.trim() || ''

export const DEFAULT_VIDEO_VOLUME = 0.35
export const VIDEO_PLAYBACK_PREFERENCE_KEY = 'qzone-photo:video-playback-preference'

const clampVolume = (value) => {
  const volume = Number(value)
  if (!Number.isFinite(volume)) return DEFAULT_VIDEO_VOLUME
  return Math.min(1, Math.max(0, volume))
}

const getPlaybackStorage = (storage) => {
  if (storage) return storage
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export const readVideoPlaybackPreference = (storage) => {
  const fallback = { muted: false, volume: DEFAULT_VIDEO_VOLUME }
  try {
    const raw = getPlaybackStorage(storage)?.getItem?.(VIDEO_PLAYBACK_PREFERENCE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw)
    return {
      muted: typeof saved?.muted === 'boolean' ? saved.muted : fallback.muted,
      volume: clampVolume(saved?.volume)
    }
  } catch {
    return fallback
  }
}

export const applyVideoPlaybackPreference = (video, storage) => {
  const preference = readVideoPlaybackPreference(storage)
  if (!video) return preference
  video.volume = preference.volume
  video.muted = preference.muted
  return preference
}

export const saveVideoPlaybackPreference = (video, storage) => {
  const preference = {
    muted: !!video?.muted,
    volume: clampVolume(video?.volume)
  }
  try {
    getPlaybackStorage(storage)?.setItem?.(
      VIDEO_PLAYBACK_PREFERENCE_KEY,
      JSON.stringify(preference)
    )
  } catch {
    // 存储不可用时仍保留当前播放器的设置，不阻断播放。
  }
  return preference
}

export const isHlsVideoSource = (value) => /\.m3u8(?:$|[?#])/i.test(String(value || '').trim())

export const resolveVideoPlaybackSource = (media = {}) =>
  firstSource(
    media.video_download_url,
    media.video_play_url,
    media.videoUrl,
    media.videourl,
    media.video_url,
    media.playUrl,
    media.downloadUrl,
    media.raw,
    media.src,
    media.video_info?.download_url,
    media.video_info?.video_url,
    media.url
  )

export const resolveVideoCoverSource = (media = {}, fallback = {}) =>
  firstSource(
    media.cover_url,
    media.coverUrl,
    media.cover,
    media.pre,
    media.thumb,
    media.thumbnail,
    media.video_info?.cover_url,
    media.video_info?.cover,
    media.video_info?.thumbnail,
    fallback.cover_url,
    fallback.coverUrl,
    fallback.cover,
    fallback.pre,
    fallback.thumb,
    fallback.thumbnail,
    fallback.url
  )
