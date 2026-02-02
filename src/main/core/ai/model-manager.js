import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import logger from '@main/core/logger'
import { AI_CONFIG } from '@main/ai/model-config'

/* --------------------------------------------------
 * 常量配置
 * -------------------------------------------------- */
/** CLIP 必需的配置文件列表 */
const CLIP_CONFIG_FILES = [
  'config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'vocab.json',
  'merges.txt'
]

/** 配置文件最小体积 (bytes) - 用于完整性校验 */
const MIN_CONFIG_FILE_SIZE = 100

/**
 * AI 模型管理器
 * 负责模型文件的检查、校验与配置修复
 */
export class ModelManager {
  /**
   * 检查模型文件完整性
   * @returns {Promise<{complete: boolean, reason?: string, clipPath?: string}>}
   */
  static async checkModelIntegrity() {
    const { baseDir, clip } = AI_CONFIG
    const clipDir = join(baseDir, clip.saveDir)
    const fileList = clip.fileList || [clip.fileName]

    // 检查所有模型文件
    for (const fileName of fileList) {
      const clipModelPath = join(clipDir, fileName)

      // 检查 1：模型文件是否存在
      if (!fs.existsSync(clipModelPath)) {
        return { complete: false, reason: `CLIP 模型文件不存在: ${fileName}` }
      }

      // 检查 2：模型文件大小是否合理（至少 1MB）
      const stats = fs.statSync(clipModelPath)
      if (stats.size < 1024 * 1024) {
        return { complete: false, reason: `CLIP 模型文件损坏或不完整: ${fileName}` }
      }
    }

    // 检查 3：关键配置文件是否存在
    const criticalConfigs = ['config.json', 'tokenizer.json', 'preprocessor_config.json']
    for (const configFile of criticalConfigs) {
      const configPath = join(clipDir, configFile)
      if (!fs.existsSync(configPath)) {
        return { complete: false, reason: `缺少配置文件: ${configFile}` }
      }
      const configStats = fs.statSync(configPath)
      if (configStats.size < MIN_CONFIG_FILE_SIZE) {
        return { complete: false, reason: `配置文件损坏: ${configFile}` }
      }
    }

    return { complete: true, clipPath: clipDir }
  }

  /**
   * 检查模型状态（用于 UI 展示）
   */
  static async checkModels() {
    const { baseDir, clip } = AI_CONFIG
    await this.ensureClipConfigs()

    const clipDir = join(baseDir, clip.saveDir)
    const fileList = clip.fileList || [clip.fileName]

    let exists = true
    let needsDownload = false

    for (const fileName of fileList) {
      const clipModelPath = join(clipDir, fileName)
      if (!fs.existsSync(clipModelPath)) {
        exists = false
        needsDownload = true
        break
      } else {
        const stats = fs.statSync(clipModelPath)
        if (stats.size === 0) {
          exists = false
          needsDownload = true
          break
        }
      }
    }

    return {
      data: {
        exists,
        modelPath: baseDir,
        clipPath: join(baseDir, clip.saveDir),
        userDataPath: app.getPath('userData'),
        needsDownload
      }
    }
  }

  /**
   * 确保 CLIP 配置文件就位
   * @private
   */
  static async ensureClipConfigs() {
    const sourceDir = app.isPackaged
      ? join(process.resourcesPath, 'app.asar/out/renderer/models/clip-base')
      : join(process.cwd(), 'src/renderer/public/models/clip-base')

    const { baseDir, clip } = AI_CONFIG
    const targetDir = join(baseDir, clip.saveDir)

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    for (const file of CLIP_CONFIG_FILES) {
      const srcFile = join(sourceDir, file)
      const destFile = join(targetDir, file)

      if (!fs.existsSync(destFile) && fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile)
        logger.info(`[ModelManager] 复制配置: ${file}`)
      } else if (fs.existsSync(destFile)) {
        // 简单完整性检查
        const stat = fs.statSync(destFile)
        if (stat.size < MIN_CONFIG_FILE_SIZE && fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile)
          logger.info(`[ModelManager] 修复配置: ${file}`)
        }
      }
    }
  }
}
