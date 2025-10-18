import { getGTK } from '@main/api/utils/helpers'
import request from '@main/api/utils/request'

/**
 * 文件批量控制接口 - 初始化上传
 * @param {string} uin 用户UIN
 * @param {string} p_skey 用户密钥
 * @param {string} checksum 文件MD5
 * @param {number} fileLen 文件大小
 * @param {string} albumId 相册ID
 * @param {string} albumName 相册名称
 * @param {string} fileName 文件名
 * @param {string} picTitle 图片标题
 * @param {string} picDesc 图片描述
 * @param {number} picWidth 图片宽度
 * @param {number} picHeight 图片高度
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
  mutliPicInfo = null
) {
  const uploadTime = Math.floor(Date.now() / 1000)
  // 使用传入的 batchId 或生成新的 batchId
  const finalBatchId = batchId || Date.now() * 1000 + Math.floor(Math.random() * 1000)

  const url = `https://h5.qzone.qq.com/webapp/json/sliceUpload/FileBatchControl/${checksum}?g_tk=${getGTK(p_skey)}`

  const payload = {
    control_req: [
      {
        uin: hostUin,
        token: {
          type: 4,
          data: p_skey,
          appid: 5
        },
        appid: 'pic_qzone',
        checksum: checksum,
        check_type: 0,
        file_len: fileLen,
        env: {
          refer: 'qzone',
          deviceInfo: 'h5'
        },
        model: 0,
        biz_req: {
          sPicTitle: picTitle || fileName,
          sPicDesc: picDesc || '',
          sAlbumName: albumName,
          sAlbumID: albumId,
          iAlbumTypeID: 0,
          iBitmap: 0,
          iUploadType: 3,
          iUpPicType: 0,
          iBatchID: finalBatchId,
          sPicPath: '',
          iPicWidth: picWidth,
          iPicHight: picHeight,
          iWaterType: 0,
          iDistinctUse: 0,
          iNeedFeeds: 1,
          iUploadTime: uploadTime,
          mapExt: null,
          mutliPicInfo: mutliPicInfo,
          sExif_CameraMaker: '',
          sExif_CameraModel: '',
          sExif_Time: '',
          sExif_LatitudeRef: '',
          sExif_Latitude: '',
          sExif_LongitudeRef: '',
          sExif_Longitude: ''
        },
        session: '',
        asy_upload: 0,
        cmd: 'FileUpload'
      }
    ]
  }
  console.log('payload :>> ', JSON.stringify(payload))
  const response = await request.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
  })

  return response.data
}

/**
 * 文件上传接口 - 上传分片
 * @param {string} uin 用户UIN
 * @param {string} p_skey 用户密钥
 * @param {string} session 上传会话
 * @param {number} offset 偏移量
 * @param {string} data base64数据
 * @param {number} end 结束位置
 * @param {number} seq 序列号
 * @param {string} checksum 校验和
 * @param {number} sliceSize 分片大小
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
  sliceSize = 16384
) {
  const uploadType = 2

  const url = 'https://h5.qzone.qq.com/webapp/json/sliceUpload/FileUpload'

  const payload = {
    uin: hostUin.toString(),
    appid: 'pic_qzone',
    session,
    offset,
    data,
    checksum,
    check_type: 0,
    retry: 0,
    seq,
    end,
    cmd: 'FileUpload',
    slice_size: sliceSize,
    biz_req: {
      iUploadType: uploadType
    }
  }

  const response = await request.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      Cookie: `uin=${uin};p_skey=${p_skey}`
    }
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
