import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { rebaseUpdateMetadata } from './rebase-update-metadata.mjs'
import { verifyReleaseAssets } from './verify-release-assets.mjs'

const version = '2.7.1'
const assets = {
  windowsDefault: `QzonePhoto-${version}-win-setup.exe`,
  windowsX64: `QzonePhoto-${version}-win-x64-setup.exe`,
  windowsIa32: `QzonePhoto-${version}-win-ia32-setup.exe`,
  macosX64Zip: `QzonePhoto-${version}-mac-x64.zip`,
  macosArm64Zip: `QzonePhoto-${version}-mac-arm64.zip`,
  macosX64Dmg: `QzonePhoto-${version}-mac-x64.dmg`,
  macosArm64Dmg: `QzonePhoto-${version}-mac-arm64.dmg`,
  linuxAppImage: `QzonePhoto-${version}-x86_64.AppImage`,
  linuxDeb: `QzonePhoto-${version}-linux-amd64.deb`
}

test('release workflow never passes an empty signing certificate to electron-builder', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8'
  )
  const buildStep = workflow.match(/- name: Build application[\s\S]*?- name: Upload artifacts/)?.[0]

  assert.ok(buildStep, 'Build application step must exist')
  assert.doesNotMatch(buildStep, /^\s+CSC_(?:LINK|KEY_PASSWORD):/m)
  assert.match(workflow, /- name: Configure optional code signing/)
  assert.match(workflow, /append_env CSC_IDENTITY_AUTO_DISCOVERY false/)
  assert.match(workflow, /append_env CSC_LINK "\$\{signing_link\}"/)
})

test('R2 workflows install locked dependencies before running the full release suite', async () => {
  for (const workflowName of ['promote-r2.yml', 'maintain-r2.yml']) {
    const workflow = await readFile(
      new URL(`../.github/workflows/${workflowName}`, import.meta.url),
      'utf8'
    )
    const installIndex = workflow.indexOf('pnpm install --frozen-lockfile --ignore-scripts')
    const testIndex = workflow.indexOf('pnpm test:release')

    assert.notEqual(installIndex, -1, `${workflowName} must install test dependencies`)
    assert.notEqual(testIndex, -1, `${workflowName} must run the release test suite`)
    assert.ok(installIndex < testIndex, `${workflowName} must install dependencies before tests`)
  }
})

test('release assets can be verified then safely rebased to an immutable R2 version directory', async (t) => {
  const fixture = await createFixture()
  t.after(() => rm(fixture.root, { recursive: true, force: true }))

  const verified = await verifyReleaseAssets({ assetsDir: fixture.assetsDir, version })
  assert.equal(verified.assetCount, 9)
  assert.ok(verified.fileNames.includes(assets.windowsDefault))

  const rebasedDir = path.join(fixture.root, 'rebased')
  await rebaseUpdateMetadata({
    assetsDir: fixture.assetsDir,
    outDir: rebasedDir,
    releasePath: `v${version}`,
    fileNames: verified.fileNames
  })

  for (const name of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
    const content = await readFile(path.join(rebasedDir, name), 'utf8')
    assert.match(content, new RegExp(`\\.\\./v${version}/QzonePhoto-${version}`))
    assert.doesNotMatch(content, /^\s*(?:url|path):\s+QzonePhoto-/m)
  }
})

test('release verification rejects a package modified after its updater metadata was created', async (t) => {
  const fixture = await createFixture()
  t.after(() => rm(fixture.root, { recursive: true, force: true }))
  await writeFile(path.join(fixture.assetsDir, assets.windowsX64), 'tampered package', 'utf8')

  await assert.rejects(
    () => verifyReleaseAssets({ assetsDir: fixture.assetsDir, version }),
    /(?:size|SHA-512) mismatch/i
  )
})

test('release verification rejects a default updater path outside the verified files list', async (t) => {
  const fixture = await createFixture()
  t.after(() => rm(fixture.root, { recursive: true, force: true }))
  const metadataPath = path.join(fixture.assetsDir, 'latest.yml')
  const metadata = await readFile(metadataPath, 'utf8')
  await writeFile(
    metadataPath,
    metadata.replace(
      `path: ${assets.windowsDefault}`,
      `path: QzonePhoto-${version}-win-not-published.exe`
    ),
    'utf8'
  )

  await assert.rejects(
    () => verifyReleaseAssets({ assetsDir: fixture.assetsDir, version }),
    /default path is not present/i
  )
})

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qzonephoto-release-pipeline-'))
  const assetsDir = path.join(root, 'assets')
  await mkdir(assetsDir, { recursive: true })
  const entries = new Map()
  for (const name of Object.values(assets)) {
    const content = `fixture:${name}`
    await writeFile(path.join(assetsDir, name), content, 'utf8')
    entries.set(name, {
      sha512: createHash('sha512').update(content).digest('base64'),
      size: Buffer.byteLength(content)
    })
    if (/\.(?:exe|zip|dmg)$/.test(name)) {
      await writeFile(path.join(assetsDir, `${name}.blockmap`), `blockmap:${name}`, 'utf8')
    }
  }

  await writeMetadata(
    path.join(assetsDir, 'latest.yml'),
    [assets.windowsDefault, assets.windowsIa32, assets.windowsX64],
    entries
  )
  await writeMetadata(
    path.join(assetsDir, 'latest-mac.yml'),
    [assets.macosArm64Dmg, assets.macosArm64Zip, assets.macosX64Dmg, assets.macosX64Zip],
    entries
  )
  await writeMetadata(
    path.join(assetsDir, 'latest-linux.yml'),
    [assets.linuxAppImage, assets.linuxDeb],
    entries
  )

  return { root, assetsDir }
}

async function writeMetadata(filePath, names, entries) {
  const [defaultName] = names
  const lines = [`version: ${version}`, 'files:']
  for (const name of names) {
    const entry = entries.get(name)
    lines.push(`  - url: ${name}`, `    sha512: ${entry.sha512}`, `    size: ${entry.size}`)
  }
  lines.push(`path: ${defaultName}`, `sha512: ${entries.get(defaultName).sha512}`)
  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8')
}
