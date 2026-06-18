export function withTimeout(promise, timeoutMs, message = '操作超时') {
  let timer = null

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
