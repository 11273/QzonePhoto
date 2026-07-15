import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'update-website-csp.mjs')

test('preserves explicit external script sources when refreshing CSP hashes', async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'qzonephoto-csp-'))
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }))

  const websiteRoot = path.join(fixtureRoot, 'website')
  const inlineScript = "console.log('analytics-safe')"
  const inlineHash = createHash('sha256').update(inlineScript).digest('base64')

  await mkdir(websiteRoot)
  await writeFile(path.join(websiteRoot, 'index.html'), `<script>${inlineScript}</script>`, 'utf8')
  await writeFile(
    path.join(websiteRoot, '_headers'),
    "/*\n  Content-Security-Policy: script-src 'self' https://static.cloudflareinsights.com 'sha256-stale';\n",
    'utf8'
  )

  await run(process.execPath, [scriptPath], fixtureRoot)

  const headers = await readFile(path.join(websiteRoot, '_headers'), 'utf8')
  assert.match(headers, /https:\/\/static\.cloudflareinsights\.com/)
  assert.ok(headers.includes(`'sha256-${inlineHash}'`))
  assert.doesNotMatch(headers, /'sha256-stale'/)
})

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'pipe' })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(command)} exited with ${code}: ${stderr}`))
    })
  })
}
