const DEFAULT_UPLOAD_ERROR = Object.freeze({
  category: 'general',
  summary: '上传失败',
  action: '请稍后重试；如果仍然失败，请重新选择该文件。'
})

const ERROR_RULES = [
  {
    category: 'cancelled',
    pattern: /取消|cancel(?:led|ed)?/i,
    summary: '上传已取消',
    action: '如需继续，请重新开始上传。'
  },
  {
    category: 'duration',
    pattern: /时长|duration|play\s*time|-530/i,
    summary: '视频时长超过 10 分钟',
    action: '请剪辑视频后重新选择。'
  },
  {
    category: 'size',
    pattern:
      /文件过大|超过大小|大小(?:限制|.*(?:上限|超过))|too\s*large|file\s*size|entity\s*too\s*large|413/i,
    summary: '文件超过大小限制',
    action: '图片需小于 500MB，视频需小于 1GB。'
  },
  {
    category: 'format',
    pattern: /格式|类型|format|mime|extension|unsupported/i,
    summary: '文件格式暂不支持',
    action: '请选择支持的图片或视频文件。'
  },
  {
    category: 'file',
    pattern: /不存在|已删除|已移动|找不到|no\s+such\s+file|enoent|not\s+found/i,
    summary: '本地文件已移动或不存在',
    action: '请重新选择该文件。'
  },
  {
    category: 'file',
    pattern: /无法读取.*文件|文件.*(?:读取|打开)|read\s*file|file\s*info/i,
    summary: '无法读取本地文件',
    action: '请确认文件可正常打开，再重新选择。'
  },
  {
    category: 'auth',
    pattern:
      /登录|认证|cookie|token.*(?:expired|invalid)|(?:expired|invalid).*token|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i,
    summary: '登录状态已失效',
    action: '请重新登录 QQ 空间后再试。'
  },
  {
    category: 'permission',
    pattern: /权限|拒绝访问|permission|access\s*denied|eperm|eacces/i,
    summary: '无法读取本地文件',
    action: '请检查文件权限，或重新选择文件。'
  },
  {
    category: 'quota',
    pattern: /容量|空间不足|quota|storage.*full|no\s*space/i,
    summary: 'QQ 空间容量不足',
    action: '请清理空间容量后再试。'
  },
  {
    category: 'rate',
    pattern: /频繁|过快|限流|rate\s*limit|too\s*many|\b429\b/i,
    summary: '操作过于频繁',
    action: '请稍候一会再重试。'
  },
  {
    category: 'network',
    pattern: /网络|超时|连接|network|timeout|timed\s*out|econn|socket|dns/i,
    summary: '网络连接不稳定',
    action: '请检查网络后重试。'
  },
  {
    category: 'service',
    pattern:
      /服务器|服务暂不可用|server|bad\s*gateway|service\s*unavailable|gateway\s*timeout|\b5\d\d\b/i,
    summary: 'QQ 空间服务暂时不可用',
    action: '请稍后重试。'
  },
  {
    category: 'data',
    pattern: /参数|信息(?:不完整|无法识别)|invalid|malformed|parse|json|syntax/i,
    summary: '文件信息无法识别',
    action: '请重新选择文件后再试。'
  }
]

function errorText(error) {
  if (typeof error === 'string') return error
  if (error && typeof error.message === 'string') return error.message
  if (error && typeof error.error === 'string') return error.error
  return ''
}

export function describeUploadError(error) {
  const text = errorText(error)
  const matchedRule = ERROR_RULES.find((rule) => rule.pattern.test(text))
  if (!matchedRule) return { ...DEFAULT_UPLOAD_ERROR }
  return {
    category: matchedRule.category,
    summary: matchedRule.summary,
    action: matchedRule.action
  }
}

export function uploadErrorMessage(error) {
  return describeUploadError(error).summary
}

export function uploadErrorDetail(error) {
  const { summary, action } = describeUploadError(error)
  return `${summary}。${action}`
}
