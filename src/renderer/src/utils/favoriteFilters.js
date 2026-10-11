// 收藏筛选的 type 与 fav_list 条目自身的 type 不是同一套编号。
// 顺序和参数均以 QQ 空间官网「我的收藏」分类入口为准。
export const FAVORITE_FILTERS = Object.freeze([
  { type: 0, label: '全部' },
  { type: 1, label: '日志' },
  { type: 3, label: '说说' },
  { type: 4, label: '分享' },
  { type: 2, label: '照片' },
  { type: 5, label: '文字' },
  { type: 6, label: '网页' }
])

export const favoriteFilterFor = (type) =>
  FAVORITE_FILTERS.find((filter) => filter.type === Number(type)) || FAVORITE_FILTERS[0]

/**
 * 官网 type_num 历史上同时出现过数组、对象和 { type, num } 数组。
 * 在渲染层统一收敛成 { [filterType]: count }，避免 UI 绑定接口形态。
 */
export const normalizeFavoriteTypeCounts = (raw, total = 0) => {
  const counts = {}
  const assign = (type, value) => {
    const key = Number(type)
    const count = Number(value)
    if (!Number.isInteger(key) || key < 0 || !Number.isFinite(count) || count < 0) return
    counts[key] = count
  }

  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      if (item && typeof item === 'object') {
        assign(item.type ?? item.id ?? item.key ?? index, item.num ?? item.count ?? item.total)
      } else {
        assign(index, item)
      }
    })
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        assign(value.type ?? value.id ?? key, value.num ?? value.count ?? value.total)
      } else {
        assign(key, value)
      }
    })
  }

  const safeTotal = Number(total) || 0
  if (safeTotal > 0) counts[0] = safeTotal
  else if (counts[0] === undefined) {
    const detailTotal = FAVORITE_FILTERS.filter((item) => item.type !== 0).reduce(
      (sum, item) => sum + Number(counts[item.type] || 0),
      0
    )
    if (detailTotal) counts[0] = detailTotal
  }
  return counts
}
