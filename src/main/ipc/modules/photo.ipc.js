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
    },
    [IPC_PHOTO.PHOTO_FLOATVIEW_LIST]: async (_, { payload, headers }) => {
      return photoService.getPhotoFloatviewList(payload, headers)
    },
    [IPC_PHOTO.PHOTO_OR_VIDEO_INFO]: async (_, { payload, headers }) => {
      return photoService.getPhotoOrVideoInfo(payload, headers)
    },
    [IPC_PHOTO.VIDEO_INFO]: async (_, { payload, headers }) => {
      return photoService.getVideoInfo(payload, headers)
    },
    [IPC_PHOTO.BATCH_VIDEO_INFO]: async (_, { payload, headers }) => {
      return photoService.batchGetVideoInfo(payload, headers)
    },
    [IPC_PHOTO.DELETE_PHOTOS]: async (_, { payload, headers }) => {
      return photoService.deletePhotos(payload, headers)
    },
    [IPC_PHOTO.GET_FEEDS]: async (_, { payload, headers }) => {
      return photoService.getFeeds(payload, headers)
    },
    [IPC_PHOTO.DELETE_FEED]: async (_, { payload, headers }) => {
      return photoService.deleteFeed(payload, headers)
    },
    [IPC_PHOTO.GET_VIDEO_LIST]: async (_, { payload, headers }) => {
      return photoService.getVideoList(payload, headers)
    },
    [IPC_PHOTO.GET_ALBUM_QA]: async (_, { payload, headers }) => {
      return photoService.getAlbumQA(payload, headers)
    },
    [IPC_PHOTO.GET_ALBUM_VISITORS]: async (_, { payload, headers }) => {
      return photoService.getAlbumVisitors(payload, headers)
    },
    [IPC_PHOTO.GET_FRIEND_PHOTOS]: async (_, { payload, headers }) => {
      return photoService.getFriendPhotos(payload, headers)
    },
    [IPC_PHOTO.GET_FRIEND_FEEDS]: async (_, { payload, headers }) => {
      return photoService.getFriendFeeds(payload, headers)
    },
    [IPC_PHOTO.GET_HOME_FEEDS]: async (_, { payload, headers }) => {
      return photoService.getHomeFeeds(payload, headers)
    },
    [IPC_PHOTO.GET_FEED_COMMENTS]: async (_, { payload, headers }) => {
      return photoService.getFeedComments(payload, headers)
    },
    [IPC_PHOTO.GET_FEEDS_COUNT]: async (_, { payload, headers }) => {
      return photoService.getFeedsCount(payload, headers)
    },
    [IPC_PHOTO.GET_ABOUT_ME_FEEDS]: async (_, { payload, headers }) => {
      return photoService.getAboutMeFeeds(payload, headers)
    },
    [IPC_PHOTO.GET_LAST_YEAR_FEEDS]: async (_, { payload, headers }) => {
      return photoService.getLastYearFeeds(payload, headers)
    },
    [IPC_PHOTO.GET_FAV_LIST]: async (_, { payload, headers }) => {
      return photoService.getFavList(payload, headers)
    },
    [IPC_PHOTO.GET_MESSAGE_BOARD]: async (_, { payload, headers }) => {
      return photoService.getMessageBoard(payload, headers)
    }
  }
}
