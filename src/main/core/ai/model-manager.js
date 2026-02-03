/**
 * AI 模型管理器 (仅保留人脸检测模型)
 */
export class ModelManager {
  /**
   * 检查模型文件完整性
   */
  static async checkModelIntegrity() {
    // 模型已废弃或转为按需加载，直接返回就绪
    return { complete: true }
  }

  /**
   * 检查模型状态
   */
  static async checkModels() {
    return {
      data: {
        exists: true,
        modelPath: '',
        needsDownload: false
      }
    }
  }

  /**
   * 确保配置文件就位
   */
  static async ensureConfigs() {
    // Do nothing
  }
}
