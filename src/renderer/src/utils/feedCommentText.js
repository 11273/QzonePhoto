export const normalizeCommentDisplayText = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s*(?:回复\s*)?[:：]\s*/, '')
    .trim()

export const normalizeCommentDisplayName = (value) =>
  String(value || '')
    .replace(/\[em\]e\d+\[\/em\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
