const { join } = require('path')
const { execFileSync } = require('child_process')

// macOS Tahoe 开始 dyld 严格要求主二进制与其加载的所有 framework/dylib
// 必须共享同一签名 seal；无 Developer ID 证书构建时，统一使用 ad-hoc
// 签名收尾。打包后不再改写 app.asar，避免为开发环境引入原生编译依赖。
function adhocResignMac(appPath) {
  const entitlementsPath = join(__dirname, 'entitlements.mac.plist')
  execFileSync(
    'codesign',
    [
      '--force',
      '--deep',
      '--sign',
      '-',
      '--options',
      'runtime',
      '--timestamp=none',
      '--entitlements',
      entitlementsPath,
      appPath
    ],
    { stdio: 'inherit' }
  )
}

exports.default = async ({ appOutDir, packager, electronPlatformName }) => {
  if (electronPlatformName !== 'darwin') return

  try {
    const appPath = join(appOutDir, `${packager.appInfo.productFilename}.app`)
    console.log(`  🔏  ad-hoc resigning ${appPath}`)
    adhocResignMac(appPath)
  } catch (err) {
    console.error(err)
    throw err
  }
}
