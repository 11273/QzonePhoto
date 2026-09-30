# 🎉 Release v2.8.0

[![总下载量](https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github&color=blue)](https://github.com/11273/QzonePhoto/releases/tag/v2.8.0) [![下载统计](https://img.shields.io/github/downloads/11273/QzonePhoto/v2.8.0/total?style=flat-square&logo=github&color=green)](https://github.com/11273/QzonePhoto/releases/tag/v2.8.0) [![访问统计](https://komarev.com/ghpvc/?username=11273-QzonePhoto-v2-8-0&label=Views&color=brightgreen&style=flat-square)](https://github.com/11273/QzonePhoto/releases/tag/v2.8.0)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.8.0) [![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/11273/QzonePhoto/releases/tag/v2.8.0) [![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/11273/QzonePhoto/releases/tag/v2.8.0)

---

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