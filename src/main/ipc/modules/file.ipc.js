import { dialog } from 'electron'
import { getFileInfo } from '@main/utils/file-processor'
import { getVideoMetadata } from '@main/services/video-metadata'
import { IPC_FILE } from '@shared/ipc-channels'
import fs from 'fs'
import path from 'path'

export function createFileHandlers() {
  return {
    [IPC_FILE.DIALOG_OPEN_FILE]: async (_, context) => {
      try {
        const result = await dialog.showOpenDialog(context.payload)
        return result
      } catch (error) {
        console.error('打开文件对话框失败:', error)
        return { canceled: true, filePaths: [] }
      }
    },

    [IPC_FILE.GET_FILE_INFO]: async (_, context) => {
      try {
        const { filePath } = context.payload
        // console.log('[file.ipc] 获取文件信息，路径:', filePath)
        const fileInfo = await getFileInfo(filePath)
        // console.log('[file.ipc] 文件信息获取成功:', fileInfo)
        return fileInfo
      } catch (error) {
        console.error('获取文件信息失败:', error)
        return null
      }
    },

    [IPC_FILE.GET_IMAGE_PREVIEW]: async (_, context) => {
      try {
        const { filePath } = context.payload
        // console.log('[file.ipc] 获取图片预览，路径:', filePath)

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          throw new Error('文件不存在')
        }

        // 读取文件并转换为base64
        const fileBuffer = fs.readFileSync(filePath)
        const ext = path.extname(filePath).toLowerCase()

        let mimeType = 'image/jpeg'
        switch (ext) {
          case '.png':
            mimeType = 'image/png'
            break
          case '.gif':
            mimeType = 'image/gif'
            break
          case '.webp':
            mimeType = 'image/webp'
            break
          case '.bmp':
            mimeType = 'image/bmp'
            break
        }

        const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`

        // 获取图片尺寸（简单实现）
        let dimensions = null
        try {
          // 这里可以使用更复杂的图片处理库来获取尺寸
          // 暂时返回null，让前端处理
          dimensions = null
        } catch (error) {
          console.warn('获取图片尺寸失败:', error)
        }

        return {
          dataUrl,
          dimensions
        }
      } catch (error) {
        console.error('获取图片预览失败:', error)
        return null
      }
    },

    [IPC_FILE.GET_VIDEO_PREVIEW]: async (_, context) => {
      try {
        const { filePath } = context.payload
        if (!fs.existsSync(filePath)) {
          throw new Error('文件不存在')
        }
        // 不再 readFileSync 整文件转 base64（GB 级视频会让主进程 V8 ExternalMemoryAccounter 崩溃）
        // 返回 qzone-local:// 协议 URL，让 renderer <video> 标签流式加载
        const normalized = filePath.replace(/\\/g, '/')
        const dataUrl = 'qzone-local://local/' + encodeURIComponent(normalized)
        return { dataUrl }
      } catch (error) {
        console.error('获取视频预览失败:', error)
        return null
      }
    },

    [IPC_FILE.GET_VIDEO_METADATA]: async (_, context) => {
      try {
        const { filePath } = context.payload
        console.log('[file.ipc] 获取视频元数据，路径:', filePath)

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          throw new Error('文件不存在')
        }

        // 使用视频元数据服务提取
        const metadata = await getVideoMetadata(filePath)

        console.log('[file.ipc] 视频元数据获取成功:', {
          duration: metadata.duration,
          hasCover: !!metadata.cover
        })

        return metadata
      } catch (error) {
        console.error('[file.ipc] 获取视频元数据失败:', error)
        // 返回默认值而不是 null，避免阻塞流程
        return {
          duration: 0,
          cover: null
        }
      }
    }
  }
}
