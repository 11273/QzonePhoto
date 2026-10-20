import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import yaml from 'js-yaml'
import {
  buildReleaseNotesPresentation,
  normalizeReleaseNotes
} from '../src/renderer/src/components/UpdateManager/update-presentation.js'

test('release-it notes form readable groups without changing source format or build inputs', async () => {
  const { generateReleaseNotes } = createRequire(import.meta.url)(
    '../build/update-release-notes.js'
  )
  const changelog = `## [9.9.9](https://example.test)
### ✨ Features | 新功能
* **photo:** 支持框选照片
### 🐛 Bug Fixes | Bug 修复
* **download:** 修复任务计数
### ⚡ Performance Improvements | 性能优化
* **download:** 优化并发下载`
  const notes = generateReleaseNotes('v9.9.9', changelog)
  const result = buildReleaseNotesPresentation(notes)
  assert.match(notes, /# 🎉 Release v9\.9\.9/)
  assert.match(notes, /shields\.io/)
  assert.ok(notes.endsWith(changelog))
  assert.match(notes, /macOS 首次打开/)
  assert.doesNotMatch(result.content, /DMG|Control|仍要打开|shields\.io|\*\*|工作流/)
  assert.deepEqual(
    result.sections.map((section) => section.title),
    ['新功能', '问题修复', '体验优化']
  )
  assert.equal(result.itemCount, 3)
  assert.ok(result.sections.every((section) => section.items.length > 0))
  const config = yaml.load(
    await readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8')
  )
  assert.equal(config.releaseInfo.releaseNotesFile, 'RELEASE_NOTES.md')
})

test('legacy macOS instructions and empty internal sections stay out of the release content', () => {
  const source = `## macOS 首次打开
1. 打开 DMG。
2. Control 点按。
## [2.9.0]
### ✨ Features | 新功能
* **photo:** 支持框选照片 ([abcd123](https://example.test/commit))
### 🐛 Bug Fixes | Bug 修复
* **ci:** 修复 Electron 回归脚本
### ⚡ Performance Improvements | 性能优化
* **download:** 优化多图下载
`
  const result = normalizeReleaseNotes(source)
  assert.match(result, /支持框选照片|优化多图下载/)
  assert.doesNotMatch(result, /macOS|Control|DMG|Electron|问题修复|✨/)
  assert.equal(normalizeReleaseNotes('### Bug Fixes\n\n* **ci:** 构建修复'), '')
})
