const text = (value) => String(value || '').trim()

export const describeMediaElementError = (error, { type = 'media' } = {}) => {
  const code = Number(error?.code)
  const isVideo = type === 'video'

  if (code === 1) return `${isVideo ? '视频' : '图片'}加载已中断，可以重新尝试。`
  if (code === 2) return `读取${isVideo ? '视频' : '图片'}时网络连接中断，请检查网络后重试。`
  if (code === 3) {
    return '文件已经返回，但当前系统无法解码；文件可能已损坏，或使用了不兼容的编码。'
  }
  if (code === 4) {
    return `${isVideo ? '视频' : '图片'}地址可能已失效、受 QQ 空间权限限制，或当前系统不支持这种格式。`
  }

  return isVideo
    ? '视频地址可能已失效、受 QQ 空间权限限制，或当前系统无法播放这种格式。'
    : '图片地址可能已失效，或当前账号没有查看权限。'
}

export const describeHlsError = (data, errorTypes = {}) => {
  const details = text(data?.details).toLowerCase()
  if (
    data?.type === errorTypes.NETWORK_ERROR ||
    /network|manifestload|levelload|fragload|keyload/.test(details)
  ) {
    return '读取视频分片时网络连接异常，请检查网络后重试。'
  }
  if (data?.type === errorTypes.MEDIA_ERROR || /buffer|decode|media/.test(details)) {
    return '视频数据已返回，但当前系统暂时无法解码；可以重试或在浏览器中打开。'
  }
  if (/manifest|level|codec|format/.test(details)) {
    return '视频播放清单无效或格式不受支持，可以在浏览器中打开后确认。'
  }
  return '视频流无法继续播放，地址可能已失效或受 QQ 空间权限限制。'
}

export const describePlaybackRejection = (error) => {
  const name = text(error?.name)
  if (name === 'AbortError') return ''
  if (name === 'NotAllowedError') {
    return '系统阻止了本次播放，请再次点击播放；应用不会自动播放或放大音量。'
  }
  if (name === 'NotSupportedError') {
    return '当前系统不支持这个视频的格式或编码，可以尝试在浏览器中打开。'
  }
  return '视频尚未准备好，或播放地址已经失效，请稍后重试。'
}
