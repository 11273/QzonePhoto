import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'
/**
 * 获取相册列表
 * @param uin qq
 * @param p_skey 登录后有
 * @returns
 */
export async function fcg_list_album_v3(uin, p_skey, hostUin, pageStart, pageNum) {
  const url = 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3'
  const params = {
    hostUin,
    uin: hostUin,
    appid: 4,
    pageStart,
    pageNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 获取相册中的照片
 */
export async function cgi_list_photo(uin, p_skey, hostUin, pageStart, pageNum, topicId) {
  const url = 'https://h5.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_list_photo'
  const params = {
    hostUin,
    uin: hostUin,
    appid: 4,
    pageStart,
    pageNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    g_tk: getGTK(p_skey),
    topicId
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 获取照片浮层视图列表
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param topicId 相册ID
 * @param picKey 照片Key
 * @param cmtNum 评论数量
 * @param isFirst 是否首次
 * @param postNum 帖子数量
 * @returns
 */
export async function cgi_floatview_photo_list_v2(
  uin,
  p_skey,
  hostUin,
  topicId,
  picKey,
  cmtNum = 10,
  isFirst = 1,
  postNum = 18
) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/cgi_floatview_photo_list_v2'
  const params = {
    g_tk: getGTK(p_skey),
    topicId,
    picKey,
    cmtNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    uin: hostUin,
    hostUin,
    appid: 4,
    isFirst,
    postNum
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}

/**
 * 获取视频数据
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param getMethod 获取方法
 * @param start 开始位置
 * @param count 获取数量
 * @param need_old 是否需要旧数据
 * @param getUserInfo 是否获取用户信息
 * @returns
 */
export async function cgi_video_get_data(
  uin,
  p_skey,
  hostUin,
  getMethod = 2,
  start = 0,
  count = 20,
  need_old = 1,
  getUserInfo = 1
) {
  const url = 'https://user.qzone.qq.com/proxy/domain/taotao.qq.com/cgi-bin/video_get_data'
  const params = {
    g_tk: getGTK(p_skey),
    uin: hostUin,
    hostUin,
    appid: 4,
    getMethod,
    start,
    count,
    need_old,
    getUserInfo,
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  }
  const response = await request.get(url, {
    params,
    headers: {
      Cookie: `p_uin=o${uin};p_skey=${p_skey}`
    }
  })
  return response.data
}
