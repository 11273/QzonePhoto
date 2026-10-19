import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { checkPullRequestEvent, validatePullRequestTitle } from './check-pr-title.mjs'

test('PR 标题接受中英文、可选范围与破坏性变更标记', () => {
  for (const title of [
    'fix(download): 修复下载速度统计',
    'docs: clarify first launch on macOS',
    'feat(api)!: 调整响应结构',
    'refactor!: 调整内部接口',
    'fix(相册): 修复空状态'
  ]) {
    assert.equal(validatePullRequestTitle(title), true, title)
  }
})

test('PR 标题拒绝缺少说明、不规范前缀和多行内容', () => {
  for (const title of [
    undefined,
    null,
    123,
    '',
    '修复下载速度',
    'Fix: update',
    'unknown: update',
    'fix:缺少空格',
    'fix: ',
    'fix:  ',
    'fix(): update',
    'fix( ): update',
    'fix: update\n',
    'fix: update\n::error::unexpected',
    'fix: update\rmore'
  ]) {
    assert.equal(validatePullRequestTitle(title), false, JSON.stringify(title))
  }
})

test('PR 标题类型与 release-it 的更新日志类型保持一致', async () => {
  const config = JSON.parse(await readFile(new URL('../.release-it.json', import.meta.url)))
  for (const { type } of config.plugins['@release-it/conventional-changelog'].preset.types) {
    assert.equal(validatePullRequestTitle(`${type}: 示例修改`), true, type)
  }
})

test('PR 事件缺少合法标题时会失败，特殊字符只作为标题数据处理', () => {
  for (const event of [
    undefined,
    {},
    { pull_request: {} },
    { pull_request: { title: 'update' } }
  ]) {
    assert.throws(() => checkPullRequestEvent(event), /PR 标题须采用/)
  }
  const title = 'fix: 保留 `code`、$(example) 和 "引号"'
  assert.equal(checkPullRequestEvent({ pull_request: { title } }), title)
})

test('CI 命令读取真实事件文件，标题错误或事件缺失时返回失败退出码', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qzone-pr-title-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const eventPath = path.join(directory, 'event.json')
  const script = fileURLToPath(new URL('./check-pr-title.mjs', import.meta.url))
  for (const [title, expectedStatus] of [
    ['fix(download): 修复统计', 0],
    ['a11y: 改善键盘操作', 0],
    ['i18n: 更新翻译', 0],
    ['fix: 保留 $(example) 和 `code`', 0],
    ['update download', 1]
  ]) {
    await writeFile(eventPath, JSON.stringify({ pull_request: { title } }))
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, GITHUB_EVENT_PATH: eventPath },
      encoding: 'utf8'
    })
    assert.equal(result.status, expectedStatus, result.stderr)
  }
  const missingEvent = spawnSync(process.execPath, [script], {
    env: { ...process.env, GITHUB_EVENT_PATH: '' },
    encoding: 'utf8'
  })
  assert.equal(missingEvent.status, 1)
  assert.match(missingEvent.stderr, /缺少 GITHUB_EVENT_PATH/)
})

test('标题编辑会重跑轻量检查，工作流从事件文件读取标题且保持只读权限', async () => {
  const workflow = yaml.load(
    await readFile(new URL('../.github/workflows/pr-title.yml', import.meta.url), 'utf8')
  )
  assert.ok(workflow.on.pull_request.types.includes('edited'))
  assert.ok(workflow.on.pull_request.types.includes('synchronize'))
  assert.equal(workflow.permissions.contents, 'read')
  assert.equal(workflow.on.pull_request_target, undefined)
  const validation = workflow.jobs.title.steps.find(
    (step) => step.name === 'Validate pull request title'
  )
  assert.equal(validation.run, 'node scripts/check-pr-title.mjs')
})
