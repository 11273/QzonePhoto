const OMIT_VALUE = Symbol('omit-ipc-value')

const cloneIpcValue = (value, ancestors) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return OMIT_VALUE
  }

  if (value instanceof Date) return value.toISOString()

  if (typeof value !== 'object') return value
  if (ancestors.has(value)) return OMIT_VALUE

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return value
        .map((item) => cloneIpcValue(item, ancestors))
        .filter((item) => item !== OMIT_VALUE)
    }

    if (value instanceof Set) {
      return [...value]
        .map((item) => cloneIpcValue(item, ancestors))
        .filter((item) => item !== OMIT_VALUE)
    }

    if (value instanceof Map) {
      const output = {}
      value.forEach((item, key) => {
        const cloned = cloneIpcValue(item, ancestors)
        if (cloned !== OMIT_VALUE) output[String(key)] = cloned
      })
      return output
    }

    const output = {}
    Object.entries(value).forEach(([key, item]) => {
      const cloned = cloneIpcValue(item, ancestors)
      if (cloned !== OMIT_VALUE) output[key] = cloned
    })
    return output
  } finally {
    ancestors.delete(value)
  }
}

/**
 * 将 Vue Proxy 或包含不可克隆字段的对象转换为 Electron IPC 可安全传递的纯数据。
 * 只保留可枚举的数据字段；函数、Symbol、undefined 与循环引用会被忽略。
 */
export const toIpcSafeValue = (value) => {
  const cloned = cloneIpcValue(value, new WeakSet())
  return cloned === OMIT_VALUE ? null : cloned
}
