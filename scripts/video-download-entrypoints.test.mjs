import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { compileFunction } from 'node:vm'
import { parse as parseVue } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { resolveVideoDownloadSource } from '../src/shared/video-download-source.mjs'

// Execute the actual renderer payload builders, isolating only their surrounding
// UI state. This catches fields lost before IPC, which service-only tests miss.
const rendererFunctions = async (component, names, dependencies = {}) => {
  const source = await fs.readFile(
    new URL(`../src/renderer/src/views/photo/components/${component}.vue`, import.meta.url),
    'utf8'
  )
  const script = parseVue(source).descriptor.scriptSetup.content
  const ast = parseScript(script, { sourceType: 'module' })
  const definitions = names.map((name) => {
    const declaration = ast.program.body.find(
      (node) =>
        node.type === 'VariableDeclaration' &&
        node.declarations.some((item) => item.id.name === name)
    )
    assert.ok(declaration, `${component}: ${name}`)
    return script.slice(declaration.start, declaration.end)
  })
  return compileFunction(
    `${definitions.join('\n')}\nreturn {${names.join(',')}}`,
    Object.keys(dependencies)
  )(...Object.values(dependencies))
}

const source = 'https://video.example/movie.m3u8?signature=synthetic'
const cover = 'https://image.example/cover.jpg'
const explicitVideo = {
  id: 'video-key',
  is_video: true,
  type: 'video',
  url: cover,
  raw: cover,
  pre: cover,
  thumb: cover,
  video_info: { video_url: source }
}

test('video download source prefers explicit video fields and excludes covers and renderer-local URLs', () => {
  assert.equal(resolveVideoDownloadSource(explicitVideo), source)
  assert.equal(resolveVideoDownloadSource({ url: cover, pre: cover }), '')
  assert.equal(resolveVideoDownloadSource({ url: 'https://a.photo.store.qq.com/psc?cover=1' }), '')
  assert.equal(resolveVideoDownloadSource({ videoUrl: 'blob:renderer-only', url: source }), source)
  assert.equal(resolveVideoDownloadSource({ raw: source, pre: source }), source)
  assert.equal(
    resolveVideoDownloadSource({ video_download_url: '//video.example/download.mp4', url: source }),
    'https://video.example/download.mp4'
  )
})

test('self/friend album payloads preserve a video source nested in album metadata', async () => {
  const { cleanPhotoData } = await rendererFunctions('main', ['isVideoPhoto', 'cleanPhotoData'], {
    effectiveHostUin: { value: '20002' },
    findCachedFeedMetadata: () => null,
    resolveVideoDownloadSource
  })
  const [video] = cleanPhotoData([{ ...explicitVideo, picKey: 'album-video', name: 'movie' }])
  assert.equal(video.video_download_url, source)
  assert.equal(video.picKey, 'album-video')
  const [image] = cleanPhotoData([{ url: cover, raw: cover, is_video: '0' }])
  assert.equal(image.raw, cover)
  assert.equal(image.video_download_url, undefined)
})

test('photo-feed payloads keep the resolved video URL, actual album and friend owner', async () => {
  const { buildDownloadPayload } = await rendererFunctions(
    'photo-module',
    ['isVideoMedia', 'getDownloadableMedia', 'buildDownloadPayload'],
    {
      resolveVideoDownloadSource,
      mediaPreviewCover: () => cover,
      effectiveHostUin: { value: '20002' },
      userStore: { userInfo: {} }
    }
  )
  const [feed] = buildDownloadPayload([
    {
      id: 'feed-id',
      time: 1700000000,
      albumId: 'real-album',
      owner: { uin: '20002' },
      media: [{ ...explicitVideo, picKey: 'photo-key', albumId: 'media-album', ownerUin: '30003' }]
    }
  ])
  assert.equal(feed.photos[0].url, source)
  assert.equal(feed.photos[0].raw, source)
  assert.equal(feed.photos[0].albumId, 'media-album')
  assert.equal(feed.photos[0].ownerUin, '30003')
  assert.equal(feed.albumId, 'real-album')
})

test('self/friend timeline and preview-single-item payloads select video URLs without changing image URLs', async () => {
  const { buildFeedDownloadPayload } = await rendererFunctions(
    'feeds-module',
    ['isVideoMedia', 'buildFeedDownloadPayload'],
    {
      resolveVideoDownloadSource,
      normalizePlainText: (value) => value,
      normalizeQzoneUin: (value) => String(value || '').replace(/^o/, ''),
      activeSource: { value: { label: '好友动态' } },
      activeKey: { value: 'friend' },
      selfUin: { value: '10001' }
    }
  )
  const feed = buildFeedDownloadPayload({
    tid: 'feed-id',
    uin: '20002',
    media: [explicitVideo, { type: 'image', origin: cover, thumb: cover }]
  })
  assert.equal(feed.photos[0].url, source)
  assert.equal(feed.photos[0].raw, source)
  assert.equal(feed.photos[1].url, cover)
  assert.equal(feed.photos[1].is_video, false)
  assert.match(feed.referer, /20002$/)
})

test('self/friend video-library download payload uses the download URL while playback keeps its existing choice', async () => {
  let payload
  const { queueVideoDownloads, getVideoDownloadUrl } = await rendererFunctions(
    'video-module',
    ['getVideoDownloadUrl', 'rawUin', 'queueVideoDownloads'],
    {
      resolveVideoDownloadSource,
      effectiveHostUin: { value: '20002' },
      isFriendContext: { value: true },
      resolveSelfQzoneUin: () => '10001',
      userStore: {},
      batchTaskIds: (result) => result,
      window: {
        QzoneAPI: {
          download: {
            addFeeds: async (value) => {
              payload = value
              return ['task']
            }
          }
        }
      }
    }
  )
  const download = 'https://video.example/original.mp4'
  await queueVideoDownloads([{ url: source, video_download_url: download, vid: 'library-id' }])
  assert.equal(payload.feeds[0].photos[0].raw, download)
  assert.equal(payload.friendUin, '20002')
  assert.equal(payload.uin, '10001')
  assert.equal(getVideoDownloadUrl({ url: source, video_download_url: download }), source)
})
