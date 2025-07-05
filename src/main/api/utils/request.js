import { extractJSONFromCallback } from '@main/api/utils/helpers'
import axios from 'axios'

// 创建 axios 实例
const request = axios.create({
  withCredentials: true,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
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
