const parseDateValue = (value) => {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const parseSecondsValue = (value) => {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null

  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? null : date
}

const parseExifOriginalTime = (value) => {
  if (!value || typeof value !== 'string') return null
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
  return parseDateValue(normalized)
}

export const getPhotoFileTime = (photo = {}) => {
  return (
    parseExifOriginalTime(photo.exif?.originalTime) ||
    parseSecondsValue(photo.modifytime) ||
    parseDateValue(photo.rawshoottime || photo.shoottime) ||
    parseDateValue(photo.uploadTime) ||
    null
  )
}
