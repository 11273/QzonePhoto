export const DOWNLOAD_TASK_SORT = Object.freeze({
  CREATED_DESC: 'created-desc',
  CREATED_ASC: 'created-asc',
  STATUS_PRIORITY: 'status-priority'
})

const VALID_SORTS = new Set(Object.values(DOWNLOAD_TASK_SORT))

const STATUS_PRIORITY = Object.freeze({
  downloading: 1,
  waiting: 2,
  paused: 3,
  error: 4,
  completed: 5,
  cancelled: 6
})

export function normalizeDownloadTaskSort(sort) {
  return VALID_SORTS.has(sort) ? sort : DOWNLOAD_TASK_SORT.CREATED_DESC
}

function taskTime(value) {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue)) return numericValue

  const parsedValue = Date.parse(value)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function compareNewestFirst(left, right) {
  const timeDifference = taskTime(right?.create_time) - taskTime(left?.create_time)
  if (timeDifference !== 0) return timeDifference
  return String(right?.id || '').localeCompare(String(left?.id || ''))
}

export function sortDownloadTasks(tasks, sort = DOWNLOAD_TASK_SORT.CREATED_DESC) {
  const normalizedSort = normalizeDownloadTaskSort(sort)
  const sortedTasks = Array.isArray(tasks) ? [...tasks] : []

  return sortedTasks.sort((left, right) => {
    if (normalizedSort === DOWNLOAD_TASK_SORT.CREATED_ASC) {
      return compareNewestFirst(right, left)
    }

    if (normalizedSort === DOWNLOAD_TASK_SORT.STATUS_PRIORITY) {
      const leftPriority = STATUS_PRIORITY[left?.status] || 7
      const rightPriority = STATUS_PRIORITY[right?.status] || 7

      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      if (left?.status === 'downloading' || left?.status === 'waiting') {
        return taskTime(left?.create_time) - taskTime(right?.create_time)
      }
    }

    return compareNewestFirst(left, right)
  })
}
