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

const taskCount = (value) => {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
}

export function getDownloadCompletionProgress(stats = {}) {
  const total = taskCount(stats.total)
  const completed = taskCount(stats.completed)
  if (total === 0) return 0
  if (completed >= total) return 100
  // 未全部成功时，避免 206/207 之类的比例四舍五入成 100%。
  return Math.min(99, Math.round((completed / total) * 100))
}

export function getDownloadManagerSummary(stats = {}) {
  const total = taskCount(stats.total)
  if (total === 0) return ''
  const completed = taskCount(stats.completed)
  const failed = taskCount(stats.error)
  const cancelled = taskCount(stats.cancelled)
  const active = taskCount(stats.downloading) + taskCount(stats.waiting)
  const paused = taskCount(stats.paused)
  const parts = [`${completed}/${total} 已完成`]

  if (active > 0) parts.unshift(`${active} 个进行中`)
  else if (paused > 0) parts.unshift('已暂停')
  else if (completed < total && completed + failed + cancelled === total) {
    parts.unshift('已结束')
  }
  if (failed > 0) parts.push(`${failed} 个失败`)
  if (cancelled > 0) parts.push(`${cancelled} 个已取消`)
  return parts.join(' · ')
}
