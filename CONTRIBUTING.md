# 贡献指南

感谢你为企鹅相册（QzonePhoto）贡献代码、文档和反馈。

## 开始前

1. 先搜索现有 Issues，避免重复工作；较大的功能请先创建 Issue 说明目标和方案。
2. Fork 仓库，并从最新的 `main` 创建一个主题明确的分支，例如 `fix/download-retry`。
3. 请勿提交 cookie、p_skey、QQ 号、真实媒体、访问令牌、日志或任何个人信息。

## 本地开发

```bash
pnpm install
pnpm dev
```

提交 Pull Request 前，请运行：

```bash
pnpm lint
pnpm build
```

## Pull Request 要求

- 一个 PR 只解决一个明确问题，避免夹带无关重构或格式化。
- 使用 PR 模板说明变更目的、验证方式，以及 UI 变化的截图或录屏。
- 修改下载、上传、登录、更新、文件路径、Electron IPC 或隐私数据处理时，请解释失败路径和安全影响。
- 所有自动检查必须通过；维护者会结合人工审核和 AI 审核意见决定是否合并。
- 合并采用 squash merge；合并后源分支会自动删除。

## 提交建议

建议使用简洁的前缀：`feat:`、`fix:`、`docs:`、`refactor:`、`chore:` 或 `test:`。
