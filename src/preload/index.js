import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_AUTH,
  IPC_DOWNLOAD,
  IPC_UPLOAD,
  IPC_PHOTO,
  IPC_USER,
  IPC_FRIEND,
  IPC_UPDATE,
  IPC_FILE,
  IPC_SHELL,
  IPC_WINDOW,
  IPC_AI_CONTROL,
  IPC_AI,
  IPC_APP,
  IPC_CLIPBOARD
} from '@shared/ipc-channels'
import { ipcClient } from '@preload/lib/ipc-client'
import { registerAuthExpiredCallback } from '@preload/lib/auth-checker'

try {
  const QzoneAPI = {
    // 获取二维码图片
    getAuthQRCode: () => ipcClient.call(IPC_AUTH.GET_QR),
    // 监听登录结果
    checkLoginState: (data) => ipcClient.call(IPC_AUTH.LISTEN_QR, data),
    // 获取登录ck
    getLoginInfo: (url) => ipcClient.call(IPC_AUTH.LOGIN_INFO, { url }),
    // 获取本地账号列表
    getLocalUnis: () => ipcClient.call(IPC_AUTH.LOCAL_UNIS),
    // 获取本地登录跳转的url用于登录
    getLocalLoginJump: (userInfo) => ipcClient.call(IPC_AUTH.LOCAL_LOGIN, { userInfo }),
    // 获取个人信息
    fetchUserInfo: () => ipcClient.call(IPC_USER.ME_INFO),
    // 获取相册列表
    getPhotoList: (data, meta) => ipcClient.call(IPC_PHOTO.PHOTO_LIST, data, meta),
    // 获取我的相册中的照片
    getPhotoByTopicId: (data, meta) => ipcClient.call(IPC_PHOTO.PHOTO_BY_TOPIC_ID, data, meta),
    // 获取照片浮层视图列表
    getPhotoFloatviewList: (data, meta) => ipcClient.call(IPC_PHOTO.PHOTO_FLOATVIEW_LIST, data, meta),
    // 获取照片或视频信息
    getPhotoOrVideoInfo: (data, meta) => ipcClient.call(IPC_PHOTO.PHOTO_OR_VIDEO_INFO, data, meta),
    // 获取视频信息
    getVideoInfo: (data, meta) => ipcClient.call(IPC_PHOTO.VIDEO_INFO, data, meta),
    // 批量获取视频信息
    batchGetVideoInfo: (data, meta) => ipcClient.call(IPC_PHOTO.BATCH_VIDEO_INFO, data, meta),
    // 删除照片
    deletePhotos: (data, meta) => ipcClient.call(IPC_PHOTO.DELETE_PHOTOS, data, meta),
    // 获取QQ空间动态（说说）
    getFeeds: (data, meta) => ipcClient.call(IPC_PHOTO.GET_FEEDS, data, meta),
    // 删除动态
    deleteFeed: (data, meta) => ipcClient.call(IPC_PHOTO.DELETE_FEED, data, meta),
    // 获取视频列表
    getVideoList: (data, meta) => ipcClient.call(IPC_PHOTO.GET_VIDEO_LIST, data, meta),
    // 获取相册问题和答案
    getAlbumQA: (data, meta) => ipcClient.call(IPC_PHOTO.GET_ALBUM_QA, data, meta),
    // 获取相册访客信息（总访客 / 今日访客 / 最近访客列表）
    getAlbumVisitors: (data, meta) => ipcClient.call(IPC_PHOTO.GET_ALBUM_VISITORS, data, meta),
    // 获取好友照片动态流
    getFriendPhotos: (data, meta) => ipcClient.call(IPC_PHOTO.GET_FRIEND_PHOTOS, data, meta),
    // 获取「好友动态」时间线（scope=0 好友 / scope=7 特别关心）
    getFriendFeeds: (data, meta) => ipcClient.call(IPC_PHOTO.GET_FRIEND_FEEDS, data, meta),
    // 获取「我的主页 / 好友主页」时间线
    getHomeFeeds: (data, meta) => ipcClient.call(IPC_PHOTO.GET_HOME_FEEDS, data, meta),
    // 拉某条好友动态的评论列表（顶层评论 + 子回复，预渲染 HTML）
    getFeedComments: (data, meta) => ipcClient.call(IPC_PHOTO.GET_FEED_COMMENTS, data, meta),
    // 顶部 5 类动态未读计数（动态 tab 角标）
    getFeedsCount: (data, meta) => ipcClient.call(IPC_PHOTO.GET_FEEDS_COUNT, data, meta),
    // 「与我相关」时间线（feeds2_html_pav_all）
    getAboutMeFeeds: (data, meta) => ipcClient.call(IPC_PHOTO.GET_ABOUT_ME_FEEDS, data, meta),
    // 「那年今日」时间线（feeds2_html_today_lastyear）
    getLastYearFeeds: (data, meta) => ipcClient.call(IPC_PHOTO.GET_LAST_YEAR_FEEDS, data, meta),
    // 「我的收藏」列表（get_fav_list）
    getFavList: (data, meta) => ipcClient.call(IPC_PHOTO.GET_FAV_LIST, data, meta),
    // 获取好友亲密度列表
    getFriendList: (data, meta) => ipcClient.call(IPC_FRIEND.GET_FRIEND_LIST, data, meta),
    // 获取 QQ 好友及分组
    getQQFriends: (data, meta) => ipcClient.call(IPC_FRIEND.GET_QQ_FRIENDS, data, meta),
    // 获取好友个人名片（真实姓名、亲密度、星座等）
    getPersonalCard: (data, meta) => ipcClient.call(IPC_USER.PERSONAL_CARD, data, meta),
    // 获取访客在线状态
    getVisitorStatus: (meta) => ipcClient.call(IPC_USER.VISITOR_STATUS, {}, meta),
    // 获取访客详细记录
    getVisitorDetail: (data, meta) => ipcClient.call(IPC_USER.VISITOR_DETAIL, data, meta),
    // 获取说说列表（含评论IP、设备型号）
    getShuoshuo: (data, meta) => ipcClient.call(IPC_USER.SHUOSHUO, data, meta),
    // 同步给内置 QQ 空间网页窗口使用，避免打开用户主页时重复登录
    setQzoneAuth: (auth) => ipcRenderer.invoke(IPC_WINDOW.SET_QZONE_AUTH, auth),

    // 文件系统相关API
    openFileDialog: (data) => ipcClient.call(IPC_FILE.DIALOG_OPEN_FILE, data),
    getFileInfo: (data) => ipcClient.call(IPC_FILE.GET_FILE_INFO, data),
    getImagePreview: (data) => ipcClient.call(IPC_FILE.GET_IMAGE_PREVIEW, data),
    getVideoPreview: (data) => ipcClient.call(IPC_FILE.GET_VIDEO_PREVIEW, data),
    getVideoMetadata: (data) => ipcClient.call(IPC_FILE.GET_VIDEO_METADATA, data),
    getFolderPhotoCount: (data) => ipcClient.call(IPC_FILE.GET_FOLDER_PHOTO_COUNT, data),

    // 下载相关API
    download: {
      // 任务管理
      addTask: (options) => ipcClient.call(IPC_DOWNLOAD.ADD_TASK, options),
      addAlbum: (albumData) => ipcClient.call(IPC_DOWNLOAD.ADD_ALBUM, albumData),
      addFeeds: (feedsData) => ipcClient.call(IPC_DOWNLOAD.ADD_FEEDS, feedsData),
      getTasks: (params = {}) => ipcClient.call(IPC_DOWNLOAD.GET_TASKS, params),
      getActiveTasks: () => ipcClient.call(IPC_DOWNLOAD.GET_ACTIVE_TASKS),
      getStats: () => ipcClient.call(IPC_DOWNLOAD.GET_STATS),

      // 任务控制
      pauseTask: (taskId) => ipcClient.call(IPC_DOWNLOAD.PAUSE_TASK, taskId),
      resumeTask: (taskId) => ipcClient.call(IPC_DOWNLOAD.RESUME_TASK, taskId),
      retryTask: (taskId) => ipcClient.call(IPC_DOWNLOAD.RETRY_TASK, taskId),
      deleteTask: (params) => ipcClient.call(IPC_DOWNLOAD.DELETE_TASK, params),

      // 批量操作
      cancelAll: () => ipcClient.call(IPC_DOWNLOAD.CANCEL_ALL),
      resumeAll: () => ipcClient.call(IPC_DOWNLOAD.RESUME_ALL),
      clearTasks: () => ipcClient.call(IPC_DOWNLOAD.CLEAR_TASKS),

      // 文件操作
      selectDirectory: () => ipcClient.call(IPC_DOWNLOAD.SELECT_DIRECTORY),
      openFolder: (folderPath) => ipcClient.call(IPC_DOWNLOAD.OPEN_FOLDER, { folderPath }),
      getDefaultPath: () => ipcClient.call(IPC_DOWNLOAD.GET_DEFAULT_PATH),
      setDefaultPath: (path) => ipcClient.call(IPC_DOWNLOAD.SET_DEFAULT_PATH, path),

      // 设置管理
      getConcurrency: () => ipcClient.call(IPC_DOWNLOAD.GET_CONCURRENCY),
      setConcurrency: (concurrency) => ipcClient.call(IPC_DOWNLOAD.SET_CONCURRENCY, concurrency),
      getReplaceExistingSetting: () => ipcClient.call(IPC_DOWNLOAD.GET_REPLACE_EXISTING),
      setReplaceExistingSetting: (replaceExisting) =>
        ipcClient.call(IPC_DOWNLOAD.SET_REPLACE_EXISTING, replaceExisting),

      // 用户管理
      setCurrentUser: (uin) => ipcClient.call(IPC_DOWNLOAD.SET_CURRENT_USER, { uin }),

      // 事件监听 - 新的推送事件
      onStatsUpdate: (callback) => ipcClient.on(IPC_DOWNLOAD.STATS_UPDATE, callback),
      onActiveTasksUpdate: (callback) => ipcClient.on(IPC_DOWNLOAD.ACTIVE_TASKS_UPDATE, callback),
      onTaskChanges: (callback) => ipcClient.on(IPC_DOWNLOAD.TASK_CHANGES, callback),
      onTasksPage: (callback) => ipcClient.on(IPC_DOWNLOAD.TASKS_PAGE, callback),
      onActiveCountUpdate: (callback) => ipcClient.on(IPC_DOWNLOAD.ACTIVE_COUNT_UPDATE, callback),
      onDetailedStatusUpdate: (callback) =>
        ipcClient.on(IPC_DOWNLOAD.DETAILED_STATUS_UPDATE, callback),

      // 移除监听器
      removeAllListeners: () => {
        ipcClient.removeAllListeners(IPC_DOWNLOAD.STATS_UPDATE)
        ipcClient.removeAllListeners(IPC_DOWNLOAD.ACTIVE_TASKS_UPDATE)
        ipcClient.removeAllListeners(IPC_DOWNLOAD.TASK_CHANGES)
        ipcClient.removeAllListeners(IPC_DOWNLOAD.TASKS_PAGE)
        ipcClient.removeAllListeners(IPC_DOWNLOAD.ACTIVE_COUNT_UPDATE)
        // ipcClient.removeAllListeners(IPC_DOWNLOAD.DETAILED_STATUS_UPDATE)
      },

      // 设置下载管理器打开状态
      setManagerOpen: (isOpen) => ipcClient.call(IPC_DOWNLOAD.SET_MANAGER_OPEN, { isOpen }),

      // 请求分页任务列表
      requestTasksPage: (params = {}) => ipcClient.call(IPC_DOWNLOAD.REQUEST_TASKS_PAGE, params)
    },

    // 上传相关API
    upload: {
      // 任务管理
      addTask: (options) => ipcClient.call(IPC_UPLOAD.ADD_TASK, options),
      addBatchTasks: (files, albumId, albumName, sessionId) =>
        ipcClient.call(IPC_UPLOAD.ADD_BATCH_TASKS, { files, albumId, albumName, sessionId }),
      getTasks: (params = {}) => ipcClient.call(IPC_UPLOAD.GET_TASKS, params),
      getActiveTasks: () => ipcClient.call(IPC_UPLOAD.GET_ACTIVE_TASKS),
      getPendingTasksByAlbum: (albumId) =>
        ipcClient.call(IPC_UPLOAD.GET_PENDING_TASKS_BY_ALBUM, albumId),
      getTasksBySession: (sessionId) => ipcClient.call(IPC_UPLOAD.GET_TASKS_BY_SESSION, sessionId),
      getStats: () => ipcClient.call(IPC_UPLOAD.GET_STATS),

      // 任务控制
      pauseTask: (taskId) => ipcClient.call(IPC_UPLOAD.PAUSE_TASK, taskId),
      resumeTask: (taskId) => ipcClient.call(IPC_UPLOAD.RESUME_TASK, taskId),
      retryTask: (taskId) => ipcClient.call(IPC_UPLOAD.RETRY_TASK, taskId),
      deleteTask: (taskId) => ipcClient.call(IPC_UPLOAD.DELETE_TASK, taskId),

      // 批量操作
      cancelAll: () => ipcClient.call(IPC_UPLOAD.CANCEL_ALL),
      cancelTasksByAlbum: (albumId, sessionId = null) =>
        ipcClient.call(IPC_UPLOAD.CANCEL_TASKS_BY_ALBUM, { albumId, sessionId }),
      deleteTasksBySession: (sessionId) =>
        ipcClient.call(IPC_UPLOAD.DELETE_TASKS_BY_SESSION, sessionId),
      pauseAll: () => ipcClient.call(IPC_UPLOAD.PAUSE_ALL),
      resumeAll: () => ipcClient.call(IPC_UPLOAD.RESUME_ALL),
      clearTasks: () => ipcClient.call(IPC_UPLOAD.CLEAR_TASKS),
      retryAllFailed: (albumId = null) => ipcClient.call(IPC_UPLOAD.RETRY_ALL_FAILED, albumId),
      clearCompleted: (albumId = null) => ipcClient.call(IPC_UPLOAD.CLEAR_COMPLETED, albumId),
      clearCancelled: (albumId = null) => ipcClient.call(IPC_UPLOAD.CLEAR_CANCELLED, albumId),

      // 设置管理
      getConcurrency: () => ipcClient.call(IPC_UPLOAD.GET_CONCURRENCY),
      setConcurrency: (concurrency) => ipcClient.call(IPC_UPLOAD.SET_CONCURRENCY, concurrency),

      // 用户管理
      setCurrentUser: (uin, p_skey, hostUin) =>
        ipcClient.call(IPC_UPLOAD.SET_CURRENT_USER, { uin, p_skey, hostUin }),

      // 相册管理
      getAlbumsWithStats: () => ipcClient.call(IPC_UPLOAD.GET_ALBUMS_WITH_STATS),
      getAlbumStats: (albumId) => ipcClient.call(IPC_UPLOAD.GET_ALBUM_STATS, albumId),

      // 事件监听 - 推送事件
      onStatsUpdate: (callback) => ipcClient.on(IPC_UPLOAD.STATS_UPDATE, callback),
      onActiveTasksUpdate: (callback) => ipcClient.on(IPC_UPLOAD.ACTIVE_TASKS_UPDATE, callback),
      onTaskChanges: (callback) => ipcClient.on(IPC_UPLOAD.TASK_CHANGES, callback),
      onTasksPage: (callback) => ipcClient.on(IPC_UPLOAD.TASKS_PAGE, callback),
      onActiveCountUpdate: (callback) => ipcClient.on(IPC_UPLOAD.ACTIVE_COUNT_UPDATE, callback),
      onDetailedStatusUpdate: (callback) =>
        ipcClient.on(IPC_UPLOAD.DETAILED_STATUS_UPDATE, callback),

      // 移除监听器
      removeAllListeners: () => {
        ipcClient.removeAllListeners(IPC_UPLOAD.STATS_UPDATE)
        ipcClient.removeAllListeners(IPC_UPLOAD.ACTIVE_TASKS_UPDATE)
        ipcClient.removeAllListeners(IPC_UPLOAD.TASK_CHANGES)
        ipcClient.removeAllListeners(IPC_UPLOAD.TASKS_PAGE)
        ipcClient.removeAllListeners(IPC_UPLOAD.ACTIVE_COUNT_UPDATE)
        ipcClient.removeAllListeners(IPC_UPLOAD.DETAILED_STATUS_UPDATE)
      },

      // 设置上传管理器打开状态
      setManagerOpen: (isOpen) => ipcClient.call(IPC_UPLOAD.SET_MANAGER_OPEN, isOpen),

      // 请求分页任务列表
      requestTasksPage: (params = {}) => ipcClient.call(IPC_UPLOAD.REQUEST_TASKS_PAGE, params)
    },

    // 剪贴板相关API
    clipboard: {
      writeText: (text) => ipcClient.call(IPC_CLIPBOARD.WRITE_TEXT, { text })
    },

    // 更新相关API
    update: {
      // 检查更新
      checkForUpdates: () => ipcClient.call(IPC_UPDATE.CHECK_UPDATE),
      // 下载更新
      downloadUpdate: () => ipcClient.call(IPC_UPDATE.DOWNLOAD_UPDATE),
      // 取消下载
      cancelDownload: () => ipcClient.call(IPC_UPDATE.CANCEL_DOWNLOAD),
      // 安装更新
      installUpdate: () => ipcClient.call(IPC_UPDATE.INSTALL_UPDATE),
      // 获取下载进度
      getProgress: () => ipcClient.call(IPC_UPDATE.GET_PROGRESS),

      // 更新事件监听
      onUpdateChecking: (callback) => ipcClient.on(IPC_UPDATE.CHECKING, callback),
      onUpdateAvailable: (callback) => ipcClient.on(IPC_UPDATE.AVAILABLE, callback),
      onUpdateNotAvailable: (callback) => ipcClient.on(IPC_UPDATE.NOT_AVAILABLE, callback),
      onDownloadProgress: (callback) => ipcClient.on(IPC_UPDATE.DOWNLOAD_PROGRESS, callback),
      onUpdateDownloaded: (callback) => ipcClient.on(IPC_UPDATE.DOWNLOADED, callback),
      onUpdateError: (callback) => ipcClient.on(IPC_UPDATE.ERROR, callback),
      // 移除监听器
      removeAllListeners: () => {
        ipcClient.removeAllListeners(IPC_UPDATE.CHECKING)
        ipcClient.removeAllListeners(IPC_UPDATE.AVAILABLE)
        ipcClient.removeAllListeners(IPC_UPDATE.NOT_AVAILABLE)
        ipcClient.removeAllListeners(IPC_UPDATE.DOWNLOAD_PROGRESS)
        ipcClient.removeAllListeners(IPC_UPDATE.DOWNLOADED)
        ipcClient.removeAllListeners(IPC_UPDATE.ERROR)
      }
    },

    shell: {
      openExternal: (url) => ipcClient.call(IPC_SHELL.OPEN_EXTERNAL, url)
    },

    // AI 相关 API
    ai: {
      // 开启防止休眠
      startBlockSleep: () => ipcClient.call(IPC_AI_CONTROL.START_BLOCK_SLEEP),
      // 关闭防止休眠
      stopBlockSleep: () => ipcClient.call(IPC_AI_CONTROL.STOP_BLOCK_SLEEP),
      // 初始化 AI 引擎环境
      initWorkerEnvironment: () => ipcClient.call(IPC_AI.INIT_ENGINE),
      /** 开始扫描 */
      startScan: (paths) => ipcClient.call(IPC_AI.SCAN_START, { paths }),
      /** 停止扫描 */
      stopScan: () => ipcClient.call(IPC_AI.SCAN_STOP),
      /** 懒删除照片记录 */
      deletePhoto: (path) => ipcClient.call(IPC_AI.DELETE_PHOTO, { path }),
      /** 获取模型状态 */
      // 获取人脸聚类
      getFaceGroups: () => ipcClient.call(IPC_AI.GET_FACE_GROUPS),
      // 获取人脸照片
      getPhotosByFace: (faceId) => ipcClient.call(IPC_AI.GET_PHOTOS_BY_FACE, { faceId }),
      // 检查模型是否存在
      checkModels: () => ipcClient.call(IPC_AI.CHECK_MODELS),
      // 检查引擎运行状态 (Ping)
      checkStatus: () => ipcClient.call(IPC_AI.CHECK_STATUS),
      // 监听进度
      onScanProgress: (callback) => ipcClient.on(IPC_AI.SCAN_PROGRESS, callback),
      // 移除监听
      removeScanProgress: () => ipcClient.removeAllListeners(IPC_AI.SCAN_PROGRESS),
      // 监听下载进度
      onDownloadProgress: (callback) => ipcClient.on(IPC_AI.DOWNLOAD_PROGRESS, callback),
      // 移除下载监听
      removeDownloadProgress: () => ipcClient.removeAllListeners(IPC_AI.DOWNLOAD_PROGRESS),
      // 监听服务状态
      onStatusChange: (callback) => ipcClient.on(IPC_AI.STATUS_CHANGE, callback),
      // 移除服务状态监听
      removeStatusChange: () => ipcClient.removeAllListeners(IPC_AI.STATUS_CHANGE),
      /** 启动全局分析 */
      startGlobalAnalysis: () => ipcClient.call(IPC_AI.START_GLOBAL_ANALYSIS),
      /** 获取待处理记录数量 */
      getPendingCount: () => ipcClient.call(IPC_AI.GET_PENDING_COUNT),
      /** 获取存储占用大小 */
      getStorageSize: () => ipcClient.call(IPC_AI.GET_STORAGE_SIZE),
      /** 启动静默扫描 */
      startBackgroundScan: (paths) => ipcClient.call(IPC_AI.START_BACKGROUND_SCAN, { paths }),
      /** 获取服务当前状态 */
      getServiceStatus: () => ipcClient.call(IPC_AI.GET_SERVICE_STATUS),
      /** 设置实时监控路径 */
      setWatchPaths: (paths) => ipcClient.call(IPC_AI.SET_WATCH_PATHS, { paths }),
      /** 触发人物聚类整理 */
      clusterFaces: () => ipcClient.call(IPC_AI.CLUSTER_FACES),
      /** 重启服务 */
      restart: () => ipcClient.call(IPC_AI.RESTART)
    },

    // 应用信息
    app: {
      getInfo: () => ipcClient.call(IPC_APP.GET_INFO),
      fetchNotices: (options = {}) => ipcClient.call(IPC_APP.FETCH_NOTICES, options),
      submitFeedback: (payload = {}) => ipcClient.call(IPC_APP.SUBMIT_FEEDBACK, payload),
      reportHealth: (payload = {}) => ipcClient.call(IPC_APP.REPORT_HEALTH, payload),
      startMonitor: () => ipcClient.call(IPC_APP.START_MONITOR),
      stopMonitor: () => ipcClient.call(IPC_APP.STOP_MONITOR),
      getGPUInfo: () => ipcClient.call(IPC_APP.GET_GPU_INFO),
      onMonitorStats: (callback) => ipcClient.on(IPC_APP.MONITOR_STATS, callback),
      removeMonitorStats: () => ipcClient.removeAllListeners(IPC_APP.MONITOR_STATS)
    },

    // 窗口相关API
    window: {
      openQzoneWeb: (data) => ipcClient.call(IPC_WINDOW.OPEN_QZONE_WEB, data)
    }
  }

  // 通用API - 包含窗口控制等基础功能
  const api = {
    // 调用主进程方法
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    // 监听主进程事件
    on: (channel, callback) => {
      const wrappedCallback = (event, ...args) => callback(...args)
      ipcRenderer.on(channel, wrappedCallback)
      return () => ipcRenderer.removeListener(channel, wrappedCallback)
    },
    // 移除监听器
    off: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    // 发送事件到主进程
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    // 注册认证过期回调
    onAuthExpired: (callback) => {
      registerAuthExpiredCallback(callback)
    }
  }

  contextBridge.exposeInMainWorld('api', api)

  contextBridge.exposeInMainWorld('QzoneAPI', QzoneAPI)
} catch (error) {
  console.error('[Preload] 暴露API失败:', error)
  console.error('[Preload] 错误堆栈:', error.stack)
}
