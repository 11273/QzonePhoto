import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const releaseConfig = JSON.parse(readFileSync(new URL('../.release-it.json', import.meta.url)))
const allowedTypes = new Set(
  releaseConfig.plugins['@release-it/conventional-changelog'].preset.types.map(({ type }) => type)
)

export function validatePullRequestTitle(title) {
  if (typeof title !== 'string' || /[\r\n]/.test(title)) return false
  const match = title.match(/^([a-z][a-z0-9]*)(?:\(([^()\r\n]+)\))?(!)?: (\S[^\r\n]*)$/)
  return Boolean(match && allowedTypes.has(match[1]) && (!match[2] || match[2].trim()))
}

export function checkPullRequestEvent(event) {
  if (!validatePullRequestTitle(event?.pull_request?.title)) {
    throw new Error(
      `PR 标题须采用“类型(可选范围): 简短说明”，例如“fix(download): 修复下载速度统计”。允许类型：${[...allowedTypes].join('、')}。`
    )
  }
  return event.pull_request.title
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.env.GITHUB_EVENT_PATH)
      throw new Error('缺少 GITHUB_EVENT_PATH，无法读取 PR 事件。')
    // 从 JSON 读取标题，避免把外部贡献者输入插入 shell 或 JavaScript 源码。
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    const title = checkPullRequestEvent(event)
    console.log(`PR 标题检查通过：${JSON.stringify(title)}`)
  } catch (error) {
    console.error('::error title=PR title::PR 标题检查失败，请查看下方说明。')
    console.error(error.message)
    process.exitCode = 1
  }
}
