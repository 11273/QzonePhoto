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
  BATCH_VIDEO_INFO: 'photo:batchGetVideoInfo'
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
  MAXIMIZED: 'window:maximized'
}

export const IPC_APP = {
  /** 获取应用信息 */
  GET_INFO: 'app:getInfo'
}

export const IPC_SHELL = {
  /** 打开外部链接 */
  OPEN_EXTERNAL: 'shell:openExternal'
}

export const ALL_CHANNELS = {
  ...IPC_AUTH,
  ...IPC_PHOTO,
  ...IPC_USER,
  ...IPC_DOWNLOAD,
  ...IPC_UPDATE,
  ...IPC_WINDOW,
  ...IPC_APP,
  ...IPC_SHELL
}

// 辅助方法：验证通道白名单
export function validateChannel(channel) {
  if (!Object.values(ALL_CHANNELS).includes(channel)) {
    throw new Error(`非法IPC通道调用: ${channel}`)
  }
}
