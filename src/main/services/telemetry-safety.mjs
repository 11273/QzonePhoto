const ALLOWED_PROPERTY_KEYS = new Set([
  'api',
  'module',
  'source',
  'target',
  'mode',
  'scope',
  'status',
  'errorCode',
  'errorGroup',
  'mediaType',
  'viewMode',
  'method',
  'stage',
  'metadataStatus',
  'countBucket',
  'sizeBucket',
  'speedBucket',
  'durationBucket',
  'concurrency',
  'retryCount',
  'activeCount',
  'successCount',
  'failedCount'
])

const SENSITIVE_KEY_PATTERN =
  /(uin|qq|p_?skey|skey|cookie|token|qrsig|sig|album(Name|Id)?|topicId|photo|pic(Key|Id)?|lloc|feed|comment|visitor|file(Name|Path)?|path|url|href|title|desc|content|contact|name|nick|avatar|cover|thumb|image|video)/i

const URL_OR_PATH_PATTERN =
  /(https?:\/\/|file:\/\/|qzone-local:\/\/|[A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|\\[^\\]+\\|\/[^/]+\/[^/]+|\.jpg\b|\.jpeg\b|\.png\b|\.gif\b|\.webp\b|\.mp4\b|\.mov\b|\.avi\b)/i

const SECRET_PATTERN = /(p_?skey|uin=|cookie|token|qrsig|sig=|skey=)/i
const ACCOUNT_NUMBER_PATTERN = /\b\d{5,12}\b/
const MAX_DIAGNOSTIC_LOG_LENGTH = 512 * 1024

export function sanitizeTelemetryProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue
    if (SENSITIVE_KEY_PATTERN.test(key)) continue
    const normalized = sanitizeTelemetryValue(raw)
    if (normalized !== undefined) result[key] = normalized
  }
  return Object.keys(result).length ? result : undefined
}

export function sanitizeTelemetryValue(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    return Math.max(-1000000, Math.min(1000000, Math.round(value * 100) / 100))
  }
  if (typeof value !== 'string') return undefined
  const text = normalizeToken(value)
  if (!text) return undefined
  if (looksPrivate(text)) return 'redacted'
  return text
}

export function toCountBucket(value) {
  const count = safeNumber(value)
  if (count <= 0) return '0'
  if (count === 1) return '1'
  if (count <= 10) return '2-10'
  if (count <= 50) return '11-50'
  if (count <= 200) return '51-200'
  return '201+'
}

export function toSizeBucket(value) {
  const size = safeNumber(value)
  const mb = size / 1024 / 1024
  if (mb <= 0) return '0'
  if (mb < 1) return '<1MB'
  if (mb < 10) return '1-10MB'
  if (mb < 100) return '10-100MB'
  if (mb < 500) return '100-500MB'
  return '500MB+'
}

export function toSpeedBucket(value) {
  const speed = safeNumber(value)
  const kb = speed / 1024
  const mb = kb / 1024
  if (speed <= 0) return '0'
  if (kb < 100) return '<100KB/s'
  if (mb < 1) return '100KB-1MB/s'
  if (mb < 5) return '1-5MB/s'
  return '5MB/s+'
}

export function toDurationBucket(value) {
  const ms = safeNumber(value)
  if (ms <= 0) return '0'
  if (ms < 1000) return '<1s'
  if (ms < 5000) return '1-5s'
  if (ms < 15000) return '5-15s'
  if (ms < 60000) return '15-60s'
  return '60s+'
}

export function classifyTelemetryError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  if (!message) return 'unknown'
  if (/timeout|timed out|etimedout/.test(message)) return 'timeout'
  if (/enoent|not found|不存在|missing/.test(message)) return 'not_found'
  if (/eacces|eperm|permission|权限/.test(message)) return 'permission'
  if (/network|socket|econn|dns|offline|连接/.test(message)) return 'network'
  if (/parse|json|syntax|解析/.test(message)) return 'parse_error'
  if (/cancel|abort|取消/.test(message)) return 'cancelled'
  return 'unknown'
}

export function toTelemetryApiName(input) {
  const raw = String(input || '')
  if (!raw) return 'unknown'
  let segment = ''
  try {
    const parsed = new URL(raw, 'https://local.invalid')
    segment = parsed.pathname.split('/').filter(Boolean).at(-1) || ''
  } catch {
    segment = raw.split(/[?#]/)[0].split('/').filter(Boolean).at(-1) || ''
  }
  const normalized = normalizeApiSegment(segment)
  if (!normalized || looksPrivate(normalized) || /^\d{5,}$/.test(normalized)) return 'unknown'
  return normalized
}

export function sanitizeDiagnosticLog(value) {
  const raw = String(value || '')
  const sliced = raw.slice(Math.max(0, raw.length - MAX_DIAGNOSTIC_LOG_LENGTH))
  return stripControlChars(sliced)
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL隐藏]')
    .replace(/file:\/\/[^\s"'<>]+/gi, '[URL隐藏]')
    .replace(/qzone-local:\/\/[^\s"'<>]+/gi, '[URL隐藏]')
    .replace(/(?:\/Users|\/Volumes|\/home|\/var|\/private|\/tmp)\/[^\s"'<>]+/gi, '[本地路径隐藏]')
    .replace(/[A-Z]:\\[^\s"'<>]+/gi, '[本地路径隐藏]')
    .replace(/\b[\w.-]+\.(?:jpg|jpeg|png|gif|webp|mp4|mov|avi|m4v|mkv|json|db|log)\b/gi, '[文件名隐藏]')
    .replace(/\b(?:p_skey|skey|token|access_token|auth|authorization|cookie|uin|qq|password|passwd|pwd|secret|key)\b/gi, '[敏感字段隐藏]')
    .replace(/\b1[3-9]\d{9}\b/g, '[手机号隐藏]')
    .replace(/\b[1-9]\d{4,10}\b/g, '[疑似账号隐藏]')
    .split(/\r?\n/)
    .slice(-3000)
    .map((line) => line.trimEnd().slice(0, 1000))
    .join('\n')
}

function normalizeToken(value) {
  return stripControlChars(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function normalizeApiSegment(value) {
  return normalizeToken(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function looksPrivate(text) {
  return URL_OR_PATH_PATTERN.test(text) || SECRET_PATTERN.test(text) || ACCOUNT_NUMBER_PATTERN.test(text)
}

function safeNumber(value) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, next) : 0
}

function stripControlChars(value) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : char
  }).join('')
}
