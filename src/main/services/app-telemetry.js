import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import axios from 'axios'
import { app } from 'electron'
import { getAppApiConfig } from '@main/config/app-api'
import logger from '@main/core/logger'
import {
  classifyTelemetryError,
  sanitizeDiagnosticLog,
  sanitizeTelemetryProperties,
  toCountBucket,
  toDurationBucket,
  toSizeBucket,
  toSpeedBucket
} from './telemetry-safety.mjs'

const INSTALL_ID_FILENAME = 'analytics-install-id'
const REQUEST_TIMEOUT_MS = 4500
const LOG_UPLOAD_REUSE_WINDOW_MS = 5 * 60 * 1000
const SESSION_ID = `${Date.now()}-${process.pid}`
let installIdCache = ''
let launchReported = false
let pendingLogUpload = null
let recentLogUpload = null

export async function submitFeedback(payload = {}) {
  const config = await getAppApiConfig()
  const baseUrls = getBaseUrls(config)
  if (!baseUrls.length) throw new Error('快捷反馈服务未配置')

  const body = {
    ...payload,
    env: {
      ...buildRuntimeEnv(payload.env?.page),
      ...(payload.env || {}),
      installId: await ensureInstallId(),
      sessionId: SESSION_ID
    },
    createdAt: payload.createdAt || new Date().toISOString()
  }

  const response = await requestWithFallback(baseUrls, '/api/feedback', {
    method: 'post',
    data: body
  })
  return parseFeedbackResponse(response)
}

export async function uploadDiagnosticLogs(options = {}) {
  const config = await getAppApiConfig()
  const baseUrls = getBaseUrls(config)
  if (!baseUrls.length) throw new Error('日志上传服务未配置')

  const logContent = await readLocalDiagnosticLog(options)
  const sanitized = sanitizeDiagnosticLog(logContent)
  if (!sanitized.trim()) throw new Error('没有可上传的诊断日志')

  const installId = await ensureInstallId()
  const body = {
    ...buildRuntimeEnv(options.page),
    installId,
    sessionId: SESSION_ID,
    reason: options.reason || 'manual_feedback',
    content: sanitized
  }

  const fingerprint = createLogUploadFingerprint({
    content: sanitized,
    installId,
    reason: body.reason
  })
  const now = Date.now()
  if (
    recentLogUpload?.fingerprint === fingerprint &&
    now - recentLogUpload.createdAt < LOG_UPLOAD_REUSE_WINDOW_MS
  ) {
    return { ...recentLogUpload.result, reused: true }
  }
  if (pendingLogUpload?.fingerprint === fingerprint) {
    return await pendingLogUpload.promise
  }

  const promise = sendDiagnosticLogUpload(baseUrls, body).then((result) => {
    recentLogUpload = {
      fingerprint,
      createdAt: Date.now(),
      result
    }
    return result
  })
  pendingLogUpload = { fingerprint, promise }
  try {
    return await promise
  } finally {
    if (pendingLogUpload?.fingerprint === fingerprint) {
      pendingLogUpload = null
    }
  }
}

export async function fetchNotices(options = {}) {
  const config = await getAppApiConfig({ forceRefresh: Boolean(options.forceRefresh) })
  const baseUrls = getBaseUrls(config)
  if (!baseUrls.length) {
    return { notice: null, notices: [], health: { ok: false, code: 'API_DISABLED' } }
  }

  const shouldReportHealth = !launchReported
  const body = shouldReportHealth
    ? {
        health: await buildHealthPayload({
          event: 'app_launch',
          page: options.page || 'unknown',
          success: true
        })
      }
    : null

  if (shouldReportHealth) launchReported = true

  try {
    const response = await requestWithFallback(baseUrls, '/api/notice', {
      method: shouldReportHealth ? 'post' : 'get',
      data: body
    })
    const data = response?.data?.data || response?.data || {}
    return {
      notice: data.notice || null,
      notices: Array.isArray(data.notices) ? data.notices : data.notice ? [data.notice] : [],
      health: data.health || null
    }
  } catch (error) {
    if (shouldReportHealth) launchReported = false
    logger.debug(`[Telemetry] 公告拉取失败: ${error?.message || error}`)
    throw error
  }
}

export async function reportHealthEvent(payload = {}) {
  const config = await getAppApiConfig()
  const baseUrls = getBaseUrls(config)
  if (!baseUrls.length) return { stored: false, skipped: true }

  const body = await buildHealthPayload(payload)
  const response = await requestWithFallback(baseUrls, '/api/health', {
    method: 'post',
    data: body
  })
  return response?.data?.data || response?.data || { stored: true }
}

function getBaseUrls(config = {}) {
  return [config.apiBaseUrl, ...(config.fallbackBaseUrls || [])]
    .map((url) => String(url || '').replace(/\/+$/, ''))
    .filter(Boolean)
}

async function requestWithFallback(baseUrls, endpoint, options) {
  let lastError = null
  for (const baseUrl of baseUrls) {
    try {
      const headers = {
        ...buildTelemetryHeaders(),
        ...(options?.headers || {})
      }
      return await axios({
        ...options,
        url: `${baseUrl}${endpoint}`,
        timeout: REQUEST_TIMEOUT_MS,
        headers,
        validateStatus: () => true
      })
    } catch (error) {
      lastError = error
      logger.debug(`[Telemetry] ${endpoint} 请求失败 ${baseUrl}: ${error?.message || error}`)
    }
  }
  throw lastError || new Error('遥测服务不可用')
}

function buildTelemetryHeaders() {
  const userAgent = buildTelemetryUserAgent()
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
    'X-Qzone-Client': userAgent
  }
}

function buildTelemetryUserAgent() {
  const version = normalizeHeaderToken(app.getVersion() || 'unknown', 40)
  const platform = normalizeHeaderToken(platformName(), 32)
  const arch = normalizeHeaderToken(os.arch(), 24)
  const mode = app.isPackaged ? 'packaged' : 'dev'
  return `QzonePhoto/${version} (${platform}; ${arch}; ${mode})`
}

async function sendDiagnosticLogUpload(baseUrls, body) {
  const response = await requestWithFallback(baseUrls, '/api/logs', {
    method: 'post',
    data: body
  })
  const data = response?.data || {}
  if (response.status >= 400 || data?.ok === false) {
    throw new Error(data?.message || '日志上传失败')
  }
  return data.data || data
}

function parseFeedbackResponse(response) {
  const data = response?.data || {}
  if (response.status === 429) return { ok: false, message: '提交太频繁了，请稍后再试' }
  if (response.status >= 500) return { ok: false, message: '反馈服务暂时不可用，请稍后再试' }
  if (data?.ok === false) {
    return { ok: false, message: data.message || '提交失败，请检查内容后再试' }
  }
  return {
    ok: response.status >= 200 && response.status < 300,
    message: data.message || '反馈已提交',
    issue: data.data?.issue,
    issueUrl: data.data?.issueUrl,
    delivery: data.data?.delivery
  }
}

function buildRuntimeEnv(page = 'unknown') {
  return {
    appVersion: app.getVersion() || 'unknown',
    system: [platformName(), os.arch()].filter(Boolean).join(' / ') || 'unknown',
    installMode: app.isPackaged ? '安装包' : '开发模式',
    page: page || 'unknown'
  }
}

async function buildHealthPayload(payload = {}) {
  return {
    event: payload.event || payload.eventName || 'app_launch',
    eventName: payload.eventName || payload.event || 'app_launch',
    ...buildRuntimeEnv(payload.page),
    installId: payload.installId || (await ensureInstallId()),
    sessionId: payload.sessionId || SESSION_ID,
    durationMs: normalizeDuration(payload.durationMs),
    success: typeof payload.success === 'boolean' ? payload.success : undefined,
    errorCode: normalizeText(payload.errorCode, 80),
    properties: normalizeProperties(payload.properties)
  }
}

function platformName() {
  const platform = os.platform()
  if (platform === 'darwin') return 'macOS'
  if (platform === 'win32') return 'Windows'
  if (platform === 'linux') return 'Linux'
  return platform
}

export async function ensureInstallId() {
  if (installIdCache) return installIdCache
  const filePath = path.join(app.getPath('userData'), INSTALL_ID_FILENAME)
  try {
    const cached = (await fs.readFile(filePath, 'utf8')).trim()
    if (cached) {
      installIdCache = cached
      return installIdCache
    }
  } catch {
    // create below
  }

  installIdCache =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `install_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  try {
    await fs.writeFile(filePath, installIdCache, 'utf8')
  } catch (error) {
    logger.debug(`[Telemetry] 安装 ID 写入失败: ${error?.message || error}`)
  }
  return installIdCache
}

function normalizeDuration(value) {
  const duration = Number(value)
  if (!Number.isFinite(duration) || duration < 0) return undefined
  return Math.min(Math.round(duration), 24 * 60 * 60 * 1000)
}

function normalizeText(value, maxLength = 120) {
  return stripControlChars(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function normalizeProperties(value) {
  return sanitizeTelemetryProperties(value)
}

function normalizeHeaderToken(value, maxLength = 80) {
  return (
    String(value || 'unknown')
      .replace(/[\r\n;()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength) || 'unknown'
  )
}

function createLogUploadFingerprint(value) {
  return crypto
    .createHash('sha256')
    .update([value.installId || '', value.reason || '', value.content || ''].join('\n'))
    .digest('hex')
}

async function readLocalDiagnosticLog(options = {}) {
  const logPath =
    process.env.QZONE_DEV_LOG_PATH || path.join(app.getPath('userData'), 'qzone-helper-dev.log')
  const extraLines = Array.isArray(options.extraLines) ? options.extraLines : []
  let content = ''
  try {
    content = await fs.readFile(logPath, 'utf8')
  } catch (error) {
    logger.debug(`[Telemetry] 本地日志读取失败: ${error?.message || error}`)
  }
  const extra = extraLines
    .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
    .filter(Boolean)
    .join('\n')
  return [content, extra].filter(Boolean).join('\n')
}

function stripControlChars(value) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : char
  }).join('')
}

export const telemetryBuckets = {
  classifyError: classifyTelemetryError,
  count: toCountBucket,
  duration: toDurationBucket,
  size: toSizeBucket,
  speed: toSpeedBucket
}
