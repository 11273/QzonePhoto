import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFeedbackEnvironment,
  feedbackSubmitErrorMessage,
  resolveFeedbackSubmissionAttempt
} from '../src/renderer/src/components/FeedbackDialog/feedback-payload.js'

test('turns reactive feedback errors into a cloneable IPC environment', () => {
  const recentErrors = new Proxy(
    [
      new Proxy(
        {
          id: 1,
          type: 'error',
          message: 'An object could not be cloned.',
          source: 'FeedbackDialog',
          time: '2026-10-18T02:00:00.000Z'
        },
        {}
      )
    ],
    {}
  )

  const environment = buildFeedbackEnvironment({
    appVersion: '2.8.0',
    system: 'macOS / arm64',
    installMode: '开发模式',
    page: '#/index',
    recentErrors
  })

  assert.doesNotThrow(() => structuredClone(environment))
  assert.deepEqual(environment.recentErrors, [
    {
      id: 1,
      type: 'error',
      message: 'An object could not be cloned.',
      source: 'FeedbackDialog',
      time: '2026-10-18T02:00:00.000Z'
    }
  ])
})

test('translates structured-clone failures instead of exposing an English runtime error', () => {
  assert.equal(
    feedbackSubmitErrorMessage(
      new DOMException('An object could not be cloned.', 'DataCloneError')
    ),
    '反馈信息整理失败，请重新打开反馈窗口后再试'
  )
})

test('reuses one idempotency key only while retrying unchanged feedback', () => {
  let sequence = 0
  const options = {
    createEventId: () => `desktop_feedback_test_${++sequence}`,
    now: () => new Date('2026-10-18T04:00:00.000Z')
  }
  const first = resolveFeedbackSubmissionAttempt(
    null,
    { type: 'bug', content: '下载按钮没有反应' },
    options
  )
  const retry = resolveFeedbackSubmissionAttempt(
    first,
    { type: 'bug', content: '  下载按钮没有反应  ' },
    options
  )
  const changed = resolveFeedbackSubmissionAttempt(
    retry,
    { type: 'bug', content: '下载按钮没有反应，页面一直加载' },
    options
  )

  assert.equal(retry, first)
  assert.equal(retry.eventId, 'desktop_feedback_test_1')
  assert.equal(retry.createdAt, '2026-10-18T04:00:00.000Z')
  assert.equal(changed.eventId, 'desktop_feedback_test_2')
})
