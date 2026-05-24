import { extractJSONFromCallback } from '@main/api/utils/helpers'
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

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    if (response.data) {
      response.data = extractJSONFromCallback(response.data)
    }

    return response
  },
  (error) => {
    if (error.response) {
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
      console.log('No response received:', error.message)
    } else {
      console.log('Request setup error:', error.message)
    }
    return Promise.reject(error)
  }
)

export default request
