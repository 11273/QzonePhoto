const list = (value) => (Array.isArray(value) ? value : [])
const text = (value) => String(value ?? '').trim()
const number = (value) => {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}
const activeFlag = (value) =>
  value === true ||
  number(value) > 0 ||
  ['online', 'yes', 'true'].includes(text(value).toLowerCase())

const escapeHtml = (value) =>
  text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const csvCell = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"'
const csv = (headers, rows) =>
  '\ufeff' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'

const readableDate = (value) => {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { hour12: false })
}

export const CONTACT_BACKUP_SCOPE_LABELS = Object.freeze({
  all: '全部联系人',
  friends: '好友',
  'current-friend-group': '当前好友分组',
  groups: '全部群',
  'current-group': '当前群',
  intimacy: '亲密度',
  'current-intimacy': '当前亲密度'
})

export const CONTACT_BACKUP_SCOPE_CATEGORIES = Object.freeze({
  all: '全部联系人',
  friends: '好友',
  'current-friend-group': '好友',
  groups: '群',
  'current-group': '群',
  intimacy: '亲密度',
  'current-intimacy': '亲密度'
})

const normalizeScope = (value) =>
  Object.hasOwn(CONTACT_BACKUP_SCOPE_LABELS, value) ? value : 'all'

export const contactBackupTimestamp = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (part) => String(part).padStart(2, '0')
  return [
    date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()),
    pad(date.getHours()) + '-' + pad(date.getMinutes()) + '-' + pad(date.getSeconds())
  ].join('_')
}

const primaryName = (person) => text(person.remark) || text(person.name) || `QQ ${text(person.uin)}`

const secondaryName = (person) => {
  const remark = text(person.remark)
  const name = text(person.name)
  return remark && name && remark !== name ? name : ''
}

const recordFor = (person, kind, kindLabel, collection, collectionId = '') => {
  const details = []
  const online = activeFlag(person.online)
  const yellowLevel = number(person.yellow ?? person.yellowLevel)
  const vip = activeFlag(person.v6 ?? person.vip)
  const level = number(person.level)
  const dayScore = number(person.dayScore)
  const weekScore = number(person.weekScore)
  const monthScore = number(person.monthScore)
  const totalScore = number(person.totalScore ?? person.score)
  const dayRank = number(person.dayRank)
  const weekRank = number(person.weekRank)
  const monthRank = number(person.monthRank)
  const totalRank = number(person.totalRank)
  const intimacyScore = kind === 'intimacy' ? number(person.score) : 0
  const mutual = Boolean(person.mutual)

  if (kind === 'friends') {
    if (online) details.push('在线')
    if (yellowLevel > 0) details.push(`黄钻 ${yellowLevel}`)
    if (vip) details.push('QQ 会员')
  }
  if (kind === 'groups') {
    if (level > 0) details.push(`空间等级 ${level}`)
    if (totalScore > 0) details.push(`总积分 ${totalScore}`)
    if (dayScore > 0) details.push(`今日 ${dayScore}`)
  }
  if (kind === 'intimacy') {
    if (person.score != null) details.push(`亲密度 ${number(person.score)}`)
    if (mutual) details.push('双方名单均出现')
  }

  return {
    kind,
    kindLabel,
    collection,
    collectionId: text(collectionId),
    remark: text(person.remark),
    name: text(person.name),
    primary: primaryName(person),
    secondary: secondaryName(person),
    uin: text(person.uin),
    detail: details.join(' · '),
    img: text(person.img),
    online,
    yellowLevel,
    vip,
    level,
    dayScore,
    weekScore,
    monthScore,
    totalScore,
    dayRank,
    weekRank,
    monthRank,
    totalRank,
    intimacyScore,
    mutual
  }
}

const buildCollections = ({ snapshot, includeFriends, includeGroups, includeIntimacy }) => {
  const collections = []

  if (includeFriends) {
    const byId = new Map()
    const ensureFriendGroup = (id, name) => {
      const key = text(id) || `name:${text(name) || '未分组'}`
      if (!byId.has(key)) {
        const collection = {
          key: `friends:${key}`,
          kind: 'friends',
          kindLabel: '好友分组',
          name: text(name) || '未分组',
          sourceId: text(id),
          identifier: '',
          status: '',
          records: []
        }
        byId.set(key, collection)
        collections.push(collection)
      }
      return byId.get(key)
    }

    for (const group of list(snapshot.friendGroups)) ensureFriendGroup(group.id, group.name)
    for (const friend of list(snapshot.friends)) {
      const collection = ensureFriendGroup(friend.groupid, friend.groupName)
      collection.records.push(
        recordFor(friend, 'friends', '好友分组', collection.name, friend.groupid)
      )
    }
  }

  if (includeGroups) {
    const membersByGroup = new Map()
    for (const member of list(snapshot.groupMembers)) {
      const id = text(member.groupId)
      if (!membersByGroup.has(id)) membersByGroup.set(id, [])
      membersByGroup.get(id).push(member)
    }

    const knownGroupIds = new Set()
    for (const group of list(snapshot.groups)) {
      const id = text(group.id)
      knownGroupIds.add(id)
      const name = text(group.name) || '未命名群'
      collections.push({
        key: `groups:${id}`,
        kind: 'groups',
        kindLabel: 'QQ 群',
        name,
        sourceId: id,
        identifier: id ? `群号 ${id}` : '',
        status: text(group.status),
        records: list(membersByGroup.get(id)).map((member) =>
          recordFor(member, 'groups', 'QQ 群', name, id)
        )
      })
    }

    for (const [id, members] of membersByGroup) {
      if (knownGroupIds.has(id)) continue
      const name = text(members[0]?.groupName) || '未命名群'
      collections.push({
        key: `groups:${id}`,
        kind: 'groups',
        kindLabel: 'QQ 群',
        name,
        sourceId: id,
        identifier: id ? `群号 ${id}` : '',
        status: '已读取',
        records: members.map((member) => recordFor(member, 'groups', 'QQ 群', name, id))
      })
    }
  }

  if (includeIntimacy) {
    const care = list(snapshot.care)
    const careBy = list(snapshot.careBy)
    const careUins = new Set(care.map((person) => text(person.uin)).filter(Boolean))
    const careByUins = new Set(careBy.map((person) => text(person.uin)).filter(Boolean))
    let intimacyCollections = [
      ['care', '我在意谁', care, careByUins],
      ['care-by', '谁在意我', careBy, careUins]
    ]
    if (normalizeScope(snapshot.scope) === 'current-intimacy') {
      const currentType = snapshot.intimacyType === 'care-by' ? 'care-by' : 'care'
      intimacyCollections = intimacyCollections.filter(([id]) => id === currentType)
    }
    for (const [id, name, people, reciprocalUins] of intimacyCollections) {
      collections.push({
        key: `intimacy:${id}`,
        kind: 'intimacy',
        kindLabel: '亲密度',
        name,
        sourceId: id,
        identifier: '',
        status: '',
        records: people.map((person) =>
          recordFor(
            { ...person, mutual: reciprocalUins.has(text(person.uin)) },
            'intimacy',
            '亲密度',
            name,
            id
          )
        )
      })
    }
  }

  return collections
}

const renderRecord = (record) => {
  const initial = record.primary.replace(/^QQ\s*/i, '').slice(0, 1) || '?'
  const searchText = [
    record.kindLabel,
    record.collection,
    record.remark,
    record.name,
    record.uin,
    record.detail
  ].join(' ')
  return [
    `<article class="contact" data-search="${escapeHtml(searchText.toLowerCase())}">`,
    `<span class="avatar" aria-hidden="true">${escapeHtml(initial)}</span>`,
    '<div class="identity">',
    `<strong>${escapeHtml(record.primary)}</strong>`,
    record.secondary ? `<span>${escapeHtml(record.secondary)}</span>` : '',
    '</div>',
    `<code>${escapeHtml(record.uin)}</code>`,
    `<span class="detail">${escapeHtml(record.detail)}</span>`,
    '</article>'
  ].join('')
}

const renderCollection = (collection, index, allCollections, showKindBadge = true) => {
  const searchText = [collection.kindLabel, collection.name, collection.identifier].join(' ')
  const initiallyExpanded = allCollections.length <= 6 || index < 2
  const records = collection.records.length
    ? collection.records.map(renderRecord).join('\n')
    : '<p class="collection-empty">暂无可见记录</p>'
  const statusClass = collection.status.startsWith('读取失败') ? ' status-warning' : ''
  return [
    `<section class="collection" data-kind="${escapeHtml(collection.kind)}" data-search="${escapeHtml(searchText.toLowerCase())}">`,
    `<button class="collection-head" type="button" aria-expanded="${initiallyExpanded}">`,
    '<div class="collection-title">',
    showKindBadge ? `<span class="kind-badge">${escapeHtml(collection.kindLabel)}</span>` : '',
    `<strong class="collection-name">${escapeHtml(collection.name)}</strong>`,
    '</div>',
    '<span class="collection-end">',
    `<strong class="collection-count">${collection.records.length}</strong>`,
    '<span class="collection-chevron" aria-hidden="true"></span>',
    '</span>',
    '</button>',
    `<div class="collection-body"${initiallyExpanded ? '' : ' hidden'}>`,
    collection.identifier || collection.status
      ? `<p class="collection-meta${statusClass}">${escapeHtml(
          [collection.identifier, collection.status].filter(Boolean).join(' · ')
        )}</p>`
      : '',
    `<div class="contacts">${records}</div>`,
    '</div>',
    '</section>'
  ].join('\n')
}

const collectionCounts = (collections) => {
  const records = collections.flatMap((collection) => collection.records)
  const friendCollections = collections.filter((collection) => collection.kind === 'friends')
  const friendRecords = friendCollections.flatMap((collection) => collection.records)
  const groupCollections = collections.filter((collection) => collection.kind === 'groups')
  const groupRecords = groupCollections.flatMap((collection) => collection.records)
  const intimacyCollections = collections.filter((collection) => collection.kind === 'intimacy')
  const intimacyRecords = intimacyCollections.flatMap((collection) => collection.records)
  return {
    friends: friendRecords.length,
    friendGroups: friendCollections.length,
    friendRemarks: friendRecords.filter((record) => record.remark).length,
    onlineFriends: friendRecords.filter((record) => record.online).length,
    yellowFriends: friendRecords.filter((record) => record.yellowLevel > 0).length,
    groups: groupCollections.length,
    groupsRead: groupCollections.filter((collection) => !collection.status.startsWith('读取失败'))
      .length,
    groupMembers: groupRecords.length,
    groupMembersWithLevel: groupRecords.filter((record) => record.level > 0).length,
    groupMembersWithScore: groupRecords.filter(
      (record) =>
        record.dayScore > 0 ||
        record.weekScore > 0 ||
        record.monthScore > 0 ||
        record.totalScore > 0
    ).length,
    intimacy: intimacyRecords.length,
    care: intimacyCollections.find((collection) => collection.key === 'intimacy:care')?.records
      .length,
    careBy: intimacyCollections.find((collection) => collection.key === 'intimacy:care-by')?.records
      .length,
    mutual: new Set(
      intimacyRecords.filter((record) => record.mutual && record.uin).map((record) => record.uin)
    ).size,
    intimacyWithScore: intimacyRecords.filter((record) => record.intimacyScore > 0).length,
    records: records.length
  }
}

const summaryMetricsFor = (viewKind, counts, collectionCount) => {
  if (viewKind === 'friends') {
    const metrics = [
      [counts.friends, '好友'],
      [counts.friendRemarks, '有备注'],
      [counts.onlineFriends, '备份时在线'],
      [counts.yellowFriends, '有黄钻资料']
    ]
    if (collectionCount > 1) metrics.splice(1, 0, [counts.friendGroups, '好友分组'])
    return metrics
  }
  if (viewKind === 'groups') {
    const metrics = [
      [counts.groups, 'QQ 群'],
      [counts.groupMembers, '可见成员记录'],
      [counts.groupsRead, '成员读取成功'],
      [counts.groupMembersWithScore, '有积分资料']
    ]
    return counts.groups === 1 ? metrics.slice(1) : metrics
  }
  if (viewKind === 'intimacy') {
    const metrics = []
    if (counts.care != null) metrics.push([counts.care, '我在意谁'])
    if (counts.careBy != null) metrics.push([counts.careBy, '谁在意我'])
    if (counts.care != null && counts.careBy != null)
      metrics.push([counts.mutual, '双方名单均出现'])
    metrics.push([counts.intimacyWithScore, '有亲密度数值'])
    return metrics
  }
  return [
    [counts.friends, '好友'],
    [counts.groups, 'QQ 群'],
    [counts.groupMembers, '群成员记录'],
    [counts.intimacy, '亲密度记录']
  ]
}

const searchPlaceholderFor = (viewKind) => {
  if (viewKind === 'friends') return '搜索备注、昵称、QQ 号或好友分组'
  if (viewKind === 'groups') return '搜索群名、群号、成员昵称或 QQ 号'
  if (viewKind === 'intimacy') return '搜索昵称、QQ 号或亲密度'
  return '搜索备注、昵称、QQ 号或分组'
}

const buildBackupHtml = ({
  scopeTitle,
  generatedAt,
  owner,
  collections,
  counts,
  warnings = [],
  viewKind = 'all'
}) => {
  const kinds = [
    ['all', '全部', counts.records],
    ['friends', '好友分组', counts.friends],
    ['groups', 'QQ 群', counts.groupMembers],
    ['intimacy', '亲密度', counts.intimacy]
  ].filter(([kind, , count]) => kind === 'all' || count > 0)
  const showKindFilters = viewKind === 'all' && kinds.length > 2
  const filterButtons = showKindFilters
    ? kinds
        .map(
          ([kind, label, count], index) =>
            `<button type="button" data-filter="${kind}" aria-pressed="${index === 0}">${label}<span>${count}</span></button>`
        )
        .join('')
    : ''
  const showFoldActions = collections.length > 2
  const summaryMetrics = summaryMetricsFor(viewKind, counts, collections.length)
  const summaryCards = summaryMetrics
    .map(([value, label]) => `<div><strong>${value || 0}</strong><span>${label}</span></div>`)
    .join('')
  const ownerLabel = [text(owner?.name), text(owner?.uin) ? `QQ ${text(owner.uin)}` : '']
    .filter(Boolean)
    .join(' · ')
  const warningItems = list(warnings)
    .map((warning) => text(warning?.message || warning))
    .filter(Boolean)
  const warning = warningItems.length
    ? [
        '<aside class="warning" role="status">',
        '<strong>部分内容暂时未读取</strong>',
        `<ul>${warningItems.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>`,
        '<span>其余可用内容已经保存，可以稍后在应用中重新备份。</span>',
        '</aside>'
      ].join('')
    : ''

  return [
    '<!doctype html>',
    '<html lang="zh-CN"><head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    `<title>企鹅相册 · ${escapeHtml(scopeTitle)}</title>`,
    '<style>',
    ':root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#111216;color:#e5e7eb}',
    '*{box-sizing:border-box}body{margin:0;padding:28px;background:radial-gradient(circle at 15% 0,rgba(37,99,235,.12),transparent 34%),#111216}',
    'main{width:min(1120px,100%);margin:0 auto}.hero,.toolbar,.collection{border:1px solid #2d3038;background:rgba(26,28,33,.96);box-shadow:0 16px 40px rgba(0,0,0,.14)}',
    '.hero{padding:22px;border-radius:16px}.hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}h1,h2,p{margin:0}h1{font-size:24px;color:#f8fafc}.source{margin-top:5px;color:#94a3b8;font-size:12px}.time{color:#94a3b8;font-size:12px}',
    '.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:18px}.summary div{padding:11px 12px;border-radius:10px;background:#23262e}.summary strong{display:block;color:#fdba74;font-size:18px;font-variant-numeric:tabular-nums}.summary span{color:#94a3b8;font-size:11px}',
    '.warning{margin-top:14px;padding:11px 13px;border:1px solid rgba(251,191,36,.24);border-radius:9px;background:rgba(251,191,36,.07);color:#fde68a;font-size:12px;line-height:1.55}.warning strong,.warning span{display:block}.warning ul{margin:5px 0;padding-left:18px}.warning span{color:#d6b973}',
    '.toolbar{position:sticky;top:12px;z-index:2;display:flex;align-items:center;gap:8px;margin:14px 0;padding:10px;border-radius:12px}.filters{display:flex;flex-shrink:0;gap:6px;overflow:auto}.filters button,.fold-actions button{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 10px;border:1px solid #343842;border-radius:8px;color:#cbd5e1;background:#242730;cursor:pointer;white-space:nowrap}.filters button[aria-pressed="true"]{border-color:rgba(249,115,22,.55);color:#fed7aa;background:rgba(249,115,22,.14)}.filters span{color:#64748b;font-size:10px}.fold-actions{display:flex;flex-shrink:0;gap:6px}.fold-actions button:hover,.filters button:hover{border-color:#475569;color:#f8fafc}.fold-actions button:focus-visible,.filters button:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}',
    '.search{width:100%;min-width:180px;height:34px;padding:0 11px;border:1px solid #343842;border-radius:8px;outline:0;color:#f8fafc;background:#15171c}.search:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.12)}.result-count{flex-shrink:0;color:#94a3b8;font-size:11px;font-variant-numeric:tabular-nums}',
    '.collection{margin-bottom:12px;border-radius:14px;overflow:hidden}.collection-head{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border:0;color:inherit;background:transparent;text-align:left;cursor:pointer}.collection-head:hover{background:rgba(255,255,255,.025)}.collection-head:focus-visible{outline:2px solid #60a5fa;outline-offset:-3px}.collection-title,.collection-end{display:flex;align-items:center;gap:8px;min-width:0}.kind-badge{flex-shrink:0;padding:3px 6px;border-radius:5px;color:#bfdbfe;background:rgba(96,165,250,.12);font-size:10px}.collection-name{overflow:hidden;color:#f1f5f9;font-size:15px;text-overflow:ellipsis;white-space:nowrap}.collection-count{display:grid;place-items:center;min-width:28px;height:28px;border-radius:999px;color:#fdba74;background:rgba(249,115,22,.12);font-size:12px}.collection-chevron{width:8px;height:8px;border-right:2px solid #64748b;border-bottom:2px solid #64748b;transform:rotate(45deg) translateY(-2px);transition:transform .18s ease}.collection-head[aria-expanded="false"] .collection-chevron{transform:rotate(-45deg)}',
    '.collection-meta{padding:0 16px 10px;color:#64748b;font-size:11px}.collection-meta.status-warning{color:#fbbf24}.contacts{border-top:1px solid #292c34}.contact{display:grid;grid-template-columns:32px minmax(160px,1fr) minmax(90px,140px) minmax(100px,160px);align-items:center;gap:10px;min-height:52px;padding:8px 16px;border-bottom:1px solid #252831}.contact:last-child{border-bottom:0}.avatar{display:grid;place-items:center;width:30px;height:30px;border:1px solid #374151;border-radius:50%;color:#bfdbfe;background:#242a35;font-size:12px}.identity{min-width:0}.identity strong,.identity span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.identity strong{color:#e2e8f0;font-size:13px}.identity span{margin-top:2px;color:#64748b;font-size:11px}.contact code{color:#93c5fd;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.detail{color:#94a3b8;font-size:11px}.collection-empty{padding:20px;color:#64748b;text-align:center;font-size:12px}.empty-state{display:none;padding:42px;color:#94a3b8;text-align:center}[hidden]{display:none!important}',
    '@media(max-width:820px){body{padding:12px}.summary{grid-template-columns:repeat(2,1fr)}.toolbar{flex-wrap:wrap}.filters,.fold-actions{max-width:100%;overflow:auto}.search{order:-1;flex-basis:100%}.contact{grid-template-columns:32px minmax(0,1fr);gap:8px}.contact code,.detail{grid-column:2}.hero-top{flex-direction:column;gap:6px}}',
    '@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}',
    '</style></head><body><main>',
    '<section class="hero">',
    '<div class="hero-top"><div>',
    `<h1>${escapeHtml(scopeTitle)}</h1>`,
    ownerLabel ? `<p class="source">来源账号 ${escapeHtml(ownerLabel)}</p>` : '',
    '</div>',
    `<span class="time">备份时间 ${escapeHtml(generatedAt)}</span></div>`,
    `<div class="summary">${summaryCards}</div>`,
    warning,
    '</section>',
    '<section class="toolbar" aria-label="联系人筛选">',
    filterButtons ? `<div class="filters">${filterButtons}</div>` : '',
    `<input class="search" type="search" placeholder="${escapeHtml(searchPlaceholderFor(viewKind))}" aria-label="搜索联系人" />`,
    showFoldActions
      ? '<div class="fold-actions"><button type="button" data-fold="open">全部展开</button><button type="button" data-fold="close">全部折叠</button></div>'
      : '',
    `<span class="result-count" aria-live="polite">${counts.records} 条</span>`,
    '</section>',
    `<div class="collections">${collections
      .map((collection, index) =>
        renderCollection(collection, index, collections, viewKind === 'all')
      )
      .join('\n')}</div>`,
    '<p class="empty-state">没有匹配的联系人记录</p>',
    '<script>',
    "const input=document.querySelector('.search'),filters=[...document.querySelectorAll('[data-filter]')],sections=[...document.querySelectorAll('.collection')],count=document.querySelector('.result-count'),empty=document.querySelector('.empty-state');let kind='all';function expand(section,value){const head=section.querySelector('.collection-head'),body=section.querySelector('.collection-body');head.setAttribute('aria-expanded',String(value));body.hidden=!value}function apply(){const query=input.value.trim().toLowerCase();let shown=0,visibleSections=0;for(const section of sections){const kindMatch=kind==='all'||section.dataset.kind===kind,sectionMatch=(section.dataset.search||'').includes(query);let matched=0;const rows=[...section.querySelectorAll('.contact')];for(const row of rows){const visible=kindMatch&&(!query||(row.dataset.search||'').includes(query)||sectionMatch);row.hidden=!visible;if(visible)matched+=1}const visible=kindMatch&&(!query||matched>0||sectionMatch);section.hidden=!visible;if(visible){visibleSections+=1;shown+=matched;if(query)expand(section,true)}}count.textContent=shown+' 条';empty.style.display=visibleSections===0?'block':'none'}for(const section of sections){section.querySelector('.collection-head').addEventListener('click',()=>expand(section,section.querySelector('.collection-head').getAttribute('aria-expanded')!=='true'))}for(const button of filters){button.addEventListener('click',()=>{kind=button.dataset.filter;for(const item of filters)item.setAttribute('aria-pressed',String(item===button));apply()})}for(const button of document.querySelectorAll('[data-fold]'))button.addEventListener('click',()=>{for(const section of sections)if(!section.hidden)expand(section,button.dataset.fold==='open')});input.addEventListener('input',apply);apply();",
    '</script>',
    '</main></body></html>'
  ].join('\n')
}

export const buildContactBackupFiles = (snapshot = {}, exportedAt = new Date()) => {
  const scope = normalizeScope(snapshot.scope)
  const includeFriends = scope === 'all' || scope === 'friends' || scope === 'current-friend-group'
  const includeGroups = scope === 'all' || scope === 'groups' || scope === 'current-group'
  const includeIntimacy = scope === 'all' || scope === 'intimacy' || scope === 'current-intimacy'
  const scopeTitle = CONTACT_BACKUP_SCOPE_LABELS[scope]
  const owner = {
    uin: text(snapshot.owner?.uin),
    name: text(snapshot.owner?.name)
  }
  const friends = list(snapshot.friends)
  const groups = list(snapshot.groups)
  const groupMembers = list(snapshot.groupMembers)
  const care = list(snapshot.care)
  const careBy = list(snapshot.careBy)
  const generatedAt = readableDate(exportedAt)
  const timestamp = contactBackupTimestamp(exportedAt)
  const warnings = list(snapshot.warnings).map((warning) =>
    typeof warning === 'string'
      ? { type: '', message: warning, id: '' }
      : {
          type: text(warning?.type),
          message: text(warning?.message),
          id: text(warning?.id)
        }
  )
  for (const group of groups.filter((item) => text(item.status).startsWith('读取失败'))) {
    if (warnings.some((warning) => warning.type === 'group' && warning.id === text(group.id)))
      continue
    warnings.push({
      type: 'group',
      message: `群「${text(group.name) || text(group.id)}」成员未能完整读取`,
      id: text(group.id)
    })
  }

  const collections = buildCollections({ snapshot, includeFriends, includeGroups, includeIntimacy })
  const records = collections.flatMap((collection) => collection.records)
  const counts = collectionCounts(collections)

  const summaryLines = [
    `企鹅相册 · ${scopeTitle}`,
    `备份时间：${generatedAt}`,
    `聚合记录：${counts.records} 条`
  ]
  if (owner.name || owner.uin) {
    summaryLines.splice(
      2,
      0,
      `来源账号：${[owner.name, owner.uin ? `QQ ${owner.uin}` : ''].filter(Boolean).join(' · ')}`
    )
  }
  if (includeFriends) summaryLines.push(`好友：${counts.friends} 位`)
  if (includeGroups) {
    summaryLines.push(`QQ 群：${counts.groups} 个`)
    summaryLines.push(`可见群成员记录：${counts.groupMembers} 条`)
  }
  if (includeIntimacy) summaryLines.push(`亲密度记录：${counts.intimacy} 条`)
  summaryLines.push(
    '',
    '文件说明：',
    `- 联系人总览_${timestamp}.html：直接用浏览器打开，可搜索、筛选并折叠分组`,
    '- 好友、群、亲密度：分别保存在同名文件夹中',
    '- CSV 文件：可用表格软件打开，方便再次整理',
    `- 联系人数据_${timestamp}.json：结构化快照，方便以后迁移或比较不同时间的变化`
  )
  if (warnings.length) {
    summaryLines.push('', '未完整读取：')
    warnings.forEach((warning) =>
      summaryLines.push(`- ${warning.message || '部分内容暂时无法读取'}`)
    )
  }
  summaryLines.push(
    '',
    '说明：群成员为当前账号在 QQ 空间积分榜中有权限看到的记录；不可见或未返回的数据不会推测。'
  )

  const aggregateRows = records.map((record) => [
    record.kindLabel,
    record.collection,
    record.collectionId,
    record.remark,
    record.name,
    record.uin,
    record.detail,
    record.img
  ])
  const friendGroupRows = collections
    .filter((collection) => collection.kind === 'friends')
    .map((collection) => [collection.name, collection.sourceId, collection.records.length])
  const friendRows = friends.map((friend) => [
    friend.groupName,
    friend.remark,
    friend.name,
    friend.uin,
    activeFlag(friend.online) ? '在线' : '',
    number(friend.yellow ?? friend.yellowLevel) || '',
    activeFlag(friend.v6 ?? friend.vip) ? '是' : '',
    friend.img
  ])
  const groupRows = groups.map((group) => [
    group.name,
    group.id,
    group.memberCount,
    group.status || '已读取'
  ])
  const memberRows = groupMembers.map((member) => [
    member.groupName,
    member.groupId,
    member.remark,
    member.name,
    member.uin,
    member.level,
    member.dayScore,
    member.weekScore,
    member.monthScore,
    member.totalScore ?? member.score,
    member.dayRank,
    member.weekRank,
    member.monthRank,
    member.totalRank,
    member.img
  ])
  const careUins = new Set(care.map((friend) => text(friend.uin)).filter(Boolean))
  const careByUins = new Set(careBy.map((friend) => text(friend.uin)).filter(Boolean))
  const intimacyRows = [
    ...care.map((friend) => [
      '我在意谁',
      friend.remark,
      friend.name,
      friend.uin,
      friend.score,
      careByUins.has(text(friend.uin)) ? '是' : '',
      friend.img
    ]),
    ...careBy.map((friend) => [
      '谁在意我',
      friend.remark,
      friend.name,
      friend.uin,
      friend.score,
      careUins.has(text(friend.uin)) ? '是' : '',
      friend.img
    ])
  ]

  const machineData = {
    schemaVersion: 1,
    application: 'QzonePhoto',
    scope,
    scopeTitle,
    generatedAt,
    owner,
    note: '只包含备份时当前账号在 QQ 空间有权限看到的数据',
    summary: counts,
    warnings,
    collections: collections.map((collection) => ({
      type: collection.kind,
      typeLabel: collection.kindLabel,
      name: collection.name,
      id: collection.sourceId,
      identifier: collection.identifier,
      status: collection.status,
      records: collection.records
    }))
  }

  const warningsFor = (...types) =>
    warnings.filter((warning) => !warning.type || types.includes(warning.type))
  const files = {
    [`联系人总览_${timestamp}.html`]: buildBackupHtml({
      scopeTitle,
      generatedAt,
      owner,
      collections,
      counts,
      warnings
    }),
    [`备份说明_${timestamp}.txt`]: summaryLines.join('\n') + '\n',
    [`联系人数据_${timestamp}.json`]: JSON.stringify(machineData, null, 2) + '\n',
    [`联系人汇总_${counts.records}条.csv`]: csv(
      ['类型', '分组', '分组标识', '备注', '昵称', 'QQ号', '附加信息', '头像地址'],
      aggregateRows
    )
  }
  if (includeFriends) {
    const friendCollections = collections.filter((collection) => collection.kind === 'friends')
    files[`好友/好友名单_${timestamp}.html`] = buildBackupHtml({
      scopeTitle: scope === 'current-friend-group' ? '当前好友分组' : '好友名单',
      generatedAt,
      owner,
      collections: friendCollections,
      counts: collectionCounts(friendCollections),
      warnings: warningsFor('friends'),
      viewKind: 'friends'
    })
    files[`好友/好友分组_${counts.friendGroups}组.csv`] = csv(
      ['分组', '分组标识', '好友数'],
      friendGroupRows
    )
    files[`好友/好友列表_${counts.friends}位.csv`] = csv(
      ['分组', '备注', '昵称', 'QQ号', '状态', '黄钻等级', 'QQ会员', '头像地址'],
      friendRows
    )
  }
  if (includeGroups) {
    const groupCollections = collections.filter((collection) => collection.kind === 'groups')
    files[`群/群与成员_${timestamp}.html`] = buildBackupHtml({
      scopeTitle: scope === 'current-group' ? '当前群成员' : '群与群成员',
      generatedAt,
      owner,
      collections: groupCollections,
      counts: collectionCounts(groupCollections),
      warnings: warningsFor('groups', 'group'),
      viewKind: 'groups'
    })
    files[`群/群列表_${counts.groups}个.csv`] = csv(
      ['群名称', '群号', '可见成员数', '读取状态'],
      groupRows
    )
    files[`群/群成员_${counts.groupMembers}条.csv`] = csv(
      [
        '群名称',
        '群号',
        '备注',
        '昵称',
        'QQ号',
        '空间等级',
        '今日积分',
        '本周积分',
        '本月积分',
        '总积分',
        '日榜排名',
        '周榜排名',
        '月榜排名',
        '总榜排名',
        '头像地址'
      ],
      memberRows
    )
  }
  if (includeIntimacy) {
    const intimacyCollections = collections.filter((collection) => collection.kind === 'intimacy')
    files[`亲密度/亲密度名单_${timestamp}.html`] = buildBackupHtml({
      scopeTitle: scope === 'current-intimacy' ? '当前亲密度名单' : '亲密度名单',
      generatedAt,
      owner,
      collections: intimacyCollections,
      counts: collectionCounts(intimacyCollections),
      warnings: warningsFor('intimacy'),
      viewKind: 'intimacy'
    })
    files[`亲密度/亲密度_${counts.intimacy}条.csv`] = csv(
      ['类型', '备注', '昵称', 'QQ号', '亲密度', '双方名单均出现', '头像地址'],
      intimacyRows
    )
  }
  return files
}
