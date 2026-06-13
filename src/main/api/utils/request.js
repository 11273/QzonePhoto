import { extractJSONFromCallback } from '@main/api/utils/helpers'
import { reportHealthEvent } from '@main/services/app-telemetry'
import { classifyTelemetryError, toTelemetryApiName } from '@main/services/telemetry-safety.mjs'
import axios from 'axios'
import http from 'http'
import https from 'https'

// 启用 keep-alive 复用 TCP/TLS 连接，避免每个分片重新握手
// 分片上传一个 35MB 视频会发出 2000+ 个 16KB 小请求，没有 keep-alive 会被 TLS 握手拖垮
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 16,
  maxFreeSockets: 16,
  timeout: 60000
})
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 16,
  maxFreeSockets: 16,
  timeout: 60000
})

// 创建 axios 实例
const request = axios.create({
  withCredentials: true,
  httpAgent,
  httpsAgent,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Connection: 'keep-alive'
  }
})

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = extractJSONFromCallback(response.data)
    }

    reportQzoneApiTelemetry(response)
    return response
  },
  (error) => {
    if (error.response) {
      reportQzoneApiTelemetry(error.response, error)
      const { config, status, data, headers } = error.response
      if (status >= 300 && status < 400) {
        console.log(
          `Redirect: [${config.method.toUpperCase()}] ${config.url} - ${status} -> ${headers.location}`
        )
        return Promise.resolve(error.response)
      } else {
        console.log(
          `Response error: [${config.method.toUpperCase()}] ${config.url} - ${status}`,
          data
        )
        return Promise.reject(error.response)
      }
    } else if (error.request) {
      reportQzoneApiTelemetry({ config: error.config, status: 0 }, error)
      console.log('No response received:', error.message)
    } else {
      reportQzoneApiTelemetry({ config: error.config, status: 0 }, error)
      console.log('Request setup error:', error.message)
    }
    return Promise.reject(error)
  }
)

function reportQzoneApiTelemetry(response, error = null) {
  try {
    const config = response?.config || error?.config || {}
    if (config.telemetry === false) return
    const status = Number(response?.status || 0)
    const apiCode = extractQzoneApiCode(response?.data)
    const success = !error && status >= 200 && status < 400 && (apiCode === null || apiCode === 0)
    if (success) return

    const errorGroup = success
      ? 'none'
      : apiCode !== null && apiCode !== 0
        ? 'api_error'
        : classifyTelemetryError(error || response?.data || '')

    void reportHealthEvent({
      event: 'qzone_api_result',
      page: 'main:qzone_api',
      success,
      errorCode: success ? undefined : apiCode !== null ? `api_${apiCode}` : errorGroup,
      properties: {
        module: 'qzone_api',
        api: toTelemetryApiName(config.url),
        method: String(config.method || 'get').toLowerCase(),
        status: success ? 'success' : status ? `${Math.floor(status / 100)}xx` : 'network',
        errorGroup,
        target: qzoneHostCategory(config.url)
      }
    }).catch(() => {})
  } catch {
    // Telemetry must never affect Qzone API behavior.
  }
}

function extractQzoneApiCode(data) {
  const value = data?.code ?? data?.ret ?? data?.result?.code
  if (value === '' || value === undefined || value === null) return null
  const code = Number(value)
  return Number.isFinite(code) ? code : null
}

function qzoneHostCategory(input) {
  try {
    const host = new URL(String(input || ''), 'https://local.invalid').hostname
    if (/ptlogin/i.test(host)) return 'ptlogin'
    if (/photo\.qzone/i.test(host)) return 'photo_qzone'
    if (/user\.qzone/i.test(host)) return 'user_qzone'
    if (/h5\.qzone/i.test(host)) return 'h5_qzone'
    if (/qzone/i.test(host)) return 'qzone'
  } catch {
    // fall through
  }
  return 'other'
}

export default request
