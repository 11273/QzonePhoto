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
