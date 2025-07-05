// scripts/update-release-notes.js
const fs = require('fs')
const { execSync } = require('child_process')

// 从参数获取 changelog 内容
const changelog = process.argv[2] || ''

// 写入 RELEASE_NOTES.md
fs.writeFileSync('RELEASE_NOTES.md', changelog)

// 添加到 git
try {
  execSync('git add RELEASE_NOTES.md', { stdio: 'inherit' })
  console.log('✅ RELEASE_NOTES.md has been added to git')
} catch (error) {
  console.error('❌ Failed to add RELEASE_NOTES.md to git:', error.message)
}
