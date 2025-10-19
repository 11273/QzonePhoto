import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'
import { calculateFileMD5, readFileAsBuffer } from '@main/utils/file-processor'

// ==================== 常量定义 ====================

/** 上传端点 URL */
const UPLOAD_ENDPOINTS = {
  FILE_BATCH_CONTROL: 'https://h5.qzone.qq.com/webapp/json/sliceUpload/FileBatchControl',
  FILE_UPLOAD: 'https://h5.qzone.qq.com/webapp/json/sliceUpload/FileUpload',
  FILE_UPLOAD_VIDEO: 'https://h5.qzone.qq.com/webapp/json/sliceUpload/FileUploadVideo'
}

/** AppId 类型 */
const APP_IDS = {
  PIC_QZONE: 'pic_qzone',
  VIDEO_QZONE: 'video_qzone'
}

/** 上传类型 */
const UPLOAD_TYPES = {
  NORMAL: 2, // 普通上传（封面）
  ADVANCED: 3 // 高级上传（图片/视频）
}

/** 默认配置 */
const DEFAULTS = {
  SLICE_SIZE: 16384, // 16KB
  TOKEN_TYPE: 4,
  TOKEN_APPID: 5
}

// ==================== 私有工具函数 ====================

/**
 * 构建通用的请求头
 * @private
 */
function buildHeaders(uin, p_skey) {
  return {
    'Content-Type': 'application/json',
    Cookie: `uin=${uin};p_skey=${p_skey}`
  }
}

/**
 * 构建通用的 token
 * @private
 */
function buildToken(p_skey) {
  return {
    type: DEFAULTS.TOKEN_TYPE,
    data: p_skey,
    appid: DEFAULTS.TOKEN_APPID
  }
}

/**
 * 构建视频上传的 biz_req
 * @private
 */
function buildVideoBizReq(fileName, picTitle, picDesc, uploadTime, playTime) {
  return {
    sPicTitle: picTitle || fileName,
    sPicDesc: picDesc || '',
    sAlbumName: '',
    sAlbumID: '',
    iAlbumTypeID: 0,
    iBitmap: 0,
    iUploadType: UPLOAD_TYPES.ADVANCED,
    iUpPicType: 0,
    iBatchID: 0,
    sPicPath: '',
    iPicWidth: 0,
    iPicHight: 0,
    iWaterType: 0,
    iDistinctUse: 0,
    sTitle: picTitle || fileName,
    sDesc: picDesc || '',
    iFlag: 0,
    iUploadTime: uploadTime,
    iPlayTime: playTime,
    sCoverUrl: '',
    iIsNew: 111,
    iIsOriginalVideo: 0,
    iIsFormatF20: 0,
    extend_info: {
      video_type: '3',
      domainid: '5'
    }
  }
}

/**
 * 构建图片上传的 biz_req
 * @private
 */
function buildImageBizReq(
  fileName,
  picTitle,
  picDesc,
  albumId,
  albumName,
  picWidth,
  picHeight,
  batchId,
  mutliPicInfo,
  uploadTime
) {
  return {
    sPicTitle: picTitle || fileName,
    sPicDesc: picDesc || '',
    sAlbumName: albumName,
    sAlbumID: albumId,
    iAlbumTypeID: 0,
    iBitmap: 0,
    iUploadType: UPLOAD_TYPES.ADVANCED,
    iUpPicType: 0,
    iBatchID: batchId,
    sPicPath: '',
    iPicWidth: picWidth,
    iPicHight: picHeight,
    iWaterType: 0,
    iDistinctUse: 0,
    iNeedFeeds: 1,
    iUploadTime: Math.floor(uploadTime / 1000),
    mapExt: null,
    mutliPicInfo: mutliPicInfo,
    sExif_CameraMaker: '',
    sExif_CameraModel: '',
    sExif_Time: '',
    sExif_LatitudeRef: '',
    sExif_Latitude: '',
    sExif_LongitudeRef: '',
    sExif_Longitude: ''
  }
}

/**
 * 构建视频封面的 biz_req
 * @private
 */
function buildVideoCoverBizReq(
  originalVideoName,
  albumId,
  albumName,
  batchId,
  mutliPicInfo,
  uploadTime,
  vid
) {
  return {
    sPicTitle: originalVideoName,
    sPicDesc: '',
    sAlbumName: albumName,
    sAlbumID: albumId,
    iAlbumTypeID: 0,
    iBitmap: 0,
    iUploadType: UPLOAD_TYPES.NORMAL,
    iUpPicType: 0,
    iBatchID: batchId,
    sPicPath: '',
    iPicWidth: 0,
    iPicHight: 0,
    iWaterType: 0,
    iDistinctUse: 0,
    mutliPicInfo: mutliPicInfo,
    iNeedFeeds: 1,
    iUploadTime: Math.floor(uploadTime / 1000),
    stExtendInfo: {
      mapParams: {
        vid: vid,
        photo_num: 'undefined',
        video_num: 'undefined'
      }
    },
    stExternalMapExt: {
      is_client_upload_cover: '1',
      is_pic_video_mix_feeds: '1'
    },
    mapExt: {},
    sExif_CameraMaker: '',
    sExif_CameraModel: '',
    sExif_Time: '',
    sExif_LatitudeRef: '',
    sExif_Latitude: '',
    sExif_LongitudeRef: '',
    sExif_Longitude: ''
  }
}

/**
 * 通用的分片上传函数
 * @private
 * @param {string} uin 用户UIN
 * @param {string} p_skey 用户密钥
 * @param {string} hostUin 主机UIN
 * @param {string} session 上传会话
 * @param {Buffer} fileBuffer 文件缓冲区
 * @param {number} fileLen 文件大小
 * @param {number} sliceSize 分片大小
 * @param {boolean} isVideo 是否为视频
 * @param {string} logPrefix 日志前缀
 * @returns {Promise<Object>} 上传结果
 */
async function uploadFileInChunks(
  uin,
  p_skey,
  hostUin,
  session,
  fileBuffer,
  fileLen,
  sliceSize,
  isVideo,
  logPrefix = '[uploadFileInChunks]'
) {
  const appid = isVideo ? APP_IDS.VIDEO_QZONE : APP_IDS.PIC_QZONE
  const uploadUrl = isVideo ? UPLOAD_ENDPOINTS.FILE_UPLOAD_VIDEO : UPLOAD_ENDPOINTS.FILE_UPLOAD
  const uploadType = isVideo ? undefined : UPLOAD_TYPES.NORMAL

  let offset = 0
  while (offset < fileLen) {
    const end = Math.min(offset + sliceSize, fileLen)
    const chunk = fileBuffer.slice(offset, end)
    const data = chunk.toString('base64')
    const seq = Math.floor(offset / sliceSize)

    const uploadPayload = {
      uin: hostUin.toString(),
      appid: appid,
      session: session,
      offset: offset,
      data: data,
      checksum: '',
      check_type: isVideo ? 1 : 0,
      retry: 0,
      seq: seq,
      end: end,
      slice_size: sliceSize,
      biz_req: isVideo ? {} : { iUploadType: uploadType }
    }

    // 视频上传需要额外的查询参数
    let finalUrl = uploadUrl
    if (isVideo) {
      uploadPayload.cmd = 'FileUploadVideo'
      const queryParams = new URLSearchParams({
        seq: seq.toString(),
        retry: '0',
        offset: offset.toString(),
        end: end.toString(),
        total: fileLen.toString(),
        type: 'json',
        g_tk: getGTK(p_skey)
      })
      finalUrl = `${uploadUrl}?${queryParams.toString()}`
    }

    const uploadResponse = await request.post(finalUrl, uploadPayload, {
      headers: buildHeaders(uin, p_skey)
    })

    console.log(
      `${logPrefix} 分片上传: offset=${offset}, end=${end}, flag=${uploadResponse.data?.data?.flag}`
    )

    if (uploadResponse.data.ret !== 0) {
      throw new Error(`${logPrefix} 分片上传失败: ret=${uploadResponse.data.ret}`)
    }

    // 检查是否完成
    if (uploadResponse.data.data && uploadResponse.data.data.flag === 1) {
      console.log(`${logPrefix} 文件上传完成`)
      return uploadResponse.data
    }

    offset = end
  }

  throw new Error(`${logPrefix} 文件上传未正常完成`)
}

// ==================== 公共 API 函数 ====================

/**
 * 文件批量控制接口 - 初始化上传
 * @param {string} uin 用户UIN
 * @param {string} p_skey 用户密钥
 * @param {string} hostUin 主机UIN
 * @param {string} checksum 文件MD5
 * @param {number} fileLen 文件大小
 * @param {string} albumId 相册ID
 * @param {string} albumName 相册名称
 * @param {string} fileName 文件名
 * @param {string} picTitle 图片标题
 * @param {string} picDesc 图片描述
 * @param {number} picWidth 图片宽度
 * @param {number} picHeight 图片高度
 * @param {number} batchId 批次ID
 * @param {Object} mutliPicInfo 批次信息
 * @param {boolean} isVideo 是否为视频文件
 * @param {number} playTime 视频播放时长（毫秒）
 * @returns {Promise<Object>} API响应
 */
export async function fileBatchControl(
  uin,
  p_skey,
  hostUin,
  checksum,
  fileLen,
  albumId,
  albumName,
  fileName,
  picTitle,
  picDesc,
  picWidth = 0,
  picHeight = 0,
  batchId = null,
  mutliPicInfo = null,
  isVideo = false,
  playTime = 0
) {
  const uploadTime = Date.now()
  const finalBatchId = batchId || Date.now() * 1000 + Math.floor(Math.random() * 1000)

  // 构建 biz_req
  const bizReq = isVideo
    ? buildVideoBizReq(fileName, picTitle, picDesc, uploadTime, playTime)
    : buildImageBizReq(
        fileName,
        picTitle,
        picDesc,
        albumId,
        albumName,
        picWidth,
        picHeight,
        finalBatchId,
        mutliPicInfo,
        uploadTime
      )

  // 构建请求 payload
  const url = `${UPLOAD_ENDPOINTS.FILE_BATCH_CONTROL}/${checksum}?g_tk=${getGTK(p_skey)}`
  const payload = {
    control_req: [
      {
        uin: hostUin.toString(),
        token: buildToken(p_skey),
        appid: isVideo ? APP_IDS.VIDEO_QZONE : APP_IDS.PIC_QZONE,
        checksum: checksum,
        check_type: isVideo ? 1 : 0,
        file_len: fileLen,
        env: {
          refer: 'qzone',
          deviceInfo: 'h5'
        },
        model: 0,
        biz_req: bizReq,
        session: '',
        asy_upload: 0,
        cmd: isVideo ? 'FileUploadVideo' : 'FileUpload'
      }
    ]
  }

  console.log(`[fileBatchControl] ${isVideo ? '视频' : '图片'}上传初始化:`, {
    fileName,
    fileLen,
    checksum
  })

  const response = await request.post(url, payload, {
    headers: buildHeaders(uin, p_skey)
  })

  console.log(`[fileBatchControl] 初始化响应: ret=${response.data.ret}`)

  return response.data
}

/**
 * 文件上传接口 - 上传分片
 * @param {string} uin 用户UIN
 * @param {string} p_skey 用户密钥
 * @param {string} hostUin 主机UIN
 * @param {string} session 上传会话
 * @param {number} offset 偏移量
 * @param {string} data base64数据
 * @param {number} end 结束位置
 * @param {number} seq 序列号
 * @param {string} checksum 校验和
 * @param {number} sliceSize 分片大小
 * @param {boolean} isVideo 是否为视频文件
 * @param {number} totalSize 文件总大小
 * @returns {Promise<Object>} API响应
 */
export async function fileUpload(
  uin,
  p_skey,
  hostUin,
  session,
  offset,
  data,
  end,
  seq = 0,
  checksum = '',
  sliceSize = DEFAULTS.SLICE_SIZE,
  isVideo = false,
  totalSize = 0
) {
  const appid = isVideo ? APP_IDS.VIDEO_QZONE : APP_IDS.PIC_QZONE
  const uploadUrl = isVideo ? UPLOAD_ENDPOINTS.FILE_UPLOAD_VIDEO : UPLOAD_ENDPOINTS.FILE_UPLOAD

  const payload = {
    uin: hostUin.toString(),
    appid: appid,
    session,
    offset,
    data,
    checksum,
    check_type: isVideo ? 1 : 0,
    retry: 0,
    seq,
    end,
    cmd: isVideo ? 'FileUploadVideo' : 'FileUpload',
    slice_size: sliceSize,
    biz_req: isVideo ? {} : { iUploadType: UPLOAD_TYPES.NORMAL }
  }

  // 视频上传需要额外的查询参数
  if (isVideo && totalSize > 0) {
    const queryParams = new URLSearchParams({
      seq: seq.toString(),
      retry: '0',
      offset: offset.toString(),
      end: end.toString(),
      total: totalSize.toString(),
      type: 'json',
      g_tk: getGTK(p_skey)
    })
    const finalUrl = `${uploadUrl}?${queryParams.toString()}`

    const response = await request.post(finalUrl, payload, {
      headers: buildHeaders(uin, p_skey)
    })
    return response.data
  }

  const response = await request.post(uploadUrl, payload, {
    headers: buildHeaders(uin, p_skey)
  })

  return response.data
}

/**
 * 获取文件的 base64 分片
 * @param {Buffer} fileBuffer 文件缓冲区
 * @param {number} offset 偏移量
 * @param {number} sliceSize 分片大小
 * @returns {string} base64 编码的分片数据
 */
export function getFileChunk(fileBuffer, offset, sliceSize) {
  const end = Math.min(offset + sliceSize, fileBuffer.length)
  const chunk = fileBuffer.slice(offset, end)
  return chunk.toString('base64')
}

/**
 * 上传视频封面图（完整流程）
 * @param {string} uin 用户UIN
 * @param {string} p_skey 用户密钥
 * @param {string} hostUin 主机UIN
 * @param {string} vid 视频ID (从视频上传响应中获取的 sVid)
 * @param {string} coverPath 封面图片路径
 * @param {string} albumId 相册ID
 * @param {string} albumName 相册名称
 * @param {string} originalVideoName 原始视频文件名
 * @param {number} batchId 批次ID
 * @param {Object} mutliPicInfo 批次信息
 * @returns {Promise<Object>} API响应
 */
export async function uploadVideoCover(
  uin,
  p_skey,
  hostUin,
  vid,
  coverPath,
  albumId,
  albumName,
  originalVideoName,
  batchId,
  mutliPicInfo
) {
  const logPrefix = '[uploadVideoCover]'

  try {
    // 1. 读取封面文件和计算 MD5
    console.log(`${logPrefix} 开始处理封面:`, { vid, coverPath })

    const coverBuffer = await readFileAsBuffer(coverPath)
    const fileLen = coverBuffer.length
    const checksum = await calculateFileMD5(coverPath)

    console.log(`${logPrefix} 封面信息:`, { fileLen, checksum })

    // 2. 初始化封面上传
    const uploadTime = Date.now()
    const url = `${UPLOAD_ENDPOINTS.FILE_BATCH_CONTROL}/${checksum}?g_tk=${getGTK(p_skey)}`

    const bizReq = buildVideoCoverBizReq(
      originalVideoName,
      albumId,
      albumName,
      batchId,
      mutliPicInfo,
      uploadTime,
      vid
    )

    const payload = {
      control_req: [
        {
          uin: hostUin.toString(),
          token: buildToken(p_skey),
          appid: APP_IDS.PIC_QZONE,
          checksum: checksum,
          check_type: 0,
          file_len: fileLen,
          env: {
            refer: 'huodong',
            deviceInfo: 'h5'
          },
          model: 0,
          biz_req: bizReq,
          session: '',
          asy_upload: 0
        }
      ]
    }

    console.log(`${logPrefix} 初始化封面上传`)

    const initResponse = await request.post(url, payload, {
      headers: buildHeaders(uin, p_skey)
    })

    console.log(`${logPrefix} 初始化响应: ret=${initResponse.data.ret}`)

    if (initResponse.data.ret !== 0 || !initResponse.data.data) {
      throw new Error(`初始化失败: ret=${initResponse.data.ret}, msg=${initResponse.data.msg}`)
    }

    const session = initResponse.data.data.session
    const sliceSize = initResponse.data.data.slice_size || DEFAULTS.SLICE_SIZE

    // 3. 分片上传封面
    const uploadResult = await uploadFileInChunks(
      uin,
      p_skey,
      hostUin,
      session,
      coverBuffer,
      fileLen,
      sliceSize,
      false, // 封面是图片，不是视频
      logPrefix
    )

    console.log(`${logPrefix} 封面上传成功`)
    return uploadResult
  } catch (error) {
    console.error(`${logPrefix} 失败:`, error.message)
    throw new Error(`视频封面上传失败: ${error.message}`)
  }
}
