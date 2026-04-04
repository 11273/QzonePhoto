import os from 'os'
import { app } from 'electron'
import si from 'systeminformation'
import { IPC_APP } from '@shared/ipc-channels'
import windowManager from '@main/core/window'

// 简单的 CPU 使用率计算
let interval = null

function startSystemMonitor() {
  if (interval) clearInterval(interval)

  // 立即执行一次
  const runMonitor = async () => {
    try {
      const win = windowManager.getMainWindow()
      if (!win || win.isDestroyed()) {
        clearInterval(interval)
        return
      }

      // 获取 CPU 负载 (更准确，跨平台)
      const cpuLoad = await si.currentLoad()
      const cpuUsage = Math.round(cpuLoad.currentLoad)

      // 获取内存信息
      const mem = await si.mem()
      const memUsage = Math.round((mem.active / mem.total) * 100)
      const usedMemGb = (mem.active / 1024 / 1024 / 1024).toFixed(1)

      // 发送数据
      win.webContents.send(IPC_APP.MONITOR_STATS, {
        cpu: cpuUsage,
        memory: memUsage,
        memoryVal: usedMemGb
      })
    } catch (e) {
      console.error('Monitor Error:', e)
      clearInterval(interval)
    }
  }

  runMonitor()
  interval = setInterval(runMonitor, 2000)
}

function stopSystemMonitor() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

export function createAppHandlers() {
  return {
    [IPC_APP.GET_INFO]: async () => {
      // 获取更友好的 OS 名称
      let osPlatform = os.platform()
      if (osPlatform === 'darwin') osPlatform = 'macOS'
      else if (osPlatform === 'win32') osPlatform = 'Windows'

      // 获取 OS 版本
      const osRelease = os.release()

      return {
        hostname: os.hostname(),
        platform: osPlatform,
        release: osRelease,
        arch: os.arch(),
        totalmem: os.totalmem(),
        cpus: os.cpus()
      }
    },
    [IPC_APP.START_MONITOR]: async () => {
      startSystemMonitor()
      return true
    },
    [IPC_APP.STOP_MONITOR]: async () => {
      stopSystemMonitor()
      return true
    },
    [IPC_APP.GET_GPU_INFO]: async () => {
      try {
        // 使用 systeminformation 获取更详细的显卡信息
        const graphics = await si.graphics()
        // graphics.controllers 是一个数组，包含所有显卡
        const controllers = graphics.controllers || []

        // 我们尽量找独立显卡，或者显存最大的
        // 这里简单处理，返回第一个或者筛选出来的
        const gpu = controllers.length > 0 ? controllers[0] : null

        // 同时也返回 Electron 的 info 作为 fallback
        const appGpu = await app.getGPUInfo('complete')

        return {
          si: gpu, // systeminformation 的数据 (更详细，有 model, vram 等)
          electron: appGpu
        }
      } catch (e) {
        console.error('Failed to get GPU info:', e)
        return null
      }
    }
  }
}
