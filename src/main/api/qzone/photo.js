import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'
/**
 * 获取相册列表
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param pageStart 分页起始位置
 * @param pageNum 每页数量
 * @param mode 模式 (2=normal普通模式, 3=class分类模式, 4=oneClass单个分类模式)
 * @param classId 分类ID (mode=4时需要)
 * @returns
 */
export async function fcg_list_album_v3(
  uin,
  p_skey,
  hostUin,
  pageStart,
  pageNum,
  mode = null,
  classId = null
) {
  const url = 'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/fcgi-bin/fcg_list_album_v3'
  const params = {
    hostUin,
    uin: hostUin,
    appid: 4,
    pageStart,
    pageNum,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    sortOrder: 1 //最新创建在前
  }

  // 添加mode参数
  if (mode !== null) {
    params.mode = mode
  }

  // 添加classId参数 (单个分类模式时)
  if (classId !== null) {
    params.classId = classId
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

/**
 * 删除照片
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param albumId 相册ID
 * @param photoData 照片数据数组，每个元素包含 {id, modifytime}
 * @param albumName 相册名称
 * @param priv 权限
 * @returns
 */
export async function cgi_delpic_multi_v2(
  uin,
  p_skey,
  hostUin,
  albumId,
  photoData,
  albumName = 'undefined',
  priv = 3
) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/photo.qzone.qq.com/cgi-bin/common/cgi_delpic_multi_v2'

  // 构造codelist格式，根据官方源码：
  // imageId|picrefer|时间戳|||imageId|imageType|0
  // 多张照片用 _ 分隔
  const codelistParts = photoData.map((photo) => {
    const photoId = photo.id
    const picrefer = photo.picrefer || ''
    const imageType = photo.imageType || 1
    const timestamp = Date.now()
    // 格式：[imageId, picrefer, 时间戳, "", "", imageId, imageType, 0].join("|")
    return [photoId, picrefer, timestamp, '', '', photoId, imageType, 0].join('|')
  })
  const codelist = codelistParts.join('_')

  // ismultiup 是照片数量对应的0字符串
  const ismultiup = '0'.repeat(photoData.length)

  const data = {
    qzreferrer: `https://user.qzone.qq.com/${hostUin}`,
    albumid: albumId,
    nvip: '1',
    bgid: 'undefined',
    tpid: 'undefined',
    priv: priv.toString(),
    albumname: albumName,
    codelist: codelist,
    ismultiup: ismultiup,
    resetcover: '1',
    newcover: '',
    uin: hostUin,
    hostUin: hostUin,
    plat: 'qzone',
    source: 'qzone',
    inCharset: 'utf-8',
    outCharset: 'utf-8'
  }

  const response = await request.post(url, data, {
    params: {
      g_tk: getGTK(p_skey)
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })

  // 返回的是HTML页面，需要解析JavaScript中的JSON数据
  const htmlContent = response.data
  // 使用正则提取JSON数据
  const jsonMatch = htmlContent.match(/frameElement\.callback\(([\s\S]*?)\)/)

  if (jsonMatch && jsonMatch[1]) {
    try {
      // 去除可能的尾部分号和空格
      const jsonStr = jsonMatch[1].trim().replace(/;?\s*$/, '')
      const result = eval('(' + jsonStr + ')')
      return result
    } catch (error) {
      console.error('解析删除照片响应失败:', error)
      throw new Error('解析删除响应失败')
    }
  }

  throw new Error('删除照片响应格式异常')
}
