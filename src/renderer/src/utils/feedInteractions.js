const itemId = (item) =>
  String(item?.id || [item?.uin, item?.time, item?.text].filter(Boolean).join('\u001f'))

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
  const result = [...base]
  const byId = new Map(result.map((item) => [itemId(item), item]))
  for (const item of incoming) {
    const key = itemId(item)
    if (!key) continue
    const previous = byId.get(key)
    if (!previous) {
      const normalized = { ...item, responses: mergeCommentRoots([], item.responses || []) }
      result.push(normalized)
      byId.set(key, normalized)
      continue
    }
    previous.responses = mergeCommentRoots(previous.responses || [], item.responses || [])
    for (const field of ['author', 'text', 'time', 'targetNick', 'targetUin']) {
      if (!previous[field] && item[field]) previous[field] = item[field]
    }
  }
  return result
}

export const countCommentTree = (items = []) =>
  items.reduce((total, item) => total + 1 + countCommentTree(item.responses || []), 0)

const moreFlag = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  return value === 1 || value === '1' || value === 'true'
}

export async function collectAllLikers({ initial = [], expected = 0, requestPage, onPage }) {
  const preview = mergeLikers([], initial)
  if (expected > 0 && preview.length >= expected && preview.every((person) => person.name)) {
    return { likers: preview, total: expected, complete: true }
  }
  let likers = preview
  let total = Math.max(0, Number(expected) || 0, preview.length)
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
    onPage?.(likers, total)
    if (total > 0 && likers.length >= total && likers.every((person) => person.name)) {
      return { likers, total, complete: true }
    }
    const nextCursor = String(response?.nextCursor || items.at(-1)?.uin || '')
    if (!items.length || !nextCursor || nextCursor === cursor) break
    const hasMore = moreFlag(response?.hasMore)
    if (hasMore === false) break
    if (total === 0 && hasMore === null && items.length < 60) {
      return { likers, total: likers.length, complete: true }
    }
    cursor = nextCursor
  }
  return {
    likers: likers.length ? likers : preview,
    total,
    complete: total === 0 && !likers.length
  }
}

export async function collectAllComments({ initial = [], requestPage, onPage, pageSize = 30 }) {
  let comments = mergeCommentRoots([], initial)
  let previousPage = ''
  for (let page = 0; page < 1000; page += 1) {
    const response = await requestPage(page * pageSize, pageSize)
    if (Number(response?.code) !== 0) throw new Error(response?.message || '评论加载失败')
    const items = Array.isArray(response?.comments) ? response.comments : []
    const signature = items.map(itemId).join('\u001e')
    if (page > 0 && items.length && signature === previousPage) {
      return { comments, complete: false }
    }
    comments = mergeCommentRoots(comments, items)
    onPage?.(comments)
    if (!items.length || moreFlag(response?.hasMore) === false) {
      return { comments, complete: true }
    }
    if (moreFlag(response?.hasMore) === null && items.length < pageSize) {
      return { comments, complete: true }
    }
    previousPage = signature
  }
  return { comments, complete: false }
}
