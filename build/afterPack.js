const { join } = require('path')
const { execFileSync } = require('child_process')
const { outputFile } = require('fs-extra')

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function writeLinuxAppStreamMetadata(appOutDir, version) {
  const metadataPath = join(
    appOutDir,
    'usr',
    'share',
    'metainfo',
    'com.qzonephoto.app.metainfo.xml'
  )
  const safeVersion = escapeXml(version)
  const sourceDateEpoch = Number(process.env.SOURCE_DATE_EPOCH)
  const releaseDate = new Date(
    Number.isFinite(sourceDateEpoch) && sourceDateEpoch > 0 ? sourceDateEpoch * 1000 : Date.now()
  )
    .toISOString()
    .slice(0, 10)
  const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>com.qzonephoto.app</id>
  <name>QzonePhoto</name>
  <name xml:lang="zh-CN">企鹅相册</name>
  <summary>Back up and manage QQ Zone albums locally</summary>
  <summary xml:lang="zh-CN">在本地管理与备份 QQ 空间相册</summary>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>GPL-3.0-only</project_license>
  <developer id="com.github.11273">
    <name>11273</name>
  </developer>
  <description>
    <p>QzonePhoto is a desktop utility for browsing, downloading and managing QQ Zone albums, photos, videos and posts.</p>
    <p xml:lang="zh-CN">企鹅相册是一款用于浏览、下载和管理 QQ 空间相册、照片、视频与动态的桌面工具。</p>
  </description>
  <launchable type="desktop-id">com.qzonephoto.app.desktop</launchable>
  <provides>
    <binary>qzone-photo</binary>
  </provides>
  <url type="homepage">https://qzonephoto.getgit.one</url>
  <url type="bugtracker">https://github.com/11273/QzonePhoto/issues</url>
  <releases>
    <release version="${safeVersion}" date="${releaseDate}" />
  </releases>
  <content_rating type="oars-1.1" />
</component>
`

  await outputFile(metadataPath, metadata, { mode: 0o644 })
}

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
  if (electronPlatformName === 'linux') {
    await writeLinuxAppStreamMetadata(appOutDir, packager.appInfo.version)
    return
  }

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
