export const OFFICIAL_UPDATE_SOURCES = Object.freeze({
  r2FeedUrl: 'https://dl.qzonephoto.getgit.one/releases/latest',
  github: Object.freeze({
    owner: '11273',
    repo: 'QzonePhoto',
    releaseType: 'release'
  })
})

// 前台并行检查 R2 和 GitHub；单一来源最多占用 4 秒，使失败场景也能在
// 标题栏反馈窗口内结束。下载前仍会由 electron-updater 复核 SHA-512。
export const UPDATE_REQUEST_TIMEOUT_MS = 4_000

export function isStableReleaseVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || '').trim())
}

/**
 * GitHub 是正式发布的版本权威，R2 只负责加速同一份安装包。
 *
 * 每次检查两个来源，并按用户可感知、可验证的规则选择：
 * - 两端同版本且当前架构的文件大小、SHA-512 一致，优先走 R2；
 * - R2 版本、大小或 SHA-512 与 GitHub 不一致时，使用 GitHub；
 * - GitHub 明确响应但没有更新时，不接受 R2 单独发布的新版本；
 * - 只有 GitHub 不可访问时，才允许使用 R2 的有效候选作为网络兜底。
 *
 * 这样既保留国内下载加速，也避免 R2 上传顺序、缓存或覆盖造成的元数据
 * 暂时不一致影响正式版本判断。
 */
export const UPDATE_SELECTION_REASON = Object.freeze({
  R2_UNVERIFIED: 'r2-unverified',
  R2_VERIFIED: 'r2-verified',
  GITHUB_ONLY: 'github-only',
  GITHUB_NEWER: 'github-newer',
  GITHUB_AUTHORITY: 'github-authority',
  GITHUB_HASH_MISMATCH: 'github-hash-mismatch',
  GITHUB_CURRENT: 'github-current',
  NO_CANDIDATE: 'no-candidate'
})

export function compareStableReleaseVersions(left, right) {
  const leftParts = String(left || '')
    .split('.')
    .map(Number)
  const rightParts = String(right || '')
    .split('.')
    .map(Number)

  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1
    }
  }
  return 0
}

export function getUpdaterMetadataFilename(architecture) {
  if (architecture?.platform === 'darwin') return 'latest-mac.yml'
  if (architecture?.platform === 'linux') return 'latest-linux.yml'
  return 'latest.yml'
}

function withNoCacheQuery(url, noCache) {
  if (!noCache) return url

  const parsed = new URL(url)
  parsed.searchParams.set('noCache', String(noCache))
  return parsed.toString()
}

/**
 * Generic Provider 不会将运行时传入的 timeout 透传到其元数据请求。
 * 检查阶段改由 Electron session.fetch 发起，以便真正中止超时请求；下载前
 * 仍交给 electron-updater 执行完整包校验和安装。
 */
export function getGenericLatestMetadataUrl(feedUrl, architecture, noCache = '') {
  try {
    const baseUrl = new URL(String(feedUrl || '').trim())
    if (baseUrl.protocol !== 'https:') return ''

    if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/'
    baseUrl.hash = ''
    const metadataUrl = new URL(getUpdaterMetadataFilename(architecture), baseUrl)
    return withNoCacheQuery(metadataUrl.toString(), noCache)
  } catch {
    return ''
  }
}

/**
 * GitHub 的 `/releases/latest/download/` 固定为稳定发布，不跟随 beta。
 * 这里只用于后台核验元数据；真正下载前仍由 electron-updater 再次读取并校验。
 */
export function getGithubLatestMetadataUrl(github, architecture, noCache = '') {
  const owner = String(github?.owner || '').trim()
  const repo = String(github?.repo || '').trim()
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return ''

  return withNoCacheQuery(
    `https://github.com/${owner}/${repo}/releases/latest/download/${getUpdaterMetadataFilename(architecture)}`,
    noCache
  )
}

export function createStableUpdateCheckResult(updateInfo, currentVersion) {
  if (!isStableReleaseVersion(updateInfo?.version) || !isStableReleaseVersion(currentVersion)) {
    return null
  }

  return {
    updateInfo,
    isUpdateAvailable: compareStableReleaseVersions(updateInfo.version, currentVersion) > 0
  }
}

/**
 * 在两端都完成检查后，决定展示与下载的候选版本。
 * `githubResponded` 为 false 表示 GitHub 请求失败；此时保留 R2 的可用候选
 * 作为临时兜底，但日志会标记为未完成双源核验。
 */
export function selectVerifiedUpdateCandidate({
  r2Candidate,
  githubCandidate,
  githubResponded,
  architecture
}) {
  if (!githubResponded) {
    return {
      candidate: r2Candidate || null,
      reason: r2Candidate
        ? UPDATE_SELECTION_REASON.R2_UNVERIFIED
        : UPDATE_SELECTION_REASON.NO_CANDIDATE
    }
  }

  if (!githubCandidate) {
    return {
      candidate: null,
      reason: UPDATE_SELECTION_REASON.GITHUB_CURRENT
    }
  }

  if (!r2Candidate) {
    return {
      candidate: githubCandidate,
      reason: UPDATE_SELECTION_REASON.GITHUB_ONLY
    }
  }

  const versionComparison = compareStableReleaseVersions(
    r2Candidate.updateInfo?.version,
    githubCandidate.updateInfo?.version
  )

  if (versionComparison < 0) {
    return {
      candidate: githubCandidate,
      reason: UPDATE_SELECTION_REASON.GITHUB_NEWER
    }
  }

  // R2 即使显示了更高版本，也不能领先 GitHub 正式发布；GitHub 始终是
  // 版本权威，R2 只在内容完全一致时才成为下载加速源。
  if (versionComparison > 0) {
    return {
      candidate: githubCandidate,
      reason: UPDATE_SELECTION_REASON.GITHUB_AUTHORITY
    }
  }

  if (
    matchesPinnedUpdateCandidate(r2Candidate.updateInfo, githubCandidate.updateInfo, architecture)
  ) {
    return {
      candidate: r2Candidate,
      reason: UPDATE_SELECTION_REASON.R2_VERIFIED
    }
  }

  return {
    candidate: githubCandidate,
    reason: UPDATE_SELECTION_REASON.GITHUB_HASH_MISMATCH
  }
}

const OFFICIAL_ASSET_FILENAME = /^qzonephoto-[a-z0-9][a-z0-9._-]*\.(?:exe|zip|dmg|appimage|deb)$/i
const VERSIONED_R2_ASSET_PATH =
  /^\.\.\/v(\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?)\/(qzonephoto-[a-z0-9][a-z0-9._-]*\.(?:exe|zip|dmg|appimage|deb))$/i

function getOfficialAssetFilename(value) {
  const url = String(value || '').trim()
  if (OFFICIAL_ASSET_FILENAME.test(url)) return url

  const matched = url.match(VERSIONED_R2_ASSET_PATH)
  return matched?.[2] || ''
}

/**
 * generic 更新源会将 `releases/latest/latest.yml` 中的版本化文件写成
 * `../vX.Y.Z/...`。只允许这一种严格的相对路径，既不允许任意跳转，
 * 也不因 R2 的正常目录结构而忽略可用更新。
 */
function isSafeAssetUrl(value, expectedVersion) {
  const url = String(value || '').trim()
  if (!url || /:\/\/|[?#]/.test(url)) return false
  if (OFFICIAL_ASSET_FILENAME.test(url)) return true

  const matched = url.match(VERSIONED_R2_ASSET_PATH)
  return Boolean(matched && (!expectedVersion || matched[1] === String(expectedVersion).trim()))
}

function isValidSha512(value) {
  return /^[A-Za-z0-9+/]{86}==$/.test(String(value || '').trim())
}

function isValidAsset(file, expectedVersion) {
  return (
    file &&
    isSafeAssetUrl(file.url, expectedVersion) &&
    OFFICIAL_ASSET_FILENAME.test(getOfficialAssetFilename(file.url)) &&
    Number.isSafeInteger(Number(file.size)) &&
    Number(file.size) > 0 &&
    isValidSha512(file.sha512)
  )
}

function matchesFilename(file, expressions) {
  const filename = getOfficialAssetFilename(file?.url).toLowerCase()
  return expressions.every((expression) => expression.test(filename))
}

/**
 * 只接受当前系统可自动安装的、明确标注架构的更新包。
 * 不接受无架构后缀的旧安装包，也不允许元数据将下载跳转到其他主机。
 */
export function selectCompatibleUpdateFile(files, architecture, expectedVersion) {
  if (!Array.isArray(files)) return null

  const platform = architecture?.platform
  const arch = architecture?.arch
  const matchers = {
    win32: {
      x64: [/win[-_]x64|x64[-_]setup/, /\.exe$/],
      x86: [/win[-_](?:ia32|x86)|(?:ia32|x86)[-_]setup/, /\.exe$/],
      arm64: [/win[-_]arm64|arm64[-_]setup/, /\.exe$/]
    },
    darwin: {
      x64: [/(?:mac|darwin)[-_]x64|x64\.(?:zip)$/i, /\.zip$/],
      arm64: [/(?:mac|darwin)[-_]arm64|arm64\.(?:zip)$/i, /\.zip$/]
    },
    linux: {
      x64: [/(?:linux[-_])?(?:x86_64|amd64|x64)/, /\.appimage$/]
    }
  }

  const expressions = matchers[platform]?.[arch]
  if (!expressions) return null

  return (
    files.find(
      (file) => isValidAsset(file, expectedVersion) && matchesFilename(file, expressions)
    ) || null
  )
}

/**
 * 两个官方源只有指向同一版本、同一架构且同一内容时才能互相替代。
 * 用于 R2 与 GitHub 的交叉核验，也用于 R2 下载失败后的 GitHub 下载兜底。
 */
export function matchesPinnedUpdateCandidate(expectedInfo, fallbackInfo, architecture) {
  if (
    !isStableReleaseVersion(expectedInfo?.version) ||
    expectedInfo.version !== fallbackInfo?.version
  ) {
    return false
  }

  const expectedFile = selectCompatibleUpdateFile(
    expectedInfo.files,
    architecture,
    expectedInfo.version
  )
  const fallbackFile = selectCompatibleUpdateFile(
    fallbackInfo.files,
    architecture,
    fallbackInfo.version
  )
  return Boolean(
    expectedFile &&
    fallbackFile &&
    expectedFile.size === fallbackFile.size &&
    expectedFile.sha512 === fallbackFile.sha512
  )
}
