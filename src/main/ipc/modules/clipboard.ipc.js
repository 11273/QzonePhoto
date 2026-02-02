import { clipboard } from 'electron'
import { IPC_CLIPBOARD } from '@shared/ipc-channels'

/**
 * 剪贴板 IPC 处理器
 */
export function createClipboardHandlers() {
  return {
    [IPC_CLIPBOARD.WRITE_TEXT]: async (_, context) => {
      try {
        const { text } = context.payload
        if (text) {
          clipboard.writeText(text)
          return true
        }
        return false
      } catch (error) {
        console.error('[clipboard.ipc] 写入剪贴板失败:', error)
        return false
      }
    }
  }
}
