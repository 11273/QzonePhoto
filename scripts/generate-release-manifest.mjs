import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { classifyReleaseFile, publicAssetUrl } from './release-manifest-lib.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=')
    return [key, rest.join('=') || '']
  })
)

const artifactsDir = path.resolve(args.artifacts || 'artifacts')
const outFile = path.resolve(args.out || 'artifacts/latest.json')
const tag = args.tag || process.env.GITHUB_REF_NAME || ''
const version = tag.replace(/^v/i, '') || ''
const releasePath = args.releasePath || tag || 'latest'
const publicBaseUrl = (args.publicBaseUrl || process.env.R2_PUBLIC_BASE_URL || '').replace(
  /\/+$/,
  ''
)
const githubRepo = process.env.GITHUB_REPOSITORY || '11273/QzonePhoto'

const files = await listFiles(artifactsDir)
const releaseFiles = files.filter((file) => /\.(exe|dmg|zip|AppImage|deb)$/i.test(file))
const assets = []

for (const file of releaseFiles) {
  const filename = path.basename(file)
  const info = classifyReleaseFile(filename)
  const size = (await stat(file)).size
  const bytes = await readFile(file)
  assets.push({
    id: info.id,
    os: info.os,
    arch: info.arch,
    type: info.type,
    filename,
    size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    r2Url: publicBaseUrl ? publicAssetUrl(publicBaseUrl, filename, releasePath) : '',
    githubUrl: tag
      ? `https://github.com/${githubRepo}/releases/download/${tag}/${encodeURIComponent(filename)}`
      : `https://github.com/${githubRepo}/releases/latest`
  })
}

const manifest = {
  version,
  tag,
  generatedAt: new Date().toISOString(),
  githubReleaseUrl: tag
    ? `https://github.com/${githubRepo}/releases/tag/${tag}`
    : `https://github.com/${githubRepo}/releases/latest`,
  assets: assets.sort((a, b) => a.id.localeCompare(b.id))
}

await writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outFile} with ${assets.length} assets`)

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    const nextPath = path.join(dir, entry.name)
    if (entry.isDirectory()) result.push(...(await listFiles(nextPath)))
    else result.push(nextPath)
  }
  return result
}
