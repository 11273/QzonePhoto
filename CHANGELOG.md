# Changelog

## [1.3.0](https://github.com/11273/QzonePhoto/compare/v1.2.1...v1.3.0) (2025-11-08)

### ✨ Features | 新功能

* 添加打开QQ空间官网功能，支持在新窗口中加载用户页面并设置相关cookies ([2f28099](https://github.com/11273/QzonePhoto/commit/2f28099eca7f6dba85a6a1a0c532fec9006f9f2e))
* 添加批量删除照片功能，支持用户选择并删除相册中的照片 ([e61b3c5](https://github.com/11273/QzonePhoto/commit/e61b3c5b1ac2614273d8103a81a1f9407106d6ca))

### 💅 Polish | 优化

* 优化相册信息展示与滚动交互体验 ([7355b63](https://github.com/11273/QzonePhoto/commit/7355b636dccfd8c27b0d09ded0d808abfaea26ce))

## [1.2.1](https://github.com/11273/QzonePhoto/compare/v1.2.0...v1.2.1) (2025-10-19)

### ✨ Features | 新功能

* 增强登录界面，添加二维码刷新功能和扫码状态提示，优化用户体验 ([49c59b2](https://github.com/11273/QzonePhoto/commit/49c59b2a570985a33f583e7426c84a52eafb51b9))

### ♻ Code Refactoring | 代码重构

* 使用 path.basename 替代手动分割路径，简化文件名提取逻辑 ([6a65710](https://github.com/11273/QzonePhoto/commit/6a65710ea816a007059c4644b9d352eda842d216))

## [1.2.0](https://github.com/11273/QzonePhoto/compare/v1.1.1...v1.2.0) (2025-10-19)

### ✨ Features | 新功能

* 优化应用关闭流程，增加状态管理和清理超时保护 ([a4de3f4](https://github.com/11273/QzonePhoto/commit/a4de3f49aa3e3b3d8fb5541b3ece421f3da712fa))
* 优化文件上传体验，减少分页大小并按需生成预览 ([7360b87](https://github.com/11273/QzonePhoto/commit/7360b87a6c52248217922ec8c4fe7426ee83bafc))
* 增加视频文件上传支持，添加视频预览功能及相关处理逻辑 ([97fbef3](https://github.com/11273/QzonePhoto/commit/97fbef3e71a77ecb41a61ef83a65899497fb2e0d))
* 增强上传服务，添加用户登录状态检查与推送管理，优化任务处理逻辑 ([f70b30a](https://github.com/11273/QzonePhoto/commit/f70b30ae4b2be443f2d942f684f68ba1e3d6a097))
* 显示相册问题以及相册权限 ([630c247](https://github.com/11273/QzonePhoto/commit/630c24742ae91f364b66caa42a75296239f895c1))
* 添加上传功能及文件处理支持 ([53901f2](https://github.com/11273/QzonePhoto/commit/53901f201dc1da6358d22859c47025ff5d5bd3fe))
* 添加视频文件预览支持，优化任务列表加载和预览缓存逻辑 ([046f683](https://github.com/11273/QzonePhoto/commit/046f6832a5f5465b0df2b52a772c08d7bea04148))
* 添加认证过期处理机制，支持全局监听和提示 ([9fd9f13](https://github.com/11273/QzonePhoto/commit/9fd9f13b381d83dcdc8deac76b60edafe6e5a6e1))

### ♻ Code Refactoring | 代码重构

* 移动开发者工具打开逻辑至窗口准备就绪事件 ([444fe89](https://github.com/11273/QzonePhoto/commit/444fe890ebd5a8b5212614c2f4a0b325b5d41c84))

## [1.1.1](https://github.com/11273/QzonePhoto/compare/v1.1.0...v1.1.1) (2025-07-06)

### 🐛 Bug Fixes | Bug 修复

* 部分视频无法预览与下载失败 ([7a712f7](https://github.com/11273/QzonePhoto/commit/7a712f7cd07552aa878769a8d620b4fd69f70d0b))

### 🔧 Continuous Integration | CI 配置

* release.yml ([5b0bd88](https://github.com/11273/QzonePhoto/commit/5b0bd88794f5767f92dd3104dc7891c291c06bf6))
* release.yml ([eef2bad](https://github.com/11273/QzonePhoto/commit/eef2bad5abb7607ad57e415c2c2a450eb710b563))

### 💅 Polish | 优化

* 开发环境跳过更新检查 ([1a4393a](https://github.com/11273/QzonePhoto/commit/1a4393a2f8195bcda383e3cf406678571ef390e8))

## [1.1.0](https://github.com/11273/QzonePhoto/compare/v1.0.4...v1.1.0) (2025-07-06)

### ✨ Features | 新功能

* 支持视频查看与下载 ([2df5e13](https://github.com/11273/QzonePhoto/commit/2df5e13cc7877519ca6b09efedfc7bbc9a649ccf))

### 🐛 Bug Fixes | Bug 修复

* 更新问题 ([780b77e](https://github.com/11273/QzonePhoto/commit/780b77e0e759b05211da8d10d2472a8ac9644de0))

### 💅 Polish | 优化

* 下载照片优先原图下载以及文件名优化 ([8b141bc](https://github.com/11273/QzonePhoto/commit/8b141bc76c98000157621e3595f6b21beda1f9d4))
* 优化文件名显示与一键下载 ([fe91458](https://github.com/11273/QzonePhoto/commit/fe91458eb1dbc5193221a2e902366616832fb304))
* 状态推送优化频率 ([57489c4](https://github.com/11273/QzonePhoto/commit/57489c48f633f7e1d3b5588aaa6bbcec1d707215))

## [1.0.4](https://github.com/11273/QzonePhoto/compare/v1.0.3...v1.0.4) (2025-07-05)

### 🔨 Configuration | 配置

* 去除mac签名 ([24fb3a8](https://github.com/11273/QzonePhoto/commit/24fb3a8a2bfc36a14a8f36655f60c03e74796920))

## [1.0.3](https://github.com/11273/QzonePhoto/compare/v1.0.2...v1.0.3) (2025-07-05)

### 🐛 Bug Fixes | Bug 修复

* 修复自动更新问题 ([66a9014](https://github.com/11273/QzonePhoto/commit/66a901460e528728fb8132eb0e3f2a13a9fbc92a))

### 🔨 Configuration | 配置

* release-it ([20f8bc1](https://github.com/11273/QzonePhoto/commit/20f8bc1dcd7dad0557b5b0d393c43b2270719f42))

## [1.0.2](https://github.com/11273/QzonePhoto/compare/v1.0.1...v1.0.2) (2025-07-05)

### 🔨 CONFIG | 配置

* note ([d87c052](https://github.com/11273/QzonePhoto/commit/d87c052a27bf9c61e5b7bbcebe150bfa6fdec680))

## 1.0.1 (2025-07-05)

### ✨ Features | 新功能

* QQ空间图片下载 ([00068e4](https://github.com/11273/QzonePhoto/commit/00068e4950d74c1f8af6a4506a1d5f18a8a6fbf9))

### 🐛 Bug Fixes | Bug 修复

* 默认下载位置错误 ([0ed9ba5](https://github.com/11273/QzonePhoto/commit/0ed9ba55a7ed5a0d2bacc959613ae6d87d2f7f33))

### 🔧 Continuous Integration | CI 配置

* action ([d4ead00](https://github.com/11273/QzonePhoto/commit/d4ead003af97d4dcd75de5de9bbd6e5c2449bf28))
* ref_name ([71a1d24](https://github.com/11273/QzonePhoto/commit/71a1d24eb1a8775d034c2b6209b50df02fad5f79))

### 🔨 CONFIG | 配置

* 打包配置优化 ([cace14d](https://github.com/11273/QzonePhoto/commit/cace14d6c2abfcd31b7c92e5253ebb758438c69b))
* 打包配置优化 note ([d65b76e](https://github.com/11273/QzonePhoto/commit/d65b76e93f3dafdbef41ae1cd9c1294e49b83ee6))
* 构建名称问题 ([a787b5e](https://github.com/11273/QzonePhoto/commit/a787b5e03b3d6a1cda5e0b12c42c48bada777d90))
