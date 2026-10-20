import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export const SINGLE_PUT_LIMIT = 5 * 1024 ** 3

const aws = async (args) => {
  const { stdout } = await execFileAsync('aws', args, {
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      AWS_RETRY_MODE: 'standard',
      AWS_MAX_ATTEMPTS: '3',
      // Send the explicit Content-MD5 below, not SDK-specific checksum trailers.
      AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required'
    }
  })
  return stdout
}

const errorCode = (error) =>
  String(error?.stderr || '').match(/An error occurred \(([^)]+)\)/)?.[1] ||
  String(error?.code || 'UPLOAD_FAILED')
const transient = (error) =>
  /^(?:InvalidPart|NoSuchUpload|SlowDown|Throttling|RequestTimeout|RequestTimeoutException|InternalError|InternalFailure|ServiceUnavailable|ECONNRESET|ETIMEDOUT|EPIPE)$/.test(
    errorCode(error)
  ) ||
  /timed? out|connection (?:was closed|reset|aborted)|could not connect to the endpoint|(?:status code|HTTP)[^\d]*(?:429|500|502|503|504)\b/i.test(
    String(error?.stderr || '')
  )
const normalizeCacheControl = (value) => String(value || '').replace(/\s/g, '')

export async function uploadR2Object({
  file,
  bucket,
  key,
  endpoint,
  cacheControl,
  contentType = 'application/octet-stream',
  runAws = aws,
  sleep = delay,
  onRetry = (message) => console.warn(message)
} = {}) {
  if (!file || !bucket || !key || !endpoint || !cacheControl) {
    throw new Error('R2 upload requires file, bucket, key, endpoint and cacheControl')
  }
  const info = await stat(file)
  if (!info.isFile() || info.size > SINGLE_PUT_LIMIT) {
    throw new Error(`R2 release upload requires a regular file no larger than 5 GiB: ${key}`)
  }
  // All current installers are below 160 MiB. A single atomic PUT avoids the
  // CompleteMultipartUpload/InvalidPart failure without changing release bytes.
  const md5 = createHash('md5')
  const sha512 = createHash('sha512')
  let bytes = 0
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length
    md5.update(chunk)
    sha512.update(chunk)
  }
  if (bytes !== info.size) throw new Error(`Release file changed while hashing: ${key}`)
  const digest = sha512.digest('base64')
  const common = ['--bucket', bucket, '--key', key, '--endpoint-url', endpoint, '--output', 'json']
  const args = [
    's3api',
    'put-object',
    ...common,
    '--body',
    file,
    '--content-length',
    String(info.size),
    '--content-md5',
    md5.digest('base64'),
    '--cache-control',
    cacheControl,
    '--content-type',
    contentType,
    '--metadata',
    JSON.stringify({ 'qzone-sha512': digest })
  ]
  for (let attempt = 1; ; attempt++) {
    try {
      await runAws(args)
      break
    } catch (error) {
      const code = errorCode(error)
      if (attempt >= 3 || !transient(error)) {
        throw new Error(`R2 upload failed for ${key}: ${code}`, { cause: error })
      }
      const waitMs = attempt * 5000
      onRetry(
        `R2 upload ${key} failed (${code}); retrying the whole object in ${waitMs / 1000}s (${attempt}/2)`
      )
      await sleep(waitMs)
    }
  }

  // Never treat an accepted PUT as sufficient to switch the stable pointers.
  // The caller's existing immutable-object guards and rollback trap stay intact.
  const remote = JSON.parse(await runAws(['s3api', 'head-object', ...common]))
  if (
    Number(remote.ContentLength) !== info.size ||
    remote.Metadata?.['qzone-sha512'] !== digest ||
    normalizeCacheControl(remote.CacheControl) !== normalizeCacheControl(cacheControl) ||
    remote.ContentType !== contentType
  ) {
    throw new Error(`R2 object verification failed for ${key}`)
  }
  return { key, size: info.size, sha512: digest }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const match = argument.match(/^--(file|key|cacheControl|contentType)=(.*)$/s)
      if (!match) throw new Error(`Unsupported upload option: ${argument.split('=')[0]}`)
      return [match[1], match[2]]
    })
  )
  uploadR2Object({ ...options, bucket: process.env.R2_BUCKET, endpoint: process.env.R2_ENDPOINT })
    .then(({ key }) => console.log(`Uploaded and verified R2 object: ${key}`))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
