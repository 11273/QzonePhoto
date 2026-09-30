# Changelog

## [2.8.0](https://github.com/11273/QzonePhoto/compare/v2.7.0...v2.8.0) (2026-09-30)

### ✨ Features | 新功能

* **app:** 完善媒体浏览与联系人交互 ([2809a5b](https://github.com/11273/QzonePhoto/commit/2809a5b4e782c7e9117950790ac9530afd091447))
* **contacts:** 支持群成员浏览与联系人备份 ([a25690c](https://github.com/11273/QzonePhoto/commit/a25690c463d4db647be2bb76f3fd121371c7b732))
* **feeds:** 完善动态内容与日志访客浏览 ([3ca8296](https://github.com/11273/QzonePhoto/commit/3ca829624c3142238539ad10069a1c52f31b3c23)), closes [#50](https://github.com/11273/QzonePhoto/issues/50)
* **feeds:** 展示可获取的完整点赞与评论 ([310b6d4](https://github.com/11273/QzonePhoto/commit/310b6d4afe96b026435b4c32ef03f0dd65092fa9)), closes [#50](https://github.com/11273/QzonePhoto/issues/50)
* **feeds:** 支持复制完整动态内容 ([5f54232](https://github.com/11273/QzonePhoto/commit/5f542320b3055173ddb57ce0af1516a41075a9ed))
* **media:** 补齐视频悬停预览与播放回退 ([5a56b12](https://github.com/11273/QzonePhoto/commit/5a56b126ec056bdc54c75b450024d9f6aaa33de2))
* **media:** 优化照片视频浏览与状态反馈 ([aa2707b](https://github.com/11273/QzonePhoto/commit/aa2707b1709ba2c42c1cacebc265c15e2b72c756))
* **navigation:** 在桌面端打开用户空间 ([c4bd703](https://github.com/11273/QzonePhoto/commit/c4bd7033d4e71717f5bc5ac75ad23cfb13a48dd4))
* **tasks:** 重构上传下载与任务管理 ([62a63c5](https://github.com/11273/QzonePhoto/commit/62a63c5c3b66283ba8d41d7f7ccae542ebecda8d))
* **theme:** 统一节日主题与官网视觉 ([d853f8e](https://github.com/11273/QzonePhoto/commit/d853f8e5c3ad500270b5740bcb8965f43dca3e86))

### 🐛 Bug Fixes | Bug 修复

* **app:** 修复演示访客接口空值异常 ([89368de](https://github.com/11273/QzonePhoto/commit/89368de17587813a7de6c751134575422fbec25d))
* **contacts:** 保留联系人列表浏览位置 ([52aeb8f](https://github.com/11273/QzonePhoto/commit/52aeb8ffc9f0c5b51616627b2279ea3e1939cc75))
* **download:** 保留照片的原始时间 ([0107a35](https://github.com/11273/QzonePhoto/commit/0107a35b4fd1a49cc3d570d43899027d28b636a6))
* **download:** 避免动态发布时间覆盖照片 EXIF ([9387d8b](https://github.com/11273/QzonePhoto/commit/9387d8bbc383ef7eda2ee12246a882e97c29d73c))
* **download:** 下载目录使用标准 QQ 号 ([3fd19fa](https://github.com/11273/QzonePhoto/commit/3fd19fa8e227fe56bae2d7563845689ba1f6868a))
* **download:** 校验媒体内容并修正文件后缀 ([31f3b8a](https://github.com/11273/QzonePhoto/commit/31f3b8a18202d725e4a9af64541aa9e84cac3f2f))
* **feeds:** 按官方评论结构保留回复内容 ([5798a61](https://github.com/11273/QzonePhoto/commit/5798a61ffeff799754c3ceb331941ea86471381e)), closes [#50](https://github.com/11273/QzonePhoto/issues/50)
* **feeds:** 保留接口返回的全部点赞用户 ([7ec2ffa](https://github.com/11273/QzonePhoto/commit/7ec2ffa205a52d05625dcf9500b7201915deae54))
* **feeds:** 补齐点赞者和评论回复展示 ([d209ba3](https://github.com/11273/QzonePhoto/commit/d209ba317e0bc9b6b5414acb0f1ce6b9013bd019)), closes [#50](https://github.com/11273/QzonePhoto/issues/50)
* **feeds:** 完善互动名单与内容状态 ([ef4949e](https://github.com/11273/QzonePhoto/commit/ef4949e1d89f0449cb5989c4a7ef31013bc5c744))
* **linux:** 完善 AppImage 离线启动兼容 ([fff21f8](https://github.com/11273/QzonePhoto/commit/fff21f843e3ebaad5e489dae3c6d576b8b7f07c8))
* **linux:** 完善 AppStream 元数据 ([08642df](https://github.com/11273/QzonePhoto/commit/08642df78e763b978f3c32d4d2fd062c562d2556))
* **login:** 统一账号登录加载状态 ([44351d9](https://github.com/11273/QzonePhoto/commit/44351d9bbf06bebebc893b98706907b8c186cd3e))
* **login:** 优化退出登录过渡状态 ([06b0877](https://github.com/11273/QzonePhoto/commit/06b0877b332f536bad9667ca04844fecdf3113a8))
* **media:** 统一视频手动播放与音量偏好 ([f750e99](https://github.com/11273/QzonePhoto/commit/f750e99b23fb28f7d6df0864adedf9b320dac0d7))
* **navigation:** 返回空间时保留列表和滚动位置 ([a9925ae](https://github.com/11273/QzonePhoto/commit/a9925ae0a3305ccc859fdf228a1648ae4a4e3b86))
* **pagination:** 分页失败后仍可继续加载 ([615ff0d](https://github.com/11273/QzonePhoto/commit/615ff0d6dd90851d04aa75789a9b084b9c05b0ab))
* **photo:** 修复单张下载与照片删除参数 ([26ca771](https://github.com/11273/QzonePhoto/commit/26ca77170c27461fc39257cb3cc8a1343d3c4d84))
* **release:** 加固发布说明与工作流校验 ([dcdc867](https://github.com/11273/QzonePhoto/commit/dcdc8670c973642999f1d3190cd845830c1562b2))
* **release:** 修复 R2 工作流依赖安装 ([e8d11c9](https://github.com/11273/QzonePhoto/commit/e8d11c960d674e554897ddfc6477b06d7b3c9948))
* **release:** 修复无证书时 macOS 构建 ([d3fa323](https://github.com/11273/QzonePhoto/commit/d3fa323dea19005158b8bab8c54ebbb5b595dcce))
* **release:** 修正 R2 覆盖脚本 ([f6b2b70](https://github.com/11273/QzonePhoto/commit/f6b2b7084d7671a0b4141ef58769e810710b3093))
* **release:** 支持重建未稳定发布 ([ab29932](https://github.com/11273/QzonePhoto/commit/ab299324c4d9557bc00ed15bef83b8e249664808))
* **tasks:** 完善传输进度与获取状态反馈 ([79886e2](https://github.com/11273/QzonePhoto/commit/79886e2f5520ae7a34475956995c4cd929d88cb9))
* **ui:** 优化容量说明提示 ([dfb7d4d](https://github.com/11273/QzonePhoto/commit/dfb7d4d24af5544a7d17394f7237fba6962936fd))

### 💄 Styles | 代码格式

* **album:** 统一相册弹窗与节日主题细节 ([3e92150](https://github.com/11273/QzonePhoto/commit/3e921506a18a889c00336b10c90265b01be6f83d))
* **ui:** 统一选中态与无障碍交互 ([a7fd13d](https://github.com/11273/QzonePhoto/commit/a7fd13dcab15241af623628f555b9c93587f78f5))

### 📝 Documentation | 文档

* **readme:** 补充联系人备份与新增功能说明 ([e63ed33](https://github.com/11273/QzonePhoto/commit/e63ed33f68ec91395368dd69484ed12922f1f782))
* **release:** 更新产品说明与演示截图 ([8653e6d](https://github.com/11273/QzonePhoto/commit/8653e6d162302e365c35caa10a72eb0677630233))

### 👷‍ Build System | 构建

* **release:** 强化发布校验与依赖安全 ([232860b](https://github.com/11273/QzonePhoto/commit/232860b34a1380cf92e8a95d35ff3fd86cefd3a3))

## [2.7.0](https://github.com/11273/QzonePhoto/compare/v2.6.0...v2.7.0) (2026-07-26)

### ✨ Features | 新功能

* **download:** 支持保留动态媒体信息 ([75145d9](https://github.com/11273/QzonePhoto/commit/75145d96205e355c2c6eeca5cbedf1fc8b985ec9))
* **download:** 支持保留动态图片文案 ([2822e74](https://github.com/11273/QzonePhoto/commit/2822e748046a4fdca4521d552c6d295e511fc3ad)), closes [#44](https://github.com/11273/QzonePhoto/issues/44)
* launch official website and harden releases ([870e8c4](https://github.com/11273/QzonePhoto/commit/870e8c491c9256a9f458f74d050875ce2968e496))
* **photo:** 支持批量复制动态图片链接 ([2fd2cfc](https://github.com/11273/QzonePhoto/commit/2fd2cfc9ba944cf24efe7ab6013a345e3b8305ce))
* **photo:** 支持批量复制图片链接 ([6d327ed](https://github.com/11273/QzonePhoto/commit/6d327edfbb8ac4b64b5e9961f95901132feb2b37)), closes [#42](https://github.com/11273/QzonePhoto/issues/42)
* **release:** 强化 R2 发布与安全更新流程 ([433dcae](https://github.com/11273/QzonePhoto/commit/433dcae54bd927e73eb47ad4b322d7331bd20d65))
* **release:** 完善更新链路与 R2 发布校验 ([a7244c6](https://github.com/11273/QzonePhoto/commit/a7244c68d193a0a19e725df1f5fb4a18e5ec8009))
* **update:** 优化更新体验与品牌展示 ([9539089](https://github.com/11273/QzonePhoto/commit/95390895f152c41ccbced2a2baadd2f756e9b2cc))
* **website:** 优化官网体验与检索 ([623f24e](https://github.com/11273/QzonePhoto/commit/623f24e1867bea81b4bb7b4e622fd3e12d923c48))
* **website:** 重构官网视觉与下载体验 ([64c9aa4](https://github.com/11273/QzonePhoto/commit/64c9aa4be388e063d5ff16d3c031a68b9c2603ce))

### 🐛 Bug Fixes | Bug 修复

* **app:** 修复更新检查与相册加载状态 ([2be5da7](https://github.com/11273/QzonePhoto/commit/2be5da73f8c673b129520fa252b64bed3048ce28))
* **brand:** optically center the legacy Z-star icon ([7f193b1](https://github.com/11273/QzonePhoto/commit/7f193b15316bc857bf857ec798ed9f60c2813f0b))
* **brand:** synchronize exact legacy transform outputs ([ec5c312](https://github.com/11273/QzonePhoto/commit/ec5c31288e5a015b7e5706790273ddef75ca7d65))
* **build:** 关闭 DMG 自动收缩 ([ad257d6](https://github.com/11273/QzonePhoto/commit/ad257d6025f826d21467ff035d4d77b43012db89))
* **login:** 修复代理环境启动空白 ([16aa589](https://github.com/11273/QzonePhoto/commit/16aa589ec8176828cf57050b58e92ab40f4fbefb))
* **release:** 复用已验证发布清单 ([98d5971](https://github.com/11273/QzonePhoto/commit/98d597116ced5507a19748064d69ecb7cc9d6a0e))
* **release:** 修复多架构更新元数据 ([66ca80d](https://github.com/11273/QzonePhoto/commit/66ca80d7a722d7fbf7446b12e6420ca85ee044db))
* **release:** 修复历史版本回退发布 ([8779b99](https://github.com/11273/QzonePhoto/commit/8779b99297b99f32b7c92723358a99b34c92111e))
* **release:** 支持稳定通道回退 ([81954d2](https://github.com/11273/QzonePhoto/commit/81954d2fa2185b77ce0350fb3dfd68945f5c9809))
* **security:** 使用随机令牌限制 qzone-local 文件访问 ([#45](https://github.com/11273/QzonePhoto/issues/45)) ([dddcae3](https://github.com/11273/QzonePhoto/commit/dddcae3d807b5985e1a4801b09b569ac71038d7b))
* **security:** 完善本地媒体访问限制 ([80f4e79](https://github.com/11273/QzonePhoto/commit/80f4e791545cce0ca84f36fb250c12dddafaa1a1))
* **security:** 延长本地媒体令牌并自动重试 ([5f85a9e](https://github.com/11273/QzonePhoto/commit/5f85a9e1790cb98ec4ee9f4055d3583ca4c5d5b0))
* **update:** 修复 R2 检查超时兜底 ([772356a](https://github.com/11273/QzonePhoto/commit/772356abd6ed8b5f7ae24cb0b489e8bef50dc9a9))
* **update:** 移除重复的重启安装入口 ([2e864cf](https://github.com/11273/QzonePhoto/commit/2e864cf8cf2ddb1ce771c5b1dfeaba5eab7f9aac))
* **update:** 优化更新来源与发布兜底 ([9b4e163](https://github.com/11273/QzonePhoto/commit/9b4e16362636a70aff63c828d9e89888c14e1456))
* **website:** 更新 Apple 芯片下载提示 ([ef74978](https://github.com/11273/QzonePhoto/commit/ef74978553e8f3dd01b0c90f0a01f1e73045a5b7))
* **website:** 统一版本选择边框 ([9201c59](https://github.com/11273/QzonePhoto/commit/9201c593693e4fee5d55536ca4e7ff7c63fabe7e))
* **website:** allow Cloudflare Analytics under CSP ([b5f9fa6](https://github.com/11273/QzonePhoto/commit/b5f9fa6616c7eb8807681050f092aba3bb67e083))

### 👷‍ Build System | 构建

* **mac:** 移除安装包目标的固定架构 ([592e8c8](https://github.com/11273/QzonePhoto/commit/592e8c81c5168d0243534a80ad59575f2e70a930))

### 🔧 Continuous Integration | CI 配置

* **actions:** 升级官方 Action 运行时 ([6552d1e](https://github.com/11273/QzonePhoto/commit/6552d1e280300fb2bd895a396500e80dd357516c))
* **github:** 完善 PR 检查与协作规范 ([9675a23](https://github.com/11273/QzonePhoto/commit/9675a23ba1651defa50d3d76191fd8c176ada51d))
* **release:** 拆分验证发布与 R2 同步 ([ab3cb46](https://github.com/11273/QzonePhoto/commit/ab3cb466ae32cb61f00ad3a78ce3337e8aa8ea90))
* **release:** 修复 32 位 Windows 构建依赖安装 ([42a9c7b](https://github.com/11273/QzonePhoto/commit/42a9c7b28d1a578df2ab23dc4894652d91a3768a))

### 🎫 Chores | 其他更新

* **config:** 停止跟踪环境变量文件 ([eeaba9a](https://github.com/11273/QzonePhoto/commit/eeaba9ace7ae037649a138f105642da7631de6aa))

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

## [2.5.0](///compare/v2.4.0...v2.5.0) (2026-06-06)

### ✨ Features | 新功能

* **feedback:** 新增应用内反馈入口 20e0afc
* **feeds:** 支持动态媒体下载和 QQ 号访问 4a2b5f0, closes #11 #12
* **notice:** 接入公告并优化分页重试 2ee6281
* **notice:** 优化公告中心体验 ebb0cbc
* **ui:** 收敛公告上报并优化更新提示 e634f3d
* **ui:** 优化反馈公告与标题栏体验 a29085c
* **upload:** 1GB 视频 / 默认原图 / 多文件并发 / 弹窗设计系统对齐 ([#10](undefined/undefined/undefined/issues/10)) 1b10013

### 💄 Styles | 代码格式

* **ui:** 调整 win 顶栏左右入口布局 0963f7f
* **ui:** 调整标题栏 GitHub 图标间距 b5c5486

### 💅 Polish | 优化

* 优化标题栏弹窗打开顺序 c0d24d9

## [2.4.0](///compare/v2.3.0...v2.4.0) (2026-05-07)

### ✨ Features | 新功能

* **photo:** 好友抽屉接入 QQ 号查询入口 + 按分组批量下载好友相册 fa4bcea

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
