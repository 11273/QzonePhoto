const toArray = (value) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') return Object.values(value)
  return []
}

const cleanNick = (value) =>
  String(value || '')
    .replace(/\[em\]e\d+\[\/em\]/g, '')
    .trim()

const commenterUin = (item) =>
  String(
    item?.uin || item?.owner_uin || item?.poster?.id || item?.poster?.uin || item?.user?.uin || ''
  ).replace(/^o/, '')

const commenterName = (item) =>
  cleanNick(
    item?.name ||
      item?.nick ||
      item?.nickname ||
      item?.poster?.name ||
      item?.poster?.nickname ||
      item?.user?.nickname ||
      item?.userinfo?.nickname ||
      ''
  )

const commentTime = (item, formatTime) => {
  const time = item?.postTime || item?.create_time || item?.created_time || 0
  return time ? formatTime(time) : ''
}

const replyItems = (item) =>
  [
    ...toArray(item?.replies),
    ...toArray(item?.replylist),
    ...toArray(item?.reply_list),
    ...toArray(item?.list_3),
    ...toArray(item?.children),
    ...toArray(item?.subcomments),
    ...toArray(item?.sub_comment),
    ...toArray(item?.commentlist).filter((reply) => reply !== item)
  ].filter((reply) => reply && typeof reply === 'object')

const leadingMention = (value) => {
  const source = String(value || '').trim()
  const match = source.match(/^@\{uin:([\w-]+)(?:,nick:([^,}]*))?(?:,[^}]*)?\}/)
  if (!match) return { text: source, targetUin: '', targetNick: '' }
  const targetUin = match[1]
  const nick = cleanNick(match[2])
  return {
    text: source.slice(match[0].length).trim(),
    targetUin,
    targetNick: nick && nick !== targetUin ? nick : ''
  }
}

const normalizedReply = (item, parent, formatTime) => {
  const leading = leadingMention(item.content || item.reply_content || item.text)
  const uin = commenterUin(item)
  const targetUin = String(
    item.touin || item.targetuin || item.target_uin || leading.targetUin || parent?.uin || ''
  ).replace(/^o/, '')
  const parentName = targetUin === parent?.uin ? parent?.author : ''
  const targetName = cleanNick(
    item.toname || item.targetnick || item.target_nick || leading.targetNick || parentName
  )
  return {
    id:
      item.tid ||
      item.id ||
      item.commentid ||
      item.replyid ||
      `${uin}-${item.postTime || item.create_time || ''}-${leading.text}`,
    uin,
    author: commenterName(item),
    text: leading.text,
    time: commentTime(item, formatTime),
    deviceName: item.source_name || item.source || '',
    targetUin,
    targetNick: targetName && targetName !== targetUin ? targetName : '',
    responses: []
  }
}

const flattenReplies = (items, parent, formatTime) => {
  const replies = []
  for (const item of items) {
    const reply = normalizedReply(item, parent, formatTime)
    replies.push(reply)
    replies.push(...flattenReplies(replyItems(item), reply, formatTime))
  }
  return replies
}

export const normalizeShuoshuoComments = (items, formatTime = String) =>
  toArray(items).map((item) => {
    const uin = commenterUin(item)
    const comment = {
      id: item.tid || item.id || item.commentid || `${uin}-${item.postTime || item.create_time}`,
      uin,
      author: commenterName(item),
      text: item.content || item.text || '',
      time: commentTime(item, formatTime),
      deviceName: item.source_name || item.source || '',
      expectedReplyCount: Math.max(
        0,
        Number(item.extendData?.replyNum ?? item.replyNum ?? item.replynum ?? 0) || 0
      ),
      responses: []
    }
    comment.responses = flattenReplies(replyItems(item), comment, formatTime)
    return comment
  })
