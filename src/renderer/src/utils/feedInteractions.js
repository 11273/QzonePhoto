const itemId = (item) =>
  String(item?.id || [item?.uin, item?.time, item?.text].filter(Boolean).join('\u001f'))

const timeId = (value) => {
  const time = String(value || '')
  const match =
    time.match(/(?:\d{4}-)?(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/) ||
    time.match(/(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/)
  return match
    ? match
        .slice(1)
        .map((part) => part.padStart(2, '0'))
        .join('-')
    : ''
}

const officialCommentKey = (item) => {
  const id = String(item?.id || '')
  const officialId = id.includes('\u001f') ? id.split('\u001f')[1] : id
  const uin = String(item?.uin || '')
  const time = timeId(item?.time)
  return officialId && uin && time ? [officialId, uin, time].join('\u001f') : ''
}

export const mergeLikers = (base = [], incoming = []) => {
  const byUin = new Map()
  for (const item of [...base, ...incoming]) {
    const uin = String(item?.uin || '').replace(/^o/, '')
    if (!/^\d+$/.test(uin)) continue
    const previous = byUin.get(uin)
    byUin.set(uin, { uin, name: String(item?.name || previous?.name || '').trim() })
  }
  return [...byUin.values()]
}

export const mergeCommentRoots = (base = [], incoming = []) => {
  const result = []
  const byId = new Map()
  const byOfficialKey = new Map()
  for (const item of [...base, ...incoming]) {
    const key = itemId(item)
    if (!key) continue
    const officialKey = officialCommentKey(item)
    const previous = byId.get(key) || (officialKey ? byOfficialKey.get(officialKey) : null)
    if (!previous) {
      const normalized = { ...item, responses: mergeCommentRoots([], item.responses || []) }
      result.push(normalized)
      byId.set(key, normalized)
      if (officialKey) byOfficialKey.set(officialKey, normalized)
      continue
    }
    byId.set(key, previous)
    if (officialKey) byOfficialKey.set(officialKey, previous)
    previous.responses = mergeCommentRoots(previous.responses || [], item.responses || [])
    for (const field of ['author', 'text', 'time', 'targetNick', 'targetUin']) {
      if (
        item[field] &&
        (!previous[field] || (field === 'text' && item[field].length > previous[field].length))
      ) {
        previous[field] = item[field]
      }
    }
    previous.expectedReplyCount = Math.max(
      Number(previous.expectedReplyCount) || 0,
      Number(item.expectedReplyCount) || 0
    )
  }
  return result
}

export const countCommentTree = (items = []) =>
  items.reduce((total, item) => total + 1 + countCommentTree(item.responses || []), 0)

export const areCommentRepliesComplete = (items = []) =>
  items.every(
    (item) =>
      (item.responses || []).length >= (Number(item.expectedReplyCount) || 0) &&
      areCommentRepliesComplete(item.responses || [])
  )

export const canExpandFeedComments = (feed, slot) =>
  Boolean(
    slot?.open ||
    slot?.comments?.length ||
    feed?.inlineComments?.length ||
    Number(feed?.cmtCount) > 0
  )

export const interactionFailureHint = (kind, error) => {
  const reason = String(error?.message || '')
  return /无权|权限|私密|未授权|禁止|permission|forbidden|unauthorized|\b403\b/i.test(reason)
    ? `当前账号暂时无法查看全部${kind}`
    : `${kind}加载失败`
}

const moreFlag = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  return value === 1 || value === '1' || value === 'true'
}

export async function collectAllLikers({ initial = [], expected = 0, requestPage, onPage }) {
  const preview = mergeLikers([], initial)
  const expectedCount = Math.max(0, Number(expected) || 0)
  if (expectedCount > 0 && preview.length >= expectedCount) {
    return { likers: preview, total: Math.max(expectedCount, preview.length), complete: true }
  }
  let likers = preview
  let total = expectedCount
  let cursor = '0'
  const cursors = new Set()
  for (let page = 0; page < 1000; page += 1) {
    if (cursors.has(cursor)) break
    cursors.add(cursor)
    const response = await requestPage(cursor)
    if (Number(response?.code) !== 0) throw new Error(response?.message || '点赞者加载失败')
    const items = mergeLikers([], response?.likers || [])
    likers = mergeLikers(likers, items)
    total = Math.max(total, Number(response?.total) || 0)
    onPage?.(likers, Math.max(total, likers.length))
    const hasMore = moreFlag(response?.hasMore)
    if (total > 0 && likers.length >= total && hasMore !== true) {
      return { likers, total: Math.max(total, likers.length), complete: true }
    }
    const nextCursor = String(response?.nextCursor || items.at(-1)?.uin || '')
    if (hasMore === false || !items.length) {
      return {
        likers,
        total: Math.max(total, likers.length),
        complete: total === 0 && likers.length === 0
      }
    }
    if (total === 0 && hasMore === null && items.length < 60) {
      return { likers, total: likers.length, complete: true }
    }
    if (!nextCursor || nextCursor === cursor) break
    cursor = nextCursor
  }
  return {
    likers: likers.length ? likers : preview,
    total: Math.max(total, likers.length),
    complete: total === 0 && !likers.length
  }
}

export async function collectAllComments({
  initial = [],
  expected = 0,
  requestPage,
  onPage,
  pageSize = 30
}) {
  let comments = mergeCommentRoots([], initial)
  let previousPage = ''
  let expectedCount = Math.max(0, Number(expected) || 0)
  let stagnantPages = 0
  for (let page = 0; page < 1000; page += 1) {
    const response = await requestPage(page * pageSize, pageSize)
    if (Number(response?.code) !== 0) throw new Error(response?.message || '评论加载失败')
    const items = Array.isArray(response?.comments) ? response.comments : []
    const signature = items.map(itemId).join('\u001e')
    if (page > 0 && items.length && signature === previousPage) {
      return { comments, complete: false }
    }
    const before = countCommentTree(comments)
    comments = mergeCommentRoots(comments, items)
    expectedCount = Math.max(expectedCount, Number(response?.total) || 0)
    onPage?.(comments)
    const completeCount =
      (expectedCount === 0 || countCommentTree(comments) >= expectedCount) &&
      areCommentRepliesComplete(comments)
    const hasMore = moreFlag(response?.hasMore)
    if (!items.length || hasMore === false) {
      // 预览里已有评论，而第一页却为空，通常是当前入口不可用或受限，不能当作末页。
      return { comments, complete: completeCount && !(page === 0 && !items.length && before > 0) }
    }
    if (hasMore === null && items.length < pageSize && completeCount) {
      return { comments, complete: true }
    }
    stagnantPages = countCommentTree(comments) === before ? stagnantPages + 1 : 0
    if (stagnantPages >= 2) return { comments, complete: false }
    previousPage = signature
  }
  return { comments, complete: false }
}
