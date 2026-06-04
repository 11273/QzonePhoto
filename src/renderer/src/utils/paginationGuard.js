const DEFAULT_COOLDOWN = 1200
const DEFAULT_MAX_FAILURES = 3

export const createPaginationGuard = (options = {}) => {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN
  const maxFailures = options.maxFailures ?? DEFAULT_MAX_FAILURES
  let lastKey = ''
  let failureCount = 0
  let retryAfter = 0

  const now = () => Date.now()

  return {
    reset() {
      lastKey = ''
      failureCount = 0
      retryAfter = 0
    },
    canLoad(key = 'default') {
      return key !== lastKey || !retryAfter || now() >= retryAfter
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
      retryAfter = now() + cooldownMs
      return {
        failureCount,
        shouldStop: failureCount >= maxFailures
      }
    },
    isStalled(currentKey, nextKey) {
      return String(currentKey) === String(nextKey)
    }
  }
}
