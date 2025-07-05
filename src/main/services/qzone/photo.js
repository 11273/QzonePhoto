import { cgi_list_photo, fcg_list_album_v3 } from '@main/api'

export class QzonePhotoService {
  constructor() {}
  async getPhotoList({ hostUin, pageStart, pageNum }, { uin, p_skey }) {
    return await fcg_list_album_v3(uin, p_skey, hostUin, pageStart, pageNum)
  }

  async getPhotoByTopicId({ hostUin, pageStart, pageNum, topicId }, { uin, p_skey }) {
    return await cgi_list_photo(uin, p_skey, hostUin, pageStart, pageNum, topicId)
  }
}
