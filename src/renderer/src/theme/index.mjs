import HOLIDAY_THEME_MANIFEST from '../../../shared/holiday-theme-manifest.mjs'

/**
 * @typedef {Object} ThemeDefinition
 * @property {string} id
 * @property {string} label
 * @property {'default'|'festival'} family
 * @property {'dark'} mode
 * @property {Record<string, string>} tokens
 * @property {{backgroundTexture?: string, decoration?: string}=} assets
 * @property {{patternOpacity?: number, decorationOpacity?: number}=} effects
 * @property {Record<string, {tokens?: Record<string, string>, effects?: {patternOpacity?: number, decorationOpacity?: number}}>=} phases
 */

export const REQUIRED_THEME_TOKENS = Object.freeze([
  'canvas',
  'surface',
  'surfaceRaised',
  'surfaceOverlay',
  'surfaceSoft',
  'surfaceHover',
  'surfaceActive',
  'surfaceDisabled',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'textSubtle',
  'textDisabled',
  'textInverse',
  'borderSubtle',
  'border',
  'borderStrong',
  'materialThin',
  'materialRegular',
  'materialThick',
  'materialBorder',
  'materialHighlight',
  'materialBlur',
  'materialBlurStrong',
  'materialSaturation',
  'brand',
  'brandHover',
  'brandPressed',
  'brandAccent',
  'brandText',
  'brandSoft',
  'brandSoftHover',
  'brandBorder',
  'focus',
  'focusRing',
  'info',
  'infoStrong',
  'infoText',
  'infoSoft',
  'infoBorder',
  'success',
  'successText',
  'successSoft',
  'successBorder',
  'warning',
  'warningStrong',
  'warningText',
  'warningSoft',
  'warningBorder',
  'danger',
  'dangerText',
  'dangerSoft',
  'dangerBorder',
  'backdrop',
  'shadowSm',
  'shadowMd',
  'shadowLg',
  'shadowBrand',
  'privacyBackdrop',
  'privacyIcon',
  'privacyText'
])

const QZONE_DARK_TOKENS = Object.freeze({
  canvas: '#141418',
  surface: '#1c1c20',
  surfaceRaised: '#232329',
  surfaceOverlay: '#18181d',
  surfaceSoft: 'rgba(255, 255, 255, 0.035)',
  surfaceHover: 'rgba(255, 255, 255, 0.065)',
  surfaceActive: 'rgba(255, 255, 255, 0.095)',
  surfaceDisabled: '#303036',
  textPrimary: '#f5f5f7',
  textSecondary: '#c4c4cc',
  textMuted: '#91919c',
  textSubtle: '#898994',
  textDisabled: '#5e5e68',
  textInverse: '#ffffff',
  borderSubtle: 'rgba(255, 255, 255, 0.065)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.2)',
  materialThin: 'rgba(24, 24, 30, 0.68)',
  materialRegular: 'rgba(24, 24, 30, 0.82)',
  materialThick: 'rgba(18, 18, 23, 0.92)',
  materialBorder: 'rgba(255, 255, 255, 0.13)',
  materialHighlight: 'rgba(255, 255, 255, 0.07)',
  materialBlur: '18px',
  materialBlurStrong: '28px',
  materialSaturation: '135%',
  brand: '#c2410c',
  brandHover: '#d1480d',
  brandPressed: '#9a3412',
  brandAccent: '#fb923c',
  brandText: '#fed7aa',
  brandSoft: 'rgba(249, 115, 22, 0.14)',
  brandSoftHover: 'rgba(249, 115, 22, 0.21)',
  brandBorder: 'rgba(251, 146, 60, 0.38)',
  focus: '#fdba74',
  focusRing: 'rgba(251, 146, 60, 0.42)',
  info: '#60a5fa',
  infoStrong: '#3b82f6',
  infoText: '#bfdbfe',
  infoSoft: 'rgba(96, 165, 250, 0.13)',
  infoBorder: 'rgba(96, 165, 250, 0.34)',
  success: '#34d399',
  successText: '#a7f3d0',
  successSoft: 'rgba(52, 211, 153, 0.13)',
  successBorder: 'rgba(52, 211, 153, 0.34)',
  warning: '#fbbf24',
  warningStrong: '#d97706',
  warningText: '#fde68a',
  warningSoft: 'rgba(251, 191, 36, 0.13)',
  warningBorder: 'rgba(251, 191, 36, 0.34)',
  danger: '#f87171',
  dangerText: '#fecaca',
  dangerSoft: 'rgba(248, 113, 113, 0.13)',
  dangerBorder: 'rgba(248, 113, 113, 0.34)',
  backdrop: 'rgba(7, 7, 10, 0.72)',
  shadowSm: '0 2px 8px rgba(0, 0, 0, 0.22)',
  shadowMd: '0 10px 28px rgba(0, 0, 0, 0.32)',
  shadowLg: '0 24px 64px rgba(0, 0, 0, 0.46)',
  shadowBrand: '0 8px 22px rgba(194, 65, 12, 0.28)',
  privacyBackdrop: 'rgba(7, 7, 10, 0.84)',
  privacyIcon: '#fbbf24',
  privacyText: '#fde68a'
})

/** @type {Readonly<Record<string, ThemeDefinition>>} */
export const THEME_REGISTRY = Object.freeze({
  'qzone-dark': Object.freeze({
    id: 'qzone-dark',
    label: '企鹅相册深色',
    family: 'default',
    mode: 'dark',
    tokens: QZONE_DARK_TOKENS,
    assets: Object.freeze({
      backgroundTexture: 'ambient-canvas',
      decoration: 'wave'
    }),
    effects: Object.freeze({ patternOpacity: 0.44, decorationOpacity: 0.72 })
  }),
  'national-day-dark': Object.freeze({
    id: 'national-day-dark',
    label: '国庆假日',
    family: 'festival',
    mode: 'dark',
    tokens: Object.freeze({
      ...QZONE_DARK_TOKENS,
      canvas: '#111014',
      surface: '#1b191f',
      surfaceRaised: '#242129',
      surfaceOverlay: '#17161b',
      surfaceSoft: 'rgba(255, 255, 255, 0.04)',
      surfaceHover: 'rgba(255, 255, 255, 0.075)',
      surfaceActive: 'rgba(255, 255, 255, 0.11)',
      surfaceDisabled: '#302d35',
      borderSubtle: 'rgba(255, 255, 255, 0.075)',
      border: 'rgba(255, 255, 255, 0.13)',
      borderStrong: 'rgba(255, 255, 255, 0.22)',
      materialThin: 'rgba(27, 23, 31, 0.7)',
      materialRegular: 'rgba(24, 21, 28, 0.84)',
      materialThick: 'rgba(18, 16, 22, 0.94)',
      materialBorder: 'rgba(255, 255, 255, 0.14)',
      materialHighlight: 'rgba(255, 255, 255, 0.075)',
      materialSaturation: '138%',
      brand: '#c43630',
      brandHover: '#de5545',
      brandPressed: '#992b2d',
      brandAccent: '#e2c371',
      brandText: '#f7dfb0',
      brandSoft: 'rgba(196, 54, 48, 0.15)',
      brandSoftHover: 'rgba(222, 85, 69, 0.22)',
      brandBorder: 'rgba(226, 195, 113, 0.32)',
      focus: '#e2c371',
      focusRing: 'rgba(226, 195, 113, 0.38)',
      backdrop: 'rgba(8, 7, 11, 0.76)',
      shadowSm: '0 3px 12px rgba(0, 0, 0, 0.28)',
      shadowMd: '0 14px 38px rgba(0, 0, 0, 0.38)',
      shadowLg: '0 30px 82px rgba(0, 0, 0, 0.54)',
      shadowBrand: '0 10px 30px rgba(196, 54, 48, 0.24)',
      privacyIcon: '#e2c371',
      privacyText: '#f7dfb0'
    }),
    assets: Object.freeze({
      backgroundTexture: 'national-day-pattern',
      decoration: 'national-day-lantern'
    }),
    effects: Object.freeze({ patternOpacity: 0.42, decorationOpacity: 0.48 })
  }),
  'new-year-dark': Object.freeze({
    id: 'new-year-dark',
    label: '元旦假日',
    family: 'festival',
    mode: 'dark',
    tokens: Object.freeze({
      ...QZONE_DARK_TOKENS,
      canvas: '#10151d',
      surface: '#181e27',
      surfaceRaised: '#202936',
      surfaceOverlay: '#131922',
      surfaceSoft: 'rgba(255, 255, 255, 0.042)',
      surfaceHover: 'rgba(255, 255, 255, 0.075)',
      surfaceActive: 'rgba(255, 255, 255, 0.11)',
      surfaceDisabled: '#2c3440',
      borderSubtle: 'rgba(255, 255, 255, 0.075)',
      border: 'rgba(255, 255, 255, 0.13)',
      borderStrong: 'rgba(255, 255, 255, 0.22)',
      materialThin: 'rgba(19, 27, 38, 0.7)',
      materialRegular: 'rgba(18, 25, 35, 0.84)',
      materialThick: 'rgba(14, 20, 28, 0.94)',
      materialBorder: 'rgba(255, 255, 255, 0.14)',
      materialHighlight: 'rgba(255, 255, 255, 0.078)',
      brand: '#c87922',
      brandHover: '#e09335',
      brandPressed: '#9c5815',
      brandAccent: '#f0cf83',
      brandText: '#f9e8bb',
      brandSoft: 'rgba(214, 151, 54, 0.15)',
      brandSoftHover: 'rgba(224, 147, 53, 0.22)',
      brandBorder: 'rgba(240, 207, 131, 0.34)',
      focus: '#f0cf83',
      focusRing: 'rgba(240, 207, 131, 0.4)',
      backdrop: 'rgba(5, 9, 15, 0.78)',
      shadowBrand: '0 10px 30px rgba(43, 98, 151, 0.24)',
      privacyIcon: '#f0cf83',
      privacyText: '#f9e8bb'
    }),
    assets: Object.freeze({
      backgroundTexture: 'new-year-fireworks',
      decoration: 'new-year-spark'
    }),
    effects: Object.freeze({ patternOpacity: 0.4, decorationOpacity: 0.44 })
  }),
  'spring-festival-dark': Object.freeze({
    id: 'spring-festival-dark',
    label: '春节假日',
    family: 'festival',
    mode: 'dark',
    tokens: Object.freeze({
      ...QZONE_DARK_TOKENS,
      canvas: '#120e11',
      surface: '#1d171b',
      surfaceRaised: '#271e23',
      surfaceOverlay: '#181216',
      surfaceSoft: 'rgba(255, 255, 255, 0.042)',
      surfaceHover: 'rgba(255, 255, 255, 0.076)',
      surfaceActive: 'rgba(255, 255, 255, 0.11)',
      surfaceDisabled: '#342b30',
      borderSubtle: 'rgba(255, 255, 255, 0.075)',
      border: 'rgba(255, 255, 255, 0.13)',
      borderStrong: 'rgba(255, 255, 255, 0.22)',
      materialThin: 'rgba(29, 20, 25, 0.7)',
      materialRegular: 'rgba(27, 19, 23, 0.85)',
      materialThick: 'rgba(20, 14, 18, 0.94)',
      materialBorder: 'rgba(255, 255, 255, 0.14)',
      materialHighlight: 'rgba(255, 255, 255, 0.075)',
      brand: '#b8322e',
      brandHover: '#d74b3d',
      brandPressed: '#8f2729',
      brandAccent: '#eabe63',
      brandText: '#f9dfaa',
      brandSoft: 'rgba(184, 50, 46, 0.16)',
      brandSoftHover: 'rgba(215, 75, 61, 0.23)',
      brandBorder: 'rgba(234, 190, 99, 0.34)',
      focus: '#eabe63',
      focusRing: 'rgba(234, 190, 99, 0.4)',
      backdrop: 'rgba(8, 5, 7, 0.78)',
      shadowBrand: '0 10px 30px rgba(184, 50, 46, 0.25)',
      privacyIcon: '#eabe63',
      privacyText: '#f9dfaa'
    }),
    assets: Object.freeze({
      backgroundTexture: 'spring-festival-pattern',
      decoration: 'chinese-lantern'
    }),
    effects: Object.freeze({ patternOpacity: 0.44, decorationOpacity: 0.5 })
  })
})

export const DEFAULT_THEME_ID = 'qzone-dark'
export const FORBIDDEN_THEME_ASSETS = Object.freeze(['logo'])
export const THEME_MANIFEST = Object.freeze(HOLIDAY_THEME_MANIFEST)
export const THEME_TIME_ZONE = THEME_MANIFEST.timezone || 'Asia/Shanghai'
export const THEME_CLOCK_CACHE_KEY = 'qzone.theme.clock.v1'
export const THEME_CLOCK_MAX_AGE_MS = 12 * 60 * 60 * 1000
export const THEME_CLOCK_RESYNC_MS = 10 * 60 * 1000
export const THEME_TRANSITION_MS = 280
export const THEME_CONSOLE_GLOBAL = 'QzoneTheme'

// 向后兼容旧的日期解析入口。新代码应读取共享 manifest 的阶段信息。
export const SEASONAL_THEME_SCHEDULES = Object.freeze(
  THEME_MANIFEST.campaigns.flatMap((campaign) => {
    const phases = Array.isArray(campaign.phases) ? campaign.phases : []
    if (!phases.length) return []
    return [
      Object.freeze({
        themeId: campaign.themeId,
        kind: campaign.kind,
        start: phases[0].start.slice(0, 10),
        end: phases.at(-1).end.slice(0, 10)
      })
    ]
  })
)

export function getTheme(themeId = DEFAULT_THEME_ID) {
  return THEME_REGISTRY[themeId] || THEME_REGISTRY[DEFAULT_THEME_ID]
}

export function validateTheme(theme) {
  if (!theme || typeof theme !== 'object') return false
  if (!theme.id || !theme.label || theme.mode !== 'dark') return false
  if (FORBIDDEN_THEME_ASSETS.some((asset) => asset in (theme.assets || {}))) return false
  return REQUIRED_THEME_TOKENS.every((token) => typeof theme.tokens?.[token] === 'string')
}

function datePartsInTimeZone(date, timeZone = THEME_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    iso: `${values.year}-${values.month}-${values.day}`,
    monthDay: `${values.month}-${values.day}`
  }
}

function dateTimeKeyInTimeZone(date, timeZone = THEME_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
}

function isWithinAnnualRange(monthDay, start, end) {
  return start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end
}

/**
 * Resolve a cosmetic seasonal theme without a network dependency.
 * Fixed schedules use YYYY-MM-DD and are intended for lunar holidays such as Spring Festival.
 */
export function resolveThemeForDate(
  now = new Date(),
  schedules = SEASONAL_THEME_SCHEDULES,
  timeZone = THEME_TIME_ZONE
) {
  const { iso, monthDay } = datePartsInTimeZone(now, timeZone)
  const active = schedules.find((schedule) => {
    if (!THEME_REGISTRY[schedule.themeId]) return false
    if (schedule.kind === 'annual') {
      return isWithinAnnualRange(monthDay, schedule.start, schedule.end)
    }
    return iso >= schedule.start && iso <= schedule.end
  })
  return active?.themeId || DEFAULT_THEME_ID
}

/**
 * Resolve the active campaign and phase from the shared website/desktop manifest.
 * Cosmetic themes always fail closed to the default theme when the manifest is invalid.
 */
export function resolveThemeStateForDate(
  now = new Date(),
  manifest = THEME_MANIFEST,
  target = 'desktop'
) {
  const fallback = Object.freeze({
    themeId: manifest?.defaultThemeId || DEFAULT_THEME_ID,
    campaignId: '',
    phaseId: 'off',
    timezone: manifest?.timezone || THEME_TIME_ZONE
  })
  if (
    !manifest ||
    manifest.killSwitch ||
    (manifest.validUntil && now.getTime() > Date.parse(manifest.validUntil)) ||
    !Array.isArray(manifest.targets) ||
    !manifest.targets.includes(target) ||
    !Array.isArray(manifest.campaigns)
  ) {
    return fallback
  }

  const localKey = dateTimeKeyInTimeZone(now, manifest.timezone || THEME_TIME_ZONE)
  for (const campaign of manifest.campaigns) {
    if (!THEME_REGISTRY[campaign.themeId] || !Array.isArray(campaign.phases)) continue
    for (const phase of campaign.phases) {
      const start = campaign.kind === 'annual' ? phase.start : phase.start.slice(0, 19)
      const end = campaign.kind === 'annual' ? phase.end : phase.end.slice(0, 19)
      const comparisonKey = campaign.kind === 'annual' ? localKey.slice(5) : localKey
      if (comparisonKey >= start && comparisonKey <= end) {
        return Object.freeze({
          themeId: campaign.themeId,
          campaignId: campaign.id,
          phaseId: phase.id,
          timezone: manifest.timezone || THEME_TIME_ZONE
        })
      }
    }
  }
  return fallback
}

function tokenToCustomProperty(token) {
  return `--theme-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

export function applyTheme(
  themeId = DEFAULT_THEME_ID,
  root = globalThis.document?.documentElement,
  phaseId = 'off'
) {
  const theme = getTheme(themeId)
  if (!root || !validateTheme(theme)) return theme

  root.dataset.theme = theme.id
  root.dataset.themeMode = theme.mode
  root.dataset.themeFamily = theme.family || 'default'
  root.dataset.themePhase = theme.id === DEFAULT_THEME_ID ? 'off' : phaseId
  root.classList.toggle('dark', theme.mode === 'dark')
  const phase = theme.phases?.[phaseId]
  const tokens = { ...theme.tokens, ...(phase?.tokens || {}) }
  const effects = { ...theme.effects, ...(phase?.effects || {}) }
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(tokenToCustomProperty(token), value)
  }
  root.style.setProperty('--theme-pattern-opacity', String(effects.patternOpacity ?? 0.4))
  root.style.setProperty('--theme-decoration-opacity', String(effects.decorationOpacity ?? 0.7))
  return theme
}

export function applyThemeState(state, root = globalThis.document?.documentElement) {
  return applyTheme(state?.themeId || DEFAULT_THEME_ID, root, state?.phaseId || 'off')
}

function readClockCache(storage, localNow) {
  try {
    const value = JSON.parse(storage?.getItem(THEME_CLOCK_CACHE_KEY) || 'null')
    if (!Number.isFinite(value?.offsetMs) || !Number.isFinite(value?.observedAt)) return null
    if (Math.abs(localNow - value.observedAt) > THEME_CLOCK_MAX_AGE_MS) return null
    return value
  } catch {
    return null
  }
}

export function getThemeClock(storage = globalThis.localStorage, localNow = Date.now()) {
  const cached = readClockCache(storage, localNow)
  return Object.freeze({
    now: new Date(localNow + (cached?.offsetMs || 0)),
    source: cached ? 'server-cache' : 'local',
    offsetMs: cached?.offsetMs || 0
  })
}

export async function syncThemeClock({
  url,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  timeoutMs = 2500
} = {}) {
  if (!url || typeof fetchImpl !== 'function') return getThemeClock(storage)
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`Theme manifest request failed: ${response.status}`)
    const remoteManifest = await response.json()
    const serverDate = Date.parse(response.headers.get('date') || '')
    const completedAt = Date.now()
    if (
      remoteManifest?.schemaVersion !== THEME_MANIFEST.schemaVersion ||
      !Number.isFinite(serverDate)
    ) {
      throw new Error('Theme manifest or server date is invalid')
    }
    const offsetMs = serverDate - Math.round((startedAt + completedAt) / 2)
    const value = { offsetMs, observedAt: completedAt, revision: remoteManifest.revision || '' }
    storage?.setItem(THEME_CLOCK_CACHE_KEY, JSON.stringify(value))
    return Object.freeze({
      now: new Date(completedAt + offsetMs),
      source: 'server',
      offsetMs,
      manifest: remoteManifest
    })
  } finally {
    clearTimeout(timeout)
  }
}

export function startThemeRuntime({
  manifestUrl,
  root = globalThis.document?.documentElement,
  target = 'desktop',
  debugTarget = null
} = {}) {
  if (!root) return () => {}
  let transitionTimer = 0
  let refreshTimer = 0
  let runtimeManifest = THEME_MANIFEST
  let manualState = null
  let currentState = null
  let themeConsole = null
  let clockAnchor = null
  let lastSyncMonotonic = -Infinity
  const previousThemeConsole = debugTarget?.[THEME_CONSOLE_GLOBAL]
  const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now()

  const setClockAnchor = (clock) => {
    clockAnchor = {
      nowMs: clock.now.getTime(),
      monotonicMs: monotonicNow(),
      source: clock.source || 'local',
      manifest: clock.manifest
    }
  }

  const getAnchoredClock = () => {
    if (!clockAnchor) setClockAnchor(getThemeClock())
    return Object.freeze({
      now: new Date(clockAnchor.nowMs + Math.max(0, monotonicNow() - clockAnchor.monotonicMs)),
      source: clockAnchor.source,
      manifest: clockAnchor.manifest
    })
  }

  const render = (clock = getAnchoredClock()) => {
    const candidateManifest = clock.manifest || runtimeManifest
    const state = manualState || resolveThemeStateForDate(clock.now, candidateManifest, target)
    if (clock.manifest) runtimeManifest = clock.manifest
    const changed = root.dataset.theme && root.dataset.theme !== state.themeId
    if (changed) {
      root.dataset.themeTransitioning = 'true'
      globalThis.clearTimeout(transitionTimer)
      transitionTimer = globalThis.setTimeout(() => {
        delete root.dataset.themeTransitioning
      }, THEME_TRANSITION_MS)
    }
    applyThemeState(state, root)
    root.dataset.themeTimeSource = manualState ? 'console' : clock.source || 'local'
    currentState = Object.freeze({ ...state, source: root.dataset.themeTimeSource })
    return state
  }

  if (debugTarget) {
    themeConsole = Object.freeze({
      list() {
        return Object.values(THEME_REGISTRY).map(({ id, label }) => ({ id, label }))
      },
      current() {
        return currentState ? { ...currentState } : null
      },
      use(themeId = 'national-day-dark') {
        if (!THEME_REGISTRY[themeId]) {
          throw new TypeError(
            `未知主题“${themeId}”，可用主题：${Object.keys(THEME_REGISTRY).join('、')}`
          )
        }
        manualState = Object.freeze({
          themeId,
          campaignId: 'console-preview',
          phaseId: themeId === DEFAULT_THEME_ID ? 'off' : 'holiday',
          timezone: THEME_TIME_ZONE
        })
        render()
        return themeConsole.current()
      },
      auto() {
        manualState = null
        render()
        return themeConsole.current()
      }
    })
    Object.defineProperty(debugTarget, THEME_CONSOLE_GLOBAL, {
      configurable: true,
      value: themeConsole
    })
  }

  setClockAnchor(getThemeClock())
  render()
  const calibrate = () => {
    if (!manifestUrl || monotonicNow() - lastSyncMonotonic < THEME_CLOCK_RESYNC_MS) return
    lastSyncMonotonic = monotonicNow()
    syncThemeClock({ url: manifestUrl })
      .then((clock) => {
        setClockAnchor(clock)
        render()
      })
      .catch(() => render())
  }
  const refresh = () => {
    render()
    calibrate()
  }
  globalThis.addEventListener?.('focus', refresh)
  globalThis.document?.addEventListener?.('visibilitychange', refresh)
  refreshTimer = globalThis.setInterval?.(refresh, 60_000)
  calibrate()

  return () => {
    globalThis.clearTimeout(transitionTimer)
    globalThis.clearInterval?.(refreshTimer)
    globalThis.removeEventListener?.('focus', refresh)
    globalThis.document?.removeEventListener?.('visibilitychange', refresh)
    if (debugTarget?.[THEME_CONSOLE_GLOBAL] === themeConsole) {
      if (previousThemeConsole === undefined) delete debugTarget[THEME_CONSOLE_GLOBAL]
      else {
        Object.defineProperty(debugTarget, THEME_CONSOLE_GLOBAL, {
          configurable: true,
          value: previousThemeConsole
        })
      }
    }
  }
}
