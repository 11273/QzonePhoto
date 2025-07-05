import { getMeInfo } from '@main/api'

export class QzoneUserService {
  constructor() {}
  async getMeInfo({ uin, p_skey }) {
    return await getMeInfo(uin, p_skey)
  }
}
