import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=')
      return [key, rest.join('=') || '']
    })
  )
  const artifactsDir = path.resolve(args.artifacts || 'artifacts')
  const outputDir = path.resolve(args.out || 'release-assets')
  const files = await listFiles(artifactsDir)
  const metadataFiles = files.filter((file) =>
    /^latest(?:-[\w-]+)?\.yml$/i.test(path.basename(file))
  )

  if (!metadataFiles.length) throw new Error('No electron-updater metadata files were found')

  const groups = new Map()
  for (const file of metadataFiles.sort()) {
    const name = path.basename(file)
    const documents = groups.get(name) || []
    documents.push({ path: file, content: await readFile(file, 'utf8') })
    groups.set(name, documents)
  }

  await mkdir(outputDir, { recursive: true })
  for (const [name, documents] of groups) {
    const merged = mergeMetadataDocuments(documents)
    await writeFile(path.join(outputDir, name), merged, 'utf8')
    console.log(`Merged ${documents.length} source file(s) into ${name}`)
  }
}

export function mergeMetadataDocuments(documents) {
  if (!Array.isArray(documents) || !documents.length) {
    throw new Error('At least one update metadata document is required')
  }

  const parsedDocuments = documents.map(parseMetadataDocument)
  const version = parsedDocuments[0].version
  if (parsedDocuments.some((document) => document.version !== version)) {
    throw new Error('Cannot merge update metadata from different versions')
  }

  const preferred =
    parsedDocuments.find((document) => /(?:^|[-_/])x64(?:[-_/]|$)/i.test(document.path)) ||
    parsedDocuments[0]
  const orderedDocuments = [
    preferred,
    ...parsedDocuments.filter((document) => document !== preferred)
  ]
  const entriesByUrl = new Map()

  for (const document of orderedDocuments) {
    for (const entry of document.fileEntries) {
      const url = entry.match(/^\s{2}- url: (.+)$/m)?.[1]
      if (!url) throw new Error(`Invalid update file entry in ${document.path}`)
      if (entriesByUrl.has(url)) {
        throw new Error(`Duplicate update file entry ${url} in ${document.path}`)
      }
      entriesByUrl.set(url, entry)
    }
  }

  const fileEntries = [...entriesByUrl.values()].map((entry) => entry.replace(/\n+$/, ''))
  const merged = `${preferred.versionLine}\nfiles:\n${fileEntries.join('\n')}${preferred.suffix}`

  validateMergedMetadata(merged, fileEntries.length)
  return merged
}

function validateMergedMetadata(content, expectedEntryCount) {
  const parsed = parseMetadataDocument({
    path: 'merged update metadata',
    content
  })

  if (parsed.fileEntries.length !== expectedEntryCount) {
    throw new Error(
      `Merged update metadata contains ${parsed.fileEntries.length} file entries; expected ${expectedEntryCount}`
    )
  }
}

function parseMetadataDocument({ path: filePath, content }) {
  const normalized = String(content).replace(/\r\n/g, '\n')
  const versionLine = normalized.match(/^version:\s*(.+)$/m)?.[0]
  const version = normalized.match(/^version:\s*(.+)$/m)?.[1]?.trim()
  const marker = 'files:\n'
  const filesStart = normalized.indexOf(marker)
  const filesEnd = normalized.indexOf('\npath:', filesStart + marker.length)

  if (!versionLine || !version || filesStart === -1 || filesEnd === -1) {
    throw new Error(`Invalid electron-updater metadata: ${filePath}`)
  }

  const entries = normalized
    .slice(filesStart + marker.length, filesEnd)
    .split(/(?=^\s{2}- url: )/m)
    .filter(Boolean)

  if (!entries.length) throw new Error(`Update metadata has no files: ${filePath}`)

  return {
    path: filePath,
    version,
    versionLine,
    fileEntries: entries,
    suffix: normalized.slice(filesEnd)
  }
}

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
