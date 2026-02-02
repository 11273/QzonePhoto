import { app } from 'electron'
import { join } from 'path'

/**
 * AI 模型配置中心
 * 简化版：仅用于 CLIP ONNX 模型下载路径管理
 */
export const AI_CONFIG = {
  // 基础目录: .../AppData/YourApp/ai-models
  baseDir: join(app.getPath('userData'), 'ai-models'),

  // 镜像源
  mirrors: ['https://hf-mirror.com', 'https://huggingface.co'],

  // CLIP 模型配置
  clip: {
    id: 'Xenova/clip-vit-base-patch16',
    saveDir: 'clip', // 存到 ai-models/clip
    fileList: ['onnx/vision_model_quantized.onnx', 'onnx/text_model_quantized.onnx']
  }
}
