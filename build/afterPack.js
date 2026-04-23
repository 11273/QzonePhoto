const asarmor = require('asarmor')
const { join } = require('path')
const { execFileSync } = require('child_process')

// macOS Tahoe 开始 dyld 严格要求主二进制与其加载的所有 framework/dylib
// 必须共享同一签名 seal；electron-builder 在无证书时会跳过签名，asarmor
// 又改写了 app.asar，因此需要统一收尾：用 --deep 让 codesign 自行处理嵌套。
function adhocResignMac(appPath) {
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath],
    { stdio: 'inherit' }
  )
}

exports.default = async ({ appOutDir, packager, electronPlatformName }) => {
  try {
    const asarPath = join(packager.getResourcesDir(appOutDir), 'app.asar')
    console.log(`  🔒  asarmor is applying patches to ${asarPath}`)
    const archive = await asarmor.open(asarPath)
    archive.patch() // apply default patches
    await archive.write(asarPath)

    if (electronPlatformName === 'darwin') {
      const appPath = join(appOutDir, `${packager.appInfo.productFilename}.app`)
      console.log(`  🔏  ad-hoc resigning ${appPath}`)
      adhocResignMac(appPath)
    }
  } catch (err) {
    console.error(err)
    throw err
  }
}
