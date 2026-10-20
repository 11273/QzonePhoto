export const AUTO_DOWNLOAD_MIN = 1
export const AUTO_DOWNLOAD_INITIAL = 3
export const AUTO_DOWNLOAD_MAX = 6

export function normalizeDownloadConcurrency(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new TypeError('并发任务数必须是 1–10 之间的整数')
  }
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 10) {
    throw new TypeError('并发任务数必须是 1–10 之间的整数')
  }
  return number
}

// Retry-After can be either delta-seconds or an HTTP date (RFC 9110 §10.2.3).
export function retryAfterMilliseconds(value, now = Date.now()) {
  const text = String(value ?? '').trim()
  if (!text) return 0
  if (/^\d+$/.test(text)) return Math.min(Number(text) * 1000, 2 ** 31 - 1)
  if (!/[a-z]/i.test(text)) return 0
  const date = Date.parse(text)
  return Number.isFinite(date) ? Math.min(Math.max(0, date - now), 2 ** 31 - 1) : 0
}

export function isTransientDownloadError(error) {
  if (error?.code === 'ERR_CANCELED' || error?.__CANCEL__) return false
  const status = Number(error?.response?.status || 0)
  return (
    [429, 502, 503, 504].includes(status) ||
    ['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET', 'EAI_AGAIN'].includes(error?.code)
  )
}

// Additive increase, multiplicative decrease. Never use cached/skipped files,
// videos, or requests from before a backoff as evidence that images can ramp up.
export class AdaptiveDownloadConcurrency {
  constructor() {
    this.limit = AUTO_DOWNLOAD_INITIAL
    this.epoch = 0
    this.successes = 0
    this.nextIncreaseAt = 0
    this.blockedUntil = 0
    this.failureRounds = 0
  }

  observeSuccess({ type, bytes, elapsedMs, epoch }, now = Date.now()) {
    if (type !== 'image' || bytes <= 0 || epoch !== this.epoch || now < this.blockedUntil) return
    if (elapsedMs > 15000) {
      this.limit = Math.max(AUTO_DOWNLOAD_MIN, this.limit - 1)
      this.successes = 0
      this.nextIncreaseAt = now + 5000
      return
    }
    this.failureRounds = 0
    this.successes++
    if (this.successes < this.limit || now < this.nextIncreaseAt) return
    this.limit = Math.min(AUTO_DOWNLOAD_MAX, this.limit + 1)
    this.successes = 0
    this.nextIncreaseAt = now + 500
  }

  observeFailure(error, now = Date.now()) {
    if (!isTransientDownloadError(error)) return
    // Simultaneous failures belong to one congestion round, not N backoffs.
    if (now >= this.blockedUntil) this.failureRounds++
    const retryAfter = retryAfterMilliseconds(error?.response?.headers?.['retry-after'], now)
    const delay = Math.max(retryAfter, Math.min(30000, 1000 * 2 ** (this.failureRounds - 1)))
    this.blockedUntil = Math.max(this.blockedUntil, now + delay)
    this.limit = Math.max(AUTO_DOWNLOAD_MIN, Math.floor(this.limit / 2))
    this.successes = 0
    this.nextIncreaseAt = this.blockedUntil + 2000
    this.epoch++
  }
}
