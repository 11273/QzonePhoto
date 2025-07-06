import { cgi_list_photo, fcg_list_album_v3, cgi_floatview_photo_list_v2 } from '@main/api'

export class QzonePhotoService {
  constructor() {}
  async getPhotoList({ hostUin, pageStart, pageNum }, { uin, p_skey }) {
    return await fcg_list_album_v3(uin, p_skey, hostUin, pageStart, pageNum)
  }

  async getPhotoByTopicId({ hostUin, pageStart, pageNum, topicId }, { uin, p_skey }) {
    return await cgi_list_photo(uin, p_skey, hostUin, pageStart, pageNum, topicId)
  }

  async getPhotoFloatviewList(
    { hostUin, topicId, picKey, cmtNum, isFirst, postNum },
    { uin, p_skey }
  ) {
    return await cgi_floatview_photo_list_v2(
      uin,
      p_skey,
      hostUin,
      topicId,
      picKey,
      cmtNum,
      isFirst,
      postNum
    )
  }

  async getPhotoOrVideoInfo({ hostUin, topicId, picKey }, { uin, p_skey }) {
    // 参数验证
    if (!topicId || !picKey) {
      console.error('getPhotoOrVideoInfo 参数不完整:', { hostUin, topicId, picKey })
      return null
    }

    const res = await cgi_floatview_photo_list_v2(uin, p_skey, hostUin, topicId, picKey, 1, 1, 0)

    // 检查响应是否成功
    if (res.code !== 0 || !res.data || !res.data.photos || res.data.photos.length === 0) {
      console.error('getPhotoOrVideoInfo API 调用失败:', { code: res.code, message: res.message })
      return null
    }

    // 根据 picKey 查找
    const matchedPhoto = res.data.photos.find((photo) => photo.picKey === picKey)

    return matchedPhoto || null
  }

  // 新增：专门处理视频信息的方法
  async getVideoInfo({ hostUin, topicId, picKey }, { uin, p_skey }) {
    console.log('getVideoInfo', { hostUin, topicId, picKey }, { uin, p_skey })
    // 参数验证
    if (!topicId || !picKey) {
      console.error('getVideoInfo 参数不完整:', { hostUin, topicId, picKey })
      return null
    }

    const photoInfo = await this.getPhotoOrVideoInfo({ hostUin, topicId, picKey }, { uin, p_skey })

    if (!photoInfo || !photoInfo.is_video) {
      console.log('不是视频或未找到照片信息:', {
        is_video: photoInfo?.is_video,
        hasPhotoInfo: !!photoInfo
      })
      return null
    }

    // 返回视频相关信息
    const result = {
      ...photoInfo,
      video_download_url: photoInfo.video_info?.download_url || null,
      video_play_url: photoInfo.video_info?.video_url || null,
      video_size: photoInfo.video_info?.size || 0,
      video_duration: photoInfo.video_info?.duration || 0,
      video_format: photoInfo.video_info?.format || 'mp4',
      cover_url: photoInfo.pre || photoInfo.url
    }

    console.log('视频信息获取成功:', {
      name: result.name,
      has_download_url: !!result.video_download_url,
      has_play_url: !!result.video_play_url,
      size: result.video_size
    })

    return result
  }

  // 新增：批量获取视频信息的方法
  async batchGetVideoInfo(photos, { uin, p_skey }) {
    const videoInfos = []

    for (const photo of photos) {
      if (photo.is_video) {
        try {
          const videoInfo = await this.getVideoInfo(
            { hostUin: uin, topicId: photo.topicId, picKey: photo.picKey },
            { uin, p_skey }
          )
          if (videoInfo) {
            videoInfos.push(videoInfo)
          }
        } catch (error) {
          console.error('获取视频信息失败:', error)
        }
      }
    }

    return videoInfos
  }
}
