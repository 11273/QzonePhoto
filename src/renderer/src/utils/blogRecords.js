const compact = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const safeWebUrl = (value) => {
  const source = String(value || '')
    .trim()
    .replace(/&amp;/g, '&')
  if (!source) return ''
  try {
    const url = new URL(source.startsWith('//') ? `https:${source}` : source)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.toString()
  } catch {
    return ''
  }
}

const cleanUin = (value) => {
  const uin = String(value || '').replace(/^o/, '')
  return /^\d+$/.test(uin) ? uin : ''
}

export const blogOfficialUrl = (hostUin, blogId) => {
  const uin = cleanUin(hostUin)
  const id = String(blogId || '').trim()
  if (!uin || !/^[A-Za-z0-9_-]+$/.test(id)) return ''
  return `https://user.qzone.qq.com/${uin}/blog/${encodeURIComponent(id)}`
}

export const normalizeBlogRecord = (raw = {}, helpers = {}) => {
  const uin = cleanUin(raw.uin || raw.hostUin || helpers.hostUin)
  const id = raw.blogId || raw.blogid || raw.id || ''
  const time = Number(raw.pubTime || raw.pubtime || raw.createTime || raw.time) || 0
  const title = compact(raw.title)
  const summary = compact(raw.abstract || raw.summary || raw.content)
  const url = blogOfficialUrl(uin, id)
  return {
    tid: id ? `blog-${uin}-${id}` : `blog-${uin}-${time}-${title}`,
    topicId: '',
    inlineComments: [],
    uin,
    name: compact(raw.nickName || raw.nickname || raw.name || helpers.name),
    avatar: helpers.avatarUrl?.(uin) || '',
    userHome: uin ? `https://user.qzone.qq.com/${uin}` : '',
    abstime: time,
    feedstime: helpers.formatTime?.(time) || '',
    appid: 2,
    typeid: 0,
    appType: '日志',
    yearLabel: '',
    actionText: '',
    actionVerb: '',
    actionTarget: '',
    actionIcon: null,
    contentText: summary,
    contentHtml: '',
    media: [],
    images: [],
    linkCard: url
      ? {
          title: title || '未命名日志',
          description: summary,
          source: 'QQ 空间日志',
          url,
          thumbnail: ''
        }
      : null,
    likeCount: 0,
    isLiked: false,
    likers: [],
    likeListComplete: true,
    likerFetchable: false,
    viewCount: Number(raw.viewCount || raw.visitCount) || 0,
    deviceName: '',
    cmtCount: Number(raw.commentCount || raw.cmtCount) || 0,
    fwdCount: 0,
    commentsComplete: Number(raw.commentCount || raw.cmtCount || 0) === 0,
    commentsFetchable: false,
    isBlog: true
  }
}
