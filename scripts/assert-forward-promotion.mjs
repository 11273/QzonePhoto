import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

function parseStableVersion(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) throw new Error(`Expected stable semantic version, received: ${value || '(empty)'}`)
  return match.slice(1).map(Number)
}

export function assertNoReleaseRollback(currentVersion, candidateVersion) {
  const current = parseStableVersion(currentVersion)
  const candidate = parseStableVersion(candidateVersion)

  for (let index = 0; index < current.length; index += 1) {
    if (candidate[index] > current[index]) return
    if (candidate[index] < current[index]) {
      throw new Error(
        `Candidate release ${candidateVersion} is older than current stable release ${currentVersion}`
      )
    }
  }
}

function readMetadataVersion(content) {
  return (
    String(content)
      .match(/^version:\s*(.+)$/m)?.[1]
      ?.trim() || ''
  )
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=')
      return [key, rest.join('=') || '']
    })
  )
  const [currentContent, candidateContent] = await Promise.all([
    readFile(args.current, 'utf8'),
    readFile(args.candidate, 'utf8')
  ])
  const currentVersion = readMetadataVersion(currentContent)
  const candidateVersion = readMetadataVersion(candidateContent)
  assertNoReleaseRollback(currentVersion, candidateVersion)
  console.log(`Promotion accepted: ${currentVersion} -> ${candidateVersion}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
