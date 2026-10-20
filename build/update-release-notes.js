// build/update-release-notes.js
const fs = require('fs')
const path = require('path')

// 配置
const CONFIG = {
  GITHUB_OWNER: '11273',
  GITHUB_REPO: 'QzonePhoto',
  CHANGELOG_FILE: path.join(__dirname, '../CHANGELOG.md'),
  OUTPUT_FILE: 'RELEASE_NOTES.md'
}

// 工具函数
const utils = {
  // 读取包版本
  getPackageVersion: () => {
    const packagePath = path.join(__dirname, '../package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    return `v${packageJson.version}`
  },

  // 生成唯一的访问统计ID
  generateViewCounterId: (version) => {
    return `${CONFIG.GITHUB_OWNER}-${CONFIG.GITHUB_REPO}-${version.replace(/\./g, '-')}`
  }
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractVersionChangelog = (content, version) => {
  const normalizedVersion = String(version).replace(/^v/, '')
  const heading = new RegExp(`^## \\[${escapeRegExp(normalizedVersion)}\\][^\\r\\n]*$`, 'm')
  const match = heading.exec(String(content))

  if (!match) {
    throw new Error(`CHANGELOG.md does not contain a section for v${normalizedVersion}`)
  }

  const start = match.index
  const remaining = String(content).slice(start)
  const nextSection = remaining.slice(match[0].length).search(/^## \[/m)
  const end = nextSection === -1 ? undefined : match[0].length + nextSection

  return remaining.slice(0, end).trim()
}

const readVersionChangelog = (version) => {
  return extractVersionChangelog(fs.readFileSync(CONFIG.CHANGELOG_FILE, 'utf8'), version)
}

const MACOS_FIRST_OPEN_GUIDE = `## 🍎 macOS 首次打开

当前安装包尚未完成 Apple 开发者签名与公证。请只在确认来自[唯一官网](https://qzonephoto.getgit.one/)或本仓库 Release、且信任此来源后继续。

1. **选对安装包**：在“ → 关于本机”查看芯片；Apple 芯片选 arm64，Intel 选 x64。
2. **安装到应用程序**：退出正在运行的旧版，打开 DMG，把“企鹅相册”拖进“应用程序”；更新时选择替换。不要直接在 DMG 中运行。
3. **首次打开被拦截时**：先在“应用程序”中双击一次，再进入“系统设置 → 隐私与安全性”，向下找到“企鹅相册”的拦截提示，选择“仍要打开”，按系统提示确认。

macOS 15 及以上不能再通过右键放行；较早系统可尝试按住 Control 点按（或右键点按）应用，选择“打开”。授权后通常可直接双击启动，替换版本后可能需要重新确认。

若提示“已损坏”或“将损坏电脑”，请停止打开，重新从官方来源下载并反馈；不要关闭系统安全保护。没有“仍要打开”时，请先尝试启动一次；受管理的电脑可能需要联系管理员。

[完整安装帮助](https://qzonephoto.getgit.one/privacy/#macos-first-open) · [Apple 官方说明](https://support.apple.com/zh-cn/102445)。不需要在终端输入命令。`

// 生成徽标
const generateBadges = (version) => {
  const { GITHUB_OWNER, GITHUB_REPO } = CONFIG
  const viewCounterId = utils.generateViewCounterId(version)
  const releaseUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${version}`

  // 徽标配置
  const badges = [
    {
      name: '总下载量',
      url: `https://img.shields.io/github/downloads/${GITHUB_OWNER}/${GITHUB_REPO}/total?style=flat-square&logo=github&color=blue`,
      link: releaseUrl
    },
    {
      name: '下载统计',
      url: `https://img.shields.io/github/downloads/${GITHUB_OWNER}/${GITHUB_REPO}/${version}/total?style=flat-square&logo=github&color=green`,
      link: releaseUrl
    },
    {
      name: '访问统计',
      url: `https://komarev.com/ghpvc/?username=${viewCounterId}&label=Views&color=brightgreen&style=flat-square`,
      link: releaseUrl
    }
  ]

  // 平台徽标
  const platforms = [
    { name: 'Windows', color: '0078D6', logo: 'windows', logoColor: 'white' },
    { name: 'macOS', color: '000000', logo: 'apple', logoColor: 'white' },
    { name: 'Linux', color: 'FCC624', logo: 'linux', logoColor: 'black' }
  ]

  // 生成徽标字符串
  const badgeStrings = badges
    .map((badge) => `[![${badge.name}](${badge.url})](${badge.link})`)
    .join(' ')

  const platformStrings = platforms
    .map(
      (platform) =>
        `[![${platform.name}](https://img.shields.io/badge/${platform.name}-${platform.color}?style=flat-square&logo=${platform.logo}&logoColor=${platform.logoColor})](${releaseUrl})`
    )
    .join(' ')

  return { badgeStrings, platformStrings }
}

// 生成Release Notes内容
const generateReleaseNotes = (version, changelog) => {
  const { badgeStrings, platformStrings } = generateBadges(version)

  return `
# 🎉 Release ${version}

${badgeStrings}

${platformStrings}

---

${MACOS_FIRST_OPEN_GUIDE}

${changelog}`
}

// 主函数
const main = () => {
  // 获取版本号
  const currentVersion = utils.getPackageVersion()
  const changelog = readVersionChangelog(currentVersion)

  // 生成内容
  const content = generateReleaseNotes(currentVersion, changelog)

  // 写入文件
  fs.writeFileSync(CONFIG.OUTPUT_FILE, content.trim())
  console.log(`✅ Generated ${CONFIG.OUTPUT_FILE} for ${currentVersion}`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exitCode = 1
  }
}

module.exports = {
  extractVersionChangelog,
  generateReleaseNotes,
  MACOS_FIRST_OPEN_GUIDE
}
