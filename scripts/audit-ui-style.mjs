import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const rendererRoot = path.resolve('src/renderer/src')
const extensions = new Set(['.vue', '.css', '.scss'])
const skipDirectories = new Set(['node_modules', 'dist', 'out'])
const tokenSources = [
  `${path.sep}styles${path.sep}themes${path.sep}`,
  `${path.sep}styles${path.sep}design-tokens.css`,
  `${path.sep}styles${path.sep}element-theme.css`
]
// Reviewed migration ceiling. Lower this whenever semantic tokens replace legacy literals so
// later UI work cannot silently re-introduce theme debt.
const migrationBaseline = Object.freeze({ rawColors: 0, importantRules: 238 })

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) return []
      return collectFiles(path.join(directory, entry.name))
    }
    const file = path.join(directory, entry.name)
    return extensions.has(path.extname(file)) ? [file] : []
  })
}

const files = collectFiles(rendererRoot)
let rawColors = 0
let importantRules = 0
const forbiddenLegacyPrimary = []
const rawColorPattern = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const normalizedFile = path.normalize(file)
  const isTokenSource = tokenSources.some((entry) => normalizedFile.includes(entry))
  if (!isTokenSource) rawColors += source.match(rawColorPattern)?.length || 0
  importantRules += source.match(/!important\b/g)?.length || 0
  if (/#409eff\b/i.test(source)) {
    forbiddenLegacyPrimary.push(path.relative(process.cwd(), file))
  }
}

console.log(
  `UI style audit: ${files.length} files, ${rawColors} unregistered raw colors, ${importantRules} !important rules`
)

if (forbiddenLegacyPrimary.length) {
  console.error('Legacy Element Plus primary blue must use a semantic theme token:')
  forbiddenLegacyPrimary.forEach((file) => console.error(`- ${file}`))
  process.exitCode = 1
}

if (rawColors > migrationBaseline.rawColors || importantRules > migrationBaseline.importantRules) {
  console.error(
    'UI style debt increased. Use semantic theme tokens or update the reviewed baseline.'
  )
  process.exitCode = 1
}
