import { Transform } from 'node:stream'
import { performance } from 'node:perf_hooks'
import { normalizeTransferRate } from '../../shared/transfer-rate.mjs'

const cancelled = () => Object.assign(new Error('传输已取消'), { code: 'ERR_CANCELED' })

// One instance per direction, shared by every task, chunk and retry.
export class TransferRateLimiter {
  constructor() {
    this.rate = 0
    this.queue = []
    this.credit = 0
    this.updatedAt = performance.now()
    this.timer = null
  }

  setRate(value) {
    this.rate = normalizeTransferRate(value)
    this.credit = 0
    this.updatedAt = performance.now()
    this.pump()
    return this.rate
  }

  consume(bytes, { signal, isCancelled } = {}) {
    if (signal?.aborted || isCancelled?.()) return Promise.reject(cancelled())
    // No timer, queue, promise or delay when unlimited.
    if (!this.rate) return null
    if (!this.queue.length) this.updatedAt = performance.now()
    return new Promise((resolve, reject) => {
      const entry = { remaining: bytes, resolve, reject, signal, isCancelled }
      entry.abort = () => {
        this.finish(entry, cancelled())
        this.pump()
      }
      signal?.addEventListener('abort', entry.abort, { once: true })
      this.queue.push(entry)
      this.pump()
    })
  }

  finish(entry, error) {
    const index = this.queue.indexOf(entry)
    if (index === -1) return
    this.queue.splice(index, 1)
    entry.signal?.removeEventListener('abort', entry.abort)
    if (error) entry.reject(error)
    else entry.resolve()
  }

  pump() {
    clearTimeout(this.timer)
    this.timer = null
    const now = performance.now()
    this.credit = Math.min(
      this.rate * 0.1,
      this.credit + ((now - this.updatedAt) * this.rate) / 1000
    )
    this.updatedAt = now
    for (const entry of [...this.queue]) {
      if (entry.signal?.aborted || entry.isCancelled?.()) this.finish(entry, cancelled())
    }
    while (this.queue.length) {
      const entry = this.queue[0]
      if (!this.rate) {
        this.finish(entry)
        continue
      }
      const paid = Math.min(entry.remaining, this.credit)
      entry.remaining -= paid
      this.credit -= paid
      if (entry.remaining > 0) break
      this.finish(entry)
    }
    if (this.queue.length) {
      const delay = Math.min(50, Math.max(1, (this.queue[0].remaining * 1000) / this.rate))
      this.timer = setTimeout(() => this.pump(), delay)
    }
  }

  createStream(onWait = () => {}) {
    const limiter = this
    const controller = new AbortController()
    const output = new Transform({
      transform(chunk, _encoding, callback) {
        if (!limiter.rate) {
          callback(null, chunk)
          return
        }
        const startedAt = performance.now()
        onWait(true)
        const send = async () => {
          let offset = 0
          while (offset < chunk.length) {
            const quantum = limiter.rate
              ? Math.max(1024, Math.min(16384, limiter.rate / 20))
              : chunk.length
            const end = Math.min(chunk.length, offset + Math.floor(quantum))
            const wait = limiter.consume(end - offset, { signal: controller.signal })
            if (wait) await wait
            if (controller.signal.aborted) throw cancelled()
            output.push(chunk.subarray(offset, end))
            offset = end
          }
        }
        send().then(
          () => {
            output.waitMs += performance.now() - startedAt
            onWait(false)
            callback()
          },
          (error) => {
            onWait(false)
            callback(error)
          }
        )
      },
      destroy(error, callback) {
        controller.abort()
        onWait(false)
        callback(error)
      }
    })
    output.waitMs = 0
    return output
  }
}
