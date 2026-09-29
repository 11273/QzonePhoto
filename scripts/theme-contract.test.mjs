import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_THEME_ID,
  FORBIDDEN_THEME_ASSETS,
  REQUIRED_THEME_TOKENS,
  SEASONAL_THEME_SCHEDULES,
  THEME_CLOCK_CACHE_KEY,
  THEME_CONSOLE_GLOBAL,
  THEME_MANIFEST,
  THEME_REGISTRY,
  THEME_TIME_ZONE,
  applyTheme,
  getThemeClock,
  getTheme,
  resolveThemeForDate,
  resolveThemeStateForDate,
  startThemeRuntime,
  syncThemeClock,
  validateTheme
} from '../src/renderer/src/theme/index.mjs'

test('default renderer theme implements the complete token contract', () => {
  const theme = getTheme()
  assert.equal(theme.id, DEFAULT_THEME_ID)
  assert.equal(validateTheme(theme), true)
  for (const token of REQUIRED_THEME_TOKENS) {
    assert.equal(typeof theme.tokens[token], 'string')
    assert.notEqual(theme.tokens[token].trim(), '')
  }
})

test('every registered renderer theme implements the complete token contract', () => {
  for (const theme of Object.values(THEME_REGISTRY)) {
    assert.equal(validateTheme(theme), true, `${theme.id} must be valid`)
    assert.equal('logo' in (theme.assets || {}), false, `${theme.id} must not theme the logo`)
  }
})

test('default theme stylesheet exposes every required token as a root custom property', () => {
  const stylesheet = readFileSync(
    new URL('../src/renderer/src/styles/themes/qzone-dark.css', import.meta.url),
    'utf8'
  )

  for (const token of REQUIRED_THEME_TOKENS) {
    const property = `--theme-${token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
    assert.match(stylesheet, new RegExp(`${property}\\s*:`), `missing ${property}`)
  }
})

test('default theme uses the bundled ambient canvas texture', () => {
  const theme = THEME_REGISTRY[DEFAULT_THEME_ID]
  const assetUrl = new URL('../src/renderer/src/assets/ambient-canvas.svg', import.meta.url)
  const stylesheet = readFileSync(
    new URL('../src/renderer/src/styles/themes/qzone-dark.css', import.meta.url),
    'utf8'
  )

  assert.equal(theme.assets.backgroundTexture, 'ambient-canvas')
  assert.equal(existsSync(assetUrl), true)
  assert.match(stylesheet, /ambient-canvas\.svg/)
})

test('unknown theme ids fall back to the default theme', () => {
  assert.equal(getTheme('not-registered'), THEME_REGISTRY[DEFAULT_THEME_ID])
})

test('themes cannot replace or recolor the product logo', () => {
  assert.deepEqual(FORBIDDEN_THEME_ASSETS, ['logo'])
  assert.equal('logo' in (THEME_REGISTRY[DEFAULT_THEME_ID].assets || {}), false)
  assert.equal(
    validateTheme({
      ...THEME_REGISTRY[DEFAULT_THEME_ID],
      assets: { ...THEME_REGISTRY[DEFAULT_THEME_ID].assets, logo: 'seasonal-logo.svg' }
    }),
    false
  )

  const titleBar = readFileSync(
    new URL('../src/renderer/src/components/CustomTitleBar/index.vue', import.meta.url),
    'utf8'
  )
  const logoRule = titleBar.match(/\.app-logo\s*\{([^}]+)\}/)?.[1] || ''
  assert.match(logoRule, /var\(--brand-logo-color\)/)
  assert.match(logoRule, /var\(--brand-logo-shadow\)/)
  assert.doesNotMatch(logoRule, /var\(--theme-/)
})

test('the title logo opens the official website without becoming a themed asset', () => {
  const titleBar = readFileSync(
    new URL('../src/renderer/src/components/CustomTitleBar/index.vue', import.meta.url),
    'utf8'
  )

  assert.match(titleBar, /APP_WEBSITE/)
  assert.match(titleBar, /aria-label="打开企鹅相册官网"/)
  assert.match(titleBar, /IPC_SHELL\.OPEN_EXTERNAL, APP_WEBSITE/)
})

test('festival themes use repository-owned shared holiday assets', () => {
  const theme = THEME_REGISTRY['national-day-dark']
  const lanternUrl = new URL('../website/assets/holiday/national-day-lantern.svg', import.meta.url)
  const patternUrl = new URL('../website/assets/holiday/national-day-pattern.svg', import.meta.url)
  const stylesheet = readFileSync(
    new URL('../src/renderer/src/styles/themes/festival-dark.css', import.meta.url),
    'utf8'
  )
  const newYearUrl = new URL('../website/assets/holiday/new-year-fireworks.svg', import.meta.url)
  const springFestivalUrl = new URL(
    '../website/assets/holiday/spring-festival-pattern.svg',
    import.meta.url
  )

  assert.equal(theme.assets.decoration, 'national-day-lantern')
  assert.equal(existsSync(lanternUrl), true)
  assert.equal(existsSync(patternUrl), true)
  assert.equal(existsSync(newYearUrl), true)
  assert.equal(existsSync(springFestivalUrl), true)
  assert.match(stylesheet, /website\/assets\/holiday\/national-day-lantern\.svg/)
  assert.match(stylesheet, /website\/assets\/holiday\/national-day-pattern\.svg/)
})

test('applying a theme updates root metadata and visual tokens without replacing business state', () => {
  const properties = new Map()
  const root = {
    dataset: { businessState: 'preserved' },
    classList: { toggle: () => {} },
    style: { setProperty: (name, value) => properties.set(name, value) },
    childNodes: [{ id: 'page-state' }]
  }

  const originalChildren = root.childNodes
  applyTheme(DEFAULT_THEME_ID, root, 'off')

  assert.equal(root.dataset.theme, DEFAULT_THEME_ID)
  assert.equal(root.dataset.themeMode, 'dark')
  assert.equal(root.dataset.themePhase, 'off')
  assert.equal(root.dataset.businessState, 'preserved')
  assert.equal(root.childNodes, originalChildren)
  assert.equal(properties.get('--theme-brand'), THEME_REGISTRY[DEFAULT_THEME_ID].tokens.brand)
  assert.equal(
    properties.get('--theme-privacy-backdrop'),
    THEME_REGISTRY[DEFAULT_THEME_ID].tokens.privacyBackdrop
  )
  assert.equal(properties.get('--theme-pattern-opacity'), '0.44')
  assert.equal(properties.get('--theme-decoration-opacity'), '0.72')
})

test('holiday themes use one stable holiday state and expose the festival family', () => {
  const properties = new Map()
  const root = {
    dataset: {},
    classList: { toggle: () => {} },
    style: { setProperty: (name, value) => properties.set(name, value) }
  }

  applyTheme('national-day-dark', root, 'holiday')
  assert.equal(properties.get('--theme-brand'), THEME_REGISTRY['national-day-dark'].tokens.brand)
  assert.equal(properties.get('--theme-pattern-opacity'), '0.42')
  assert.equal(properties.get('--theme-decoration-opacity'), '0.48')
  assert.equal(root.dataset.themeFamily, 'festival')
  assert.equal(root.dataset.themePhase, 'holiday')
})

test('the shared manifest exposes National Day, New Year and Spring Festival windows', () => {
  assert.equal(THEME_TIME_ZONE, 'Asia/Shanghai')
  assert.equal(THEME_MANIFEST.targets.includes('desktop'), true)
  assert.equal(THEME_MANIFEST.targets.includes('website'), true)
  assert.deepEqual(resolveThemeStateForDate(new Date('2026-09-27T15:59:59.000Z')), {
    themeId: DEFAULT_THEME_ID,
    campaignId: '',
    phaseId: 'off',
    timezone: THEME_TIME_ZONE
  })
  assert.equal(resolveThemeStateForDate(new Date('2026-09-27T16:00:00.000Z')).phaseId, 'holiday')
  assert.equal(
    resolveThemeStateForDate(new Date('2026-10-07T15:59:59.000Z')).themeId,
    'national-day-dark'
  )
  assert.equal(
    resolveThemeStateForDate(new Date('2026-10-07T16:00:00.000Z')).themeId,
    DEFAULT_THEME_ID
  )
  assert.equal(resolveThemeForDate(new Date('2026-09-27T16:00:00.000Z')), 'national-day-dark')
  assert.equal(
    resolveThemeStateForDate(new Date('2027-01-01T00:00:00+08:00')).themeId,
    'new-year-dark'
  )
  assert.equal(
    resolveThemeStateForDate(new Date('2027-01-04T00:00:00+08:00')).themeId,
    DEFAULT_THEME_ID
  )
  assert.equal(
    resolveThemeStateForDate(new Date('2027-01-30T00:00:00+08:00')).themeId,
    'spring-festival-dark'
  )
  assert.equal(
    resolveThemeStateForDate(new Date('2027-02-21T00:00:00+08:00')).themeId,
    DEFAULT_THEME_ID
  )
})

test('desktop and website holiday manifests stay byte-for-byte equivalent as data', () => {
  const websiteManifest = JSON.parse(
    readFileSync(new URL('../website/holiday-theme-manifest.json', import.meta.url), 'utf8')
  )
  assert.deepEqual(websiteManifest, JSON.parse(JSON.stringify(THEME_MANIFEST)))
})

test('an expired manifest fails closed to the default theme', () => {
  const expiredManifest = {
    ...THEME_MANIFEST,
    validUntil: '2026-09-27T23:59:59+08:00'
  }
  assert.equal(
    resolveThemeStateForDate(new Date('2026-09-28T00:00:00+08:00'), expiredManifest).themeId,
    DEFAULT_THEME_ID
  )
})

test('every public website page loads the independent holiday runtime', () => {
  for (const path of [
    '../website/index.html',
    '../website/features/index.html',
    '../website/privacy/index.html',
    '../website/404.html'
  ]) {
    const html = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(html, /holiday-theme\.js\?v=/, `${path} must load the holiday runtime`)
  }
})

test('website presentation does not restore cursor-following light effects', () => {
  const runtime = readFileSync(new URL('../website/main.js', import.meta.url), 'utf8')
  const stylesheet = readFileSync(new URL('../website/styles.css', import.meta.url), 'utf8')

  assert.doesNotMatch(runtime, /pointermove|setupSurfaceMotion|--spotlight-/)
  assert.doesNotMatch(stylesheet, /--spotlight-|--depth-|--material-[xy]|is-depth-active/)
})

test('fixed date windows support future lunar holiday themes', () => {
  const schedules = [
    { themeId: 'national-day-dark', kind: 'fixed', start: '2027-02-05', end: '2027-02-20' }
  ]
  assert.equal(
    resolveThemeForDate(new Date('2027-02-10T04:00:00.000Z'), schedules),
    'national-day-dark'
  )
  assert.equal(
    resolveThemeForDate(new Date('2027-02-21T04:00:00.000Z'), schedules),
    DEFAULT_THEME_ID
  )
  assert.equal(SEASONAL_THEME_SCHEDULES[0].kind, 'fixed')
})

test('server time calibration is cached and used without blocking offline launches', async () => {
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  }
  const serverTime = 'Mon, 28 Sep 2026 04:00:00 GMT'
  const clock = await syncThemeClock({
    url: 'https://example.test/holiday-theme-manifest.json',
    storage,
    fetchImpl: async () => ({
      ok: true,
      headers: { get: (name) => (name.toLowerCase() === 'date' ? serverTime : null) },
      json: async () => THEME_MANIFEST
    })
  })

  assert.equal(clock.source, 'server')
  assert.equal(values.has(THEME_CLOCK_CACHE_KEY), true)
  const cached = getThemeClock(storage, JSON.parse(values.get(THEME_CLOCK_CACHE_KEY)).observedAt)
  assert.equal(cached.source, 'server-cache')
  assert.ok(Number.isFinite(cached.offsetMs))
})

test('development theme console previews and restores themes without replacing page state', () => {
  const properties = new Map()
  const root = {
    dataset: { pageState: 'preserved' },
    classList: { toggle: () => {} },
    style: { setProperty: (name, value) => properties.set(name, value) },
    childNodes: [{ id: 'current-page' }]
  }
  const originalChildren = root.childNodes
  const debugTarget = {}
  const stop = startThemeRuntime({ root, debugTarget })
  const themeConsole = debugTarget[THEME_CONSOLE_GLOBAL]

  assert.deepEqual(
    themeConsole.list().map(({ id }) => id),
    ['qzone-dark', 'national-day-dark', 'new-year-dark', 'spring-festival-dark']
  )
  themeConsole.use('national-day-dark')
  assert.equal(root.dataset.theme, 'national-day-dark')
  assert.equal(root.dataset.themePhase, 'holiday')
  assert.equal(root.dataset.themeTimeSource, 'console')
  assert.equal(root.dataset.pageState, 'preserved')
  assert.equal(root.childNodes, originalChildren)

  themeConsole.use('qzone-dark')
  assert.equal(root.dataset.theme, 'qzone-dark')
  assert.equal(root.dataset.themePhase, 'off')
  assert.throws(() => themeConsole.use('not-registered'), /未知主题/)

  themeConsole.auto()
  assert.notEqual(root.dataset.themeTimeSource, 'console')
  stop()
  assert.equal(THEME_CONSOLE_GLOBAL in debugTarget, false)
})
