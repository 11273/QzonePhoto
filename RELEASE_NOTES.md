# 🎉 Release v2.3.0

[![总下载量](https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github&color=blue)](https://github.com/11273/QzonePhoto/releases/tag/v2.3.0) [![下载统计](https://img.shields.io/github/downloads/11273/QzonePhoto/v2.3.0/total?style=flat-square&logo=github&color=green)](https://github.com/11273/QzonePhoto/releases/tag/v2.3.0) [![访问统计](https://komarev.com/ghpvc/?username=11273-QzonePhoto-v2-3-0&label=Views&color=brightgreen&style=flat-square)](https://github.com/11273/QzonePhoto/releases/tag/v2.3.0)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.3.0) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.3.0) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/11273/QzonePhoto/releases/tag/v2.3.0)

---

## [2.3.0](///compare/v2.2.2...v2.3.0) (2026-04-25)

### ✨ Features | 新功能

* **photo:** 接入相册访客接口 + 关键文本一键复制 4f3682f
* 接入 QQ 真实好友分组并保留亲密度入口 574556b

### 🐛 Bug Fixes | Bug 修复

* cgi_list_photo 脏数据容错并修正照片分页续拉 e9f3cf8

### ♻ Code Refactoring | 代码重构

* **photo,video:** 充实左侧 sidebar、视频卡片极简化、补全已有接口字段 5c5e6c8
* **photo:** 相册头部权限信息改为标题旁灰字 + 详情 popover 203c5cf
* **ui:** 照片 timeline 卡片化 + 上传/下载管理器空状态 + 侧栏 chip 自动换行 9677bcb
* 把 cgi_list_photo 容错逻辑下沉到 service 层并放宽触发条件 5275c2c

### 📝 Documentation | 文档

* README 重构 — 451→216 行，按工具型 app 标准结构重排 27082d9
* 更新 README + 替换截图 + 写入新功能说明 615fee6

### 🎫 Chores | 其他更新

* **ui:** 全局 ds-dialog 暗色对话框样式 + 1024/480 响应式补全 75d9b1f
* **ui:** 全局设计令牌统一 + 主题色对齐 + 复制位点扩展 c8cbcaf, closes #60a5fa f56c6c/#e6a23c