import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { load as loadYaml } from 'js-yaml'
import { rebaseUpdateMetadata } from './rebase-update-metadata.mjs'

const METADATA_NAMES = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']
const STABLE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/
const INSTALLER_NAME_PATTERN = /^QzonePhoto-[A-Za-z0-9._-]+\.(?:exe|zip|dmg|AppImage|deb)$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/i
const SHA512_PATTERN = /^[A-Za-z0-9+/]{86}==$/

export async function prepareR2Rollback({
  tag,
  manifestPath,
  metadataDir,
  outDir,
  fileListPath,
  assetListPath,
  publicBaseUrl = 'https://dl.qzonephoto.getgit.one'
} = {}) {
  if (!STABLE_TAG_PATTERN.test(String(tag || ''))) {
    throw new Error(`Rollback tag must be stable, received: ${tag || '(empty)'}`)
  }

  const manifestFile = path.resolve(manifestPath || `artifacts/${tag}.json`)
  const sourceDirectory = path.resolve(metadataDir || 'artifacts')
  const outputDirectory = path.resolve(outDir || 'stable-update-metadata')
  const baseUrl = normalizePublicBaseUrl(publicBaseUrl)
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'))
  const version = tag.slice(1)

  if (manifest.tag !== tag || manifest.version !== version) {
    throw new Error(
      `Rollback manifest identity mismatch: ${manifest.tag || '(empty)'} / ${manifest.version || '(empty)'}`
    )
  }
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) {
    throw new Error('Rollback manifest does not contain release assets')
  }

  const assets = new Map()
  for (const asset of manifest.assets) {
    const filename = String(asset?.filename || '')
    const size = Number(asset?.size)
    const sha256 = String(asset?.sha256 || '')
    const expectedUrl = `${baseUrl}/releases/${tag}/${encodeURIComponent(filename)}`
    if (!INSTALLER_NAME_PATTERN.test(filename)) {
      throw new Error(
        `Rollback manifest contains an unsafe installer name: ${filename || '(empty)'}`
      )
    }
    if (assets.has(filename)) {
      throw new Error(`Rollback manifest contains a duplicate installer: ${filename}`)
    }
    if (!Number.isSafeInteger(size) || size <= 0 || !SHA256_PATTERN.test(sha256)) {
      throw new Error(`Rollback manifest contains invalid integrity data for ${filename}`)
    }
    if (asset.r2Url !== expectedUrl) {
      throw new Error(`Rollback manifest contains an unexpected R2 URL for ${filename}`)
    }
    assets.set(filename, { filename, size })
  }

  const referencedAssets = new Set()
  for (const metadataName of METADATA_NAMES) {
    const metadata = loadYaml(await readFile(path.join(sourceDirectory, metadataName), 'utf8'))
    if (String(metadata?.version || '') !== version) {
      throw new Error(`${metadataName} does not describe rollback version ${version}`)
    }
    if (!Array.isArray(metadata?.files) || !metadata.files.length) {
      throw new Error(`${metadataName} does not contain update files`)
    }

    for (const entry of metadata.files) {
      const filename = readLocalFilename(entry?.url, metadataName)
      const manifestAsset = assets.get(filename)
      if (!manifestAsset || Number(entry?.size) !== manifestAsset.size) {
        throw new Error(`${metadataName} does not match rollback manifest asset ${filename}`)
      }
      if (!SHA512_PATTERN.test(String(entry?.sha512 || ''))) {
        throw new Error(`${metadataName} contains invalid SHA-512 data for ${filename}`)
      }
      referencedAssets.add(filename)
    }

    const defaultFilename = readLocalFilename(metadata?.path, metadataName)
    const defaultEntry = metadata.files.find((entry) => entry?.url === defaultFilename)
    if (!defaultEntry || metadata?.sha512 !== defaultEntry.sha512) {
      throw new Error(`${metadataName} default updater asset is inconsistent`)
    }
  }

  if (referencedAssets.size !== assets.size) {
    const unreferenced = [...assets.keys()].filter((name) => !referencedAssets.has(name))
    throw new Error(
      `Rollback manifest contains unreferenced installers: ${unreferenced.join(', ')}`
    )
  }

  const installerNames = [...assets.keys()].sort()
  const fileNames = [...installerNames, ...METADATA_NAMES]
  await mkdir(outputDirectory, { recursive: true })
  await rebaseUpdateMetadata({
    assetsDir: sourceDirectory,
    outDir: outputDirectory,
    releasePath: tag,
    fileNames
  })
  await writeFile(
    path.resolve(fileListPath || 'verified-release-files.txt'),
    `${fileNames.join('\n')}\n`
  )
  await writeFile(
    path.resolve(assetListPath || 'verified-rollback-assets.tsv'),
    `${installerNames.map((name) => `${name}\t${assets.get(name).size}`).join('\n')}\n`
  )

  return { tag, version, installers: installerNames.length, metadataFiles: METADATA_NAMES.length }
}

function normalizePublicBaseUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('R2 public base URL must use HTTPS')
  return url.toString().replace(/\/$/, '')
}

function readLocalFilename(value, metadataName) {
  const filename = String(value || '').trim()
  if (!INSTALLER_NAME_PATTERN.test(filename) || path.basename(filename) !== filename) {
    throw new Error(`${metadataName} contains an unsafe updater path: ${filename || '(empty)'}`)
  }
  return filename
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const [key, ...rest] = argument.replace(/^--/, '').split('=')
      return [key, rest.join('=')]
    })
  )
  const result = await prepareR2Rollback({
    tag: args.tag,
    manifestPath: args.manifest,
    metadataDir: args.metadata,
    outDir: args.out,
    fileListPath: args.fileList,
    assetListPath: args.assetList,
    publicBaseUrl: args.publicBaseUrl
  })
  console.log(
    `Prepared verified R2 rollback snapshot ${result.tag} (${result.installers} installers, ${result.metadataFiles} metadata files)`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
