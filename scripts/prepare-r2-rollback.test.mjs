import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareR2Rollback } from './prepare-r2-rollback.mjs'

const tag = 'v2.7.0'
const version = tag.slice(1)
const baseUrl = 'https://dl.qzonephoto.getgit.one'
const filesByMetadata = {
  'latest.yml': [`QzonePhoto-${version}-win-x64-setup.exe`],
  'latest-mac.yml': [`QzonePhoto-${version}-mac-arm64.zip`],
  'latest-linux.yml': [`QzonePhoto-${version}-linux-x86_64.AppImage`]
}

test('prepares stable pointers from a historical R2 snapshot without current filename assumptions', async (t) => {
  const fixture = await createFixture()
  t.after(() => rm(fixture.root, { recursive: true, force: true }))

  const result = await prepareR2Rollback(fixture.options)
  assert.equal(result.installers, 3)
  assert.match(
    await readFile(path.join(fixture.outDir, 'latest-linux.yml'), 'utf8'),
    new RegExp(String.raw`\.\./${tag}/QzonePhoto-${version}-linux-x86_64\.AppImage`)
  )
  assert.deepEqual((await readFile(fixture.fileListPath, 'utf8')).trim().split('\n').slice(-3), [
    'latest.yml',
    'latest-mac.yml',
    'latest-linux.yml'
  ])
})

test('rejects a historical snapshot whose metadata and manifest disagree', async (t) => {
  const fixture = await createFixture()
  t.after(() => rm(fixture.root, { recursive: true, force: true }))
  const metadataPath = path.join(fixture.metadataDir, 'latest-linux.yml')
  const content = await readFile(metadataPath, 'utf8')
  await writeFile(metadataPath, content.replace('size: 103', 'size: 999'), 'utf8')

  await assert.rejects(
    () => prepareR2Rollback(fixture.options),
    /does not match rollback manifest/i
  )
})

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qzonephoto-r2-rollback-'))
  const metadataDir = path.join(root, 'metadata')
  const outDir = path.join(root, 'stable')
  const manifestPath = path.join(root, `${tag}.json`)
  const fileListPath = path.join(root, 'files.txt')
  const assetListPath = path.join(root, 'assets.tsv')
  await mkdir(metadataDir, { recursive: true })

  const assets = []
  let size = 101
  for (const [metadataName, filenames] of Object.entries(filesByMetadata)) {
    const [filename] = filenames
    const sha512 = createHash('sha512').update(filename).digest('base64')
    await writeFile(
      path.join(metadataDir, metadataName),
      [
        `version: ${version}`,
        'files:',
        `  - url: ${filename}`,
        `    sha512: ${sha512}`,
        `    size: ${size}`,
        `path: ${filename}`,
        `sha512: ${sha512}`
      ].join('\n'),
      'utf8'
    )
    assets.push({
      filename,
      size,
      sha256: createHash('sha256').update(filename).digest('hex'),
      r2Url: `${baseUrl}/releases/${tag}/${filename}`
    })
    size += 1
  }

  await writeFile(manifestPath, JSON.stringify({ tag, version, assets }), 'utf8')
  return {
    root,
    metadataDir,
    outDir,
    fileListPath,
    options: {
      tag,
      manifestPath,
      metadataDir,
      outDir,
      fileListPath,
      assetListPath,
      publicBaseUrl: baseUrl
    }
  }
}
