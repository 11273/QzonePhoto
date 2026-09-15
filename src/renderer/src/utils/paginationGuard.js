const DEFAULT_COOLDOWN = 1200
const DEFAULT_MAX_FAILURES = 3

export const normalizePaginationFlag = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes'].includes(normalized)) return true
  if (['0', 'false', 'no', ''].includes(normalized)) return false
  return null
}

export const shouldContinuePagination = ({
  serverHasMore,
  cursorMoved = true,
  itemCount = 0,
  pageSize = 0,
  nextOffset,
  total
} = {}) => {
  if (!cursorMoved) return false

  const normalizedServerFlag = normalizePaginationFlag(serverHasMore)
  if (normalizedServerFlag !== null) return normalizedServerFlag

  const normalizedNextOffset = Number(nextOffset)
  const normalizedTotal = Number(total)
  if (
    Number.isFinite(normalizedNextOffset) &&
    Number.isFinite(normalizedTotal) &&
    normalizedTotal > 0
  ) {
    return normalizedNextOffset < normalizedTotal
  }

  const normalizedPageSize = Number(pageSize)
  return normalizedPageSize > 0 && Number(itemCount) >= normalizedPageSize
}

export const isNearScrollEnd = (scrollElement, threshold = 100) => {
  if (!scrollElement) return false
  const scrollHeight = Number(scrollElement.scrollHeight) || 0
  const scrollTop = Number(scrollElement.scrollTop) || 0
  const clientHeight = Number(scrollElement.clientHeight) || 0
  return scrollHeight - scrollTop - clientHeight <= threshold
}

export const retryPageRequest = async (
  request,
  { attempts = 3, delayMs = 350, onRetry = null } = {}
) => {
  let lastError
  const maxAttempts = Math.max(1, Number(attempts) || 1)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await request(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
      onRetry?.(error, attempt)
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }

  throw lastError
}

export const createPaginationGuard = (options = {}) => {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES
  const getNow = options.now ?? (() => Date.now())
  let lastKey = ''
  let failureCount = 0
  let retryAfter = 0

  return {
    reset() {
      lastKey = ''
      failureCount = 0
      retryAfter = 0
    },
    canLoad(key = 'default') {
      return key !== lastKey || !retryAfter || getNow() >= retryAfter
    },
    succeed() {
      this.reset()
    },
    fail(key = 'default') {
      if (key === lastKey) {
        failureCount += 1
      } else {
        lastKey = key
        failureCount = 1
      }
      retryAfter = getNow() + cooldownMs
      return {
        failureCount,
        retryAfter,
        // Reaching the retry threshold only pauses eager/automatic retries. A later
        // user scroll must remain able to retry the same cursor after the cooldown.
        shouldPauseAuto: failureCount >= maxFailures,
        shouldStop: false
      }
    },
    isStalled(currentKey, nextKey) {
      return String(currentKey) === String(nextKey)
    }
  }
}
