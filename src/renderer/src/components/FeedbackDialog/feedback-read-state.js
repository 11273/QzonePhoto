const STORAGE_KEY = 'qzone.feedback.seen-messages.v1'

const readSeenMap = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

const latestAdminMessageId = (thread) =>
  (Array.isArray(thread?.messages) ? thread.messages : []).reduce(
    (latest, message) =>
      message?.sender === 'admin' ? Math.max(latest, Number(message.id) || 0) : latest,
    0
  )

export const countUnreadFeedbackThreads = (threads = []) => {
  const seen = readSeenMap()
  return threads.reduce((count, thread) => {
    const latest = latestAdminMessageId(thread)
    const lastSeen = Number(seen[String(thread?.feedbackId)] || 0)
    return count + (latest > lastSeen ? 1 : 0)
  }, 0)
}

export const isFeedbackThreadUnread = (thread) => {
  const seen = readSeenMap()
  return latestAdminMessageId(thread) > Number(seen[String(thread?.feedbackId)] || 0)
}

export const markFeedbackThreadSeen = (thread) => {
  const feedbackId = Number(thread?.feedbackId)
  const latest = latestAdminMessageId(thread)
  if (!feedbackId || !latest) return
  const seen = readSeenMap()
  seen[String(feedbackId)] = latest
  const entries = Object.entries(seen)
    .sort(([, left], [, right]) => Number(right) - Number(left))
    .slice(0, 100)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // The unread marker is a convenience only; feedback content remains available without storage.
  }
}
