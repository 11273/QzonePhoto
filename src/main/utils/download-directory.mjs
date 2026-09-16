// Cookie 的 uin 使用 o 前缀；下载目录只使用 QQ 号本身。
export const downloadFolderUin = (uin) => {
  const value = String(uin ?? '').trim()
  if (/^o[1-9]\d+$/.test(value)) return value.slice(1)
  return /^[1-9]\d+$/.test(value) ? value : 'unknown'
}
