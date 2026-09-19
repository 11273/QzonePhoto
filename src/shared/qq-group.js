const GROUP_SCORE_FIELDS = [
  {
    field: 'groupdayscore',
    scoreKey: 'dayScore',
    rankKey: 'dayRank',
    candidates: ['score', 'dayscore', 'dayScore']
  },
  {
    field: 'groupweekscore',
    scoreKey: 'weekScore',
    rankKey: 'weekRank',
    candidates: ['score', 'weekscore', 'weekScore']
  },
  {
    field: 'groupmonthscore',
    scoreKey: 'monthScore',
    rankKey: 'monthRank',
    candidates: ['score', 'monthscore', 'monthScore']
  },
  {
    field: 'grouptotalscore',
    scoreKey: 'totalScore',
    rankKey: 'totalRank',
    candidates: ['totalscore', 'total_score', 'totalScore', 'score']
  }
]
export const QQ_GROUP_MEMBER_PAGE_SIZE = 30

const asObject = (value) => (value && typeof value === 'object' ? value : {})
const asArray = (value) => (Array.isArray(value) ? value : [])
const normalizedUin = (value) => {
  const uin = String(value ?? '')
    .replace(/^o/, '')
    .trim()
  return /^\d+$/.test(uin) ? uin : ''
}

export const unwrapQQGroupData = (response) => {
  const payload = asObject(response)
  return asObject(payload.data || payload)
}

export const paginateQQGroupMembers = (members, limit = QQ_GROUP_MEMBER_PAGE_SIZE) =>
  asArray(members).slice(0, Math.max(0, Number(limit) || 0))

export const normalizeQQGroups = (response) => {
  const data = unwrapQQGroupData(response)
  const seen = new Set()
  const groups = []

  for (const item of asArray(data.groupinfo)) {
    const id = normalizedUin(item?.groupid ?? item?.groupId ?? item?.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    groups.push({ id, name: String(item?.groupname ?? item?.groupName ?? '').trim() || '未命名群' })
  }

  const defaultGroupId = normalizedUin(
    data.areadata?.groupid ?? data.areadata?.groupId ?? data.groupid
  )
  return { groups, defaultGroupId }
}

const profileEntries = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => [normalizedUin(item?.uin ?? item?.qq), item])
  }
  return Object.entries(asObject(value)).map(([key, item]) => [
    normalizedUin(item?.uin ?? item?.qq ?? key),
    item
  ])
}

const metricNumber = (item, candidates) => {
  for (const key of candidates) {
    const value = Number(item?.[key])
    if (Number.isFinite(value)) return value
  }
  return 0
}

const metricRank = (item, fallback) => {
  const rank = Number(item?.rank ?? item?.ranking ?? item?.order)
  return Number.isFinite(rank) && rank > 0 ? rank : fallback
}

export const normalizeQQGroupMembers = (response, groupId = '') => {
  const data = unwrapQQGroupData(response)
  const profiles = new Map()
  const profileSource = data.groupmeminfo || data.friendinfo
  for (const [uin, profile] of profileEntries(profileSource)) {
    if (uin) profiles.set(uin, asObject(profile))
  }

  const scoreByUin = new Map()
  const orderedUins = []
  const seen = new Set()
  for (const metric of GROUP_SCORE_FIELDS) {
    for (const [index, item] of asArray(data[metric.field]).entries()) {
      const uin = normalizedUin(item?.uin ?? item?.qq)
      if (!uin) continue
      scoreByUin.set(uin, {
        ...scoreByUin.get(uin),
        [metric.scoreKey]: metricNumber(item, metric.candidates),
        [metric.rankKey]: metricRank(item, index + 1)
      })
      if (!seen.has(uin)) {
        seen.add(uin)
        orderedUins.push(uin)
      }
    }
  }

  // 指定群接口返回的 groupmeminfo 是官网当前允许看到的记录；不推测接口未返回的人。
  if (data.groupmeminfo) {
    for (const uin of profiles.keys()) {
      if (!seen.has(uin)) {
        seen.add(uin)
        orderedUins.push(uin)
      }
    }
  } else if (orderedUins.length === 0) {
    orderedUins.push(...profiles.keys())
  }

  return orderedUins.map((uin) => {
    const profile = profiles.get(uin) || {}
    const score = scoreByUin.get(uin) || {}
    return {
      uin,
      groupId: String(groupId || ''),
      name: String(profile.nickname ?? profile.nick ?? profile.name ?? '').trim(),
      remark: String(profile.remark ?? '').trim(),
      img: `https://qlogo4.store.qq.com/qzone/${uin}/${uin}/100`,
      level: Number(profile.scorelevel ?? profile.level) || 0,
      dayScore: score.dayScore || 0,
      weekScore: score.weekScore || 0,
      monthScore: score.monthScore || 0,
      totalScore: score.totalScore || 0,
      dayRank: score.dayRank || 0,
      weekRank: score.weekRank || 0,
      monthRank: score.monthRank || 0,
      totalRank: score.totalRank || 0,
      score: score.totalScore || score.monthScore || score.weekScore || score.dayScore || 0
    }
  })
}
