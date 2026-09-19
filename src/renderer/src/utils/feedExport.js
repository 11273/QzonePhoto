const compactText = (value) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const readableFeedText = (value) =>
  compactText(value).replace(
    /@\{uin:([^,}]+),nick:([^,}]+)(?:,[^}]*)?\}/g,
    (_, uin, nick) => `@${compactText(nick) || compactText(uin)}`
  )

export const countFeedComments = (comments = []) =>
  comments.reduce((total, comment) => total + 1 + countFeedComments(comment?.responses || []), 0)

const personLabel = (person = {}) => {
  const name = compactText(person.author || person.name || person.nick)
  const uin = compactText(person.uin)
  if (name && uin && name !== uin) return `${name}（QQ：${uin}）`
  return name || (uin ? `QQ：${uin}` : '未知用户')
}

const commentLines = (comments = [], depth = 0) => {
  const lines = []
  comments.forEach((comment, index) => {
    const prefix = depth ? `${'  '.repeat(depth)}↳` : `${index + 1}.`
    const target = comment?.targetNick
      ? ` 回复 @${compactText(comment.targetNick)}`
      : comment?.targetUin
        ? ` 回复 QQ：${compactText(comment.targetUin)}`
        : ''
    const time = compactText(comment?.time)
    const device = compactText(comment?.deviceName)
    const meta = [time, device ? `来自 ${device}` : ''].filter(Boolean).join(' · ')
    const text = readableFeedText(comment?.text)
    lines.push(
      `${prefix} ${personLabel(comment)}${target}${meta ? ` [${meta}]` : ''}${text ? `：${text}` : ''}`
    )
    lines.push(...commentLines(comment?.responses || [], depth + 1))
  })
  return lines
}

const mediaUrl = (media = {}) =>
  compactText(media.origin || media.raw || media.url || media.pre || media.thumb)

export const buildFeedExportText = (feed = {}, comments = []) => {
  const lines = []
  const author = personLabel(feed)
  const time = compactText(feed.feedstime) || compactText(feed.formattedTime)
  const type = compactText(feed.appType)
  const action = compactText(feed.actionText)
  const content = readableFeedText(feed.contentText || feed.contentHtml)
  const media = Array.isArray(feed.media) ? feed.media.filter(mediaUrl) : []
  const likers = Array.isArray(feed.likers) ? feed.likers : []
  const commentList = Array.isArray(comments) ? comments : []
  const loadedCommentCount = countFeedComments(commentList)

  lines.push(`作者：${author}`)
  if (time) lines.push(`时间：${time}`)
  if (type) lines.push(`类型：${type}`)
  if (action) lines.push(`动态：${action}`)
  lines.push('', '内容：', content || '（无文字内容）')

  if (feed.linkCard) {
    const linkTitle = compactText(feed.linkCard.title)
    const linkDescription = compactText(feed.linkCard.description)
    const linkSource = compactText(feed.linkCard.source)
    const linkUrl = compactText(feed.linkCard.url)
    lines.push('', '链接：')
    if (linkTitle) lines.push(`标题：${linkTitle}`)
    if (linkDescription) lines.push(`摘要：${linkDescription}`)
    if (linkSource) lines.push(`来源：${linkSource}`)
    if (linkUrl) lines.push(`地址：${linkUrl}`)
  }

  lines.push('', `媒体（${media.length}）：`)
  if (!media.length) {
    lines.push('（无）')
  } else {
    media.forEach((item, index) => {
      const kind = item.type === 'video' || item.is_video ? '视频' : '图片'
      lines.push(`${index + 1}. [${kind}] ${mediaUrl(item)}`)
    })
  }

  lines.push('', `点赞：${Number(feed.likeCount) || 0}`)
  if (likers.length) {
    lines.push(`点赞者（${likers.length}）：${likers.map(personLabel).join('、')}`)
  }
  if (Number(feed.viewCount) > 0) lines.push(`浏览：${Number(feed.viewCount)}`)

  lines.push('', `评论与回复（${loadedCommentCount}）：`)
  lines.push(...(commentList.length ? commentLines(commentList) : ['（无）']))

  return lines.join('\n').trim()
}
