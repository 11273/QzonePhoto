# 🎉 Release v2.1.0

[![总下载量](https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github&color=blue)](https://github.com/11273/QzonePhoto/releases/tag/v2.1.0) [![下载统计](https://img.shields.io/github/downloads/11273/QzonePhoto/v2.1.0/total?style=flat-square&logo=github&color=green)](https://github.com/11273/QzonePhoto/releases/tag/v2.1.0) [![访问统计](https://komarev.com/ghpvc/?username=11273-QzonePhoto-v2-1-0&label=Views&color=brightgreen&style=flat-square)](https://github.com/11273/QzonePhoto/releases/tag/v2.1.0)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.1.0) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.1.0) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/11273/QzonePhoto/releases/tag/v2.1.0)

---

## [2.1.0](///compare/v2.0.0...v2.1.0) (2026-04-05)

### ✨ Features | 新功能

* 优化相册选择逻辑，好友模式下默认选中第一个相册 f0788ec
* 好友照片模块，网格卡片布局展示好友动态照片 e66fc24
* 好友相册模块与相册问答查看功能 ea2dc94
* 添加富文本组件，支持解析@提及和表情，优化评论和回复展示 901d4c2
* 添加开发环境远程调试端口配置 e0457d9

### 🐛 Bug Fixes | Bug 修复

* 升级 electron-builder 修复 pnpm 10.29.3+ 间接依赖丢失问题 a9427e0, closes #9618

### ♻ Code Refactoring | 代码重构

* 优化相册和视频模块的样式，调整标题和按钮布局，更新动画时长以提升用户体验 9bc5f20
* 更新自定义标题栏样式，调整布局以增强响应性和用户交互体验 ec68c7b

### 📝 Documentation | 文档

* 修复README截图文件名拼写错误，补充好友动态功能描述，统一格式 0d934a0
* 更新README.md，增强功能描述，添加上传和下载管理部分，移除不再使用的截图 3fcedde
* 更新README.md，重构内容布局，增强功能描述和视觉效果 e619408

### 🎫 Chores | 其他更新

* 日志清理 移除/注释 Pusher 及 Service 层中的冗余高频调试日志，清理 Lint 警告。 8599ad3

### 💅 Polish | 优化

* 优化自动加载更多功能，优化照片、视频和动态模块的内容填充体验 3344ccb
* 优化隐私遮罩样式和交互效果 f0d168a