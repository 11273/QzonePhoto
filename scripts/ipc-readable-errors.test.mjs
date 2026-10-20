import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const preloadSource = await readFile(new URL('../src/preload/index.js', import.meta.url), 'utf8')

test('QQ 空间读取接口会把主进程错误返回给界面分类处理', () => {
  const readableChannels = [
    'IPC_USER.ME_INFO',
    'IPC_PHOTO.PHOTO_LIST',
    'IPC_PHOTO.PHOTO_BY_TOPIC_ID',
    'IPC_PHOTO.PHOTO_FLOATVIEW_LIST',
    'IPC_PHOTO.PHOTO_OR_VIDEO_INFO',
    'IPC_PHOTO.VIDEO_INFO',
    'IPC_PHOTO.BATCH_VIDEO_INFO',
    'IPC_PHOTO.GET_FEEDS',
    'IPC_PHOTO.GET_VIDEO_LIST',
    'IPC_PHOTO.GET_ALBUM_QA',
    'IPC_PHOTO.GET_ALBUM_VISITORS',
    'IPC_PHOTO.GET_FRIEND_PHOTOS',
    'IPC_PHOTO.GET_HOME_FEEDS',
    'IPC_PHOTO.GET_FRIEND_FEEDS',
    'IPC_PHOTO.GET_FEED_COMMENTS',
    'IPC_PHOTO.GET_FEED_LIKERS',
    'IPC_PHOTO.GET_SHUOSHUO_COMMENTS',
    'IPC_PHOTO.GET_FEEDS_COUNT',
    'IPC_PHOTO.GET_ABOUT_ME_FEEDS',
    'IPC_PHOTO.GET_LAST_YEAR_FEEDS',
    'IPC_PHOTO.GET_FAV_LIST',
    'IPC_PHOTO.GET_MESSAGE_BOARD',
    'IPC_PHOTO.GET_BLOG_LIST',
    'IPC_FRIEND.GET_FRIEND_LIST',
    'IPC_FRIEND.GET_QQ_FRIENDS',
    'IPC_FRIEND.GET_QQ_GROUPS',
    'IPC_FRIEND.GET_QQ_GROUP_MEMBERS',
    'IPC_USER.PERSONAL_CARD',
    'IPC_USER.VISITOR_STATUS',
    'IPC_USER.VISITOR_DETAIL',
    'IPC_USER.VISITOR_MORE',
    'IPC_USER.SHUOSHUO',
    'IPC_USER.SCHEDULED_SHUOSHUO'
  ]

  for (const channel of readableChannels) {
    assert.match(
      preloadSource,
      new RegExp(`callReadable\\(${channel.replace('.', '\\.')}`),
      channel
    )
  }
})

test('读取策略会继续检查 IPC 数据体中的 QQ 空间业务错误', async () => {
  const ipcClientSource = await readFile(
    new URL('../src/preload/lib/ipc-client.js', import.meta.url),
    'utf8'
  )
  assert.match(ipcClientSource, /responseCheck = getQzoneReadFailure/)
  assert.match(ipcClientSource, /responseCheck\(data\)/)
  assert.match(ipcClientSource, /businessFailure\.message/)
  assert.match(ipcClientSource, /businessFailure\.code/)
})

test('写入接口不会被读取错误策略批量改变', () => {
  assert.doesNotMatch(preloadSource, /callReadable\(IPC_PHOTO\.DELETE_PHOTOS/)
  assert.doesNotMatch(preloadSource, /callReadable\(IPC_PHOTO\.DELETE_FEED/)
  assert.doesNotMatch(preloadSource, /callReadable\(IPC_PHOTO\.SET_FEED_TOP/)
})
