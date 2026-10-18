import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const values = new Map()
globalThis.window = {
  localStorage: {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    }
  }
}

const { countUnreadFeedbackThreads, isFeedbackThreadUnread, markFeedbackThreadSeen } =
  await import('../src/renderer/src/components/FeedbackDialog/feedback-read-state.js')

test('only unseen admin replies create feedback unread badges', () => {
  values.clear()
  const thread = {
    feedbackId: 42,
    messages: [
      { id: 1, sender: 'user' },
      { id: 2, sender: 'admin' },
      { id: 3, sender: 'user' }
    ]
  }

  assert.equal(isFeedbackThreadUnread(thread), true)
  assert.equal(countUnreadFeedbackThreads([thread]), 1)

  markFeedbackThreadSeen(thread)
  assert.equal(isFeedbackThreadUnread(thread), false)
  assert.equal(countUnreadFeedbackThreads([thread]), 0)

  thread.messages.push({ id: 4, sender: 'admin' })
  assert.equal(isFeedbackThreadUnread(thread), true)
})

test('legacy replies without a stable message id never hide a future reply', () => {
  values.clear()
  const legacyThread = {
    feedbackId: 99,
    messages: [{ id: 0, sender: 'admin' }]
  }
  markFeedbackThreadSeen(legacyThread)
  assert.equal(countUnreadFeedbackThreads([legacyThread]), 0)

  const upgradedThread = {
    feedbackId: 99,
    messages: [{ id: 1, sender: 'admin' }]
  }
  assert.equal(countUnreadFeedbackThreads([upgradedThread]), 1)
})

test('new feedback form always carries redacted diagnostics and stays backend-compatible', async () => {
  const source = await readFile(
    new URL('../src/renderer/src/components/FeedbackDialog/index.vue', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(source, /form\.contact|联系方式（选填|联系方式，可不填|attachLogs/)
  assert.doesNotMatch(source, /type="checkbox"/)
  assert.match(source, /env: buildEnv\(logId\)/)
  assert.match(source, /eventId: submissionAttempt\.eventId/)
  assert.match(source, /eventId: followupAttempt\.eventId/)
  assert.match(source, /thread\.feedbackId === Number\(result\.feedbackId\)/)
  assert.match(source, /recentErrors: recentErrors\.value/)
  assert.match(source, /if \(window\.QzoneAPI\?\.app\?\.uploadLogs\)/)
  assert.match(source, /appVersion: props\.appVersion/)
  assert.match(source, /system: systemText\.value/)
  assert.match(source, /installMode: runtime\.value\.isPackaged/)
  assert.match(source, /page: window\.location\.hash/)
  assert.doesNotMatch(source, /诊断信息会自动附带/)
  assert.doesNotMatch(source, /fd-context-bar|fd-details-toggle|fd-detail-item/)
  assert.match(source, /还差 \$\{MIN_FEEDBACK_CONTENT_LENGTH - contentLength\.value\} 个字才能发送/)
  assert.match(source, /:aria-invalid="contentTooShort \? 'true' : 'false'"/)
  assert.match(source, /aria-describedby="feedback-content-help"/)
  assert.match(source, /\.fd-inbox::-webkit-scrollbar/)
  assert.match(source, /scrollbar-width: none/)
  assert.match(source, /官方已回复/)
  assert.match(source, /feedbackTimeline\(thread\)/)
  assert.match(source, /我的反馈/)
  assert.match(source, /我的补充/)
  assert.match(source, /补充信息/)
  assert.match(source, /class="fd-tab-badge" aria-hidden="true"><\/span>/)
  assert.doesNotMatch(source, /badgeText/)
  assert.match(source, /unreadCount\.value = countUnreadFeedbackThreads\(threads\.value\)/)
  assert.doesNotMatch(source, /查看处理记录|收起处理记录|historyFeedbackId|toggleHistory/)
  assert.doesNotMatch(source, /继续聊聊/)
})
