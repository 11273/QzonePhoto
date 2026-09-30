import assert from 'node:assert/strict'
import test from 'node:test'
import { auditR2Release } from './audit-r2-release.mjs'

const tag = 'v2.7.1'
const version = tag.slice(1)
const baseUrl = 'https://dl.qzonephoto.getgit.one'
const sha512 = `${'A'.repeat(86)}==`
const assets = [
  { filename: `QzonePhoto-${version}-win-x64-setup.exe`, size: 101, id: 'windows-x64' },
  { filename: `QzonePhoto-${version}-mac-arm64.zip`, size: 102, id: 'macos-arm64' },
  { filename: `QzonePhoto-${version}-x86_64.AppImage`, size: 103, id: 'linux-x64' }
]

function metadata(asset, { stable = false, unsafeDefault = false } = {}) {
  const url = stable ? `../${tag}/${asset.filename}` : asset.filename
  const defaultUrl = unsafeDefault ? `../${tag}/../../unexpected.exe` : url
  return [
    `version: ${version}`,
    'files:',
    `  - url: ${url}`,
    `    sha512: ${sha512}`,
    `    size: ${asset.size}`,
    `path: ${defaultUrl}`,
    `sha512: ${sha512}`
  ].join('\n')
}

function createFetch({ unsafeDefault = false, unsafeCache = false, onRequest } = {}) {
  const stableCacheControl = unsafeCache ? 'public, max-age=14400' : 'no-cache, no-store, max-age=0'
  const manifest = {
    tag,
    version,
    assets: assets.map((asset) => ({
      ...asset,
      r2Url: `${baseUrl}/releases/${tag}/${asset.filename}`,
      githubUrl: `https://github.com/11273/QzonePhoto/releases/download/${tag}/${asset.filename}`
    }))
  }
  const githubRelease = {
    draft: false,
    prerelease: false,
    assets: assets.map((asset) => ({ name: asset.filename, size: asset.size }))
  }

  return async (input, options = {}) => {
    onRequest?.(String(input), options)
    const url = new URL(String(input))
    const cleanUrl = `${url.origin}${url.pathname}`
    if (cleanUrl === `${baseUrl}/manifests/latest.json`) {
      return json(manifest, {
        'cache-control': stableCacheControl
      })
    }
    if (cleanUrl === `https://api.github.com/repos/11273/QzonePhoto/releases/tags/${tag}`) {
      return json(githubRelease)
    }

    const metadataName = url.pathname.match(/(latest(?:-mac|-linux)?\.yml)$/)?.[1]
    const asset = assets.find((item) => {
      if (metadataName === 'latest.yml') return item.id === 'windows-x64'
      if (metadataName === 'latest-mac.yml') return item.id === 'macos-arm64'
      return item.id === 'linux-x64'
    })
    if (metadataName) {
      const isStable = url.pathname.includes('/releases/latest/')
      const isVersioned = url.pathname.includes(`/releases/${tag}/`)
      return text(
        metadata(asset, {
          stable: isStable,
          unsafeDefault: isStable && unsafeDefault && metadataName === 'latest.yml' && !isVersioned
        }),
        isStable
          ? {
              'content-type': 'application/x-yaml',
              'cache-control': stableCacheControl
            }
          : {}
      )
    }

    const downloadAsset = assets.find((item) => cleanUrl.endsWith(`/${item.filename}`))
    if (downloadAsset && options.method === 'HEAD') {
      return text('', { 'content-length': String(downloadAsset.size) })
    }
    return text('not found', {}, 404)
  }
}

test('accepts a complete versioned R2 release layout', async () => {
  const result = await auditR2Release({ tag, publicBaseUrl: baseUrl, fetchImpl: createFetch() })
  assert.equal(result.tag, tag)
  assert.equal(result.installers, assets.length)
})

test('authenticates only the GitHub API audit request when a workflow token is available', async () => {
  const requests = []
  await auditR2Release({
    tag,
    publicBaseUrl: baseUrl,
    githubToken: 'test-token',
    fetchImpl: createFetch({ onRequest: (url, options) => requests.push({ url, options }) })
  })

  const githubApiRequest = requests.find(({ url }) => url.startsWith('https://api.github.com/'))
  assert.equal(githubApiRequest.options.headers.authorization, 'Bearer test-token')
  assert.equal(
    requests
      .filter(({ url }) => !url.startsWith('https://api.github.com/'))
      .some(({ options }) => options.headers?.authorization),
    false
  )
})

test('rejects a stable metadata file whose top-level default path escapes the release directory', async () => {
  await assert.rejects(
    () =>
      auditR2Release({
        tag,
        publicBaseUrl: baseUrl,
        fetchImpl: createFetch({ unsafeDefault: true })
      }),
    /default updater asset/i
  )
})

test('rejects a stable pointer that CDN caches could keep stale', async () => {
  await assert.rejects(
    () =>
      auditR2Release({
        tag,
        publicBaseUrl: baseUrl,
        fetchImpl: createFetch({ unsafeCache: true })
      }),
    /disable public caching/i
  )
})

function text(body, headers = {}, status = 200) {
  return new Response(body, { status, headers })
}

function json(value, headers = {}) {
  return text(JSON.stringify(value), { 'content-type': 'application/json', ...headers })
}
