# 🎉 Release v2.2.0

[![总下载量](https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github&color=blue)](https://github.com/11273/QzonePhoto/releases/tag/v2.2.0) [![下载统计](https://img.shields.io/github/downloads/11273/QzonePhoto/v2.2.0/total?style=flat-square&logo=github&color=green)](https://github.com/11273/QzonePhoto/releases/tag/v2.2.0) [![访问统计](https://komarev.com/ghpvc/?username=11273-QzonePhoto-v2-2-0&label=Views&color=brightgreen&style=flat-square)](https://github.com/11273/QzonePhoto/releases/tag/v2.2.0)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.2.0) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.2.0) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/11273/QzonePhoto/releases/tag/v2.2.0)

---

## [2.2.0](///compare/v2.1.0...v2.2.0) (2026-04-21)

### ✨ Features | 新功能

* 好友隐藏数据展示与动态流增强 da95815

### 🐛 Bug Fixes | Bug 修复

* 一键下载时保留上一次的 qq_photo_key，避免批量下载落入加密占位图 eaf76cc
* 好友QQ号脱敏显示，与自己的QQ号行为一致 724e11c
* 好友信息改为悬停头像展示，修复照片流快速切换竞态 f0c2842
* 好友模式下相册问答显示仅相册主人可见提示 647244c
* 好友模式下跳过相册问答API调用，避免触发登出 2e7c427
* 所有辅助API调用添加skipAuthCheck，防止偶发-3000触发登出 0ad15cc

### 🎫 Chores | 其他更新

* 更新 release.yml，优化 Node.js 和 pnpm 安装步骤 a7ce236
* 注释掉调试日志以清理代码 bb854d0