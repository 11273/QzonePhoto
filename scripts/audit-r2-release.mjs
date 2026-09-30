import { pathToFileURL } from 'node:url'

const METADATA_NAMES = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']
const DEFAULT_PUBLIC_BASE_URL = 'https://dl.qzonephoto.getgit.one'
const DEFAULT_GITHUB_REPOSITORY = '11273/QzonePhoto'
const STABLE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/
const ASSET_NAME_PATTERN = /^QzonePhoto-[A-Za-z0-9._-]+\.(?:exe|zip|dmg|AppImage|deb)$/

export async function auditR2Release({
  tag,
  publicBaseUrl,
  githubRepo,
  githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
  fetchImpl = fetch
} = {}) {
  const baseUrl = normalizePublicBaseUrl(publicBaseUrl || DEFAULT_PUBLIC_BASE_URL)
  const repository = String(githubRepo || DEFAULT_GITHUB_REPOSITORY).trim()
  const manifestUrl = `${baseUrl}/manifests/latest.json${cacheBust()}`
  const [currentManifest, manifestHeaders] = await Promise.all([
    fetchJson(fetchImpl, manifestUrl, 'R2 public manifest'),
    fetchHead(fetchImpl, manifestUrl, 'R2 public manifest')
  ])
  verifyStablePointerHeaders(manifestHeaders, 'application/json', 'R2 public manifest')
  const releaseTag = String(tag || currentManifest.tag || '').trim()
  if (!STABLE_TAG_PATTERN.test(releaseTag)) {
    throw new Error(
      `Expected a stable release tag such as v2.7.1, received: ${releaseTag || '(empty)'}`
    )
  }

  const version = releaseTag.slice(1)
  if (currentManifest.tag !== releaseTag || currentManifest.version !== version) {
    throw new Error(
      `Public manifest points to ${currentManifest.tag || '(empty)'} / ${currentManifest.version || '(empty)'}, expected ${releaseTag}`
    )
  }

  const [githubRelease, ...metadataPairs] = await Promise.all([
    fetchJson(
      fetchImpl,
      `https://api.github.com/repos/${repository}/releases/tags/${releaseTag}`,
      'GitHub release API',
      { headers: githubApiHeaders(githubToken) }
    ),
    ...METADATA_NAMES.map(async (name) => {
      const stableUrl = `${baseUrl}/releases/latest/${name}${cacheBust()}`
      const [source, stable, stableHeaders] = await Promise.all([
        fetchText(
          fetchImpl,
          `https://github.com/${repository}/releases/download/${releaseTag}/${name}`,
          `GitHub ${name}`
        ),
        fetchText(fetchImpl, stableUrl, `R2 ${name}`),
        fetchHead(fetchImpl, stableUrl, `R2 ${name}`)
      ])
      return [name, { source, stable, stableHeaders }]
    })
  ])

  if (githubRelease.draft || githubRelease.prerelease) {
    throw new Error(`${releaseTag} is not a published stable GitHub Release`)
  }

  const githubAssets = new Map((githubRelease.assets || []).map((asset) => [asset.name, asset]))
  const metadataAssets = new Map()
  for (const [name, { source, stable, stableHeaders }] of metadataPairs) {
    verifyStablePointerHeaders(stableHeaders, 'application/x-yaml', `R2 ${name}`)
    const sourceVersion = readMetadataVersion(source, `GitHub ${name}`)
    const stableVersion = readMetadataVersion(stable, `R2 ${name}`)
    if (sourceVersion !== version || stableVersion !== version) {
      throw new Error(
        `${name} version mismatch: GitHub=${sourceVersion || '(empty)'}, R2=${stableVersion || '(empty)'}, expected=${version}`
      )
    }

    const sourceEntries = parseMetadataEntries(source, `GitHub ${name}`)
    const stableEntries = parseMetadataEntries(stable, `R2 ${name}`, releaseTag)
    if (sourceEntries.length !== stableEntries.length) {
      throw new Error(`${name} file count differs between GitHub and R2`)
    }

    for (let index = 0; index < sourceEntries.length; index += 1) {
      const sourceEntry = sourceEntries[index]
      const stableEntry = stableEntries[index]
      const expectedUrl = `../${releaseTag}/${sourceEntry.filename}`
      if (
        stableEntry.url !== expectedUrl ||
        stableEntry.filename !== sourceEntry.filename ||
        stableEntry.sha512 !== sourceEntry.sha512 ||
        stableEntry.size !== sourceEntry.size
      ) {
        throw new Error(`${name} contains an invalid stable entry for ${sourceEntry.filename}`)
      }
      metadataAssets.set(sourceEntry.filename, sourceEntry)
    }

    // electron-updater 仍会读取顶层 path / sha512 作为默认安装包。
    // 不能只检查 files 列表，否则错误的默认路径可能绕过 R2 的版本目录。
    const sourceDefault = parseDefaultMetadataAsset(source, `GitHub ${name}`)
    const stableDefault = parseDefaultMetadataAsset(stable, `R2 ${name}`, releaseTag)
    if (
      stableDefault.url !== `../${releaseTag}/${sourceDefault.filename}` ||
      stableDefault.filename !== sourceDefault.filename ||
      stableDefault.sha512 !== sourceDefault.sha512
    ) {
      throw new Error(`${name} contains an invalid default updater asset`)
    }
    if (
      !sourceEntries.some(
        (entry) =>
          entry.filename === sourceDefault.filename && entry.sha512 === sourceDefault.sha512
      )
    ) {
      throw new Error(`${name} default updater asset is missing from its files list`)
    }

    // 每个版本目录也保留 GitHub 原始 metadata，供人工核查和灾难恢复使用。
    // 稳定指针只允许是它的严格版本化副本。
    const versioned = await fetchText(
      fetchImpl,
      `${baseUrl}/releases/${releaseTag}/${name}${cacheBust()}`,
      `R2 versioned ${name}`
    )
    if (versioned !== source) {
      throw new Error(`Versioned R2 ${name} does not exactly match the GitHub Release metadata`)
    }
  }

  const manifestAssets = new Map()
  for (const asset of currentManifest.assets || []) {
    if (!asset?.filename || manifestAssets.has(asset.filename)) {
      throw new Error('Public manifest contains a missing or duplicate asset filename')
    }
    manifestAssets.set(asset.filename, asset)
  }
  if (manifestAssets.size !== metadataAssets.size) {
    throw new Error(
      `Public manifest has ${manifestAssets.size} installers, expected ${metadataAssets.size} from updater metadata`
    )
  }

  const checks = []
  for (const [filename, metadataEntry] of metadataAssets) {
    if (!ASSET_NAME_PATTERN.test(filename)) {
      throw new Error(`Updater metadata contains an unexpected installer name: ${filename}`)
    }
    const githubAsset = githubAssets.get(filename)
    if (!githubAsset || Number(githubAsset.size) !== metadataEntry.size) {
      throw new Error(`GitHub Release asset does not match updater metadata: ${filename}`)
    }

    const manifestAsset = manifestAssets.get(filename)
    const assetUrl = `${baseUrl}/releases/${releaseTag}/${encodeURIComponent(filename)}`
    if (
      !manifestAsset ||
      Number(manifestAsset.size) !== metadataEntry.size ||
      manifestAsset.r2Url !== assetUrl ||
      manifestAsset.githubUrl !==
        `https://github.com/${repository}/releases/download/${releaseTag}/${encodeURIComponent(filename)}`
    ) {
      throw new Error(`Public manifest does not match ${filename}`)
    }
    const githubDigest = String(githubAsset.digest || '')
    if (githubDigest.startsWith('sha256:') && manifestAsset.sha256 !== githubDigest.slice(7)) {
      throw new Error(`Public manifest SHA-256 does not match GitHub Release: ${filename}`)
    }

    checks.push(
      fetchHead(fetchImpl, `${assetUrl}${cacheBust()}`, `R2 asset ${filename}`).then((headers) => {
        const contentLength = Number(headers.get('content-length'))
        if (contentLength !== metadataEntry.size) {
          throw new Error(
            `R2 asset size mismatch for ${filename}: ${contentLength || '(missing)'}, expected ${metadataEntry.size}`
          )
        }
      })
    )
  }
  await Promise.all(checks)

  return {
    tag: releaseTag,
    version,
    metadataFiles: METADATA_NAMES.length,
    installers: metadataAssets.size,
    generatedAt: currentManifest.generatedAt || null
  }
}

function normalizePublicBaseUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('R2 public base URL must use HTTPS')
  return url.toString().replace(/\/$/, '')
}

function cacheBust() {
  return `?audit=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function readMetadataVersion(content, label) {
  const version = String(content)
    .match(/^version:\s*(.+)$/m)?.[1]
    ?.trim()
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
    throw new Error(`${label} does not contain a stable version`)
  }
  return version
}

function parseMetadataEntries(content, label, stableTag = '') {
  const entries = []
  const pattern = /^\s*- url:\s*(.+)\r?\n\s+sha512:\s*(.+)\r?\n\s+size:\s*(\d+)\s*$/gm
  for (const match of String(content).matchAll(pattern)) {
    const url = match[1].trim()
    const filename = stableTag
      ? url.match(new RegExp(`^\\.\\./${escapeRegExp(stableTag)}/(.+)$`))?.[1] || ''
      : url
    if (!ASSET_NAME_PATTERN.test(filename)) {
      throw new Error(`${label} has an unsafe or unexpected installer path: ${url}`)
    }
    entries.push({ url, filename, sha512: match[2].trim(), size: Number(match[3]) })
  }
  if (!entries.length) throw new Error(`${label} does not contain any update files`)
  return entries
}

function parseDefaultMetadataAsset(content, label, stableTag = '') {
  const match = String(content).match(/^path:\s*(.+)\r?\nsha512:\s*(.+)\s*$/m)
  if (!match) throw new Error(`${label} does not contain a default updater asset`)

  const url = match[1].trim()
  const filename = stableTag
    ? url.match(new RegExp(`^\\.\\./${escapeRegExp(stableTag)}/(.+)$`))?.[1] || ''
    : url
  if (!ASSET_NAME_PATTERN.test(filename)) {
    throw new Error(`${label} has an unsafe default updater asset path: ${url}`)
  }
  return { url, filename, sha512: match[2].trim() }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function verifyStablePointerHeaders(headers, expectedContentType, label) {
  const contentType = String(headers.get('content-type') || '').toLowerCase()
  const cacheControl = String(headers.get('cache-control') || '').toLowerCase()
  if (!contentType.startsWith(expectedContentType)) {
    throw new Error(`${label} has unexpected content type: ${contentType || '(missing)'}`)
  }
  if (!cacheControl.includes('no-store') || !cacheControl.includes('max-age=0')) {
    throw new Error(`${label} must disable public caching for the stable pointer`)
  }
}

function githubApiHeaders(token) {
  const headers = {
    accept: 'application/vnd.github+json',
    'cache-control': 'no-cache',
    'user-agent': 'QzonePhoto-R2-Audit'
  }
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

async function fetchText(fetchImpl, url, label, { headers = {} } = {}) {
  const response = await fetchImpl(url, {
    headers: { 'cache-control': 'no-cache', ...headers }
  })
  if (!response.ok) throw new Error(`${label} request failed: HTTP ${response.status}`)
  return response.text()
}

async function fetchJson(fetchImpl, url, label, options) {
  const content = await fetchText(fetchImpl, url, label, options)
  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}

async function fetchHead(fetchImpl, url, label) {
  const response = await fetchImpl(url, {
    method: 'HEAD',
    headers: { 'cache-control': 'no-cache' }
  })
  if (!response.ok) throw new Error(`${label} request failed: HTTP ${response.status}`)
  return response.headers
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const [key, ...rest] = argument.replace(/^--/, '').split('=')
      return [key, rest.join('=')]
    })
  )
  const result = await auditR2Release({
    tag: args.tag,
    publicBaseUrl: args.publicBaseUrl,
    githubRepo: args.githubRepo
  })
  console.log(
    `R2 public release audit passed: ${result.tag} (${result.installers} installers, ${result.metadataFiles} metadata files)`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
