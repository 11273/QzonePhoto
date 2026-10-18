import assert from 'node:assert/strict'
import test from 'node:test'

import { loadLastYearFeedRange } from '../src/shared/last-year-feed-state.js'

test('最早年份空响应只保留此前逐年确认过的空结果', async () => {
  const requested = []
  const result = await loadLastYearFeedRange({
    firstYear: 2012,
    minYear: 2010,
    fetchYear: async ({ year }) => {
      requested.push(year)
      if (year === 2010) throw new Error('QQ 空间返回的数据不完整')
      return { code: 0, feeds: [], hasMore: false }
    }
  })

  assert.deepEqual(requested, [2012, 2011, 2010])
  assert.equal(result.code, 0)
  assert.match(result.emptyDescription, /已检查 2012–2011 年/)
  assert.match(result.emptyDescription, /2010 年的数据未能继续读取/)
})

test('中间年份失败仍保留真实错误，不伪装成空内容', async () => {
  await assert.rejects(
    loadLastYearFeedRange({
      firstYear: 2012,
      minYear: 2010,
      fetchYear: async ({ year }) => {
        if (year === 2011) throw new Error('网络连接异常')
        return { code: 0, feeds: [], hasMore: false }
      }
    }),
    /网络连接异常/
  )
})

test('找到往年内容后立即返回对应年份和分页参数', async () => {
  const result = await loadLastYearFeedRange({
    firstYear: 2012,
    minYear: 2010,
    count: 8,
    mode: 2,
    fetchYear: async ({ year }) => ({
      code: 0,
      feeds: year === 2011 ? [{ id: 'feed-1' }] : [],
      hasMore: false
    })
  })

  assert.equal(result.feeds.length, 1)
  assert.deepEqual(result.pager, { year: 2011, count: 8, mode: 2 })
})
