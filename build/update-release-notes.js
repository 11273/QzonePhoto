// scripts/update-release-notes.js
const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')

// 配置
const CONFIG = {
  GITHUB_OWNER: '11273',
  GITHUB_REPO: 'QzonePhoto',
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
  },

  // 执行Git命令
  gitAdd: (file) => {
    try {
      execSync(`git add ${file}`, { stdio: 'inherit' })
      return true
    } catch (error) {
      console.error(`❌ Failed to add ${file} to git:`, error.message)
      return false
    }
  }
}

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

${changelog}`
}

// 主函数
const main = () => {
  // 获取命令行参数
  const changelog = process.argv[2] || ''

  // 获取版本号
  const currentVersion = utils.getPackageVersion()

  // 生成内容
  const content = generateReleaseNotes(currentVersion, changelog)

  // 写入文件
  fs.writeFileSync(CONFIG.OUTPUT_FILE, content.trim())
  console.log(`✅ Generated ${CONFIG.OUTPUT_FILE} for ${currentVersion}`)

  // 添加到Git
  if (utils.gitAdd(CONFIG.OUTPUT_FILE)) {
    console.log(`✅ ${CONFIG.OUTPUT_FILE} has been added to git`)
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('❌ Unexpected error:', error.message)
  process.exit(1)
})

// 执行
main()
