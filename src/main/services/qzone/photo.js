import {
  cgi_list_photo,
  fcg_list_album_v3,
  cgi_floatview_photo_list_v2,
  cgi_delpic_multi_v2,
  feeds2_html_picfeed_qqtab,
  feeds_home_html,
  feeds_delete_cgi,
  cgi_settopfeed,
  cgi_video_get_data,
  cgi_get_albuminfo_v2,
  cgi_get_visitor_simple,
  feeds2_html_picfeed,
  feeds3_html_more,
  emotion_cgi_ic_getcomments,
  emotion_cgi_getcmtreply_v6,
  get_like_list_app,
  cgi_get_feeds_count,
  feeds2_html_pav_all,
  feeds2_html_today_lastyear,
  get_fav_list,
  get_msgb,
  get_blog_list
} from '@main/api'
import { fetchPhotosTolerantly } from './photoTolerance'

export class QzonePhotoService {
  constructor() {
    this.qq_photo_key = null
  }

  async getPhotoList({ hostUin, pageStart, pageNum, mode, classId }, { uin, p_skey }) {
    return await fcg_list_album_v3(uin, p_skey, hostUin, pageStart, pageNum, mode, classId)
  }

  async getPhotoByTopicId(
    { hostUin, pageStart, pageNum, topicId, question, answer },
    { uin, p_skey }
  ) {
    const opts = {}
    if (question !== undefined) opts.question = question
    if (answer !== undefined) opts.answer = answer
    // 回带上一个 qq_photo_key：让服务端把当前会话当成"已信任"，
    // 返回稳定 key（配对所有曾经签发的图片签名 URL），而不是每次都发
    // 新的一次性签名票导致旧批次图片无法复用。
    if (this.qq_photo_key) opts.qq_photo_key = this.qq_photo_key

    return await fetchPhotosTolerantly(
      async (start, num) => {
        const result = await cgi_list_photo(uin, p_skey, hostUin, start, num, topicId, opts)
        if (result.qq_photo_key) {
          this.qq_photo_key = result.qq_photo_key
          opts.qq_photo_key = result.qq_photo_key
        }
        return result.data
      },
      pageStart,
      pageNum
    )
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
    if (!topicId || !picKey) {
      const error = new Error('视频记录缺少相册或文件标识，无法向 QQ 空间查询播放地址')
      error.code = 'INVALID_VIDEO_REFERENCE'
      throw error
    }

    const res = await cgi_floatview_photo_list_v2(uin, p_skey, hostUin, topicId, picKey, 1, 1, 0)

    if (!res || typeof res !== 'object') {
      throw new Error('QQ 空间没有返回视频详情数据')
    }

    const responseCodes = [res.code, res.ret, res.subcode, res.errno, res.errorCode]
      .map(Number)
      .filter(Number.isFinite)
    const code = responseCodes.find((value) => value !== 0) ?? responseCodes[0] ?? 0
    if (code !== 0) {
      const error = new Error(
        String(
          res.message ||
            res.msg ||
            res.retmsg ||
            res.errmsg ||
            res.reason ||
            'QQ 空间拒绝了视频详情请求'
        )
      )
      error.code = code
      throw error
    }

    if (!Array.isArray(res.data?.photos)) {
      throw new Error('QQ 空间返回的视频详情数据不完整')
    }

    const matchedPhoto = res.data.photos.find((photo) => photo.picKey === picKey)
    if (!matchedPhoto) {
      throw new Error('QQ 空间没有返回目标视频记录，视频可能已删除或当前账号不可见')
    }
    return matchedPhoto
  }

  async getVideoInfo({ hostUin, topicId, picKey }, { uin, p_skey }) {
    const photoInfo = await this.getPhotoOrVideoInfo({ hostUin, topicId, picKey }, { uin, p_skey })

    if (!photoInfo.is_video) {
      throw new Error('QQ 空间返回的目标记录不是可播放的视频')
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

  // 新增：删除照片
  async deletePhotos({ hostUin, albumId, photoData, albumName, priv }, { uin, p_skey }) {
    return await cgi_delpic_multi_v2(uin, p_skey, hostUin, albumId, photoData, albumName, priv)
  }

  // 获取QQ空间动态（说说）
  async getFeeds({ hostUin, begintime, fuin }, { uin, p_skey }) {
    return await feeds2_html_picfeed_qqtab(uin, p_skey, hostUin, begintime, fuin)
  }

  // 拉「好友动态」（feeds3_html_more）—— 网页右上「动态」入口的接口
  //   scope=0: 好友动态；scope=7: 特别关心（同接口换 scope）
  async getFriendFeeds(
    { hostUin, pagenum, begintime, externparam, count, dayspac, scope },
    { uin, p_skey }
  ) {
    return await feeds3_html_more(uin, p_skey, hostUin, {
      pagenum,
      begintime,
      externparam,
      count,
      dayspac,
      scope
    })
  }

  // 拉「我的主页 / 好友主页」时间线（官方主页 feeds_html_module + feeds_html_act_all）
  async getHomeFeeds({ hostUin, start, count }, { uin, p_skey }) {
    return await feeds_home_html(uin, p_skey, hostUin, { start, count })
  }

  // 拉某条好友动态的评论列表（按需展开"剩余 N 条评论"时调用）
  async getFeedComments({ topicId, hostUin, feedsType, start, num, sort }, { uin, p_skey }) {
    return await emotion_cgi_ic_getcomments(uin, p_skey, {
      topicId,
      hostUin,
      feedsType,
      start,
      num,
      sort
    })
  }

  async getFeedLikers(payload, { uin, p_skey }) {
    return await get_like_list_app(uin, p_skey, payload)
  }

  async getShuoshuoComments(payload, { uin, p_skey }) {
    return await emotion_cgi_getcmtreply_v6(uin, p_skey, payload)
  }

  // 顶部 5 类动态未读计数
  async getFeedsCount({ hostUin }, { uin, p_skey }) {
    return await cgi_get_feeds_count(uin, p_skey, hostUin)
  }

  // 「与我相关」时间线
  async getAboutMeFeeds({ hostUin, offset, count, beginTime, endTime }, { uin, p_skey }) {
    return await feeds2_html_pav_all(uin, p_skey, hostUin, { offset, count, beginTime, endTime })
  }

  // 「那年今日」时间线
  async getLastYearFeeds({ year, count, mode }, { uin, p_skey }) {
    return await feeds2_html_today_lastyear(uin, p_skey, { year, count, mode })
  }

  // 「我的收藏」列表
  async getFavList({ type, start, num }, { uin, p_skey }) {
    return await get_fav_list(uin, p_skey, { type, start, num })
  }

  // 「留言板」列表
  async getMessageBoard({ hostUin, start, num }, { uin, p_skey }) {
    return await get_msgb(uin, p_skey, hostUin, { start, num })
  }

  async getBlogList({ hostUin, pos, num }, { uin, p_skey }) {
    return await get_blog_list(uin, p_skey, hostUin, { pos, num })
  }

  // 删除动态
  async deleteFeed(payload, { uin, p_skey }) {
    return await feeds_delete_cgi(uin, p_skey, payload)
  }

  async setFeedTop({ hostUin, key, action, needChange }, { uin, p_skey }) {
    return await cgi_settopfeed(uin, p_skey, hostUin, key, action, needChange)
  }

  // 获取视频列表
  async getVideoList({ hostUin, getMethod, start, count, need_old, getUserInfo }, { uin, p_skey }) {
    return await cgi_video_get_data(
      uin,
      p_skey,
      hostUin,
      getMethod,
      start,
      count,
      need_old,
      getUserInfo
    )
  }

  // 获取相册问题和答案
  async getAlbumVisitors({ hostUin, albumId }, { uin, p_skey }) {
    return await cgi_get_visitor_simple(uin, p_skey, hostUin, albumId)
  }

  async getAlbumQA({ hostUin, albumId }, { uin, p_skey }) {
    return await cgi_get_albuminfo_v2(uin, p_skey, hostUin, albumId)
  }

  // 获取好友照片动态流
  async getFriendPhotos({ start, count, begintime }, { uin, p_skey }) {
    return await feeds2_html_picfeed(uin, p_skey, start, count, begintime)
  }
}
