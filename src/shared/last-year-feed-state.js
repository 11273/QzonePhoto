export const loadLastYearFeedRange = async ({
  fetchYear,
  firstYear,
  minYear = 2010,
  count = 10,
  mode = 1
}) => {
  let year = firstYear
  let confirmedEmptyYears = 0

  while (year >= minYear) {
    let response
    try {
      response = await fetchYear({ year, count, mode })
    } catch (error) {
      // 个别账号在接口支持的最早年份只返回空响应。只有此前年份都已明确
      // 成功且为空时，才能保留这些已确认结果；其他失败继续抛出真实原因。
      if (year === minYear && confirmedEmptyYears > 0) {
        return {
          code: 0,
          feeds: [],
          hasMore: false,
          pager: { year, count, mode },
          emptyDescription: `已检查 ${firstYear}–${year + 1} 年，没有读取到可见的往年今日内容；${year} 年的数据未能继续读取。`
        }
      }
      throw error
    }

    if (!response || Number(response.code) !== 0) return response
    if (response?.feeds?.length || year === minYear) {
      return { ...response, pager: { year, count, mode } }
    }
    confirmedEmptyYears += 1
    year -= 1
  }

  return { code: 0, feeds: [], hasMore: false, pager: { year, count, mode } }
}
