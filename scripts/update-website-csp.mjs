import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const websiteRoot = path.resolve('website')
const headersPath = path.join(websiteRoot, '_headers')
const htmlFiles = await listHtmlFiles(websiteRoot)
const hashes = new Set()

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8')
  for (const match of html.matchAll(/<script(?![^>]+\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const digest = createHash('sha256').update(match[1]).digest('base64')
    hashes.add(`'sha256-${digest}'`)
  }
}

const headers = await readFile(headersPath, 'utf8')
const currentScriptSources = headers.match(/script-src\s+([^;]+);/)
if (!currentScriptSources) throw new Error('website/_headers is missing a script-src CSP directive')

const explicitScriptSources = currentScriptSources[1]
  .split(/\s+/)
  .filter((source) => !/^'sha(?:256|384|512)-/.test(source))
const scriptPolicy = `script-src ${[...new Set([...explicitScriptSources, ...Array.from(hashes).sort()])].join(' ')};`
const nextHeaders = headers.replace(/script-src\s+[^;]+;/, scriptPolicy)

if (nextHeaders === headers) {
  console.log(`CSP is current (${hashes.size} inline script hashes)`)
} else if (process.argv.includes('--check')) {
  console.error('website/_headers has stale CSP hashes; run pnpm website:csp')
  process.exitCode = 1
} else {
  await writeFile(headersPath, nextHeaders, 'utf8')
  console.log(`Updated website/_headers (${hashes.size} inline script hashes)`)
}

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const resolved = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listHtmlFiles(resolved)))
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(resolved)
  }
  return files
}
