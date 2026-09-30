import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import test from 'node:test'
import { load } from 'js-yaml'

const require = createRequire(import.meta.url)
const afterPack = require('../build/afterPack.js').default

test('Linux package uses the self-contained AppImage runtime and catalog-safe name', async () => {
  const [configText, packageText] = await Promise.all([
    readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8')
  ])
  const config = load(configText)
  const packageJson = JSON.parse(packageText)

  assert.equal(config.toolsets.appimage, '1.0.3')
  assert.equal(config.appImage.artifactName, 'QzonePhoto-${version}-${arch}.${ext}')
  assert.equal(config.linux.syncDesktopName, true)
  assert.equal(packageJson.desktopName, 'com.qzonephoto.app.desktop')
})

test('Linux package embeds current AppStream metadata for offline catalogs', async (t) => {
  const appOutDir = await mkdtemp(path.join(os.tmpdir(), 'qzonephoto-linux-package-'))
  t.after(() => rm(appOutDir, { recursive: true, force: true }))

  await afterPack({
    appOutDir,
    electronPlatformName: 'linux',
    packager: { appInfo: { version: '9.8.7' } }
  })

  const metadata = await readFile(
    path.join(appOutDir, 'usr/share/metainfo/com.qzonephoto.app.metainfo.xml'),
    'utf8'
  )
  assert.match(metadata, /<id>com\.qzonephoto\.app<\/id>/)
  assert.match(
    metadata,
    /<launchable type="desktop-id">com\.qzonephoto\.app\.desktop<\/launchable>/
  )
  assert.match(metadata, /<release version="9\.8\.7" \/>/)
})
