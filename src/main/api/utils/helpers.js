export function getGTK(p_skey) {
  let n = 5381
  for (let i = 0; i < p_skey.length; i++) {
    n += (n << 5) + p_skey.charCodeAt(i)
  }

  return n & 2147483647
}
export function hash33(s) {
  let e = 0
  for (const char of s) {
    e = (e * 33 + char.charCodeAt(0)) & 0x7fffffff
  }
  return e
}

/**
 * 通用数据提取函数
 * 支持以下格式：
 * 1. JSON 对象（已解析的直接返回）
 * 2. _Callback({...})
 * 3. xxxCB(...args)、xxx_CB(...args)
 * 4. HTML 包裹的 frameElement.callback({...})
 * 5. 其他字符串原样返回
 */
export function extractJSONFromCallback(input = '') {
  if (typeof input === 'object') return input
  if (typeof input !== 'string') return input

  let str = input.trim()

  // ✅ 处理 HTML 包裹的 frameElement.callback 响应
  if (str.includes('frameElement.callback')) {
    const frameCallbackMatch = str.match(/frameElement\.callback\s*\(\s*({[\s\S]*?})\s*\)\s*;?/i)
    if (frameCallbackMatch) {
      try {
        const obj = Function('"use strict";return (' + frameCallbackMatch[1] + ')')()
        return {
          functionName: 'frameElement.callback',
          raw: [obj],
          ...obj
        }
      } catch (error) {
        console.error('解析 frameElement.callback 失败:', error)
        return input
      }
    }
  }

  // ✅ 支持任意合法函数名（包括 _Callback）
  const jsonMatch = str.match(/^\s*([a-zA-Z_$][\w$]*)\s*\(\s*({[\s\S]*?})\s*\)\s*;?\s*$/)
  if (jsonMatch) {
    try {
      const fnName = jsonMatch[1]
      const obj = Function('"use strict";return (' + jsonMatch[2] + ')')()
      return {
        functionName: fnName,
        raw: [obj],
        ...obj
      }
    } catch {
      return input
    }
  }

  // ✅ 支持函数名(参数1, 参数2, ...)
  const cbMatch = str.match(/^\s*([a-zA-Z_$][\w$]*)\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/)
  if (!cbMatch) return input

  const fnName = cbMatch[1]
  const argsStr = cbMatch[2]

  // 参数解析器
  const parseArg = (arg) => {
    const trimmed = arg.trim()
    if (!trimmed) return null

    if (/^['"]/.test(trimmed)) {
      return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"')
    }
    if (/^-?\d+\.?\d*$/.test(trimmed)) return Number(trimmed)
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
    if (trimmed === 'null') return null

    try {
      return Function('"use strict";return (' + trimmed + ')')()
    } catch {
      return trimmed
    }
  }

  const args = []
  let current = ''
  let inQuote = false
  let quoteChar = ''
  let braceDepth = 0

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i]

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true
      quoteChar = char
    } else if (char === quoteChar && inQuote) {
      inQuote = false
    } else if (char === '{') {
      braceDepth++
    } else if (char === '}') {
      braceDepth--
    }

    if (char === ',' && !inQuote && braceDepth === 0) {
      args.push(parseArg(current))
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) args.push(parseArg(current))

  // 基于函数名结构化参数（可扩展）
  let structured = {}
  if (fnName === 'ptuiCB') {
    structured = {
      code: Number(args[0]),
      status: Number(args[1]),
      data: args[2],
      subCode: Number(args[3]),
      message: args[4],
      extra: args[5]
    }
  } else if (fnName === 'ptui_qlogin_CB') {
    structured = {
      code: Number(args[0]),
      url: args[1],
      extra: args[2]
    }
  }

  return {
    functionName: fnName,
    raw: args,
    ...structured
  }
}
