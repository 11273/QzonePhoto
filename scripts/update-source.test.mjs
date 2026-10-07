import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createStableUpdateCheckResult,
  getGenericLatestMetadataUrl,
  getGithubLatestMetadataUrl,
  getUpdaterMetadataFilename,
  UPDATE_REQUEST_TIMEOUT_MS,
  matchesPinnedUpdateCandidate,
  selectCompatibleUpdateFile,
  selectVerifiedUpdateCandidate,
  UPDATE_SELECTION_REASON
} from '../src/main/core/update-source.js'

const sha512 = `${'A'.repeat(86)}==`

function windowsAsset(version = '2.7.1', overrides = {}) {
  return {
    url: `../v${version}/QzonePhoto-${version}-win-x64-setup.exe`,
    size: 123456,
    sha512,
    ...overrides
  }
}

test('uses R2 only when GitHub confirms the same release asset', () => {
  const architecture = { platform: 'win32', arch: 'x64' }
  const r2Candidate = { source: 'r2', updateInfo: { version: '2.7.1', files: [windowsAsset()] } }
  const githubCandidate = {
    source: 'github',
    updateInfo: {
      version: '2.7.1',
      files: [windowsAsset('2.7.1', { url: 'QzonePhoto-2.7.1-win-x64-setup.exe' })]
    }
  }

  const selection = selectVerifiedUpdateCandidate({
    r2Candidate,
    githubCandidate,
    githubResponded: true,
    architecture
  })

  assert.equal(selection.candidate, r2Candidate)
  assert.equal(selection.reason, UPDATE_SELECTION_REASON.R2_VERIFIED)
})

test('uses GitHub as release authority when source versions differ', () => {
  const architecture = { platform: 'win32', arch: 'x64' }
  const r2Candidate = { source: 'r2', updateInfo: { version: '2.7.1', files: [windowsAsset()] } }
  const githubNewer = {
    source: 'github',
    updateInfo: {
      version: '2.7.2',
      files: [windowsAsset('2.7.2', { url: 'QzonePhoto-2.7.2-win-x64-setup.exe' })]
    }
  }
  const r2Newer = {
    source: 'r2',
    updateInfo: {
      version: '2.7.2',
      files: [windowsAsset('2.7.2')]
    }
  }

  const githubOlder = {
    source: 'github',
    updateInfo: {
      version: '2.7.0',
      files: [windowsAsset('2.7.0', { url: 'QzonePhoto-2.7.0-win-x64-setup.exe' })]
    }
  }

  const githubSelection = selectVerifiedUpdateCandidate({
    r2Candidate,
    githubCandidate: githubNewer,
    githubResponded: true,
    architecture
  })
  assert.equal(githubSelection.candidate, githubNewer)
  assert.equal(githubSelection.reason, UPDATE_SELECTION_REASON.GITHUB_NEWER)

  const r2Selection = selectVerifiedUpdateCandidate({
    r2Candidate: r2Newer,
    githubCandidate: githubOlder,
    githubResponded: true,
    architecture
  })
  assert.equal(r2Selection.candidate, githubOlder)
  assert.equal(r2Selection.reason, UPDATE_SELECTION_REASON.GITHUB_AUTHORITY)
})

test('only uses an R2-only update when GitHub is unavailable', () => {
  const architecture = { platform: 'win32', arch: 'x64' }
  const r2Candidate = { source: 'r2', updateInfo: { version: '2.7.1', files: [windowsAsset()] } }

  const githubCurrent = selectVerifiedUpdateCandidate({
    r2Candidate,
    githubCandidate: null,
    githubResponded: true,
    architecture
  })
  assert.equal(githubCurrent.candidate, null)
  assert.equal(githubCurrent.reason, UPDATE_SELECTION_REASON.GITHUB_CURRENT)

  const githubUnavailable = selectVerifiedUpdateCandidate({
    r2Candidate,
    githubCandidate: null,
    githubResponded: false,
    architecture
  })
  assert.equal(githubUnavailable.candidate, r2Candidate)
  assert.equal(githubUnavailable.reason, UPDATE_SELECTION_REASON.R2_UNVERIFIED)

  const githubCandidate = {
    source: 'github',
    updateInfo: {
      version: '2.7.1',
      files: [windowsAsset('2.7.1', { url: 'QzonePhoto-2.7.1-win-x64-setup.exe' })]
    }
  }
  const r2Current = selectVerifiedUpdateCandidate({
    r2Candidate: null,
    githubCandidate,
    githubResponded: true,
    architecture
  })
  assert.equal(r2Current.candidate, githubCandidate)
  assert.equal(r2Current.reason, UPDATE_SELECTION_REASON.GITHUB_ONLY)
})

test('uses GitHub when the same version has different package metadata', () => {
  const architecture = { platform: 'win32', arch: 'x64' }
  const r2Candidate = { source: 'r2', updateInfo: { version: '2.7.1', files: [windowsAsset()] } }
  const githubCandidate = {
    source: 'github',
    updateInfo: {
      version: '2.7.1',
      files: [windowsAsset('2.7.1', { url: 'QzonePhoto-2.7.1-win-x64-setup.exe', size: 999 })]
    }
  }

  const selection = selectVerifiedUpdateCandidate({
    r2Candidate,
    githubCandidate,
    githubResponded: true,
    architecture
  })
  assert.equal(selection.candidate, githubCandidate)
  assert.equal(selection.reason, UPDATE_SELECTION_REASON.GITHUB_HASH_MISMATCH)
})

test('uses a short, explicit request timeout instead of electron-updater default', () => {
  assert.equal(UPDATE_REQUEST_TIMEOUT_MS, 4_000)
})

test('builds fixed-source metadata URLs without making them a download authority', () => {
  const github = { owner: '11273', repo: 'QzonePhoto' }
  assert.equal(getUpdaterMetadataFilename({ platform: 'win32' }), 'latest.yml')
  assert.equal(getUpdaterMetadataFilename({ platform: 'darwin' }), 'latest-mac.yml')
  assert.equal(getUpdaterMetadataFilename({ platform: 'linux' }), 'latest-linux.yml')
  assert.equal(
    getGithubLatestMetadataUrl(github, { platform: 'darwin' }),
    'https://github.com/11273/QzonePhoto/releases/latest/download/latest-mac.yml'
  )
  assert.equal(
    getGenericLatestMetadataUrl(
      'https://dl.qzonephoto.getgit.one/releases/latest',
      { platform: 'win32' },
      'test'
    ),
    'https://dl.qzonephoto.getgit.one/releases/latest/latest.yml?noCache=test'
  )
  assert.equal(getGenericLatestMetadataUrl('http://example.invalid', { platform: 'win32' }), '')
  assert.equal(getGithubLatestMetadataUrl({ owner: 'bad/path', repo: 'QzonePhoto' }), '')
})

test('turns GitHub stable metadata into an update result only when it is newer', () => {
  const updateInfo = { version: '2.7.1', files: [windowsAsset()] }
  assert.equal(createStableUpdateCheckResult(updateInfo, '2.7.0').isUpdateAvailable, true)
  assert.equal(createStableUpdateCheckResult(updateInfo, '2.7.1').isUpdateAvailable, false)
  assert.equal(createStableUpdateCheckResult({ version: '2.7.1-beta.1' }, '2.7.0'), null)
})

test('only accepts the exact versioned R2 asset for the current platform', () => {
  const architecture = { platform: 'win32', arch: 'x64' }
  const expected = windowsAsset()

  assert.deepEqual(selectCompatibleUpdateFile([expected], architecture, '2.7.1'), expected)
  assert.equal(selectCompatibleUpdateFile([windowsAsset('2.7.0')], architecture, '2.7.1'), null)
  assert.equal(
    selectCompatibleUpdateFile(
      [windowsAsset('2.7.1', { url: 'https://example.invalid/update.exe' })],
      architecture,
      '2.7.1'
    ),
    null
  )
  assert.equal(
    selectCompatibleUpdateFile(
      [windowsAsset('2.7.1', { url: '../v2.7.1/../../unexpected.exe' })],
      architecture,
      '2.7.1'
    ),
    null
  )
})

test('GitHub download fallback must match the already selected R2 package exactly', () => {
  const architecture = { platform: 'win32', arch: 'x64' }
  const r2 = { version: '2.7.1', files: [windowsAsset()] }
  const github = {
    version: '2.7.1',
    files: [windowsAsset('2.7.1', { url: 'QzonePhoto-2.7.1-win-x64-setup.exe' })]
  }

  assert.equal(matchesPinnedUpdateCandidate(r2, github, architecture), true)
  assert.equal(
    matchesPinnedUpdateCandidate(r2, { ...github, version: '2.7.2' }, architecture),
    false
  )
  assert.equal(
    matchesPinnedUpdateCandidate(
      r2,
      { ...github, files: [windowsAsset('2.7.1', { size: 123457 })] },
      architecture
    ),
    false
  )
})
