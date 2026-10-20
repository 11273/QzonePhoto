# 🎉 Release v2.9.0

[![总下载量](https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github&color=blue)](https://github.com/11273/QzonePhoto/releases/tag/v2.9.0) [![下载统计](https://img.shields.io/github/downloads/11273/QzonePhoto/v2.9.0/total?style=flat-square&logo=github&color=green)](https://github.com/11273/QzonePhoto/releases/tag/v2.9.0) [![访问统计](https://komarev.com/ghpvc/?username=11273-QzonePhoto-v2-9-0&label=Views&color=brightgreen&style=flat-square)](https://github.com/11273/QzonePhoto/releases/tag/v2.9.0)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.9.0) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.9.0) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/11273/QzonePhoto/releases/tag/v2.9.0)

---

## 🍎 macOS 首次打开

当前安装包尚未完成 Apple 开发者签名与公证。请只在确认来自[唯一官网](https://qzonephoto.getgit.one/)或本仓库 Release、且信任此来源后继续。

1. **选对安装包**：在“ → 关于本机”查看芯片；Apple 芯片选 arm64，Intel 选 x64。
2. **安装到应用程序**：退出正在运行的旧版，打开 DMG，把“企鹅相册”拖进“应用程序”；更新时选择替换。不要直接在 DMG 中运行。
3. **首次打开被拦截时**：先在“应用程序”中双击一次，再进入“系统设置 → 隐私与安全性”，向下找到“企鹅相册”的拦截提示，选择“仍要打开”，按系统提示确认。

macOS 15 及以上不能再通过右键放行；较早系统可尝试按住 Control 点按（或右键点按）应用，选择“打开”。授权后通常可直接双击启动，替换版本后可能需要重新确认。

若提示“已损坏”或“将损坏电脑”，请停止打开，重新从官方来源下载并反馈；不要关闭系统安全保护。没有“仍要打开”时，请先尝试启动一次；受管理的电脑可能需要联系管理员。

[完整安装帮助](https://qzonephoto.getgit.one/privacy/#macos-first-open) · [Apple 官方说明](https://support.apple.com/zh-cn/102445)。不需要在终端输入命令。

## [2.9.0](https://github.com/11273/QzonePhoto/compare/v2.8.0...v2.9.0) (2026-10-20)

### ✨ Features | 新功能

* **album:** 优化侧栏信息与相册展示 ([45c30d7](https://github.com/11273/QzonePhoto/commit/45c30d7d03427d3c52faec6e6378a294d996baeb))
* **data:** 补充空间访客与内容数据 ([81f4be9](https://github.com/11273/QzonePhoto/commit/81f4be933cb19a5140800913cad97123d727e34a))
* **download-ui:** 优化任务布局并支持本地媒体预览 ([36cbc5f](https://github.com/11273/QzonePhoto/commit/36cbc5fe01cd909b22ca24916b1d4b4807364f11))
* **feedback:** 支持查看设备反馈回复 ([23b2c81](https://github.com/11273/QzonePhoto/commit/23b2c81a3b7a9333e2767f2e99a26256e532fe08))
* **feedback:** add private conversation center ([29370c6](https://github.com/11273/QzonePhoto/commit/29370c68dd173296b502ca4effc8595c9be4c648))
* **feeds:** 支持动态置顶与删除 ([a980db8](https://github.com/11273/QzonePhoto/commit/a980db8d7f44f4d6b7e66c3e089ba07846806eb6))
* **photo:** 支持框选和连续选择照片 ([7e9cf77](https://github.com/11273/QzonePhoto/commit/7e9cf77da4e83461aff6e6a4def4cf2be6f85374))
* **ui:** 优化动态数据与媒体预览体验 ([1b6b44c](https://github.com/11273/QzonePhoto/commit/1b6b44c6b489939d232f52e3badf1e9d39099b6c))
* **upload:** 支持 HEIC 本地转换上传 ([9a0f6e8](https://github.com/11273/QzonePhoto/commit/9a0f6e805f3f5bd8e0b612293b8013d311e6c373)), closes [#55](https://github.com/11273/QzonePhoto/issues/55)

### 🐛 Bug Fixes | Bug 修复

* **album:** 同步刷新后的照片数量 ([85ac8aa](https://github.com/11273/QzonePhoto/commit/85ac8aa0c32f764cfbec424e8bfe23db1e79156a))
* **ci:** 修复 Electron 回归脚本在 Linux 下的路径解析 ([0fd14bd](https://github.com/11273/QzonePhoto/commit/0fd14bd90bbf910a5545ce974659c7f7a79a06d9))
* **content:** 完善接口失败与空状态提示 ([9943ed3](https://github.com/11273/QzonePhoto/commit/9943ed318762ea627a9f0a0d0a5bfa0f7ee93336))
* **content:** 完善数据读取状态与错误提示 ([f534f5c](https://github.com/11273/QzonePhoto/commit/f534f5cf3da7a68f3015fd69631883f1599698a2))
* **download:** 稳定任务状态统计与实时进度更新 ([487b2fc](https://github.com/11273/QzonePhoto/commit/487b2fc34d8e95d508c019cf5123c2e1870d7384))
* **download:** correct batch speed reporting and prevent progress color flicker ([#56](https://github.com/11273/QzonePhoto/issues/56)) ([bdad9dd](https://github.com/11273/QzonePhoto/commit/bdad9ddb3cd483f622c27e40af15957978f2943b))
* **feedback:** 修复反馈页签切换卡住 ([872623c](https://github.com/11273/QzonePhoto/commit/872623cdc579ffd8f57024d836137115d099352e))
* **feeds:** 区分往年边界检查与真实加载失败 ([21dc731](https://github.com/11273/QzonePhoto/commit/21dc73134b3c0f81215e67167df009813d2bb405))
* **feeds:** 修复日志列表请求失败与乱码提示 ([e64e53b](https://github.com/11273/QzonePhoto/commit/e64e53b6e4afe72ff627625bfe746d9355f3b905))
* **feeds:** 修正动态游标分页提前结束 ([24eda90](https://github.com/11273/QzonePhoto/commit/24eda9093de494a3fa05d04ef376ef36c4773f13))
* **feeds:** 正确识别官方删除成功响应 ([dab5857](https://github.com/11273/QzonePhoto/commit/dab5857e2804d0d2c0c61e368e32c416bfa8b83b))
* **ipc:** 修复登录状态判定与跨桥错误传递 ([599090a](https://github.com/11273/QzonePhoto/commit/599090ae30798938cda3886c7420a2dc745325f5))
* **logging:** 限制日志体积并读取近期诊断片段 ([8085c53](https://github.com/11273/QzonePhoto/commit/8085c538856fd59d4da4d133cc67e45c09231f3a))
* **notice:** 静默处理后台断连并合并退避重试 ([81093fe](https://github.com/11273/QzonePhoto/commit/81093fe448ee088810875c9f11a63dbd0e74d9e8))
* **photo:** 正确提示旧相册访问限制 ([e40a950](https://github.com/11273/QzonePhoto/commit/e40a950a60e0b2a8bd0fa0131a32bf7c94782865))
* **release:** 使用明确的 Cloudflare 区域 ([10881ea](https://github.com/11273/QzonePhoto/commit/10881ead2342fa6f10c440f1011c71b6d2955ca1))
* **release:** 修复无证书 macOS 包启动 ([73bc17f](https://github.com/11273/QzonePhoto/commit/73bc17fc93c4b87f98d57e6cfd82ae67801b562f)), closes [#53](https://github.com/11273/QzonePhoto/issues/53)
* **release:** 支持 R2 回退与安全覆盖 ([7d664a4](https://github.com/11273/QzonePhoto/commit/7d664a4e55d48b5997b6213f2be523ad10e61e2c))
* **release:** 支持手动清理覆盖缓存 ([d74b7ff](https://github.com/11273/QzonePhoto/commit/d74b7ffb3026074c44dbb193915f8fc63af5c891))
* **setting:** 修复“动态信息”设置失效的问题 ([#54](https://github.com/11273/QzonePhoto/issues/54)) ([04ebac8](https://github.com/11273/QzonePhoto/commit/04ebac84eaa8442b8ab8401e64600519778deec0))
* **update:** 以 GitHub 正式版本校验更新源 ([2467b7e](https://github.com/11273/QzonePhoto/commit/2467b7e0de2285e8af1d3edbb75c6a02f785e825))
* **website:** 完善下载状态与桌面端体验 ([50a4484](https://github.com/11273/QzonePhoto/commit/50a448486744bda11297d91ad0736ad1750355e3))

### ⚡ Performance Improvements | 性能优化

* **download:** 优化自适应并发与限流重试 ([2cd1b78](https://github.com/11273/QzonePhoto/commit/2cd1b78d9d5ba7a0d5667361fd071f6ca250488e))

### 💄 Styles | 代码格式

* **tasks:** 精简上传下载管理器状态布局 ([cafb3c5](https://github.com/11273/QzonePhoto/commit/cafb3c5d7b710e8b3f7cf6da076fbd456e3050cd))

### 🔧 Continuous Integration | CI 配置

* **pr:** 规范贡献提交流程与审查检查 ([c7f5706](https://github.com/11273/QzonePhoto/commit/c7f57064418a15df0fb385b8b03fe82078fb9961))