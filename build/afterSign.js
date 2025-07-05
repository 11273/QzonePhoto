// build/afterSign.js
const fs = require('fs')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  // 只对 macOS 平台进行公证
  if (electronPlatformName !== 'darwin') {
    console.log(`⏭️ 跳过代码签名 - 当前平台: ${electronPlatformName}`)
    return
  }

  // 检查是否有必要的环境变量
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('⚠️ 跳过公证 - 缺少必要的Apple凭证环境变量')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  // 检查应用文件是否存在
  if (!fs.existsSync(appPath)) {
    console.log(`⚠️ 跳过公证 - 应用文件不存在: ${appPath}`)
    return
  }

  // 从配置文件中获取Bundle ID
  const bundleId = 'com.qzonephoto.app'

  console.log('🔐 开始公证macOS应用...')

  // 动态导入 @electron/notarize
  const { notarize } = await import('@electron/notarize')

  return await notarize({
    appBundleId: bundleId,
    appPath: appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })
}
