export const OFFICIAL_UPDATE_SOURCES = Object.freeze({
  r2FeedUrl: 'https://dl.qzonephoto.getgit.one/releases/latest',
  github: Object.freeze({
    owner: '11273',
    repo: 'QzonePhoto',
    releaseType: 'release'
  })
})

export function isStableReleaseVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value || '').trim())
}

function isSafeAssetUrl(value) {
  const url = String(value || '').trim()
  return Boolean(url) && !/[\\/]|:\/\/|[?#]|\.\./.test(url)
}

function isValidSha512(value) {
  return /^[A-Za-z0-9+/]{86}==$/.test(String(value || '').trim())
}

function isValidAsset(file) {
  return (
    file &&
    isSafeAssetUrl(file.url) &&
    /^qzonephoto-/i.test(String(file.url)) &&
    Number.isSafeInteger(Number(file.size)) &&
    Number(file.size) > 0 &&
    isValidSha512(file.sha512)
  )
}

function matchesFilename(file, expressions) {
  const filename = String(file?.url || '').toLowerCase()
  return expressions.every((expression) => expression.test(filename))
}

/**
 * 只接受当前系统可自动安装的、明确标注架构的更新包。
 * 不接受无架构后缀的旧安装包，也不允许元数据将下载跳转到其他主机。
 */
export function selectCompatibleUpdateFile(files, architecture) {
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

  return files.find((file) => isValidAsset(file) && matchesFilename(file, expressions)) || null
}

/**
 * GitHub 兜底只能下载与已选 R2 更新完全相同的发布包，防止切源时意外切到另一版本。
 */
export function matchesPinnedUpdateCandidate(expectedInfo, fallbackInfo, architecture) {
  if (
    !isStableReleaseVersion(expectedInfo?.version) ||
    expectedInfo.version !== fallbackInfo?.version
  ) {
    return false
  }

  const expectedFile = selectCompatibleUpdateFile(expectedInfo.files, architecture)
  const fallbackFile = selectCompatibleUpdateFile(fallbackInfo.files, architecture)
  return Boolean(
    expectedFile &&
    fallbackFile &&
    expectedFile.size === fallbackFile.size &&
    expectedFile.sha512 === fallbackFile.sha512
  )
}
