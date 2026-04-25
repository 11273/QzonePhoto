<div align="center">

<img src="resources/icon.png" alt="Qzone Photo" width="96" />

<h1>Qzone Photo</h1>

<p>把 QQ 空间的相册、视频、动态、好友列表通通带回本地，并按你想要的方式管理。</p>

<p>
  <a href="https://github.com/11273/QzonePhoto/releases/latest"><strong>📥 下载安装</strong></a>
  ·
  <a href="#-使用指南">使用指南</a>
  ·
  <a href="#-常见问题">常见问题</a>
  ·
  <a href="https://github.com/11273/QzonePhoto/issues">反馈</a>
</p>

<p>
  <img src="https://img.shields.io/github/v/release/11273/QzonePhoto?style=flat-square&logo=github" alt="release" />
  <img src="https://img.shields.io/github/downloads/11273/QzonePhoto/total?style=flat-square&logo=github" alt="downloads" />
  <img src="https://img.shields.io/github/stars/11273/QzonePhoto?style=flat-square&logo=github" alt="stars" />
  <img src="https://img.shields.io/badge/platform-Win%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="platform" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" />
</p>

</div>

---

## 简介

Qzone Photo 是一个跨平台的 QQ 空间桌面客户端，复用 QQ 空间网页端官方接口完成登录与数据获取，所有数据仅在本地处理。如果你在意空间里那些舍不得删的青春、合影、视频，这个工具能帮你把它们安全带回来——也能反向上传你电脑里的本地照片。

## 截图

<table>
  <tr>
    <td><img src="screenshots/photo.png" alt="相册视图" /></td>
    <td><img src="screenshots/photo-view.png" alt="动态时间线" /></td>
  </tr>
  <tr>
    <td align="center">相册视图：5 项 StatCard、灰字权限、按分类的相册菜单</td>
    <td align="center">动态时间线：来源 / 媒体 / 年份筛选 + 实时聚合统计</td>
  </tr>
  <tr>
    <td><img src="screenshots/video-view.png" alt="视频网格" /></td>
    <td><img src="screenshots/friend.png" alt="好友抽屉" /></td>
  </tr>
  <tr>
    <td align="center">视频网格：6 项 stats（含磁盘配额条）+ 时长 / 年份 / 排序</td>
    <td align="center">好友抽屉：真实 QQ 分组 + 亲密度榜 + 搜索 + 右键复制 QQ 号</td>
  </tr>
  <tr>
    <td><img src="screenshots/download.png" alt="下载管理" /></td>
    <td><img src="screenshots/upload.png" alt="上传管理" /></td>
  </tr>
  <tr>
    <td align="center">下载管理：并发数 / 跳过重复 / 任务状态分类筛选</td>
    <td align="center">上传管理：相册筛选 / 状态筛选 / 整体进度 / 实时速度</td>
  </tr>
</table>

> 截图均开启隐私模式 + 二次打码处理（好友昵称 / 头像 / 评论作者 / 访客名），仅供 UI 展示。

## ✨ 主要功能

### 📥 下载

- 一键下载全部相册或选择性下载，支持批量任务
- 自动获取原图分辨率，照片视频混合下载
- 断点续传：意外中断后自动跳过已下载的文件
- 自动按 `QQ号 / 相册名 /` 整理目录

### 📤 上传

- 拖拽 / 多选本地文件，支持照片和视频
- 选择目标相册或新建相册，实时进度
- 显示磁盘配额进度条 + 今日上传剩余配额（来自空间官方接口）

### 👥 好友 / 访客

- **真实好友分组**：直接拉 QQ 好友分组（不只是亲密度榜），按 uin 自动去重
- **三视角并存**：分组 / 我在意谁 / 谁在意我，按需切换
- **好友空间**：一键切换上下文，下载好友相册，渲染好友的动态时间线
- **相册访客**：每个相册独立的总访客 / 今日新增 / 最近访客头像与时间

### 🎨 浏览体验

- **暗色主题**：背景层级 / 边框 / 文本灰阶 / 主题色全部走 CSS 变量统一管理
- **隐私模式**：右上角一键全屏模糊，分享屏幕不漏内容
- **一键复制**：QQ 号 / 相册问题 / 答案 / 相册 ID / 版本号 / 访客 QQ 号 全部点击或右键即可复制
- **统一权限弹层**：标题旁灰字 `N 张 / 权限文案 ▾`，点开看完整问答 + 允许的功能 + 朋友圈范围

## 🚀 安装

### 直接下载（推荐）

| 平台 | 下载文件 | 备注 |
|---|---|---|
| Windows | `*-win-x64-setup.exe` | 64 位（主流）|
| Windows | `*-win-ia32-setup.exe` | 32 位老电脑 |
| macOS | `*-mac-arm64.dmg` | M 系列 Apple Silicon |
| macOS | `*-mac-x64.dmg` | Intel 芯片 |
| Linux | `*-linux-x86_64.AppImage` | 通用版（`chmod +x` 后双击）|
| Linux | `*-linux-amd64.deb` | Ubuntu / Debian 系 |

**[👉 前往最新版本](https://github.com/11273/QzonePhoto/releases/latest)**

> Windows 提示安全警告 → "更多信息 → 仍要运行"。
> macOS 提示未验证 → 系统设置 → 隐私与安全性 → 仍要打开。

### 从源码运行

```bash
git clone https://github.com/11273/QzonePhoto.git
cd QzonePhoto
pnpm install
pnpm dev          # 开发模式（热重载）
pnpm build:mac    # / build:win / build:linux 打包
```

> 需要 Node.js ≥ 18 + pnpm。

## 📖 使用指南

1. **登录**：扫码登录或使用本地 QQ 账号一键登录
2. **浏览**：进入相册看权限、访客、StatCard；切到「照片 / 视频」tab 看时间线和网格
3. **下载**：勾选要下载的相册 → 「下载相册」；任务在底部「下载管理」里追踪
4. **上传**：进入相册 → 「上传照片」 → 拖入文件；任务在「上传管理」里追踪
5. **好友空间**：底部「好友」抽屉 → 点头像进入对方空间，所有页面自动切上下文

## 📁 文件保存路径

```text
[默认照片目录]/QzonePhoto/
├── <你的 QQ 号>/
│   ├── <相册名>/
│   │   ├── 照片.jpg
│   │   └── 视频.mp4
│   └── 好友相册/
│       └── <好友 QQ 号>/<相册名>/
│           └── ...
```

| 平台 | 默认路径 |
|---|---|
| Windows | `C:\Users\<用户>\Pictures\QzonePhoto\` |
| macOS | `~/Pictures/QzonePhoto/` |
| Linux | `~/Pictures/QzonePhoto/` |

> 可在「下载管理 → 更改位置」自定义。

## 🔐 安全与合规

- 直接调用 QQ 空间官方接口，无第三方服务器中转
- 所有 cookie / p_skey / 文件全部仅在本地存储和处理
- 代码全开源，任意时刻可审查
- **请仅下载你有权限访问的内容**，下载内容仅供个人使用，遵守相关法律法规

## 🔍 常见问题

<details>
<summary><strong>能下载好友的相册吗？</strong></summary>

可以。支持下载好友的公开相册以及你有权限查看的（QQ 好友可见、已通过的回答问题相册等）。仅自己可见、密码相册等会自动跳过。
</details>

<details>
<summary><strong>下载速度很慢怎么办？</strong></summary>

1. 降低并发数到 1–2（下载管理 → 并发数）
2. 检查网络稳定性，避开高峰期
3. 关闭其他占网络的程序
</details>

<details>
<summary><strong>登录失败怎么办？</strong></summary>

1. 确认 QQ 在手机上能正常用
2. 重新扫码或重启应用
3. 本地登录失败时确认电脑端 QQ 已登录
</details>

<details>
<summary><strong>支持哪些文件格式？</strong></summary>

- **照片**：JPG / PNG / GIF / BMP / WEBP
- **视频**：MP4 / MOV / AVI（QQ 空间转码后通常为 MP4）
</details>

<details>
<summary><strong>我自己电脑上的 QQ 头像没显示？</strong></summary>

第一次登录时有可能 cookie 还没建立。退出重登一次，或者刷新页面（Ctrl/Cmd + R）。
</details>

## 🤝 反馈与贡献

- 🐛 [Issues](https://github.com/11273/QzonePhoto/issues) — 反馈 bug、建议新功能
- 💬 [Discussions](https://github.com/11273/QzonePhoto/discussions) — 经验交流
- ⭐ Star 一下这个项目支持作者持续迭代

[![Stargazers over time](https://starchart.cc/11273/QzonePhoto.svg)](https://github.com/11273/QzonePhoto)

## 📄 许可证

[MIT License](LICENSE) — 自由使用、修改、分发，无商业限制。

---

<div align="center">

<sub>Made with ❤️ — 让美好回忆永远陪伴你</sub>

</div>
