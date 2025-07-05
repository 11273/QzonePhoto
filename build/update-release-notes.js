// scripts/update-release-notes.js
const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')

// GitHub 仓库信息
const GITHUB_OWNER = '11273'
const GITHUB_REPO = 'QzonePhoto'

// 从参数获取 changelog 内容
const changelog = process.argv[2] || ''

// 读取 package.json 获取当前版本
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
const currentVersion = `v${packageJson.version}`
const currentVersionWithoutDot = currentVersion.replace('.', '')

// 生成徽标部分
const badges = `
# 🎉 Release ${currentVersion}

[![GitHub Release](https://img.shields.io/github/v/release/${GITHUB_OWNER}/${GITHUB_REPO}?style=flat-square&logo=github&color=blue)](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${currentVersion}) [![下载统计](https://img.shields.io/github/downloads/${GITHUB_OWNER}/${GITHUB_REPO}/${currentVersion}/total?style=flat-square&logo=github&color=green)](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${currentVersion}) [![访问统计](https://komarev.com/ghpvc/?username=${GITHUB_OWNER}${GITHUB_REPO}${currentVersionWithoutDot}&label=Views&color=brightgreen&style=flat-square)](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${currentVersion})


[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${currentVersion}) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${currentVersion}) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${currentVersion})

---

`

// 组合内容
const fullContent = badges + changelog

// 写入 RELEASE_NOTES.md
fs.writeFileSync('RELEASE_NOTES.md', fullContent)

// 添加到 git
try {
  execSync('git add RELEASE_NOTES.md', { stdio: 'inherit' })
  console.log(`✅ RELEASE_NOTES.md for ${currentVersion} has been added to git`)
} catch (error) {
  console.error('❌ Failed to add RELEASE_NOTES.md to git:', error.message)
}
