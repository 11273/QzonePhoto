export const IPC_AUTH = {
  /** 获取二维码 */
  GET_QR: 'auth:getQrcodeImg',
  /** 获取扫码结果 */
  LISTEN_QR: 'auth:listenScanResult',
  /** 扫码成功获取登录信息 */
  LOGIN_INFO: 'auth:getLoginInfo',
  /** 获取本地账号列表 */
  LOCAL_UNIS: 'auth:getLocalUnis',
  /** 获取本地登录跳转的url用于登录 */
  LOCAL_LOGIN: 'auth:localLogin'
}

export const IPC_PHOTO = {
  /** 获取我的相册列表 */
  PHOTO_LIST: 'photo:getPhotoList',
  /** 获取我的相册中的照片 */
  PHOTO_BY_TOPIC_ID: 'photo:getPhotoByTopicId',
  /** 获取照片浮层视图列表 */
  PHOTO_FLOATVIEW_LIST: 'photo:getPhotoFloatviewList',
  /** 获取照片或视频信息 */
  PHOTO_OR_VIDEO_INFO: 'photo:getPhotoOrVideoInfo',
  /** 获取视频信息 */
  VIDEO_INFO: 'photo:getVideoInfo',
  /** 批量获取视频信息 */
  BATCH_VIDEO_INFO: 'photo:batchGetVideoInfo',
  /** 删除照片 */
  DELETE_PHOTOS: 'photo:deletePhotos'
}

export const IPC_USER = {
  /** 获取我的信息 */
  ME_INFO: 'user:getMeInfo'
}

export const IPC_DOWNLOAD = {
  /** 添加下载任务 */
  ADD_TASK: 'download:addTask',
  /** 添加相册下载 */
  ADD_ALBUM: 'download:addAlbum',
  /** 获取任务列表（分页） */
  GET_TASKS: 'download:getTasks',
  /** 获取活跃任务 */
  GET_ACTIVE_TASKS: 'download:getActiveTasks',
  /** 获取任务统计 */
  GET_STATS: 'download:getStats',
  /** 暂停任务 */
  PAUSE_TASK: 'download:pauseTask',
  /** 继续任务 */
  RESUME_TASK: 'download:resumeTask',
  /** 重试任务 */
  RETRY_TASK: 'download:retryTask',
  /** 删除任务 */
  DELETE_TASK: 'download:deleteTask',
  /** 取消所有任务 */
  CANCEL_ALL: 'download:cancelAll',
  /** 恢复所有任务 */
  RESUME_ALL: 'download:resumeAll',
  /** 清空任务列表 */
  CLEAR_TASKS: 'download:clearTasks',
  /** 打开下载文件夹 */
  OPEN_FOLDER: 'download:openFolder',
  /** 选择下载目录 */
  SELECT_DIRECTORY: 'download:selectDirectory',
  /** 获取默认下载路径 */
  GET_DEFAULT_PATH: 'download:getDefaultPath',
  /** 设置默认下载路径 */
  SET_DEFAULT_PATH: 'download:setDefaultPath',
  /** 获取并发数 */
  GET_CONCURRENCY: 'download:getConcurrency',
  /** 设置并发数 */
  SET_CONCURRENCY: 'download:setConcurrency',
  /** 获取文件替换设置 */
  GET_REPLACE_EXISTING: 'download:getReplaceExisting',
  /** 设置文件替换选项 */
  SET_REPLACE_EXISTING: 'download:setReplaceExisting',
  /** 设置下载管理器打开状态 */
  SET_MANAGER_OPEN: 'download:setManagerOpen',
  /** 请求分页任务列表 */
  REQUEST_TASKS_PAGE: 'download:requestTasksPage',
  /** 设置当前用户 */
  SET_CURRENT_USER: 'download:setCurrentUser',

  // 推送事件
  /** 统计信息更新推送 */
  STATS_UPDATE: 'download:stats-update',
  /** 活跃任务更新推送 */
  ACTIVE_TASKS_UPDATE: 'download:active-tasks-update',
  /** 任务变化推送 */
  TASK_CHANGES: 'download:task-changes',
  /** 分页任务列表推送 */
  TASKS_PAGE: 'download:tasks-page',
  /** 活跃任务数量推送 */
  ACTIVE_COUNT_UPDATE: 'download:active-count-update',
  /** 详细状态推送（用于首页显示） */
  DETAILED_STATUS_UPDATE: 'download:detailed-status-update'
}

export const IPC_UPLOAD = {
  /** 添加上传任务 */
  ADD_TASK: 'upload:addTask',
  /** 批量添加上传任务 */
  ADD_BATCH_TASKS: 'upload:addBatchTasks',
  /** 获取任务列表（分页） */
  GET_TASKS: 'upload:getTasks',
  /** 获取活跃任务 */
  GET_ACTIVE_TASKS: 'upload:getActiveTasks',
  /** 获取任务统计 */
  GET_STATS: 'upload:getStats',
  /** 暂停任务 */
  PAUSE_TASK: 'upload:pauseTask',
  /** 继续任务 */
  RESUME_TASK: 'upload:resumeTask',
  /** 重试任务 */
  RETRY_TASK: 'upload:retryTask',
  /** 删除任务 */
  DELETE_TASK: 'upload:deleteTask',
  /** 取消所有任务 */
  CANCEL_ALL: 'upload:cancelAll',
  /** 取消特定相册或会话的任务 */
  CANCEL_TASKS_BY_ALBUM: 'upload:cancelTasksByAlbum',
  /** 删除特定会话的所有任务 */
  DELETE_TASKS_BY_SESSION: 'upload:deleteTasksBySession',
  /** 暂停所有任务 */
  PAUSE_ALL: 'upload:pauseAll',
  /** 恢复所有任务 */
  RESUME_ALL: 'upload:resumeAll',
  /** 清空任务列表 */
  CLEAR_TASKS: 'upload:clearTasks',
  /** 获取并发数 */
  GET_CONCURRENCY: 'upload:getConcurrency',
  /** 设置并发数 */
  SET_CONCURRENCY: 'upload:setConcurrency',
  /** 设置上传管理器打开状态 */
  SET_MANAGER_OPEN: 'upload:setManagerOpen',
  /** 请求分页任务列表 */
  REQUEST_TASKS_PAGE: 'upload:requestTasksPage',
  /** 设置当前用户 */
  SET_CURRENT_USER: 'upload:setCurrentUser',
  /** 获取所有相册及其统计信息 */
  GET_ALBUMS_WITH_STATS: 'upload:getAlbumsWithStats',
  /** 获取指定相册的统计信息 */
  GET_ALBUM_STATS: 'upload:getAlbumStats',
  /** 批量重试失败任务 */
  RETRY_ALL_FAILED: 'upload:retryAllFailed',
  /** 清理完成的任务 */
  CLEAR_COMPLETED: 'upload:clearCompleted',
  /** 清理取消的任务 */
  CLEAR_CANCELLED: 'upload:clearCancelled',
  /** 获取指定相册的未完成任务 */
  GET_PENDING_TASKS_BY_ALBUM: 'upload:getPendingTasksByAlbum',
  /** 获取指定会话的所有任务 */
  GET_TASKS_BY_SESSION: 'upload:getTasksBySession',

  // 推送事件
  /** 统计信息更新推送 */
  STATS_UPDATE: 'upload:stats-update',
  /** 活跃任务更新推送 */
  ACTIVE_TASKS_UPDATE: 'upload:active-tasks-update',
  /** 任务变化推送 */
  TASK_CHANGES: 'upload:task-changes',
  /** 分页任务列表推送 */
  TASKS_PAGE: 'upload:tasks-page',
  /** 活跃任务数量推送 */
  ACTIVE_COUNT_UPDATE: 'upload:active-count-update',
  /** 详细状态推送（用于首页显示） */
  DETAILED_STATUS_UPDATE: 'upload:detailed-status-update'
}

export const IPC_UPDATE = {
  /** 检查更新 */
  CHECK_UPDATE: 'update:check',
  /** 下载更新 */
  DOWNLOAD_UPDATE: 'update:download',
  /** 取消下载 */
  CANCEL_DOWNLOAD: 'update:cancelDownload',
  /** 安装更新 */
  INSTALL_UPDATE: 'update:install',
  /** 获取下载进度 */
  GET_PROGRESS: 'update:getProgress',
  /** 获取下载状态 */
  GET_STATUS: 'update:getStatus',
  /** 更新检查中 */
  CHECKING: 'update:checking',
  /** 发现更新 */
  AVAILABLE: 'update:available',
  /** 没有更新 */
  NOT_AVAILABLE: 'update:notAvailable',
  /** 下载进度 */
  DOWNLOAD_PROGRESS: 'update:downloadProgress',
  /** 更新已下载 */
  DOWNLOADED: 'update:downloaded',
  /** 更新错误 */
  ERROR: 'update:error'
}

export const IPC_WINDOW = {
  /** 最小化窗口 */
  MINIMIZE: 'window:minimize',
  /** 最大化/还原窗口 */
  MAXIMIZE: 'window:maximize',
  /** 关闭窗口 */
  CLOSE: 'window:close',
  /** 获取窗口状态 */
  IS_MAXIMIZED: 'window:isMaximized',
  /** 窗口最大化事件 */
  MAXIMIZED: 'window:maximized',
  /** 打开QQ空间官网 */
  OPEN_QZONE_WEB: 'window:openQzoneWeb'
}

export const IPC_APP = {
  /** 获取应用信息 */
  GET_INFO: 'app:getInfo'
}

export const IPC_SHELL = {
  /** 打开外部链接 */
  OPEN_EXTERNAL: 'shell:openExternal'
}

export const IPC_FILE = {
  /** 打开文件对话框 */
  DIALOG_OPEN_FILE: 'dialog:openFile',
  /** 获取文件信息 */
  GET_FILE_INFO: 'file:getInfo',
  /** 获取图片预览 */
  GET_IMAGE_PREVIEW: 'file:getImagePreview',
  /** 获取视频预览 */
  GET_VIDEO_PREVIEW: 'file:getVideoPreview',
  /** 获取视频元数据 */
  GET_VIDEO_METADATA: 'file:getVideoMetadata'
}

// 避免键名冲突，创建所有通道值的集合
const ALL_CHANNEL_VALUES = [
  ...Object.values(IPC_AUTH),
  ...Object.values(IPC_PHOTO),
  ...Object.values(IPC_USER),
  ...Object.values(IPC_DOWNLOAD),
  ...Object.values(IPC_UPLOAD),
  ...Object.values(IPC_UPDATE),
  ...Object.values(IPC_WINDOW),
  ...Object.values(IPC_APP),
  ...Object.values(IPC_SHELL),
  ...Object.values(IPC_FILE)
]

// 为了向后兼容，保留 ALL_CHANNELS 对象（用于某些场景）
export const ALL_CHANNELS = {
  ...IPC_AUTH,
  ...IPC_PHOTO,
  ...IPC_USER,
  ...IPC_DOWNLOAD, // 下载优先
  ...IPC_UPDATE,
  ...IPC_WINDOW,
  ...IPC_APP,
  ...IPC_SHELL,
  ...IPC_FILE
}

// 辅助方法：验证通道白名单
export function validateChannel(channel) {
  // 使用 ALL_CHANNEL_VALUES 数组来避免键名冲突问题
  if (!ALL_CHANNEL_VALUES.includes(channel)) {
    throw new Error(`非法IPC通道调用: ${channel}`)
  }
}
