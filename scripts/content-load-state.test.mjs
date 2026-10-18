import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTENT_LOAD_REASON,
  CONTENT_LOAD_STATUS,
  classifyContentLoadFailure,
  createContentLoadState
} from '../src/shared/content-load-state.js'

test('好友模块无权限时只说明当前内容不可见', () => {
  const state = classifyContentLoadFailure(
    { code: 403, message: '没有权限访问' },
    { label: '视频', friendMode: true }
  )

  assert.equal(state.status, CONTENT_LOAD_STATUS.FORBIDDEN)
  assert.equal(state.reason, CONTENT_LOAD_REASON.FORBIDDEN)
  assert.equal(state.title, '暂时无法查看视频')
  assert.match(state.description, /其他公开内容仍可继续浏览/)
  assert.equal(state.retryable, false)
  assert.doesNotMatch(state.description, /接口|响应|code/i)
})

test('QQ 空间最近一年限制会给出准确原因', () => {
  const state = classifyContentLoadFailure(
    { code: 403, message: '非好友仅可查看最近一年的内容' },
    { label: '这个相册', friendMode: true }
  )

  assert.equal(state.status, CONTENT_LOAD_STATUS.FORBIDDEN)
  assert.equal(state.reason, CONTENT_LOAD_REASON.NON_FRIEND_HISTORY)
  assert.match(state.description, /非好友查看最近一年的内容/)
  assert.match(state.description, /暂无当前账号可见的照片/)
  assert.equal(state.retryable, false)
})

test('最近一年限制兼容同义提示，已删除内容不会误报为空', () => {
  const history = classifyContentLoadFailure(
    { ret: 0, msg: '非好友只能查看近一年的内容' },
    { label: '动态', friendMode: true }
  )
  const missing = classifyContentLoadFailure(
    { code: -1, message: '该相册已被删除' },
    { label: '相册', friendMode: true }
  )

  assert.equal(history.reason, CONTENT_LOAD_REASON.NON_FRIEND_HISTORY)
  assert.match(history.description, /更早的动态不会显示/)
  assert.equal(missing.reason, CONTENT_LOAD_REASON.NOT_FOUND)
  assert.match(missing.description, /删除、失效/)
})

test('相册答案错误、HTTP 404 和网关超时会给出对应原因', () => {
  const verification = classifyContentLoadFailure({ code: -10805, message: '回答错误' })
  const missing = classifyContentLoadFailure({ status: 404 }, { label: '视频' })
  const timeout = classifyContentLoadFailure({ response: { status: 504 } }, { label: '动态' })

  assert.equal(verification.reason, CONTENT_LOAD_REASON.ACCESS_VERIFICATION)
  assert.match(verification.description, /答案或访问密码不正确/)
  assert.equal(missing.reason, CONTENT_LOAD_REASON.NOT_FOUND)
  assert.match(missing.description, /删除、失效或更改了可见范围/)
  assert.equal(timeout.reason, CONTENT_LOAD_REASON.TIMEOUT)
})

test('需要相册验证和非好友不可见会说明下一步，而不是伪装成空内容', () => {
  const verification = classifyContentLoadFailure(
    { code: 0, message: '主人设置了访问问题，需要回答问题后才能查看' },
    { label: '照片', friendMode: true }
  )
  const relationship = classifyContentLoadFailure(
    { code: 403, message: '您还不是对方好友，无法查看该内容' },
    { label: '动态', friendMode: true }
  )

  assert.equal(verification.reason, CONTENT_LOAD_REASON.ACCESS_VERIFICATION)
  assert.match(verification.description, /完成验证/)
  assert.equal(verification.retryable, true)
  assert.equal(relationship.reason, CONTENT_LOAD_REASON.FORBIDDEN)
  assert.match(relationship.description, /可见范围/)
})

test('应用错误码优先于成功 HTTP 状态，失败 HTTP 状态优先于传输代号', () => {
  const auth = classifyContentLoadFailure({ code: -3000, response: { status: 200 } })
  const timeout = classifyContentLoadFailure({
    code: 'ERR_BAD_RESPONSE',
    response: { status: 504 }
  })

  assert.equal(auth.reason, CONTENT_LOAD_REASON.AUTH_REQUIRED)
  assert.equal(timeout.reason, CONTENT_LOAD_REASON.TIMEOUT)
})

test('序列化后只剩 HTTP 文案时仍能识别权限、失效、限流和服务异常', () => {
  const forbidden = classifyContentLoadFailure(new Error('Request failed with status code 403'), {
    label: '好友动态',
    friendMode: true
  })
  const missing = classifyContentLoadFailure(new Error('HTTP 404'), { label: '照片' })
  const rate = classifyContentLoadFailure(new Error('Request failed with status code 429'))
  const server = classifyContentLoadFailure(new Error('HTTP 502'), { label: '视频' })

  assert.equal(forbidden.reason, CONTENT_LOAD_REASON.FORBIDDEN)
  assert.match(forbidden.description, /可见范围/)
  assert.equal(missing.reason, CONTENT_LOAD_REASON.NOT_FOUND)
  assert.equal(rate.reason, CONTENT_LOAD_REASON.RATE_LIMITED)
  assert.equal(server.reason, CONTENT_LOAD_REASON.SERVER)
})

test('嵌套子错误码和详细字段不会在 IPC 传递后丢失', () => {
  const security = classifyContentLoadFailure({
    response: {
      status: 200,
      data: { code: 0, subcode: -3002, detail: '需要安全验证' }
    }
  })
  const permission = classifyContentLoadFailure(
    { data: { errno: 403, error_description: '仅好友可见' } },
    { label: '日志', friendMode: true }
  )

  assert.equal(security.reason, CONTENT_LOAD_REASON.SECURITY_CHECK)
  assert.equal(permission.reason, CONTENT_LOAD_REASON.FORBIDDEN)
  assert.match(permission.description, /这部分日志/)
})

test('请求超时可以重试且不暴露原始错误', () => {
  const state = classifyContentLoadFailure(new Error('network timeout'), { label: '照片' })

  assert.equal(state.status, CONTENT_LOAD_STATUS.ERROR)
  assert.equal(state.reason, CONTENT_LOAD_REASON.TIMEOUT)
  assert.equal(state.title, '照片读取超时')
  assert.match(state.description, /响应时间过长/)
  assert.equal(state.retryable, true)
  assert.doesNotMatch(state.description, /timeout/i)
})

test('登录失效不提供无意义的原地重试', () => {
  const state = classifyContentLoadFailure(
    { code: 401, message: '登录状态已失效' },
    { label: '动态' }
  )

  assert.equal(state.retryable, false)
  assert.equal(state.reason, CONTENT_LOAD_REASON.AUTH_REQUIRED)
  assert.match(state.description, /重新登录/)
})

test('安全校验、限流、断网和服务异常会给出不同恢复提示', () => {
  const security = classifyContentLoadFailure({ code: -501, message: '接口被风控拦截，需要验证码' })
  const securityByCode = classifyContentLoadFailure({ ret: -3002 })
  const rate = classifyContentLoadFailure({ code: 429, message: '访问频繁' })
  const network = classifyContentLoadFailure(new Error('ERR_NETWORK'), { label: '日志' })
  const server = classifyContentLoadFailure({ code: 503, message: '服务繁忙' }, { label: '动态' })
  const upstreamBusy = classifyContentLoadFailure({ code: -1, message: '网络繁忙，请稍后再试' })

  assert.equal(security.reason, CONTENT_LOAD_REASON.SECURITY_CHECK)
  assert.equal(securityByCode.reason, CONTENT_LOAD_REASON.SECURITY_CHECK)
  assert.match(security.description, /安全校验/)
  assert.equal(rate.reason, CONTENT_LOAD_REASON.RATE_LIMITED)
  assert.match(rate.description, /稍等片刻/)
  assert.equal(network.reason, CONTENT_LOAD_REASON.NETWORK)
  assert.match(network.description, /检查网络/)
  assert.equal(server.reason, CONTENT_LOAD_REASON.SERVER)
  assert.match(server.description, /QQ 空间/)
  assert.equal(upstreamBusy.reason, CONTENT_LOAD_REASON.SERVER)
})

test('未知的负业务码不会仅凭绝对值伪装成 HTTP 服务错误', () => {
  const state = classifyContentLoadFailure({ code: -503 }, { label: '动态' })
  assert.equal(state.reason, CONTENT_LOAD_REASON.UNKNOWN)
})

test('未开通空间和不完整响应不会伪装成空数据', () => {
  const unavailable = classifyContentLoadFailure(
    { message: '该用户尚未开通QQ空间' },
    { label: '留言板', friendMode: true }
  )
  const invalid = classifyContentLoadFailure(
    { message: 'QQ 空间返回的留言板数据不完整' },
    { label: '留言板' }
  )

  assert.equal(unavailable.status, CONTENT_LOAD_STATUS.FORBIDDEN)
  assert.equal(unavailable.reason, CONTENT_LOAD_REASON.UNAVAILABLE)
  assert.match(unavailable.description, /未开通或已关闭/)
  assert.equal(invalid.status, CONTENT_LOAD_STATUS.ERROR)
  assert.equal(invalid.reason, CONTENT_LOAD_REASON.INVALID_RESPONSE)
  assert.match(invalid.description, /完整的留言板数据/)
})

test('视频查询标识缺失会说明具体原因且不提供无效重试', () => {
  const state = classifyContentLoadFailure(
    new Error('视频记录缺少相册或文件标识，无法向 QQ 空间查询播放地址'),
    { label: '视频播放地址' }
  )

  assert.equal(state.reason, CONTENT_LOAD_REASON.INVALID_RESPONSE)
  assert.equal(state.retryable, false)
  assert.equal(state.title, '视频信息不完整')
  assert.match(state.description, /相册或文件标识/)
})

test('未知乱码不直接展示给用户', () => {
  const state = classifyContentLoadFailure({ code: -1, message: '����' }, { label: '说说' })
  assert.equal(state.reason, CONTENT_LOAD_REASON.UNKNOWN)
  assert.doesNotMatch(state.description, /�/)
})

test('真正空数据与加载失败保持区分', () => {
  const state = createContentLoadState(CONTENT_LOAD_STATUS.EMPTY, {
    label: '视频',
    friendMode: true,
    emptyDescription: '对方还没有公开的视频。'
  })

  assert.equal(state.status, CONTENT_LOAD_STATUS.EMPTY)
  assert.equal(state.title, '暂无视频')
  assert.equal(state.description, '对方还没有公开的视频。')
  assert.equal(state.retryable, false)
})

test('无法识别的失败不会猜测权限、空数据或网络原因', () => {
  const state = classifyContentLoadFailure({ code: -987654 }, { label: '收藏' })

  assert.equal(state.reason, CONTENT_LOAD_REASON.UNKNOWN)
  assert.match(state.description, /没有提供可识别的失败原因/)
  assert.doesNotMatch(state.description, /权限|网络|暂无/)
})
