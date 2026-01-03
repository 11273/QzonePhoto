/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的字符串
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * 格式化日期（带年份）
 * @param {number} timestamp - 时间戳（秒）
 * @returns {string} 格式化后的日期字符串
 */
export const formatDateWithYear = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * 格式化时间（时分秒）
 * @param {number} timestamp - 时间戳（秒）
 * @returns {string} 格式化后的时间字符串
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 格式化任务数量
 * @param {number} count - 数量
 * @returns {string} 格式化后的数量字符串
 */
export const formatTaskCount = (count) => {
  if (count < 1000) return count.toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  return `${Math.floor(count / 1000)}k`
}
/**
 * 格式化进度百分比
 * @param {number} current - 当前值
 * @param {number} total - 总值
 * @param {number} decimals - 小数位数
 * @returns {number} 百分比
 */
export const calculateProgress = (current, total, decimals = 1) => {
  if (!total || total === 0) return 0
  const progress = (current / total) * 100
  return Math.min(100, Math.max(0, Number(progress.toFixed(decimals))))
}

/**
 * 格式化持续时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的持续时间
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0秒'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟${secs}秒`
  } else {
    return `${secs}秒`
  }
}

/**
 * 格式化数字（添加千分位分隔符）
 * @param {number} num - 数字
 * @returns {string} 格式化后的数字字符串
 */
export const formatNumber = (num) => {
  if (typeof num !== 'number') return '0'
  return num.toLocaleString('zh-CN')
}

/**
 * 格式化文件名（截断过长的文件名）
 * @param {string} filename - 文件名
 * @param {number} maxLength - 最大长度
 * @returns {string} 格式化后的文件名
 */
export const formatFilename = (filename, maxLength = 30) => {
  if (!filename || filename.length <= maxLength) return filename

  const extension = filename.split('.').pop()
  const name = filename.substring(0, filename.lastIndexOf('.'))
  const truncatedName = name.substring(0, maxLength - extension.length - 4)

  return `${truncatedName}...${extension}`
}

/**
 * 生成唯一ID
 * @param {string} prefix - 前缀
 * @returns {string} 唯一ID
 */
export const generateUniqueId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 格式化任务名称
 * @param {string} name - 任务名称
 * @returns {string} 格式化后的任务名称
 */
export const TASK_NAME_CONFIG = {
  maxLength: 60, // 最大显示长度
  prefixLength: 20, // 前缀保留长度
  suffixLength: 10, // 后缀保留长度（不含扩展名）
  prefixRatio: 0.5, // 当使用比例计算时，前缀占比
  suffixRatio: 0.4 // 当使用比例计算时，后缀占比
}
export const formatTaskName = (name) => {
  if (!name) return ''

  const { maxLength, prefixLength, suffixLength, prefixRatio, suffixRatio } = TASK_NAME_CONFIG

  // 获取文件名和扩展名
  const lastDotIndex = name.lastIndexOf('.')
  let fileName = name
  let extension = ''

  if (lastDotIndex > -1) {
    fileName = name.substring(0, lastDotIndex)
    extension = name.substring(lastDotIndex)
  }

  // 如果文件名长度没有超过限制，直接返回
  if (name.length <= maxLength) {
    return name
  }

  // 如果文件名（不含扩展名）长度超过限制，进行截断
  if (fileName.length > prefixLength + suffixLength + 3) {
    const prefix = fileName.substring(0, prefixLength)
    const suffix = fileName.substring(fileName.length - suffixLength)
    return `${prefix}...${suffix}${extension}`
  }

  // 如果整个名称超长但文件名部分不够长，直接截断整个名称
  if (name.length > maxLength) {
    const totalPrefix = Math.floor(maxLength * prefixRatio)
    const totalSuffix = Math.floor(maxLength * suffixRatio)
    return `${name.substring(0, totalPrefix)}...${name.substring(name.length - totalSuffix)}`
  }

  return name
}

/**
 * 获取QQ表情图片URL
 * @param {string} code - 表情代码 (如 e100)
 * @returns {string} 表情图片URL
 */
export const getQQEmojiUrl = (code) => {
  // QQ表情官方CDN地址
  // 这些图片来自QQ空间,是公开可访问的
  return `https://qzonestyle.gtimg.cn/qzone/em/${code}.gif`
}

/**
 * 获取QQ头像URL
 * @param {string} uin - QQ号
 * @param {number} size - 头像大小 (可选值: 30)
 * @returns {string} 头像图片URL
 */
export const getQQAvatarUrl = (uin, size = 30) => {
  // QQ空间头像CDN地址
  // qlogo{1-4}.store.qq.com 有多个服务器,这里使用 qlogo4
  return `https://qlogo4.store.qq.com/qzone/${uin}/${uin}/${size}`
}

/**
 * 检查是否需要使用特殊处理的表情代码
 * 某些表情代码格式不同,需要特殊处理
 */
const SPECIAL_EMOJI_MAP = {
  // 如果有特殊格式的表情可以在这里映射
  // 例如: 'e400846': 'emoji_400846'
}

/**
 * 解析富文本内容（同时处理@提及和表情）
 * @param {string} text - 原始文本
 * @returns {Array} 解析后的片段数组
 */
export const parseRichText = (text) => {
  if (!text) return []

  const segments = []
  // 同时匹配 @提及 和 表情
  // 使用联合正则表达式一次性处理所有特殊内容
  const combinedRegex = /@\{uin:(\d+),nick:([^,}]+)(?:,(?:who|auto):(\d+))?\}|\[em\](e\d+)\[\/em\]/g
  let lastIndex = 0
  let match

  while ((match = combinedRegex.exec(text)) !== null) {
    // 添加匹配之前的普通文本
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      })
    }

    // 判断是@提及还是表情
    if (match[1]) {
      // @提及
      segments.push({
        type: 'mention',
        uin: match[1],
        nick: match[2],
        who: match[3] || '0'
      })
    } else if (match[4]) {
      // 表情
      const emojiCode = match[4]
      const imageUrl = SPECIAL_EMOJI_MAP[emojiCode]
        ? getQQEmojiUrl(SPECIAL_EMOJI_MAP[emojiCode])
        : getQQEmojiUrl(emojiCode)

      segments.push({
        type: 'emoji',
        code: emojiCode,
        url: imageUrl
      })
    }

    lastIndex = match.index + match[0].length
  }

  // 添加最后剩余的文本
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}
