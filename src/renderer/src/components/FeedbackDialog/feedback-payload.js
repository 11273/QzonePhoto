import { toIpcSafeValue } from '../../../../shared/ipc-payload.js'

const normalizeSubmissionContent = (value) => String(value || '').trim()

export const createFeedbackClientEventId = () => {
  const randomId = globalThis.crypto?.randomUUID?.()
  if (randomId) return `desktop_feedback_${randomId}`
  return `desktop_feedback_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Keep one event id and timestamp while retrying the same text. A new type or
 * text intentionally starts a new submission instead of reusing the old id.
 */
export const resolveFeedbackSubmissionAttempt = (
  previousAttempt,
  { type, content },
  { createEventId = createFeedbackClientEventId, now = () => new Date() } = {}
) => {
  const fingerprint = `${String(type || 'other')}\u0000${normalizeSubmissionContent(content)}`
  if (previousAttempt?.fingerprint === fingerprint) return previousAttempt
  return {
    fingerprint,
    eventId: createEventId(),
    createdAt: now().toISOString()
  }
}

export const buildFeedbackEnvironment = ({
  appVersion,
  system,
  installMode,
  page,
  recentErrors,
  logId
}) =>
  toIpcSafeValue({
    appVersion: String(appVersion || 'unknown'),
    system: String(system || 'unknown'),
    installMode: String(installMode || 'unknown'),
    page: String(page || '#/index'),
    recentErrors: Array.isArray(recentErrors) ? recentErrors : [],
    logId: String(logId || '') || undefined
  })

export const feedbackSubmitErrorMessage = (error) => {
  const message = String(error?.message || '').trim()
  if (/could not be cloned|DataCloneError/i.test(message)) {
    return '反馈信息整理失败，请重新打开反馈窗口后再试'
  }
  return message || '提交失败，请稍后重试'
}
