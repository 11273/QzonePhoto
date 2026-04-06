import { getMeInfo, getPersonalCard, getVisitorStatus, getVisitorDetail, getShuoshuo } from '@main/api'

export class QzoneUserService {
  constructor() {}
  async getMeInfo({ uin, p_skey }) {
    return await getMeInfo(uin, p_skey)
  }

  async getPersonalCard({ targetUin }, { uin, p_skey }) {
    return await getPersonalCard(uin, p_skey, targetUin)
  }

  async getVisitorStatus(_, { uin, p_skey }) {
    return await getVisitorStatus(uin, p_skey)
  }

  async getVisitorDetail({ mask, mod }, { uin, p_skey }) {
    return await getVisitorDetail(uin, p_skey, mask, mod)
  }

  async getShuoshuo({ targetUin, pos, num }, { uin, p_skey }) {
    return await getShuoshuo(uin, p_skey, targetUin, pos, num)
  }
}
