import fs from 'node:fs'
import { open } from 'node:fs/promises'
import { createHash } from 'node:crypto'

export const MAX_LOG_BYTES = 5 * 1024 * 1024
export const MAX_LOG_ENTRY_BYTES = 16 * 1024
export const MAX_DIAGNOSTIC_BYTES = 512 * 1024

const decodeTail = (buffer, partial) => {
  let start = 0
  if (partial) {
    const newline = buffer.indexOf(10)
    if (newline >= 0 && newline < buffer.length - 1) start = newline + 1
    else while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start++
  }
  return buffer.subarray(start).toString('utf8')
}

// Only read the retained tail, including when migrating a historical multi-GB log.
const trimFile = (filename, maxBytes) => {
  let fd
  try {
    fd = fs.openSync(filename, 'r+')
    const size = fs.fstatSync(fd).size
    if (size <= maxBytes) return 0
    const tail = Buffer.alloc(maxBytes)
    const length = fs.readSync(fd, tail, 0, tail.length, size - tail.length)
    const retained = Buffer.from(decodeTail(tail.subarray(0, length), true))
    let written = 0
    while (written < retained.length) {
      written += fs.writeSync(fd, retained, written, retained.length - written, written)
    }
    // Truncate only after the complete retained tail has been written successfully.
    fs.ftruncateSync(fd, retained.length)
    return size - retained.length
  } catch (error) {
    if (error.code === 'ENOENT') return 0
    throw error
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

const boundEntry = (message, maxBytes) => {
  const text = String(message)
  const buffer = Buffer.from(text.slice(0, maxBytes))
  if (text.length < maxBytes && buffer.length + 1 <= maxBytes) return `${text}\n`
  const marker = '\n[日志过长，已截断]\n'
  let end = maxBytes - Buffer.byteLength(marker)
  while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--
  return buffer.subarray(0, end).toString('utf8') + marker
}

export function createBoundedLogWriter(
  filename,
  { maxBytes = MAX_LOG_BYTES, maxEntryBytes = MAX_LOG_ENTRY_BYTES, now = Date.now } = {}
) {
  const archive = `${filename}.1`
  const recent = new Map()
  let suppressed = 0
  let windowStart = now()
  let writes = 0
  const maintain = () => trimFile(filename, maxBytes) + trimFile(archive, maxBytes)

  const write = (entry) => {
    let size = 0
    try {
      size = fs.statSync(filename).size
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    if (size + Buffer.byteLength(entry) > maxBytes) {
      // Keep exactly one bounded archive, not an ever-growing archive directory.
      try {
        fs.unlinkSync(archive)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      if (size) fs.renameSync(filename, archive)
    }
    fs.appendFileSync(filename, entry)
  }

  try {
    maintain()
  } catch {
    // Logging is best effort; filesystem errors must never recursively log themselves.
  }

  return {
    maintain,
    append(message) {
      const entry = boundEntry(message, Math.min(maxEntryBytes, maxBytes))
      const time = now()
      if (time - windowStart >= 10000) {
        windowStart = time
        writes = 0
      }
      const key = createHash('sha256')
        .update(entry.replace(/^\[[^\]]+\] /, ''))
        .digest('hex')
      if ((recent.has(key) && time - recent.get(key) < 60000) || writes >= 200) {
        suppressed++
        return null
      }
      recent.delete(key)
      recent.set(key, time)
      if (recent.size > 128) recent.delete(recent.keys().next().value)
      writes++
      try {
        if (suppressed) {
          write(`[${new Date(time).toISOString()}] [INFO] 已合并 ${suppressed} 条重复或过密日志\n`)
          suppressed = 0
        }
        write(entry)
      } catch {
        // Keep the bounded console entry available even when the disk is unavailable.
      }
      return entry.trimEnd()
    }
  }
}

export async function readDiagnosticLogTail(filename, maxBytes = MAX_DIAGNOSTIC_BYTES) {
  const readTail = async (file, limit) => {
    let handle
    try {
      handle = await open(file, 'r')
      const { size } = await handle.stat()
      const start = Math.max(0, size - limit)
      const buffer = Buffer.alloc(Math.min(size, limit))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
      return decodeTail(buffer.subarray(0, bytesRead), start > 0)
    } catch (error) {
      if (error.code === 'ENOENT') return ''
      throw error
    } finally {
      await handle?.close()
    }
  }
  const current = await readTail(filename, maxBytes)
  const remaining = maxBytes - Buffer.byteLength(current)
  const previous = remaining > 0 ? await readTail(`${filename}.1`, remaining) : ''
  return previous + current
}
