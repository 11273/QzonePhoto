// Batch summaries need refreshes when task counts change, not when
// high-frequency throughput-only statistics change.
const TASK_COUNT_FIELDS = [
  'total',
  'waiting',
  'downloading',
  'completed',
  'error',
  'paused',
  'cancelled'
]

export function didDownloadTaskCountsChange(previous, next) {
  if (!next || typeof next !== 'object') return false
  if (!previous || typeof previous !== 'object') return true
  return TASK_COUNT_FIELDS.some((field) => (previous[field] || 0) !== (next[field] || 0))
}
