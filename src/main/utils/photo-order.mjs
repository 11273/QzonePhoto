export const isVideoPhoto = (photo = {}) => {
  return (
    photo.is_video === true ||
    photo.is_video === 1 ||
    photo.is_video === '1' ||
    photo.type === 'video'
  )
}

export const mergeEnrichedImagesInOriginalOrder = (photos = [], enrichedImages = []) => {
  const ordered = [...photos]
  let imageIndex = 0

  photos.forEach((photo, index) => {
    if (isVideoPhoto(photo)) return
    ordered[index] = enrichedImages[imageIndex] || photo
    imageIndex += 1
  })

  return ordered
}
