/**
 * 将 Set-Cookie 数组解析为键值对对象
 * @param setCookieHeader Set-Cookie 字符串数组
 * @returns { [key: string]: string }
 */
export function parseSetCookie(setCookieHeader) {
  return setCookieHeader.reduce((acc, cookieString) => {
    const [keyValue] = cookieString.split(';')
    const [key, value = ''] = keyValue.split('=').map((part) => part.trim())
    if (value) {
      acc[key] = value
    }
    return acc
  }, {})
}

/**
 * 提取 JavaScript 中的对象或数组，并转换为合法 JSON 后解析
 * @param {string} rawStr - 原始 JS 字符串
 * @returns {Object|Array|undefined}
 */
export function extractJson(rawStr) {
  // 优先匹配数组
  let match = rawStr.match(/\[\s*{[\s\S]*?}\s*\]/)

  if (!match) {
    // 尝试匹配 var xxx = {...};
    match = rawStr.match(/var\s+\w+\s*=\s*({[\s\S]*?});/)
  }

  if (!match) {
    console.warn('[extractJson] ⚠️ 未匹配到 JSON 数据')
    return
  }

  let jsObjectStr = match[0]

  // 如果是 var xxx = {...}; 形式，提取 {...}
  if (jsObjectStr.startsWith('var')) {
    jsObjectStr = match[1]
  }

  try {
    // 使用 Function 构造函数安全地将 JS 对象转为对象
    const obj = Function('"use strict";return (' + jsObjectStr + ')')()
    return obj
  } catch (error) {
    console.error('[extractJson] ❌ JS 对象解析失败:', error)
  }
}
