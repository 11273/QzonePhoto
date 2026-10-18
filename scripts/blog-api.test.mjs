import assert from 'node:assert/strict'
import test from 'node:test'

import { buildQzoneBlogListParams } from '../src/shared/qzone-blog-query.js'

test('日志摘要接口使用服务端支持的参数与 UTF-8 响应', () => {
  const params = buildQzoneBlogListParams({
    viewerUin: '10001',
    hostUin: '10002',
    pos: 15,
    num: 15,
    gTk: 123456,
    random: 0.5
  })

  assert.equal(params.reqInfo, 1)
  assert.equal(params.absType, 0)
  assert.equal(params.inCharset, 'utf-8')
  assert.equal(params.outCharset, 'utf-8')
  assert.equal(params.hostUin, '10002')
  assert.equal(params.uin, '10001')
  assert.equal(params.pos, 15)
  assert.equal(params.g_tk, 123456)
})

test('动态加载失败不会把乱码或上游原始错误直接展示给用户', async () => {
  const { classifyContentLoadFailure } = await import('../src/shared/content-load-state.js')
  const state = classifyContentLoadFailure('�����ͳ�����', { label: '我的日志' })

  assert.equal(state.title, '我的日志暂时加载失败')
  assert.equal(state.description, '没有成功读取我的日志，请稍后重新加载。')
  assert.doesNotMatch(state.description, /�/)
})
