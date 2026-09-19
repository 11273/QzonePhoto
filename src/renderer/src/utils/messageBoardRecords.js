const cleanUin = (value) => {
  const uin = String(value || '').replace(/^o/, '')
  return /^\d+$/.test(uin) ? uin : ''
}

export const messageBoardRecordKey = (item = {}) =>
  String(item.id || [cleanUin(item.uin), item.pubtime, item.ubbContent].join('\u001f'))

export const mergeMessageBoardPages = (base = [], incoming = []) => {
  const records = new Map()
  for (const item of [...base, ...incoming]) {
    const key = messageBoardRecordKey(item)
    if (!key) continue
    const previous = records.get(key)
    if (!previous) {
      records.set(key, item)
      continue
    }
    const replies = new Map()
    for (const reply of [...(previous.replyList || []), ...(item.replyList || [])]) {
      const replyKey = String(
        reply?.id ||
          [
            cleanUin(reply?.uin),
            reply?.pubtime || reply?.time,
            reply?.content || reply?.ubbContent || reply?.htmlContent
          ].join('\u001f')
      )
      replies.set(replyKey, reply)
    }
    records.set(key, {
      ...previous,
      ...item,
      __pageStart: previous.__pageStart ?? item.__pageStart,
      __pageIndex: previous.__pageIndex ?? item.__pageIndex,
      replyList: [...replies.values()]
    })
  }
  return [...records.values()]
}

export const messageReplyTarget = (reply = {}) => ({
  uin: cleanUin(
    reply.targetUin ||
      reply.target_uin ||
      reply.replyTargetUin ||
      reply.reply_target_uin ||
      reply.toUin ||
      reply.to_uin
  ),
  name: String(
    reply.targetName ||
      reply.target_name ||
      reply.replyTargetName ||
      reply.reply_target_name ||
      reply.toName ||
      reply.to_name ||
      ''
  ).trim()
})
