import { IpcRegistry } from '@main/ipc/ipc-registry'
import { createAuthHandlers } from '@main/ipc/modules/auth.ipc'
import { createDownloadHandlers } from '@main/ipc/modules/download.ipc'
import { createUploadHandlers } from '@main/ipc/modules/upload.ipc'
import { createPhotoHandlers } from '@main/ipc/modules/photo.ipc'
import { createUserHandlers } from '@main/ipc/modules/user.ipc'
import { createUpdateHandlers } from '@main/ipc/modules/update.ipc'
import { createFileHandlers } from '@main/ipc/modules/file.ipc'
import { registerWindowControl, setupWindowEventListeners } from '@main/ipc/modules/window.ipc'

export async function registerIPC(services) {
  // 1. 初始化注册器
  const registry = new IpcRegistry()

  // 2. 注册窗口控制处理器
  registerWindowControl()
  setupWindowEventListeners()

  // 3. 加载所有处理器
  const handlers = {
    ...createAuthHandlers(services),
    ...createUserHandlers(services),
    ...createPhotoHandlers(services),
    ...createDownloadHandlers(services),
    ...createUploadHandlers(services),
    ...createUpdateHandlers(services),
    ...createFileHandlers()
  }

  // 调试：检查handlers对象
  // console.log('IPC handlers keys:', Object.keys(handlers))
  // console.log(
  //   'IPC handlers values:',
  //   Object.values(handlers).map((h) => typeof h)
  // )

  // 4. 自动注册所有通道
  for (const [channel, handler] of Object.entries(handlers)) {
    try {
      if (!channel) {
        console.error('发现无效的IPC通道名:', channel)
        continue
      }
      // console.log(`正在注册IPC通道: ${channel}`)
      await registry.register(channel, handler)
    } catch (error) {
      console.error(`注册IPC通道失败 [${channel}]:`, error)
    }
  }

  // 5. 返回注册器实例以便后续管理
  return registry
}
