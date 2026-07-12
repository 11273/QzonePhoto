const DEMO_ORIGIN = 'http://127.0.0.1:4173'
const asset = (name) => `${DEMO_ORIGIN}/assets/demo/${name}.png`
const noop = async () => ({ code: 0 })
const listen = () => () => {}

const images = ['sunset', 'flowers', 'coffee', 'city', 'cat', 'sky'].map(asset)
const now = Math.floor(Date.now() / 1000)

const albums = [
  { id: 'demo-daily', classid: 1, name: '生活随拍', total: 36, priv: 1, coverUrl: images[2] },
  { id: 'demo-travel', classid: 1, name: '沿途风景', total: 48, priv: 1, coverUrl: images[0] },
  { id: 'demo-pets', classid: 1, name: '猫咪日常', total: 24, priv: 1, coverUrl: images[4] },
  { id: 'demo-memories', classid: 2, name: '值得纪念', total: 18, priv: 1, coverUrl: images[1] }
]

const photos = Array.from({ length: 18 }, (_, index) => {
  const url = images[index % images.length]
  return {
    id: `demo-photo-${index + 1}`,
    lloc: `demo-lloc-${index + 1}`,
    picKey: `demo-key-${index + 1}`,
    name: `演示照片 ${String(index + 1).padStart(2, '0')}.png`,
    url,
    pre: url,
    raw: url,
    modifytime: now - Math.floor(index / 6) * 86400,
    is_video: 0,
    size: 1280000 + index * 32000
  }
})

const feedHtml = (text, media, topicId) => `
  <div class="f-single">
    <a href="https://user.qzone.qq.com/100012026">时光收藏夹</a>
    <div class="qz_info_cut">${text}</div>
    <div class="pic-content">
      ${media.map((url) => `<a class="img-item" href="${url}"><img src="${url}" data-origin="${url}"></a>`).join('')}
    </div>
    <span class="qz_like_btn_v3" data-likecnt="28" data-islike="0"></span>
    <span class="qz_btn_reply"><em>6</em></span>
    <span class="qz_retweet_btn"><em>2</em></span>
    <span class="state">浏览 126 次</span>
    <span class="phone-style">来自 企鹅相册 - QzonePhoto</span>
    <i name="feed_data" data-topicid="${topicId}"></i>
  </div>`

const feeds = [
  {
    key: 'demo-feed-1',
    uin: '100012026',
    nickname: '时光收藏夹',
    logimg: asset('logo'),
    abstime: now - 3600,
    feedstime: '今天 18:26',
    appid: 4,
    typeid: 0,
    commentcnt: 6,
    relycnt: 2,
    html: feedHtml('把日常认真保存下来，回看时每一张都有意义。', images.slice(0, 3), 'demo-travel')
  },
  {
    key: 'demo-feed-2',
    uin: '100012026',
    nickname: '时光收藏夹',
    logimg: asset('logo'),
    abstime: now - 90000,
    feedstime: '昨天 16:08',
    appid: 311,
    typeid: 0,
    commentcnt: 3,
    relycnt: 0,
    html: feedHtml('普通的一天，也值得留下一点颜色。', images.slice(3, 6), 'demo-daily')
  }
]

const photoFeeds = [
  {
    skey: 'demo-photo-feed-1',
    time: String(now - 3600),
    desc: '把日常认真保存下来，回看时每一张都有意义。',
    photos: photos.slice(0, 6).map((photo) => ({
      id: photo.id,
      name: photo.name,
      url: photo.url,
      picsmallurl: photo.pre,
      picbigurl: photo.raw,
      raw: photo.raw,
      picKey: photo.picKey,
      lloc: photo.lloc
    })),
    photo_total: 6,
    albumname: '沿途风景',
    albumid: 'demo-travel',
    type: 'upload_photo',
    praiseNum: 28,
    comment_total: 6,
    comments: [],
    like_users: '',
    visitorCount: 126,
    source_name: '企鹅相册 - QzonePhoto'
  },
  {
    skey: 'demo-photo-feed-2',
    time: String(now - 90000),
    desc: '普通的一天，也值得留下一点颜色。',
    photos: photos.slice(6, 12).map((photo) => ({
      id: photo.id,
      name: photo.name,
      url: photo.url,
      picsmallurl: photo.pre,
      picbigurl: photo.raw,
      raw: photo.raw,
      picKey: photo.picKey,
      lloc: photo.lloc
    })),
    photo_total: 6,
    albumname: '生活随拍',
    albumid: 'demo-daily',
    type: 'upload_photo',
    praiseNum: 16,
    comment_total: 3,
    comments: [],
    like_users: '',
    visitorCount: 84,
    source_name: '企鹅相册 - QzonePhoto'
  }
]

const videos = images.slice(0, 6).map((pre, index) => ({
  vid: `demo-video-${index + 1}`,
  title: ['海边日落', '花园散步', '周末咖啡', '城市夜色', '猫咪午后', '晴空片段'][index],
  desc: ['海边日落', '花园散步', '周末咖啡', '城市夜色', '猫咪午后', '晴空片段'][index],
  pre,
  url: pre,
  duration: 18 + index * 7,
  commentCount: index + 2,
  uploadTime: now - index * 86400 * 12,
  size: 8_000_000 + index * 1_200_000
}))

const downloadTasks = photos.slice(0, 6).map((photo, index) => ({
  id: `demo-download-${index + 1}`,
  name: photo.name,
  type: 'photo',
  thumbnail_url: photo.pre,
  status: index < 2 ? 'downloading' : index < 5 ? 'completed' : 'waiting',
  progress: index < 2 ? 42 + index * 26 : index < 5 ? 100 : 0,
  downloaded: index < 2 ? 3_200_000 + index * 900_000 : 7_500_000,
  total: 7_500_000,
  speed: index < 2 ? 1_800_000 + index * 600_000 : 0,
  directory: '/Users/demo/Pictures/企鹅相册/沿途风景',
  create_time: Date.now() - index * 60000,
  error: ''
}))

const uploadTasks = photos.slice(6, 12).map((photo, index) => ({
  id: `demo-upload-${index + 1}`,
  filename: photo.name,
  filePath: photo.pre,
  previewUrl: photo.pre,
  albumId: 'demo-daily',
  albumName: '生活随拍',
  status: index < 2 ? 'uploading' : index < 5 ? 'completed' : 'waiting',
  progress: index < 2 ? 36 + index * 31 : index < 5 ? 100 : 0,
  total: 6_800_000,
  speed: index < 2 ? 1_200_000 + index * 400_000 : 0,
  create_time: Date.now() - index * 70000,
  error: '',
  retryCount: 0
}))

export const createDemoQzoneAPI = (realApi) => ({
  ...realApi,
  demoMode: true,
  fetchUserInfo: async () => ({
    code: 0,
    data: {
      uin: '100012026',
      nick: '时光收藏夹',
      nickname: '时光收藏夹',
      level: 7,
      score: 28640,
      speed: 18,
      diskused: 6842,
      diskTotal: 51200
    }
  }),
  setQzoneAuth: noop,
  getPhotoList: async () => ({
    code: 0,
    data: {
      albumsInUser: albums.length,
      user: { diskused: 6842 },
      classList: [
        { id: 1, name: '我的相册' },
        { id: 2, name: '珍藏时光' }
      ],
      albumListModeClass: [
        { classId: 1, className: '我的相册', albumList: albums.slice(0, 3), nextPageStart: 3 },
        { classId: 2, className: '珍藏时光', albumList: albums.slice(3), nextPageStart: 1 }
      ]
    }
  }),
  getPhotoByTopicId: async ({ pageStart = 0, pageNum = 100 } = {}) => ({
    code: 0,
    data: {
      photoList: photos.slice(pageStart, pageStart + pageNum),
      totalInAlbum: photos.length,
      nextPageStart: Math.min(pageStart + pageNum, photos.length),
      hasMore: pageStart + pageNum < photos.length,
      requestedCount: pageNum,
      skippedCount: 0
    }
  }),
  getAlbumQA: async () => ({ code: 0, data: {} }),
  getFeeds: async () => ({ code: 0, data: { feeds: photoFeeds } }),
  getFriendPhotos: async () => ({ code: 0, data: { photos: [], hasmore: false } }),
  getHomeFeeds: async () => ({ code: 0, hasMore: false, pager: { start: feeds.length }, feeds }),
  getFriendFeeds: async () => ({ code: 0, hasMore: false, feeds }),
  getAboutMeFeeds: async () => ({ code: 0, hasMore: false, feeds }),
  getLastYearFeeds: async () => ({ code: 0, hasMore: false, feeds }),
  getFeedsCount: async () => ({ code: 0, counts: { myFeeds_new_cnt: 2, friendFeeds_new_cnt: 8 } }),
  getFeedComments: async () => ({ code: 0, comments: [] }),
  getShuoshuo: async () => ({ code: 0, msglist: [] }),
  getVideoList: async () => ({
    code: 0,
    data: {
      Videos: videos,
      UserInfo: { diskUsed: 6842, diskTotal: 51200 },
      total: videos.length,
      nextPageStart: videos.length,
      isLast: 'true'
    }
  }),
  getImagePreview: async ({ filePath } = {}) => ({ dataUrl: filePath || images[0] }),
  getVideoPreview: async () => ({ dataUrl: images[5] }),
  app: {
    ...realApi.app,
    fetchNotices: async () => ({ code: 0, data: [] }),
    reportHealth: noop,
    submitFeedback: noop,
    uploadLogs: noop
  },
  update: {
    ...realApi.update,
    checkForUpdates: async () => ({ code: 0, updateAvailable: false }),
    onUpdateChecking: listen,
    onUpdateAvailable: listen,
    onUpdateNotAvailable: listen,
    onDownloadProgress: listen,
    onUpdateDownloaded: listen,
    onUpdateError: listen,
    removeAllListeners: () => {}
  },
  download: {
    ...realApi.download,
    getTasks: async () => downloadTasks,
    getActiveTasks: async () => downloadTasks.filter((task) => task.status === 'downloading'),
    getStats: async () => ({
      total: 6,
      waiting: 1,
      downloading: 2,
      completed: 3,
      error: 0,
      paused: 0,
      cancelled: 0,
      active: 2
    }),
    getDefaultPath: async () => '/Users/demo/Pictures/企鹅相册',
    getConcurrency: async () => 3,
    getReplaceExistingSetting: async () => false,
    setCurrentUser: noop,
    setManagerOpen: noop,
    requestTasksPage: async () => ({
      tasks: downloadTasks,
      pagination: { page: 1, pageSize: 10, total: 6, totalPages: 1 }
    }),
    onStatsUpdate: listen,
    onActiveTasksUpdate: listen,
    onTaskChanges: listen,
    onTasksPage: listen,
    onActiveCountUpdate: listen,
    onDetailedStatusUpdate: listen,
    removeAllListeners: () => {}
  },
  upload: {
    ...realApi.upload,
    getTasks: async () => ({
      tasks: uploadTasks,
      pagination: { page: 1, pageSize: 10, total: 6, totalPages: 1 }
    }),
    getActiveTasks: async () => uploadTasks.filter((task) => task.status === 'uploading'),
    getStats: async () => ({
      total: 6,
      waiting: 1,
      uploading: 2,
      completed: 3,
      error: 0,
      paused: 0,
      cancelled: 0,
      active: 2
    }),
    getAlbumsWithStats: async () =>
      albums.map((album) => ({
        id: album.id,
        name: album.name,
        total: album.total,
        waiting: 0,
        uploading: album.id === 'demo-daily' ? 2 : 0,
        completed: album.id === 'demo-daily' ? 3 : 0
      })),
    getConcurrency: async () => 3,
    setCurrentUser: noop,
    setManagerOpen: noop,
    onStatsUpdate: listen,
    onActiveTasksUpdate: listen,
    onTaskChanges: listen,
    onTasksPage: listen,
    onActiveCountUpdate: listen,
    onDetailedStatusUpdate: listen,
    removeAllListeners: () => {}
  }
})
