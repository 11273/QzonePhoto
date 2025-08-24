export const APP_ID = 'com.qzonephoto.app'
export const APP_NAME = 'QzonePhoto'
export const APP_HOMEPAGE = 'https://github.com/11273/QzonePhoto'
export const APP_DESCRIPTION = 'Qzone Photo - QQ空间相册'

// QQ空间相册配置 - 基于官方源码
export const QZONE_CONFIG = {
  // 权限映射
  privMap: {
    1: '所有人可见',
    2: '密码访问',
    3: '仅自己可见',
    4: 'QQ好友可见',
    5: '回答问题的人可见',
    6: '部分好友可见',
    8: '部分好友不可见'
  },

  // 朋友圈权限映射
  pyPrivMap: {
    1: '公开',
    3: '仅主人可见',
    4: '好友和同学可见'
  },

  // 相册分类映射
  classMap: {
    100: '最爱',
    101: '人物',
    102: '风景',
    103: '动物',
    104: '游记',
    105: '卡通',
    106: '生活',
    107: '其他'
  },

  // 容器配置
  container: {
    width: 1400,
    minWidth: 740,
    maxWidth: 1920
  },

  // 相册封面配置
  albumCover: {
    width: 70,
    height: 70
  },

  // 相册项目配置
  albumItem: {
    width: 192,
    ratio: 1,
    footerHeight: 34,
    minWidth: 192,
    maxWidth: 200,
    paddingH: 15,
    paddingV: 35,
    innerPaddingH: 6,
    innerPaddingV: 6,
    imgRatio: 1
  },

  // 照片项配置
  item: {
    width: 160,
    ratio: 0.75,
    footerHeight: 32,
    minWidth: 160,
    maxWidth: 200,
    paddingH: 15,
    paddingV: 35,
    innerPaddingH: 0,
    innerPaddingV: 0,
    imgRatio: 0.75
  },

  // 小尺寸照片项配置
  itemSmall: {
    width: 100,
    ratio: 0.75,
    footerHeight: 0,
    minWidth: 100,
    maxWidth: 100,
    paddingH: 15,
    paddingV: 35,
    innerPaddingH: 0,
    innerPaddingV: 0,
    imgRatio: 0.75
  },

  // 请求参数配置
  photoNumPerRequestMax: 30,
  photoNumPerRequest: 30,
  photoNumPerPageMax: 100,
  photoNumPerPage: 100,
  photoSelectedMax: 500
}

// 辅助函数 - 检查权限功能
export const QZONE_UTILS = {
  /**
   * 检查是否允许转载
   */
  checkAllowReprint: (album) => {
    // 根据相册权限判断是否允许转载
    return album && album.allowReprint === 1
  },

  /**
   * 检查是否允许分享
   */
  checkAllowShare: (album) => {
    // 根据相册权限判断是否允许分享
    return album && album.allowShare !== 0
  },

  /**
   * 检查是否允许圈人
   */
  checkAllowMark: (album) => {
    // 根据相册权限判断是否允许圈人
    return album && album.allowMark === 1
  },

  /**
   * 检查是否显示相机信息
   */
  checkShowCameraInfo: (album) => {
    // 根据相册设置判断是否显示相机型号和拍摄时间
    return album && album.showCameraInfo === 1
  },

  /**
   * 获取相册权限文本
   */
  getAlbumPermissionText: (album) => {
    if (!album) return ''

    const parts = []
    const privText = QZONE_CONFIG.privMap[album.priv] || '未知权限'
    parts.push(privText)

    // 检查功能权限
    const features = []
    if (QZONE_UTILS.checkAllowReprint(album)) features.push('转载')
    if (QZONE_UTILS.checkAllowShare(album)) features.push('分享')
    if (QZONE_UTILS.checkAllowMark(album)) features.push('圈人')

    if (features.length > 0) {
      parts.push('允许' + features.join('、'))
    }

    // 检查相机信息显示
    if (QZONE_UTILS.checkShowCameraInfo(album)) {
      parts.push('显示相机型号、拍摄时间')
    }

    return parts.join(' / ')
  }
}
