import { app } from 'electron'
import { join } from 'path'

/**
 * AI 模型配置中心
 * 简化版：仅用于 AI 模型下载路径管理
 */
export const AI_CONFIG = {
  // 基础目录: .../AppData/YourApp/ai-models
  baseDir: join(app.getPath('userData'), 'ai-models'),

  // 镜像源
  mirrors: ['https://hf-mirror.com', 'https://huggingface.co']
}
