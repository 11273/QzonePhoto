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
    // 由于网页调整视图会同步干扰数据，这里需要强制指定模式 3，但是 3 会导致数据获取不全，所以需要指定 needUserInfo
    mode: mode || 3,
    needUserInfo: 1,
    //最新创建在前
    sortOrder: 1
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
      Cookie: `uin=${uin};p_skey=${p_skey}`
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

/**
 * 获取QQ空间动态（说说）
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param begintime 开始时间戳（秒）
 * @param fuin 查看谁的动态（默认等于hostUin）
 * @returns
 */
export async function feeds2_html_picfeed_qqtab(uin, p_skey, hostUin, begintime = 0, fuin = null) {
  const url =
    'https://user.qzone.qq.com/proxy/domain/ic2.qzone.qq.com/cgi-bin/feeds/feeds2_html_picfeed_qqtab'
  const params = {
    g_tk: getGTK(p_skey),
    t: Date.now(),
    uin: hostUin,
    hostUin,
    fuin: fuin || hostUin,
    appid: 4,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    begintime
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
 * 删除动态
 * @param uin qq
 * @param p_skey 登录后有
 * @param hostUin 主人QQ
 * @param skey 动态的skey
 * @param time 动态的时间戳
 * @param typeid 动态类型ID
 * @param flag 标志位，默认0
 * @returns
 */
export async function feeds_delete_cgi(uin, p_skey, hostUin, skey, time, typeid = 0, flag = 0) {
  const url = 'https://user.qzone.qq.com/proxy/domain/w.qzone.qq.com/cgi-bin/feeds/feeds_delete_cgi'

  const params = {
    g_tk: getGTK(p_skey)
  }

  // 构造表单数据
  const formData = new URLSearchParams({
    // qzreferrer: `https://user.qzone.qq.com/${hostUin}`,
    appid: 4,
    type: typeid,
    key: skey,
    flag: flag,
    time: time,
    uin: hostUin,
    hostUin: hostUin,
    plat: 'qzone',
    source: 'qzone',
    inCharset: 'UTF-8',
    outCharset: 'UTF-8'
  })
  console.log(formData.toString())
  const response = await request.post(url, formData.toString(), {
    params,
    headers: {
      Cookie: `uin=${uin};p_skey=${p_skey}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    }
  })

  return response.data
}
