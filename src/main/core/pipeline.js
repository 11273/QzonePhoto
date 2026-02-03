import { IPC_AI } from '@shared/ipc-channels'

import { AiActionTypes } from '@shared/ai-ipc-channels'
import { getTable } from './database'
import logger from '@main/core/logger'

// 核心逻辑：单路流水线控制
export const Pipeline = {
  isRunning: false,
  shouldStop: false,

  /**
   * 启动处理流水线
   * @param {import('electron').BrowserWindow} mainWindow 用于发送进度的窗口 (兼容旧逻辑)
   * @param {Function} aiInvoker 调度接口
   * @param {Object} options 选项 { onProgress: Function }
   */
  async start(mainWindow, aiInvoker, options = {}) {
    if (this.isRunning) return
    this.isRunning = true
    this.shouldStop = false

    const table = getTable()
    const onProgress =
      options.onProgress ||
      ((data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_AI.SCAN_PROGRESS, data)
        }
      })

    try {
      // 1. 获取全局总数 (用于归一化进度百分比)
      const totalPendingRows = await table.query().where("status = 'pending'").toArray()
      const totalToProcess = totalPendingRows.length
      let processedCount = 0
      const BATCH_SIZE = 50

      logger.info(`[Pipeline] 🚀 开始全局分析, 总计待处理: ${totalToProcess}`)

      while (!this.shouldStop) {
        const pendingFiles = await table
          .query()
          .where("status = 'pending'")
          .limit(BATCH_SIZE)
          .toArray()

        if (pendingFiles.length === 0) break

        logger.info(
          `[Pipeline] 🔍 获取批次: ${pendingFiles.length} 项 (累计已处理: ${processedCount}/${totalToProcess})`
        )

        for (const file of pendingFiles) {
          if (this.shouldStop) break

          try {
            // A. 通知 UI
            onProgress({
              status: 'ANALYZING',
              current: processedCount + 1,
              total: totalToProcess,
              filePath: file.path,
              message: `正在分析 (${processedCount + 1}/${totalToProcess})`
            })

            // B. 调度 Worker
            const result = await aiInvoker(AiActionTypes.ANALYZE, { filePath: file.path })

            if (!result) {
              throw new Error('Worker 返回结果为空')
            }

            // C. 入库
            const escapedPath = file.path.replace(/'/g, "\\'")
            await table.update({
              where: `path = '${escapedPath}'`,
              values: {
                faces: result.faces ? JSON.stringify(result.faces) : '[]',
                thumbnail: result.thumbnail || '',
                width: result.width || 0,
                height: result.height || 0,
                timestamp: result.timestamp || Date.now(),
                status: 'done'
              }
            })
            processedCount++
          } catch (err) {
            const errMsg = err.message || String(err)
            const stack = err.stack ? `\n错误堆栈: ${err.stack}` : ''
            logger.error(`[Pipeline] ❌ 处理失败: ${file.path}, ${errMsg}${stack}`)

            // 无论成功失败，计数都要增加，否则进度条不动
            processedCount++

            // 边缘情况处理：文件丢失则从库中删除
            const escapedPath = file.path.replace(/'/g, "\\'")
            if (errMsg.includes('ENOENT') || errMsg.includes('not found')) {
              await table.delete(`path = '${escapedPath}'`)
            } else {
              // 标记为错误，避免死循环处理同一个坏图
              try {
                await table.update({
                  where: `path = '${escapedPath}'`,
                  values: { status: 'error' }
                })
              } catch (updErr) {
                logger.error(`[Pipeline] 更新错误状态也失败了: ${updErr.message}`)
              }
            }
          }
        }

        if (processedCount >= totalToProcess) break
      }

      if (this.shouldStop) {
        logger.info(
          `[Pipeline] 🛑 收到停止信号，正在退出循环 (已处理: ${processedCount}/${totalToProcess})`
        )
        onProgress({
          status: 'STOPPED',
          current: processedCount,
          total: totalToProcess,
          message: '分析已暂停'
        })
      } else {
        logger.info(`[Pipeline] 🎉 所有任务处理完成 (总计: ${processedCount})`)
        onProgress({
          status: 'COMPLETE',
          current: processedCount,
          total: totalToProcess,
          message: '分析完成'
        })
      }
    } catch (err) {
      logger.error(`[Pipeline] 💥 发生严重错误: ${err.message}`)
    } finally {
      this.isRunning = false
      this.shouldStop = false
    }
  }
}
