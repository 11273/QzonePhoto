// Aggregate throughput across the entire batch, including short completed files.
export class RollingDownloadThroughput {
  constructor(windowMs = 2000) {
    this.windowMs = windowMs
    this.reset()
  }

  reset() {
    this.samples = []
    this.bytesInWindow = 0
    this.firstByteAt = null
  }

  record(bytes, now = Date.now()) {
    if (!Number.isFinite(bytes) || bytes <= 0) return
    if (this.firstByteAt === null) this.firstByteAt = now
    // Aggregate by 250 ms buckets so large media transfers cannot allocate
    // a new sample for every incoming network chunk.
    const bucketAt = Math.floor(now / 250) * 250
    const last = this.samples[this.samples.length - 1]
    if (last?.at === bucketAt) last.bytes += bytes
    else this.samples.push({ bytes, at: bucketAt })
    this.bytesInWindow += bytes
    this.prune(now)
  }

  prune(now) {
    const cutoff = now - this.windowMs
    while (this.samples.length && this.samples[0].at < cutoff) {
      this.bytesInWindow -= this.samples.shift().bytes
    }
    if (this.samples.length === 0) this.firstByteAt = null
  }

  getBytesPerSecond(now = Date.now()) {
    this.prune(now)
    if (this.samples.length === 0) return 0
    // Smooth across task boundaries without inflating the first few milliseconds.
    const observedMs = Math.min(this.windowMs, Math.max(500, now - this.firstByteAt))
    return Math.round((this.bytesInWindow * 1000) / observedMs)
  }
}
