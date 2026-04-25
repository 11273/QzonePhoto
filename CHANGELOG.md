# Changelog

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

## [2.2.2](///compare/v2.2.1...v2.2.2) (2026-04-23)

### 🐛 Bug Fixes | Bug 修复

* macOS 打包走 ad-hoc 递归重签，修复 Tahoe 下启动即崩 695c3a3
* 好友相册点问号不再请求 getAlbumQA，避免接口报错 bd99d4a

## [2.2.1](///compare/v2.2.0...v2.2.1) (2026-04-22)

### 🐛 Bug Fixes | Bug 修复

* 让 cgi_list_photo 获得稳定 qq_photo_key，根治批量下载/回翻预览的加密占位 cd420c2

### 🎫 Chores | 其他更新

* 修复 ESLint 报错与告警 7a0b92b

## [2.2.0](///compare/v2.1.0...v2.2.0) (2026-04-21)

### ✨ Features | 新功能

* 好友隐藏数据展示与动态流增强 da95815

### 🐛 Bug Fixes | Bug 修复

* 一键下载时保留上一次的 qq_photo_key，避免批量下载落入加密占位图 eaf76cc
* 好友QQ号脱敏显示，与自己的QQ号行为一致 724e11c
* 好友信息改为悬停头像展示，修复照片流快速切换竞态 f0c2842
* 好友模式下相册问答显示"仅相册主人可见"提示 647244c
* 好友模式下跳过相册问答API调用，避免触发登出 2e7c427
* 所有辅助API调用添加skipAuthCheck，防止偶发-3000触发登出 0ad15cc

### 🎫 Chores | 其他更新

* 更新 release.yml，优化 Node.js 和 pnpm 安装步骤 a7ce236
* 注释掉调试日志以清理代码 bb854d0

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

## [2.0.0](///compare/v1.6.0...v2.0.0) (2026-01-02)

### ✨ Features | 新功能

* 添加照片模块中的视频预览功能，优化视频播放体验，移除视频模块预览中的隐私模式相关样式 7b71ed5
* 添加视频模块，支持获取视频列表和播放功能，优化视频统计信息展示 ba3ca96
* 添加获取QQ空间动态和删除动态功能，优化相册模块切换体验 4f97093
* 添加隐私模式支持，媒体项增加隐私遮罩和模糊效果，优化用户隐私保护体验 e736676
* 添加隐私模式支持，视频卡片和播放器增加隐私遮罩，优化用户隐私保护体验 d36035e

### 🎫 Chores | 其他更新

* 更新LOGO，优化视觉效果 3934b4d

## [1.6.0](///compare/v1.5.0...v1.6.0) (2025-12-16)

### ✨ Features | 新功能

* 添加QQ号脱敏显示功能，支持点击切换显示状态 9a0f35c

### 🐛 Bug Fixes | Bug 修复

* 优化相册名称生成逻辑，添加时间戳和ID后缀以减少冲突 3e58e74
* 强制指定模式以确保数据完整性，更新相册列表获取参数 064b9be
* 更新存储空间显示逻辑，修改标签为“已用容量” 4141a7c
* 获取用户昵称时中文乱码 043038a

## [1.5.0](///compare/v1.4.0...v1.5.0) (2025-12-16)

### ✨ Features | 新功能

* 按创建时间排序相册列表 d1a5a60
* 更新相册信息展示，添加存储空间显示功能并优化格式化逻辑 00698f2
* 添加定时刷新本地账号列表功能，优化登录体验 de77e4a

### 🐛 Bug Fixes | Bug 修复

* 更新相册分类名称为“其他”，优化滚动处理逻辑以支持防抖和动画状态管理 d962a7e

### ♻ Code Refactoring | 代码重构

* 重构相册列表获取功能的参数支持，优化相册数据加载逻辑 7cc2803

## [1.4.0](///compare/v1.3.0...v1.4.0) (2025-12-15)

### ✨ Features | 新功能

* 更换视频元数据提取功能，支持获取视频时长和封面 2c309d1
* 添加相册类型文本映射与展示，优化相册信息布局 2d91957

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
