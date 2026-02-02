import * as lancedb from '@lancedb/lancedb'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import logger from '@main/core/logger'

let dbInstance = null
let mainTable = null

export const TABLE_NAME = 'media_library'

/**
 * 初始化数据库
 * @returns {Promise<lancedb.Table>}
 */
export async function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'ai-db')

  // 确保存储目录存在
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true })
  }

  try {
    dbInstance = await lancedb.connect(dbPath)
    const tables = await dbInstance.tableNames()
    let shouldCreate = true

    if (tables.includes(TABLE_NAME)) {
      try {
        const tbl = await dbInstance.openTable(TABLE_NAME)
        // 检查 schema 是否包含 mtime
        // schema 可能是对象或 Arrow Schema。
        // 安全起见，尝试查询一条数据看是否有 mtime
        const sample = await tbl.query().limit(1).toArray()
        const hasMtime = sample.length > 0 && sample[0].mtime !== undefined
        // 如果表是空的，也可能 sample 是空。
        // 如果 schema 变更，且为了保证一致性，我们选择：
        // 如果 sample 存在但无 mtime -> 重建
        // 如果 sample 不存在 -> 可以直接由 createTable 如果我们 drop 的话。
        // 或者更简单的：如果表存在，我们假设 schema 正确吗？不，我们刚才就挂了。

        if (hasMtime || sample.length === 0) {
          mainTable = tbl
          shouldCreate = false
        } else {
          logger.warn(`[Database] 检测到旧 Schema (缺失 mtime)，正在重建表...`)
          // 删除旧表
          await dbInstance.dropTable(TABLE_NAME)
          shouldCreate = true
        }
      } catch (err) {
        logger.warn(`[Database] 打开表失败，可能本地文件不完整，尝试强制重建:`, err)
        // 强制清理目录内容尝试重新创建，或者直接尝试 drop
        try {
          await dbInstance.dropTable(TABLE_NAME)
        } catch (dropErr) {
          logger.error('[Database] Drop table failed during recovery:', dropErr)
        }
        shouldCreate = true
      }
    }

    if (shouldCreate) {
      logger.info(`[Database] 创建新表: ${TABLE_NAME}`)
      // 创建表结构。
      // 注意：Status 字段用于 Pipeline 状态流转: pending -> done | error
      mainTable = await dbInstance.createTable(TABLE_NAME, [
        {
          id: 'init_marker',
          path: 'init_marker',
          folder: 'init',
          status: 'error',
          vector: Array(512).fill(0.0),
          faces: '[]',
          timestamp: Date.now(),
          mtime: Date.now(), // 👈 新增：文件最后修改时间，用于增量同步检查
          width: 0,
          height: 0,
          thumbnail: ''
        }
      ])
      await mainTable.delete("path = 'init_marker'")
    }

    logger.info('[Database] 数据库就绪')
    return mainTable
  } catch (error) {
    logger.error('[Database] 初始化失败:', error)
    throw error
  }
}

/**
 * 获取表实例
 * @returns {lancedb.Table}
 */
export function getTable() {
  if (!mainTable) throw new Error('数据库未初始化！')
  return mainTable
}
