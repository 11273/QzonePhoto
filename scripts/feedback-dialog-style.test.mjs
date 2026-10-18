import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL('../src/renderer/src/components/FeedbackDialog/index.vue', import.meta.url),
  'utf8'
)

test('teleported feedback dialog styles target the global dialog root', () => {
  assert.match(source, /:global\(\.feedback-dialog\)\s*\{[^}]*--fd-ease-out:/s)
  assert.match(source, /:global\(\.feedback-dialog \.el-dialog__body\)/)
  assert.doesNotMatch(source, /:deep\(\.feedback-dialog/)
})
