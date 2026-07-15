import JSON5 from 'json5'

export function parseObjectLiteral(input) {
  if (typeof input !== 'string' || !input.trim()) return null
  try {
    return JSON5.parse(normalizeUndefinedLiteral(input))
  } catch {
    return null
  }
}

// QQ 空间的 JSONP 偶尔会在对象字段里使用 JavaScript 的 undefined。
// JSON5 不支持该字面量；仅在字符串外把完整单词替换为 null，避免执行任何远程脚本。
function normalizeUndefinedLiteral(input) {
  let output = ''
  let quote = ''
  let escaped = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (quote) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = ''
      }
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      output += char
      continue
    }

    if (
      input.startsWith('undefined', index) &&
      !/[A-Za-z0-9_$]/.test(input[index - 1] || '') &&
      !/[A-Za-z0-9_$]/.test(input[index + 'undefined'.length] || '')
    ) {
      output += 'null'
      index += 'undefined'.length - 1
      continue
    }

    output += char
  }

  return output
}

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

  // 处理 HTML 包裹的 frameElement.callback 响应
  if (str.includes('frameElement.callback')) {
    const frameCallbackMatch = str.match(/frameElement\.callback\s*\(\s*({[\s\S]*?})\s*\)\s*;?/i)
    if (frameCallbackMatch) {
      try {
        const obj = parseObjectLiteral(frameCallbackMatch[1])
        if (!obj || typeof obj !== 'object') return input
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

  // 支持任意合法函数名（包括 _Callback）
  const jsonMatch = str.match(/^\s*([a-zA-Z_$][\w$]*)\s*\(\s*({[\s\S]*?})\s*\)\s*;?\s*$/)
  if (jsonMatch) {
    try {
      const fnName = jsonMatch[1]
      const obj = parseObjectLiteral(jsonMatch[2])
      if (!obj || typeof obj !== 'object') return input
      return {
        functionName: fnName,
        raw: [obj],
        ...obj
      }
    } catch {
      return input
    }
  }

  // 支持函数名(参数1, 参数2, ...)
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

    return parseObjectLiteral(trimmed) ?? trimmed
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
