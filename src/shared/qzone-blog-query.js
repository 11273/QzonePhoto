export const buildQzoneBlogListParams = ({
  viewerUin,
  hostUin,
  pos = 0,
  num = 15,
  gTk,
  random = Math.random()
}) => ({
  hostUin,
  uin: viewerUin,
  blogType: 0,
  cateName: '',
  cateHex: '',
  statYear: '',
  // get_abs 只接受这个稳定的摘要组合。reqInfo=7 / absType=1 会返回 -4003。
  reqInfo: 1,
  pos,
  num,
  sortType: 0,
  absType: 0,
  startTime: '',
  endTime: '',
  source: 0,
  ref: 'qzone',
  inCharset: 'utf-8',
  outCharset: 'utf-8',
  verbose: 1,
  callback: '_Callback',
  rand: random,
  g_tk: gTk
})
