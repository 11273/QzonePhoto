import fs from 'fs/promises'
import path from 'path'
import axios from 'axios'
import { app } from 'electron'
import logger from '@main/core/logger'
import { APP_HOMEPAGE } from '@shared/const'

const ENV = import.meta.env || {}
const DEFAULT_REMOTE_TIMEOUT_MS = 3500
const DEFAULT_CACHE_FILENAME = 'app-api-config.json'
const DEFAULT_REMOTE_CONFIG_FILENAME = '.github/app-config.json'

let sessionApiConfig = null

export async function getAppApiConfig(options = {}) {
  const forceRefresh = Boolean(options?.forceRefresh)
  const remoteConfigUrl = resolveRemoteConfigUrl()
  const fallbackApiBaseUrl = resolveFallbackApiBaseUrl()

  if (!forceRefresh && sessionApiConfig && sessionApiConfig.remoteConfigUrl === remoteConfigUrl) {
    return sessionApiConfig
  }

  if (remoteConfigUrl) {
    try {
      const remoteConfig = await fetchRemoteConfig(remoteConfigUrl)
      sessionApiConfig = remoteConfig
      await writeCachedConfig(remoteConfig)
      return remoteConfig
    } catch (error) {
      logger.warn(`[AppApi] 远程配置拉取失败: ${error?.message || error}`)
    }
  }

  const cachedConfig = await readCachedConfig(remoteConfigUrl)
  if (cachedConfig) {
    sessionApiConfig = cachedConfig
    return cachedConfig
  }

  const fallbackConfig = buildFallbackConfig(fallbackApiBaseUrl, remoteConfigUrl)
  sessionApiConfig = fallbackConfig
  return fallbackConfig
}

async function fetchRemoteConfig(remoteConfigUrl) {
  const response = await axios.get(remoteConfigUrl, {
    timeout: DEFAULT_REMOTE_TIMEOUT_MS,
    headers: {
      Accept: 'application/json'
    }
  })

  const config = normalizeApiConfig(response.data, {
    remoteConfigUrl,
    source: 'remote'
  })

  if (!config.apiBaseUrl) {
    throw new Error('远程配置缺少 apiBaseUrl')
  }

  return config
}

async function readCachedConfig(remoteConfigUrl) {
  try {
    const raw = await fs.readFile(getCacheFilePath(), 'utf8')
    const parsed = JSON.parse(raw)
    const config = normalizeApiConfig(parsed, {
      remoteConfigUrl: remoteConfigUrl || parsed?.remoteConfigUrl || '',
      source: 'cache'
    })

    return config.apiBaseUrl ? config : null
  } catch {
    return null
  }
}

async function writeCachedConfig(config) {
  try {
    await fs.writeFile(getCacheFilePath(), JSON.stringify(config, null, 2), 'utf8')
  } catch (error) {
    logger.warn(`[AppApi] 写入本地缓存失败: ${error?.message || error}`)
  }
}

function getCacheFilePath() {
  return path.join(app.getPath('userData'), DEFAULT_CACHE_FILENAME)
}

function normalizeApiConfig(input, context = {}) {
  const apiBaseUrl = normalizeBaseUrl(input?.apiBaseUrl || input?.baseurl || '')
  const fallbackBaseUrls = normalizeFallbackBaseUrls(
    input?.fallbackBaseUrls || input?.fallbacks || [],
    apiBaseUrl
  )
  const version =
    typeof input?.version === 'string' || typeof input?.version === 'number'
      ? String(input.version)
      : ''
  const ttlSeconds = normalizeTtlSeconds(input?.ttlSeconds)
  const fetchedAt = isValidDateString(input?.fetchedAt) ? input.fetchedAt : new Date().toISOString()

  return {
    apiBaseUrl,
    fallbackBaseUrls,
    version,
    ttlSeconds,
    fetchedAt,
    remoteConfigUrl: normalizeHttpUrl(context.remoteConfigUrl || input?.remoteConfigUrl || ''),
    source: context.source || input?.source || 'unknown'
  }
}

function buildFallbackConfig(fallbackApiBaseUrl, remoteConfigUrl) {
  return {
    apiBaseUrl: fallbackApiBaseUrl,
    fallbackBaseUrls: [],
    version: '',
    ttlSeconds: normalizeTtlSeconds(),
    fetchedAt: new Date().toISOString(),
    remoteConfigUrl,
    source: fallbackApiBaseUrl ? 'fallback' : 'disabled'
  }
}

function resolveFallbackApiBaseUrl() {
  return normalizeBaseUrl(ENV.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || '')
}

function resolveRemoteConfigUrl() {
  const explicitUrl = normalizeHttpUrl(
    ENV.VITE_REMOTE_CONFIG_URL || process.env.VITE_REMOTE_CONFIG_URL || ''
  )
  if (explicitUrl) return explicitUrl
  return buildDefaultRemoteConfigUrl()
}

function buildDefaultRemoteConfigUrl() {
  const match = APP_HOMEPAGE.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/)?$/i)
  if (!match) return ''
  const [, owner, repo] = match
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${DEFAULT_REMOTE_CONFIG_FILENAME}`
}

function normalizeFallbackBaseUrls(input, primaryBaseUrl) {
  if (!Array.isArray(input)) return []

  const seen = new Set(primaryBaseUrl ? [primaryBaseUrl] : [])
  const result = []

  for (const item of input) {
    const nextUrl = normalizeBaseUrl(item)
    if (!nextUrl || seen.has(nextUrl)) continue
    seen.add(nextUrl)
    result.push(nextUrl)
  }

  return result
}

function normalizeBaseUrl(value) {
  const normalized = normalizeHttpUrl(value)
  return normalized ? normalized.replace(/\/+$/, '') : ''
}

function normalizeHttpUrl(value) {
  const nextValue = String(value || '').trim()
  if (!nextValue) return ''

  try {
    const url = new URL(nextValue)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.toString()
  } catch {
    return ''
  }
}

function normalizeTtlSeconds(value) {
  const ttl = Number(value)
  if (!Number.isFinite(ttl) || ttl <= 0) return 86400
  return Math.min(Math.max(Math.round(ttl), 300), 604800)
}

function isValidDateString(value) {
  return Boolean(value) && !Number.isNaN(Date.parse(String(value)))
}
