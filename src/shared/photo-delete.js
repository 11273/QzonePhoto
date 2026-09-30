const firstText = (...values) => {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim())
  return value === undefined ? '' : String(value).trim()
}

export const normalizePhotoDeleteItem = (photo = {}) => {
  const lloc = firstText(photo.lloc, photo.id, photo.picKey)
  const sloc = firstText(photo.sloc, photo.picrefer, photo.picRefer)
  if (!lloc || !sloc) return null
  return { lloc, sloc }
}

export const normalizeAlbumPrivacy = (value) => {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1
}

/**
 * QQ 空间网页端 cgi_delpic_multi_v2 的照片定位格式：
 * {lloc}|53|0|0||{sloc}|{albumPriv}|0，多张照片使用下划线连接。
 */
export const buildPhotoDeleteCodelist = (photos, albumPriv) => {
  const priv = normalizeAlbumPrivacy(albumPriv)
  const items = (Array.isArray(photos) ? photos : []).map(normalizePhotoDeleteItem)
  if (!items.length || items.some((item) => !item)) {
    throw new Error('照片缺少删除所需的 lloc 或 sloc 定位信息')
  }
  return items.map(({ lloc, sloc }) => `${lloc}|53|0|0||${sloc}|${priv}|0`).join('_')
}
