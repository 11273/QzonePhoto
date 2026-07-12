;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.QzoneDownloadCore = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const DEFAULT_ASSET = 'windows-x64-setup'
  const WORKER_DOWNLOAD_URL = 'https://qzone.getgit.one/api/download'
  const DEFAULT_GITHUB_RELEASE_URL = 'https://github.com/11273/QzonePhoto/releases/latest'
  const ASSET_IDS = new Set([
    'windows-x64-setup',
    'windows-ia32-setup',
    'macos-arm64-dmg',
    'macos-x64-dmg',
    'linux-x64-appimage',
    'linux-x64-deb'
  ])
  const TELEMETRY_KEYS = new Set([
    'source',
    'target',
    'status',
    'stage',
    'platform',
    'arch',
    'asset',
    'packageType',
    'channel',
    'downloadHost',
    'fallbackReason',
    'referrerType',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'releaseVersion',
    'siteVersion',
    'viewport',
    'cta',
    'scrollBucket',
    'pageLoadBucket',
    'browser',
    'language',
    'colorScheme',
    'connectionType',
    'connectionSaveData'
  ])

  const assetInfo = Object.freeze({
    'windows-x64-setup': {
      label: 'Windows 64 位版',
      platform: 'windows',
      arch: 'x64',
      packageType: 'setup',
      hint: '适合大多数 Windows 电脑'
    },
    'windows-ia32-setup': {
      label: 'Windows 32 位版',
      platform: 'windows',
      arch: 'ia32',
      packageType: 'setup',
      hint: '仅适合少量 32 位老电脑'
    },
    'macos-arm64-dmg': {
      label: 'macOS Apple 芯片版',
      platform: 'macos',
      arch: 'arm64',
      packageType: 'dmg',
      hint: '适合 M1、M2、M3、M4 系列 Mac'
    },
    'macos-x64-dmg': {
      label: 'macOS Intel 版',
      platform: 'macos',
      arch: 'x64',
      packageType: 'dmg',
      hint: '适合使用 Intel 处理器的 Mac'
    },
    'linux-x64-appimage': {
      label: 'Linux AppImage',
      platform: 'linux',
      arch: 'x64',
      packageType: 'appimage',
      hint: '下载后添加执行权限即可运行'
    },
    'linux-x64-deb': {
      label: 'Linux Deb',
      platform: 'linux',
      arch: 'x64',
      packageType: 'deb',
      hint: '适合 Ubuntu、Debian 等系统'
    }
  })

  function detectPlatform(input) {
    const platform = cleanText(input && input.platform, 80).toLowerCase()
    const userAgent = cleanText(input && input.userAgent, 240).toLowerCase()
    const mobile =
      Boolean(input && input.mobile) || /android|iphone|ipad|ipod|mobile/.test(userAgent)
    if (mobile) {
      return { os: 'mobile', arch: 'unknown', bitness: 'unknown', mobile: true, confident: true }
    }

    if (/win/.test(platform) || /windows/.test(userAgent)) {
      const is32Bit =
        /(?:win32|wow32|x86(?!_64)|i[3-6]86)/.test(`${platform} ${userAgent}`) &&
        !/(?:win64|x64|x86_64|wow64)/.test(userAgent)
      return {
        os: 'windows',
        arch: is32Bit ? 'ia32' : 'x64',
        bitness: is32Bit ? '32' : /(?:win64|x64|x86_64|wow64)/.test(userAgent) ? '64' : 'unknown',
        mobile: false,
        confident: true
      }
    }
    if (/mac/.test(platform) || /macintosh|mac os x/.test(userAgent)) {
      return { os: 'macos', arch: 'unknown', bitness: 'unknown', mobile: false, confident: true }
    }
    if (/linux/.test(platform) || /linux/.test(userAgent)) {
      return {
        os: 'linux',
        arch: /aarch64|arm64/.test(userAgent) ? 'arm64' : 'x64',
        bitness: '64',
        mobile: false,
        confident: true
      }
    }
    return { os: 'unknown', arch: 'unknown', bitness: 'unknown', mobile: false, confident: false }
  }

  function refinePlatform(current, entropy) {
    if (!current || current.mobile) return current
    const next = Object.assign({}, current)
    const entropyPlatform = cleanText(entropy && entropy.platform, 40).toLowerCase()
    const architecture = cleanText(entropy && entropy.architecture, 40).toLowerCase()
    const bitness = cleanText(entropy && entropy.bitness, 8)

    if (/windows/.test(entropyPlatform)) next.os = 'windows'
    if (/mac/.test(entropyPlatform)) next.os = 'macos'
    if (/linux/.test(entropyPlatform)) next.os = 'linux'
    if (/arm|aarch64/.test(architecture)) next.arch = 'arm64'
    if (/x86|amd64/.test(architecture)) next.arch = bitness === '32' ? 'ia32' : 'x64'
    if (bitness === '32' || bitness === '64') next.bitness = bitness
    next.confident = next.os !== 'unknown'
    return next
  }

  function recommendAsset(platform) {
    if (!platform || platform.mobile) return null
    if (platform.os === 'windows')
      return platform.bitness === '32' ? 'windows-ia32-setup' : 'windows-x64-setup'
    if (platform.os === 'macos') {
      if (platform.arch === 'arm64') return 'macos-arm64-dmg'
      if (platform.arch === 'x64') return 'macos-x64-dmg'
      return null
    }
    if (platform.os === 'linux') return 'linux-x64-appimage'
    return DEFAULT_ASSET
  }

  function normalizeManifest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyManifest()
    const assets = Array.isArray(value.assets)
      ? value.assets.map(normalizeAsset).filter(Boolean)
      : []
    return {
      version: cleanText(value.version || value.tag, 40).replace(/^v/i, ''),
      tag: cleanText(value.tag, 40),
      generatedAt: cleanText(value.generatedAt, 80),
      githubReleaseUrl: trustedUrl(value.githubReleaseUrl, 'github'),
      assets
    }
  }

  function normalizeAsset(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const id = cleanText(value.id, 80).toLowerCase()
    if (!ASSET_IDS.has(id)) return null
    const filename = cleanText(value.filename, 220).replace(/[\\/]/g, '')
    const size = Number(value.size)
    return {
      id,
      os: cleanToken(value.os, 24),
      arch: cleanToken(value.arch, 24),
      type: cleanToken(value.type, 24),
      filename,
      size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
      sha256: /^[a-f0-9]{8,128}$/i.test(String(value.sha256 || ''))
        ? String(value.sha256).toLowerCase()
        : '',
      r2Url: trustedUrl(value.r2Url, 'r2'),
      githubUrl: trustedUrl(value.githubUrl, 'github')
    }
  }

  function workerDownloadUrl(asset, source) {
    const safeAsset = ASSET_IDS.has(String(asset || '').toLowerCase())
      ? String(asset).toLowerCase()
      : DEFAULT_ASSET
    const safeSource = cleanText(source, 80).replace(/[^a-z0-9_:/ .-]/gi, '') || 'website'
    return `${WORKER_DOWNLOAD_URL}?asset=${encodeURIComponent(safeAsset)}&source=${encodeURIComponent(safeSource)}`
  }

  function githubAssetUrl(manifest, assetId) {
    const normalized = normalizeManifest(manifest)
    const asset = normalized.assets.find((item) => item.id === assetId)
    return asset && asset.githubUrl
      ? asset.githubUrl
      : normalized.githubReleaseUrl || DEFAULT_GITHUB_RELEASE_URL
  }

  function safeTelemetryProperties(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result = {}
    Object.entries(value).forEach(([key, raw]) => {
      if (!TELEMETRY_KEYS.has(key)) return
      if (typeof raw === 'boolean') {
        result[key] = raw
        return
      }
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        result[key] = Math.round(raw * 100) / 100
        return
      }
      const next = cleanTelemetryText(raw)
      if (next) result[key] = next
    })
    return result
  }

  function trustedUrl(value, kind) {
    const text = cleanText(value, 500)
    if (!text) return ''
    try {
      const url = new URL(text)
      if (url.protocol !== 'https:') return ''
      if (kind === 'r2' && url.hostname !== 'dl.qzonephoto.getgit.one') return ''
      if (
        kind === 'github' &&
        (url.hostname !== 'github.com' || !url.pathname.startsWith('/11273/QzonePhoto/'))
      )
        return ''
      return url.toString()
    } catch {
      return ''
    }
  }

  function cleanTelemetryText(value) {
    return cleanText(value, 120).replace(/[^a-z0-9_:/., -]/gi, '')
  }

  function cleanToken(value, maxLength) {
    return cleanText(value, maxLength).replace(/[^a-z0-9_:/.-]/gi, '')
  }

  function cleanText(value, maxLength) {
    return String(value == null ? '' : value)
      .split(String.fromCharCode(0))
      .join('')
      .trim()
      .slice(0, maxLength)
  }

  function emptyManifest() {
    return { version: '', tag: '', generatedAt: '', githubReleaseUrl: '', assets: [] }
  }

  return Object.freeze({
    ASSET_IDS,
    DEFAULT_ASSET,
    DEFAULT_GITHUB_RELEASE_URL,
    assetInfo,
    detectPlatform,
    refinePlatform,
    recommendAsset,
    normalizeManifest,
    workerDownloadUrl,
    githubAssetUrl,
    safeTelemetryProperties
  })
})
