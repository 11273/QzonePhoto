import fg from 'fast-glob'
import path from 'path'
import { getTable } from './database'
import logger from '@main/core/logger'
import { AI_EXTENSIONS } from '@shared/const'
import crypto from 'crypto'

/**
 * 同步指定的文件夹列表 (账实相符)
 * 逻辑：只点名，看文件在不在，改没改。不读内容。
 */
export async function syncFolders(folderPaths) {
  logger.info(`[Scanner] 启动轻量点名同步, 路径列表: ${JSON.stringify(folderPaths)}`)
  const table = getTable()

  // 1. 获取数据库中已有的所有文件路径和修改时间
  let existingRecords = []
  try {
    // 假设数据库已经有了 mtime 字段 (schema 已更新)
    existingRecords = await table.query().select(['path', 'mtime']).toArray()
  } catch (error) {
    logger.error('[Scanner] 查询现有记录失败:', error)
  }

  // Map: path -> mtime
  const dbRecordMap = new Map()
  existingRecords.forEach((r) => dbRecordMap.set(r.path, r.mtime || 0))

  const diskPathSet = new Set()

  let newCount = 0
  let modifiedCount = 0
  const tasksToAdd = []
  const tasksToUpdate = [] // 存放需要重置的文件路径

  // 2. 扫描磁盘文件 (只读 Stats)
  for (const folder of folderPaths) {
    logger.info(`[Scanner] 📂 开始扫描目录: ${folder}`)
    try {
      const pattern = `**/*.{${AI_EXTENSIONS.SCAN_TARGETS.join(',')}}`
      const entries = await fg([pattern], {
        cwd: folder,
        absolute: true,
        caseSensitiveMatch: false,
        stats: true, // 获取文件状态 (mtime)
        ignore: ['**/node_modules/**', '**/.*'],
        followSymbolicLinks: true // 跟随符号链接
      })

      logger.info(`[Scanner] 🔍 目录 [${folder}] 扫描完成，匹配文件数: ${entries.length}`)

      for (const entry of entries) {
        const filePath = entry.path
        const stats = entry.stats
        const mtime = stats ? stats.mtimeMs : Date.now()
        const size = stats ? stats.size : 0
        diskPathSet.add(filePath)

        // 生成基于 FilePath + Size + mtime 的稳定 ID
        const fileId = generateHashId(filePath, size, mtime)

        if (!dbRecordMap.has(filePath)) {
          // A. 发现新文件 -> 录入名单
          tasksToAdd.push({
            id: fileId,
            path: filePath,
            folder: folder,
            status: 'pending',
            vector: Array(512).fill(0),
            faces: '[]',
            timestamp: mtime,
            mtime: mtime,
            width: 0,
            height: 0,
            thumbnail: ''
          })
          newCount++
          // logger.debug(`[Scanner] [NEW] ${filePath}`)
        } else {
          // B. 检查名单里的文件是否“变了样”
          const dbMtime = dbRecordMap.get(filePath)
          // 容差 100ms
          if (Math.abs(mtime - dbMtime) > 100) {
            modifiedCount++
            tasksToUpdate.push({ path: filePath, mtime })
            logger.debug(`[Scanner] [MODIFIED] ${filePath}`)
          }
        }
      }
    } catch (err) {
      logger.error(`[Scanner] ❌ 扫描目录失败: ${folder}`, err)
    }
  }

  logger.info(
    `[Scanner] 📊 扫描阶段结束。待新增: ${tasksToAdd.length}, 待更新: ${tasksToUpdate.length}, 磁盘总文件数: ${diskPathSet.size}`
  )

  // 3. 处理新增
  if (tasksToAdd.length > 0) {
    try {
      await table.add(tasksToAdd)
      logger.info(`[Scanner] ✅ 数据库写入成功: 新增 ${tasksToAdd.length} 项`)
    } catch (err) {
      logger.error('[Scanner] ❌ 数据库写入失败 (Add):', err)
    }
  }

  // 4. 处理修改 -> 重置为待处理
  if (tasksToUpdate.length > 0) {
    try {
      for (const task of tasksToUpdate) {
        const escapedPath = task.path.replace(/'/g, "\\'")
        await table.update({
          where: `path = '${escapedPath}'`,
          values: {
            status: 'pending',
            mtime: task.mtime,
            timestamp: task.mtime,
            vector: Array(512).fill(0)
          }
        })
      }
      logger.info(`[Scanner] 🔄 数据库更新成功: 已重置 ${tasksToUpdate.length} 项`)
    } catch (err) {
      logger.error('[Scanner] ❌ 数据库更新失败 (Update):', err)
    }
  }

  // 5. 处理消失
  const pathsToRemove = []
  for (const [dbPath] of dbRecordMap) {
    if (!diskPathSet.has(dbPath)) {
      pathsToRemove.push(dbPath)
    }
  }

  if (pathsToRemove.length > 0) {
    try {
      for (const pathToRemove of pathsToRemove) {
        const escapedPath = pathToRemove.replace(/'/g, "\\'")
        await table.delete(`path = '${escapedPath}'`)
      }
      logger.info(`[Scanner] 🗑️ 数据库清理成功: 移除 ${pathsToRemove.length} 项 (文件已不存在)`)
    } catch (err) {
      logger.error('[Scanner] ❌ 数据库清理失败 (Delete):', err)
    }
  }

  logger.info(
    `[Scanner] ====== 同步总结: 新增 ${newCount}, 移除 ${pathsToRemove.length}, 修改 ${modifiedCount} ======`
  )

  return { newCount, deletedCount: pathsToRemove.length, modifiedCount }
}

/**
 * 索引单个文件 (动态入库)
 * @param {string} filePath 文件绝对路径
 * @param {string} folderPath 归属目录 (可选)
 * @returns {Promise<{success: boolean, type: 'new'|'modified'|'exists'|'error'}>}
 */
export async function indexSingleFile(filePath, folderPath = null) {
  try {
    if (!isSupportedImage(filePath)) {
      logger.debug(`[Scanner] [DYNAMIC] 🚫 文件类型不支持: ${filePath}`)
      return { success: false, type: 'error', message: 'Unsupported file type' }
    }

    const fs = await import('fs/promises')
    const stats = await fs.stat(filePath)
    if (!stats.isFile()) return { success: false, type: 'error' }

    const mtime = stats.mtimeMs
    const size = stats.size
    const table = getTable()

    // 1. 检查是否存在
    const existing = await table
      .query()
      .where(`path = '${filePath.replace(/'/g, "\\'")}'`)
      .select(['path', 'mtime'])
      .toArray()

    const fileId = generateHashId(filePath, size, mtime)

    if (existing.length === 0) {
      // A. 新文件
      await table.add([
        {
          id: fileId,
          path: filePath,
          folder: folderPath || path.dirname(filePath),
          status: 'pending',
          vector: Array(512).fill(0),
          faces: '[]',
          timestamp: mtime,
          mtime: mtime,
          width: 0,
          height: 0,
          thumbnail: ''
        }
      ])
      logger.info(`[Scanner] [DYNAMIC] ✅ 发现并入库新文件: ${filePath}`)
      return { success: true, type: 'new' }
    } else {
      // B. 检查更新
      const dbMtime = existing[0].mtime || 0
      if (Math.abs(mtime - dbMtime) > 100) {
        await table.update({
          where: `path = '${filePath.replace(/'/g, "\\'")}'`,
          values: {
            status: 'pending',
            mtime: mtime,
            timestamp: mtime,
            vector: Array(512).fill(0)
          }
        })
        logger.info(`[Scanner] [DYNAMIC] 🔄 检测到文件变更，已重置索引: ${filePath}`)
        return { success: true, type: 'modified' }
      }
    }

    return { success: true, type: 'exists' }
  } catch (err) {
    logger.error(`[Scanner] [DYNAMIC] ❌ 索引单文件失败: ${filePath}`, err)
    return { success: false, type: 'error' }
  }
}

/**
 * 生成基于文件元数据的唯一 ID
 * 公式: Hash(Path + Size + Mtime)
 * @param {string} filePath
 * @param {number} size
 * @param {number} mtime
 * @returns {string}
 */
function generateHashId(filePath, size, mtime) {
  const data = `${filePath}|${size}|${mtime}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * 助手方法：判断是否为 AI 支持的图片格式
 */
function isSupportedImage(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '')
  return AI_EXTENSIONS.SCAN_TARGETS.includes(ext)
}
