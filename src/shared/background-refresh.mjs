/** Passive refresh: one in-flight request, focus throttling, bounded failure backoff.
 * The task updates state only on success; failures never manufacture empty data.
 */
export function createBackgroundRefresh(
  task,
  { minIntervalMs = 60000, maxBackoffMs = 5 * 60000, now = Date.now } = {}
) {
  let pending = null
  let nextAt = 0
  let failures = 0
  return (options = {}) => {
    if (pending) return pending
    if (!options.force && now() < nextAt) return Promise.resolve(undefined)
    pending = Promise.resolve()
      .then(() => task(options))
      .then((result) => {
        failures = 0
        nextAt = now() + minIntervalMs
        return result
      })
      .catch(() => {
        failures = Math.min(failures + 1, 10)
        nextAt = now() + Math.min(minIntervalMs * 2 ** (failures - 1), maxBackoffMs)
        return undefined
      })
      .finally(() => {
        pending = null
      })
    return pending
  }
}
