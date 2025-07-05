// utils/platform.js

/**
 * 平台检测工具函数
 * @returns {Object} 平台信息对象
 */
export function getPlatformInfo() {
  const ua = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  // 基础平台检测
  const detectOS = () => {
    if (platform.includes('win') || ua.includes('windows')) return 'windows'
    if (platform.includes('mac') || ua.includes('mac')) return 'mac'
    if (platform.includes('linux') || ua.includes('linux')) return 'linux'
    return 'unknown'
  }

  // 检测系统架构
  const detectArchitecture = () => {
    if (ua.includes('x64') || ua.includes('x86_64')) return 'x64'
    if (ua.includes('arm64')) return 'arm64'
    return 'x86'
  }

  // 检测 Windows 版本
  const getWindowsVersion = () => {
    const match = ua.match(/windows nt (\d+\.\d+)/i)
    if (match) {
      const version = parseFloat(match[1])
      if (version >= 10.0) return '10/11'
      if (version >= 6.3) return '8.1'
      if (version >= 6.2) return '8'
      if (version >= 6.1) return '7'
    }
    return 'unknown'
  }

  const os = detectOS()

  return {
    // 平台类型
    os,

    // 布尔判断
    isWindows: os === 'windows',
    isMac: os === 'mac',
    isLinux: os === 'linux',

    // 详细信息
    architecture: detectArchitecture(),
    version: os === 'windows' ? getWindowsVersion() : '',

    // 显示名称
    displayName: {
      windows: 'Windows',
      mac: 'macOS',
      linux: 'Linux',
      unknown: 'Unknown'
    }[os]
  }
}

// 导出便捷方法
export const isWindows = () => getPlatformInfo().isWindows
export const isMac = () => getPlatformInfo().isMac
export const isLinux = () => getPlatformInfo().isLinux
export const getOS = () => getPlatformInfo().os
