// Give users an actionable explanation without exposing signed URLs or raw errors.
export function getDownloadFailureHint(error) {
  const message = String(error?.message || error || '')
  if (/ENOSPC|磁盘空间不足/i.test(message)) return '磁盘空间不足，释放空间后重试。'
  if (/EACCES|EPERM|permission denied/i.test(message)) {
    return '无法写入保存位置，请更换文件夹后重新添加任务。'
  }
  if (/\b(?:404|410)\b/.test(message)) {
    return '源文件已失效或不存在，请刷新来源页面后重新添加任务。'
  }
  if (/\b(?:401|403)\b/.test(message)) {
    return '地址已过期或无访问权限，请刷新来源页面后重新添加任务。'
  }
  if (/timeout|timed?\s*out|ETIMEDOUT|超时/i.test(message)) {
    return '连接超时，可稍后重试；已完成的文件不受影响。'
  }
  if (/ENOTFOUND|ECONN|EAI_AGAIN|network|aborted|socket|连接|网络/i.test(message)) {
    return '连接中断，请检查网络后重试。'
  }
  if (/非媒体|不是有效|INVALID_MEDIA/i.test(message)) {
    return '来源未返回有效媒体，请刷新来源页面后重新添加任务。'
  }
  return '未能完成下载，可单独重试；若仍失败，请刷新来源页面后重新添加任务。'
}
