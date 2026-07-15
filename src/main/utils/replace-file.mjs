import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const pathExists = (filePath) =>
  fs.promises
    .access(filePath)
    .then(() => true)
    .catch(() => false)

/**
 * 用同目录临时文件替换目标文件，并在 Windows 不允许覆盖 rename 时保留回滚路径。
 * 调用方负责创建与清理 tempPath；替换失败时原文件会尽量恢复，备份也不会被主动删除。
 */
export const replaceFileSafely = async (tempPath, targetPath) => {
  const originalStat = await fs.promises.stat(targetPath).catch(() => null)
  if (!originalStat) {
    await fs.promises.rename(tempPath, targetPath)
    return
  }

  const backupPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${crypto.randomUUID()}.backup`
  )
  let originalMoved = false
  let replacementMoved = false

  try {
    await fs.promises.rename(targetPath, backupPath)
    originalMoved = true
    await fs.promises.rename(tempPath, targetPath)
    replacementMoved = true
    await fs.promises.chmod(targetPath, originalStat.mode)
    await fs.promises.unlink(backupPath)
    originalMoved = false
  } catch (error) {
    if (replacementMoved) await fs.promises.unlink(targetPath).catch(() => {})
    if (originalMoved && (await pathExists(backupPath))) {
      try {
        await fs.promises.rename(backupPath, targetPath)
        originalMoved = false
      } catch (restoreError) {
        error.message = `${error.message}；原文件保留在 ${backupPath}，自动恢复失败：${restoreError.message}`
      }
    }
    throw error
  }
}
