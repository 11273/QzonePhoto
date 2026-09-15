export const DOWNLOAD_TIME_PREFERENCES = Object.freeze({
  SHOOT: 'shoot',
  UPLOAD: 'upload'
})

export const normalizeDownloadTimePreference = (value) =>
  value === DOWNLOAD_TIME_PREFERENCES.UPLOAD
    ? DOWNLOAD_TIME_PREFERENCES.UPLOAD
    : DOWNLOAD_TIME_PREFERENCES.SHOOT

const parseNumericTime = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const milliseconds = numeric >= 1e12 ? numeric : numeric * 1000
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date
}

const parseDateValue = (value) => {
  if (!value || value === '0') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }
  if (typeof value === 'number' || /^\d{10,13}$/.test(String(value).trim())) {
    return parseNumericTime(value)
  }

  const normalized = String(value)
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    .replace(/^(\d{4})\/(\d{2})\/(\d{2})/, '$1-$2-$3')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

const getShootTime = (photo) =>
  parseDateValue(photo.exif?.originalTime) ||
  parseDateValue(photo.rawshoottime) ||
  parseDateValue(photo.shoottime)

const getUploadTime = (photo) =>
  parseDateValue(photo.uploadTime) ||
  parseDateValue(photo.uploadtime) ||
  parseDateValue(photo.modifytime)

export const getPhotoFileTime = (photo = {}, preference = DOWNLOAD_TIME_PREFERENCES.SHOOT) => {
  const normalizedPreference = normalizeDownloadTimePreference(preference)
  return normalizedPreference === DOWNLOAD_TIME_PREFERENCES.UPLOAD
    ? getUploadTime(photo) || getShootTime(photo)
    : getShootTime(photo) || getUploadTime(photo)
}
