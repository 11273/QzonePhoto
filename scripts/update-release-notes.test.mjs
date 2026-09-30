import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const {
  extractVersionChangelog,
  generateReleaseNotes
} = require('../build/update-release-notes.js')

test('release notes keep the exact current-version changelog without later versions', () => {
  const changelog = `# Changelog

## [2.8.0](https://example.test/compare/v2.7.0...v2.8.0) (2026-09-30)

* **release:** 保留字面量 $(printf HOOK_EXPANDED) 和 \`反引号\`

## [2.7.0](https://example.test/compare/v2.6.0...v2.7.0) (2026-07-26)

* previous release
`

  const section = extractVersionChangelog(changelog, 'v2.8.0')

  assert.match(section, /^## \[2\.8\.0\]/)
  assert.match(section, /\$\(printf HOOK_EXPANDED\)/)
  assert.match(section, /`反引号`/)
  assert.doesNotMatch(section, /^## \[2\.7\.0\]/m)
  assert.doesNotMatch(section, /previous release/)

  const notes = generateReleaseNotes('v2.8.0', section)
  assert.match(notes, /# 🎉 Release v2\.8\.0/)
  assert.match(notes, /\$\(printf HOOK_EXPANDED\)/)
})

test('release notes fail when the bumped version is absent from the changelog', () => {
  assert.throws(
    () => extractVersionChangelog('# Changelog\n\n## [2.7.0]\n', 'v2.8.0'),
    /does not contain a section for v2\.8\.0/
  )
})
