// eslint-disable-next-line no-unused-vars
import { QzonePhotoService } from '@main/services/qzone/photo'
import { ServiceNames } from '@main/services/service-manager'
import { IPC_PHOTO } from '@shared/ipc-channels'

export function createPhotoHandlers(service) {
  /** @type {QzonePhotoService} */
  const photoService = service.get(ServiceNames.PHOTO)
  return {
    [IPC_PHOTO.PHOTO_LIST]: async (_, { payload, headers }) => {
      return photoService.getPhotoList(payload, headers)
    },
    [IPC_PHOTO.PHOTO_BY_TOPIC_ID]: async (_, { payload, headers }) => {
      return photoService.getPhotoByTopicId(payload, headers)
    }
  }
}
