import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('certificate-free macOS builds use a launchable ad-hoc signature', async () => {
  const [builderConfig, afterPack] = await Promise.all([
    readProjectFile('electron-builder.yml'),
    readProjectFile('build/afterPack.js')
  ])

  assert.match(builderConfig, /^\s*hardenedRuntime:\s*false\s*$/m)
  assert.match(afterPack, /'--deep'/)
  assert.match(afterPack, /'--sign',\s*\n\s*'-'/)
  assert.doesNotMatch(afterPack, /'--options',\s*\n\s*'runtime'/)
})

test('release workflow verifies that packaged Electron really loads', async () => {
  const workflow = await readProjectFile('.github/workflows/release.yml')

  assert.match(workflow, /- name: Verify macOS application can load/)
  assert.match(workflow, /codesign --verify --deep --strict/)
  assert.match(workflow, /ELECTRON_RUN_AS_NODE=1/)
  assert.match(workflow, /process\.versions\.electron/)
  assert.match(
    workflow,
    /gh release edit "\$\{GITHUB_REF_NAME\}"[\s\S]*?--notes-file RELEASE_NOTES\.md/
  )
})

test('macOS first-open guidance is present at every user-facing release entry', async () => {
  const [readme, home, help, llms, releaseNotesBuilder] = await Promise.all([
    readProjectFile('README.md'),
    readProjectFile('website/index.html'),
    readProjectFile('website/privacy/index.html'),
    readProjectFile('website/llms.txt'),
    readProjectFile('build/update-release-notes.js')
  ])

  for (const [name, content] of [
    ['README', readme],
    ['website home', home],
    ['website help', help],
    ['llms.txt', llms],
    ['release notes generator', releaseNotesBuilder]
  ]) {
    assert.match(content, /Control/, `${name} must explain Control/right-click opening`)
    assert.match(content, /隐私与安全性/, `${name} must explain the system setting fallback`)
    assert.match(content, /仍要打开/, `${name} must name the macOS action`)
    assert.match(
      content,
      /macOS 15/,
      `${name} must distinguish modern Gatekeeper from older right-click instructions`
    )
    assert.match(
      content,
      /已损坏/,
      `${name} must not conflate damage warnings with first-open approval`
    )
    assert.match(content, /替换/, `${name} must explain manual upgrades`)
  }

  const combined = [readme, home, help, llms, releaseNotesBuilder].join('\n')
  assert.doesNotMatch(combined, /xattr\s+-|spctl\s+--master-disable/)
})
