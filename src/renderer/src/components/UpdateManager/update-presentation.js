const TECHNICAL_CONTENT =
  /\b(?:r2|ci|github actions?|workflow|token|sha-?512|checksum)\b|发布校验|更新链路|构建|工作流|签名|令牌/i

const TECHNICAL_SECTION =
  /(?:continuous integration|ci 配置|code refactoring|代码重构|build|构建|发布|工作流|安全|security|文档|documentation|测试|tests|代码格式|styles|dependencies|依赖|chore|完整变更|安装|首次打开)/i

const RELEASE_SECTION_LABELS = [
  [/features?|新功能/i, '新功能'],
  [/bug fixes?|问题修复|修复/i, '问题修复'],
  [/performance|体验优化|优化/i, '体验优化']
]

const ERROR_PRESENTATIONS = {
  NETWORK_ERROR: {
    title: '网络连接不稳定',
    detail: '暂时无法完成更新文件的下载。网络恢复后可以重新尝试。',
    reassurance: '不会影响你继续使用当前版本。',
    retryLabel: '重新尝试',
    canRetry: true
  },
  HTTP_ERROR: {
    title: '更新服务暂时不可用',
    detail: '暂时无法获取更新文件，请稍后再试。',
    reassurance: '不会影响你继续使用当前版本。',
    retryLabel: '重新尝试',
    canRetry: true
  },
  VERIFICATION_ERROR: {
    title: '更新文件未通过验证',
    detail: '为保护你的设备，未通过验证的文件不会被安装。',
    reassurance: '已停止本次更新；该文件不会被安装，重新下载即可再试。',
    retryLabel: '重新下载',
    canRetry: true
  },
  DISK_FULL: {
    title: '磁盘空间不足',
    detail: '请先清理一些磁盘空间，再重新检查更新。',
    reassurance: '不会影响你继续使用当前版本。',
    retryLabel: '',
    canRetry: false
  },
  PERMISSION_ERROR: {
    title: '没有足够的安装权限',
    detail: '请确认应用有权限写入安装目录后，再重新下载。',
    reassurance: '不会影响你继续使用当前版本。',
    retryLabel: '',
    canRetry: false
  },
  CANCELLED: {
    title: '下载已取消',
    detail: '更新文件没有完成下载。',
    reassurance: '需要时可以重新下载。',
    retryLabel: '重新下载',
    canRetry: true
  },
  NO_RELEASE: {
    title: '暂时没有可用更新',
    detail: '当前没有可安装的新版本。',
    reassurance: '你可以继续使用当前版本。',
    retryLabel: '',
    canRetry: false
  },
  UNKNOWN_ERROR: {
    title: '更新暂时没有完成',
    detail: '请稍后重新尝试，或从下载页获取最新版本。',
    reassurance: '不会影响你继续使用当前版本。',
    retryLabel: '重新尝试',
    canRetry: true
  }
}

function cleanReleaseNote(raw) {
  return String(raw || '')
    .replace(/!?(?:\[([^\]]*)\]\([^)]*\))/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/,?\s*(?:closes?|fixes?)\s+(?:\[#?\d+\]|#\d+)(?:\([^)]*\))?/gi, '')
    .replace(/\s*\([a-f0-9]{3,40}\)$/i, '')
    .replace(/[，,;；]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getReleaseSectionLabel(raw) {
  const clean = cleanReleaseNote(raw)
    .replace(/^#+\s*/, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
  if (
    TECHNICAL_SECTION.test(clean) ||
    /^(?:企鹅相册\s+v?\d|release\b)|^\[?\d+\.\d+\.\d+\]?/i.test(clean)
  ) {
    return ''
  }

  const matched = RELEASE_SECTION_LABELS.find(([pattern]) => pattern.test(clean))
  return matched ? matched[1] : clean
}

function cleanReleaseNoteItem(raw) {
  const clean = cleanReleaseNote(String(raw).replace(/^[-*+]\s+/, ''))
  if (/^(?:ci|build|release|logging|pr|deps|test):/i.test(clean)) return ''
  const text = clean
    .replace(/^[-*+]\s+/, '')
    .replace(/^[^:：]{1,32}[:：]\s*/, '')
    .trim()

  return !text || TECHNICAL_CONTENT.test(text) ? '' : text
}

/**
 * 将发行页格式的 Markdown 转为应用内可阅读的更新说明。
 * 徽章、版本标题和面向维护者的章节会在进入滚动区前被移除，避免长说明挤压操作区域。
 */
export function normalizeReleaseNotes(releaseNotes) {
  const lines = []
  let skipSection = false
  let previousWasBlank = true

  // 新版发行页折叠安装帮助和开发记录；历史版的 macOS 章节也会由标题规则过滤。
  const source = String(releaseNotes || '').replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, '')
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      if (!previousWasBlank && lines.length) lines.push('')
      previousWasBlank = true
      continue
    }

    if (/^#{1,6}\s+/.test(line)) {
      const label = getReleaseSectionLabel(line)
      const isVersionHeading =
        /^#+\s*(?:🎉\s*)?(?:release\b|企鹅相册\s+v?\d|\[?\d+\.\d+\.\d+)/i.test(line)
      skipSection = !label && !isVersionHeading
      if (label) lines.push(`### ${label}`)
      previousWasBlank = false
      continue
    }

    if (
      skipSection ||
      /^<[^>]+>/.test(line) ||
      /^[-–—]{3,}$/.test(line) ||
      /!\[[^\]]*\]\([^)]*\)/.test(line)
    ) {
      continue
    }

    if (/^[-*+]\s+/.test(line)) {
      const item = cleanReleaseNoteItem(line)
      if (item) lines.push(`- ${item}`)
      previousWasBlank = false
      continue
    }

    const paragraph = cleanReleaseNote(line)
    if (paragraph && !TECHNICAL_CONTENT.test(paragraph)) lines.push(paragraph)
    previousWasBlank = false
  }

  return lines
    .filter((line, index) => {
      if (!line.startsWith('### ')) return true
      const next = lines.slice(index + 1).find((entry) => entry.trim())
      return next && !next.startsWith('### ')
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildReleaseNotesPresentation(releaseNotes) {
  const content = normalizeReleaseNotes(releaseNotes)
  const itemCount = content.split('\n').filter((line) => /^-\s+/.test(line)).length
  const sections = []
  for (const line of content.split('\n')) {
    if (line.startsWith('### ')) {
      sections.push({ title: line.slice(4), items: [] })
    } else if (line.trim()) {
      if (!sections.length) sections.push({ title: '更新内容', items: [] })
      sections.at(-1).items.push(line.replace(/^-\s+/, ''))
    }
  }

  return {
    hasNotes: Boolean(content),
    content,
    itemCount,
    sections: sections.filter((section) => section.items.length)
  }
}

export function getUpdateErrorPresentation(errorInfo = {}) {
  const errorType = String(errorInfo.errorType || 'UNKNOWN_ERROR').toUpperCase()
  const preset = ERROR_PRESENTATIONS[errorType] || ERROR_PRESENTATIONS.UNKNOWN_ERROR
  const canRetry =
    typeof errorInfo.canRetry === 'boolean'
      ? errorInfo.canRetry && preset.canRetry
      : preset.canRetry

  return {
    ...preset,
    canRetry,
    primaryAction: canRetry ? 'retry' : 'close'
  }
}

export function formatReleaseDate(releaseDate, now = new Date()) {
  const date = new Date(releaseDate)
  if (Number.isNaN(date.getTime())) return ''

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const time = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  if (sameDay) return `今天 ${time}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function buildUpdatePresentation(updateInfo = {}, options = {}) {
  const currentVersion = String(updateInfo.currentVersion || '').trim()
  const version = String(updateInfo.version || '').trim()
  const releaseNotes = buildReleaseNotesPresentation(updateInfo.releaseNotes)

  return {
    versionLabel:
      currentVersion && version && currentVersion !== version
        ? `${currentVersion} → ${version}`
        : version || currentVersion,
    releaseDateLabel: formatReleaseDate(updateInfo.releaseDate, options.now || new Date()),
    releaseNotes
  }
}

export function getManualDownloadChoices({ officialUrl, fallbackUrl }) {
  return { officialUrl, fallbackUrl }
}
