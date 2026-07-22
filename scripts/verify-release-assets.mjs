import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const RELEASE_ASSET_NAMES = (version) => ({
  windowsX64: `QzonePhoto-${version}-win-x64-setup.exe`,
  windowsIa32: `QzonePhoto-${version}-win-ia32-setup.exe`,
  macosX64Zip: `QzonePhoto-${version}-mac-x64.zip`,
  macosArm64Zip: `QzonePhoto-${version}-mac-arm64.zip`,
  macosX64Dmg: `QzonePhoto-${version}-mac-x64.dmg`,
  macosArm64Dmg: `QzonePhoto-${version}-mac-arm64.dmg`,
  linuxAppImage: `QzonePhoto-${version}-linux-x86_64.AppImage`,
  linuxDeb: `QzonePhoto-${version}-linux-amd64.deb`
})

const METADATA_REQUIREMENTS = (assets) => ({
  'latest.yml': [assets.windowsX64, assets.windowsIa32],
  'latest-mac.yml': [
    assets.macosX64Zip,
    assets.macosArm64Zip,
    assets.macosX64Dmg,
    assets.macosArm64Dmg
  ],
  'latest-linux.yml': [assets.linuxAppImage, assets.linuxDeb]
})

const METADATA_NAMES = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']

function blockmapNames(assets) {
  return Object.values(assets)
    .filter((name) => /\.(?:exe|zip|dmg)$/.test(name))
    .map((name) => `${name}.blockmap`)
}

export async function verifyReleaseAssets({ assetsDir, version }) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version || ''))) {
    throw new Error(`Release version must be valid semver, received: ${version || '(empty)'}`)
  }

  const directory = path.resolve(assetsDir || 'release-assets')
  const names = RELEASE_ASSET_NAMES(version)
  const expectedAssets = Object.values(names)
  const expectedBlockmaps = blockmapNames(names)
  const fileNames = [...expectedAssets, ...expectedBlockmaps, ...METADATA_NAMES].sort()
  const directoryEntries = await readdir(directory, { withFileTypes: true })
  const files = new Set(
    directoryEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  )

  for (const name of expectedAssets) {
    if (!files.has(name)) throw new Error(`Missing required release asset: ${name}`)
  }
  for (const name of expectedBlockmaps) {
    if (!files.has(name)) throw new Error(`Missing required blockmap: ${name}`)
  }

  const metadataRequirements = METADATA_REQUIREMENTS(names)
  for (const [metadataName, requiredAssets] of Object.entries(metadataRequirements)) {
    if (!files.has(metadataName)) throw new Error(`Missing updater metadata: ${metadataName}`)
    await verifyMetadata({
      metadataPath: path.join(directory, metadataName),
      directory,
      version,
      requiredAssets
    })
  }

  return { version, assetCount: expectedAssets.length, fileNames }
}

async function verifyMetadata({ metadataPath, directory, version, requiredAssets }) {
  const content = await readFile(metadataPath, 'utf8')
  const declaredVersion = content.match(/^version:\s*(.+)$/m)?.[1]?.trim()
  if (declaredVersion !== version) {
    throw new Error(
      `Updater metadata ${path.basename(metadataPath)} has version ${declaredVersion || '(empty)'}, expected ${version}`
    )
  }

  const entries = parseMetadataEntries(content, metadataPath)
  const allowedAssets = new Set(requiredAssets)
  for (const assetName of entries.keys()) {
    if (!allowedAssets.has(assetName)) {
      throw new Error(
        `${path.basename(metadataPath)} contains an unexpected updater asset: ${assetName}`
      )
    }
  }
  for (const assetName of requiredAssets) {
    const entry = entries.get(assetName)
    if (!entry) {
      throw new Error(`${path.basename(metadataPath)} is missing ${assetName}`)
    }
    await verifyMetadataEntry(entry, path.join(directory, assetName), metadataPath)
  }

  for (const entry of entries.values()) {
    const filePath = path.join(directory, entry.url)
    try {
      await verifyMetadataEntry(entry, filePath, metadataPath)
    } catch (error) {
      throw new Error(`${path.basename(metadataPath)} has an invalid asset entry: ${error.message}`)
    }
  }
}

function parseMetadataEntries(content, metadataPath) {
  const entries = new Map()
  const pattern = /^\s*- url:\s*(.+)\r?\n\s+sha512:\s*(.+)\r?\n\s+size:\s*(\d+)\s*$/gm

  for (const match of content.matchAll(pattern)) {
    const url = match[1].trim()
    if (!/^[^\\/?:#]+$/.test(url)) {
      throw new Error(
        `Updater metadata ${path.basename(metadataPath)} contains an unsafe asset URL`
      )
    }
    if (entries.has(url)) throw new Error(`Updater metadata contains duplicate asset: ${url}`)
    entries.set(url, { url, sha512: match[2].trim(), size: Number(match[3]) })
  }

  if (!entries.size) throw new Error(`Updater metadata has no valid file entries: ${metadataPath}`)
  return entries
}

async function verifyMetadataEntry(entry, filePath, metadataPath) {
  const [bytes, fileStats] = await Promise.all([readFile(filePath), stat(filePath)])
  if (fileStats.size !== entry.size) {
    throw new Error(`Size mismatch for ${entry.url} referenced by ${path.basename(metadataPath)}`)
  }

  const sha512 = createHash('sha512').update(bytes).digest('base64')
  if (sha512 !== entry.sha512) {
    throw new Error(
      `SHA-512 mismatch for ${entry.url} referenced by ${path.basename(metadataPath)}`
    )
  }
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=')
      return [key, rest.join('=') || '']
    })
  )
  const result = await verifyReleaseAssets({
    assetsDir: args.assets,
    version: args.version || process.env.GITHUB_REF_NAME?.replace(/^v/, '')
  })
  if (args.fileList) {
    await writeFile(path.resolve(args.fileList), `${result.fileNames.join('\n')}\n`, 'utf8')
  }
  console.log(`Verified ${result.assetCount} release assets for v${result.version}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
