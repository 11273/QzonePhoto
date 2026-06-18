# 🎉 Release v2.6.0

[![总下载量](https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github&color=blue)](https://github.com/11273/QzonePhoto/releases/tag/v2.6.0) [![下载统计](https://img.shields.io/github/downloads/11273/QzonePhoto/v2.6.0/total?style=flat-square&logo=github&color=green)](https://github.com/11273/QzonePhoto/releases/tag/v2.6.0) [![访问统计](https://komarev.com/ghpvc/?username=11273-QzonePhoto-v2-6-0&label=Views&color=brightgreen&style=flat-square)](https://github.com/11273/QzonePhoto/releases/tag/v2.6.0)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.6.0) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.6.0) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/11273/QzonePhoto/releases/tag/v2.6.0)

---

## [2.6.0](https://github.com/11273/QzonePhoto/compare/v2.5.0...v2.6.0) (2026-06-18)

### ✨ Features | 新功能

* **feedback:** 支持上传脱敏诊断日志 ([2822878](https://github.com/11273/QzonePhoto/commit/282287877c89821d09f1efb257bb176232d36afe))
* **feeds:** 支持留言板动态流 ([ebd661a](https://github.com/11273/QzonePhoto/commit/ebd661ad259948fb9e2c47075605b7e962e0b654))

### 🐛 Bug Fixes | Bug 修复

* declare pnpm dependencies and build approvals ([b1c9bdf](https://github.com/11273/QzonePhoto/commit/b1c9bdfa729220900b9af67741ba903b4af2621e))
* **download:** 保留照片时间并维持媒体顺序 ([310178d](https://github.com/11273/QzonePhoto/commit/310178dc262bc1f67156b9f99e033caed0faca7b)), closes [#38](https://github.com/11273/QzonePhoto/issues/38)
* **feeds:** 兼容 QQ 空间动图媒体地址 ([b70fa25](https://github.com/11273/QzonePhoto/commit/b70fa258db93c5da8425395ddd385e36ab8f58c7))
* **feeds:** 优化留言板图片和回复展示 ([3f62d43](https://github.com/11273/QzonePhoto/commit/3f62d431c28702f9113365160f640c91c5702f06))
* **login:** 增加登录态恢复超时兜底 ([5f5115f](https://github.com/11273/QzonePhoto/commit/5f5115fdd21ec6c09ef7979144a6bcecc0265364)), closes [#39](https://github.com/11273/QzonePhoto/issues/39)
* **preview:** 兜底预览图片和外链打开 ([79cd1fa](https://github.com/11273/QzonePhoto/commit/79cd1fa67e50b68413bd4745286a23fac790bf3d))

### ♻ Code Refactoring | 代码重构

* **ui:** 使用组件替换表情图标 ([f45262c](https://github.com/11273/QzonePhoto/commit/f45262ced4b7ab88204aaa69311e8dcdd0e26f2b))

### 🔧 Continuous Integration | CI 配置

* pin Windows release runner to 2022 ([e6c982a](https://github.com/11273/QzonePhoto/commit/e6c982aa859a27d85628d42a8aa0031822bea2d9))