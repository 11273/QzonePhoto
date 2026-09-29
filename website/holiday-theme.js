;(function () {
  'use strict'

  const MANIFEST_URL = '/holiday-theme-manifest.json'
  const RESYNC_INTERVAL_MS = 10 * 60 * 1000
  // Apply the known calendar before the stylesheet is parsed. The network
  // manifest remains authoritative and will immediately correct this seed.
  // This avoids a full-page restyle and large paint immediately after first render.
  const BOOTSTRAP_MANIFEST = {
    revision: '2026-holiday-calendar-v3',
    validUntil: '2027-02-28T23:59:59+08:00',
    killSwitch: false,
    targets: ['website'],
    campaigns: [
      {
        themeId: 'national-day-dark',
        phases: [
          {
            id: 'holiday',
            start: '2026-09-28T00:00:00+08:00',
            end: '2026-10-07T23:59:59+08:00'
          }
        ]
      },
      {
        themeId: 'new-year-dark',
        phases: [
          {
            id: 'holiday',
            start: '2027-01-01T00:00:00+08:00',
            end: '2027-01-03T23:59:59+08:00'
          }
        ]
      },
      {
        themeId: 'spring-festival-dark',
        phases: [
          {
            id: 'holiday',
            start: '2027-01-30T00:00:00+08:00',
            end: '2027-02-20T23:59:59+08:00'
          }
        ]
      }
    ]
  }
  const root = document.documentElement
  let manifest = BOOTSTRAP_MANIFEST
  let clockSource = 'local'
  let clockAnchor = null
  let lastSyncAt = -Infinity

  renderTheme()
  syncThemeManifest().catch(() => {
    // 节日装饰是渐进增强能力，任何异常都不能影响官网的主要内容与下载入口。
  })
  window.setInterval(refreshTheme, 60_000)
  window.addEventListener('focus', refreshTheme)
  document.addEventListener('visibilitychange', refreshTheme)

  function monotonicNow() {
    return window.performance?.now?.() ?? Date.now()
  }

  function currentTime() {
    if (!clockAnchor) return Date.now()
    return clockAnchor.nowMs + Math.max(0, monotonicNow() - clockAnchor.monotonicMs)
  }

  function refreshTheme() {
    renderTheme()
    if (monotonicNow() - lastSyncAt >= RESYNC_INTERVAL_MS) {
      syncThemeManifest().catch(() => {})
    }
  }

  async function syncThemeManifest() {
    lastSyncAt = monotonicNow()
    const response = await fetch(MANIFEST_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return

    const remoteManifest = await response.json()
    const serverNow = Date.parse(response.headers.get('date') || '')
    clockSource = Number.isFinite(serverNow) ? 'server' : 'local'
    clockAnchor = {
      nowMs: Number.isFinite(serverNow) ? serverNow : Date.now(),
      monotonicMs: monotonicNow()
    }
    manifest = remoteManifest
    renderTheme()
  }

  function clearTheme() {
    delete root.dataset.holidayTheme
    delete root.dataset.holidayFamily
    delete root.dataset.holidayPhase
    delete root.dataset.holidayRevision
    delete root.dataset.holidayTimeSource
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta?.dataset.defaultContent) themeMeta.content = themeMeta.dataset.defaultContent
  }

  function renderTheme() {
    if (!manifest) return
    const now = currentTime()
    if (
      manifest?.killSwitch ||
      !Array.isArray(manifest?.targets) ||
      !manifest.targets.includes('website') ||
      !Array.isArray(manifest.campaigns) ||
      (manifest.validUntil && now > Date.parse(manifest.validUntil))
    ) {
      clearTheme()
      return
    }

    const active = manifest.campaigns
      .flatMap((campaign) => (campaign.phases || []).map((phase) => ({ campaign, phase })))
      .find(({ phase }) => now >= Date.parse(phase.start) && now <= Date.parse(phase.end))
    if (!active) {
      clearTheme()
      return
    }

    root.dataset.holidayTheme = active.campaign.themeId
    root.dataset.holidayFamily = 'festival'
    root.dataset.holidayPhase = active.phase.id
    root.dataset.holidayRevision = manifest.revision || ''
    root.dataset.holidayTimeSource = clockSource

    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      if (!themeMeta.dataset.defaultContent) themeMeta.dataset.defaultContent = themeMeta.content
      const themeColors = {
        'national-day-dark': '#fbfaf8',
        'new-year-dark': '#f8fafc',
        'spring-festival-dark': '#fbf9f7'
      }
      themeMeta.content = themeColors[active.campaign.themeId] || '#f7f7f8'
    }
  }
})()
