function parseVersion(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split('+', 1)[0]
  const [core, prerelease = ''] = normalized.split('-', 2)
  const parts = core.split('.').map((part) => Number.parseInt(part, 10))

  return {
    parts: parts.length === 3 && parts.every(Number.isFinite) ? parts : [],
    prerelease
  }
}

/**
 * 比较两个稳定版版本号。返回正数代表 left 更新，负数代表 right 更新。
 * 预发布版本默认低于同一主版本的正式版，和 electron-updater 的稳定通道保持一致。
 */
export function compareReleaseVersions(left, right) {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)

  if (!leftVersion.parts.length || !rightVersion.parts.length) return 0

  for (let index = 0; index < 3; index += 1) {
    const difference = leftVersion.parts[index] - rightVersion.parts[index]
    if (difference !== 0) return difference
  }

  if (leftVersion.prerelease === rightVersion.prerelease) return 0
  if (!leftVersion.prerelease) return 1
  if (!rightVersion.prerelease) return -1
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease)
}

/**
 * 两个来源均有可用版本时优先选择版本更高者；完全相同则优先 R2。
 */
export function selectPreferredUpdateCandidate(r2Candidate, githubCandidate) {
  if (!r2Candidate) return githubCandidate || null
  if (!githubCandidate) return r2Candidate

  const comparison = compareReleaseVersions(
    r2Candidate.result?.updateInfo?.version,
    githubCandidate.result?.updateInfo?.version
  )

  return comparison >= 0 ? r2Candidate : githubCandidate
}
