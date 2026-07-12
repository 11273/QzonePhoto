;(function () {
  'use strict'

  const core = window.QzoneDownloadCore
  if (!core) return

  const config = {
    apiBaseUrl: 'https://qzone.getgit.one',
    manifestUrls: manifestUrls(),
    siteVersion: '2026.07.12'
  }
  const state = {
    sessionId: sessionId(),
    visitorId: visitorId(),
    manifest: core.normalizeManifest(null),
    manifestSource: 'loading',
    platform: core.detectPlatform({
      platform: navigator.userAgentData?.platform || navigator.platform,
      userAgent: navigator.userAgent
    }),
    recommendedAsset: null,
    pageStartedAt: performance.now(),
    maxScrollPercent: 0,
    engagementTracked: false
  }

  setupNavigation()
  setupReveal()
  setupChoices()
  setupDownloadLinks()
  setupOutboundTracking()
  setupFaqTracking()
  setupEngagementTracking()
  renderPlatform(state.platform)
  loadHighEntropyPlatform()
  loadManifest()
  track('website_visit', { source: pageName(), status: 'viewed', stage: 'visit' }, true)

  function setupEngagementTracking() {
    const updateScrollDepth = () => {
      const scrollableHeight = Math.max(document.documentElement.scrollHeight - innerHeight, 1)
      const progress = Math.min(100, Math.max(0, Math.round((scrollY / scrollableHeight) * 100)))
      state.maxScrollPercent = Math.max(state.maxScrollPercent, progress)
    }
    const reportEngagement = () => {
      if (state.engagementTracked) return
      const durationMs = Math.round((performance.now() - state.pageStartedAt) / 5000) * 5000
      if (durationMs < 10000) return
      state.engagementTracked = true
      track(
        'website_engaged',
        {
          source: pageName(),
          status: 'engaged',
          stage: 'engagement',
          durationBucket: durationBucket(durationMs),
          scrollBucket: scrollBucket(state.maxScrollPercent),
          pageLoadBucket: pageLoadBucket(),
          platform: state.platform.os,
          browser: browserFamily()
        },
        true,
        { durationMs, unload: true }
      )
    }
    updateScrollDepth()
    window.addEventListener('scroll', updateScrollDepth, { passive: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reportEngagement()
    })
    window.addEventListener('pagehide', reportEngagement, { once: true })
  }

  function setupNavigation() {
    const toggle = document.querySelector('[data-nav-toggle]')
    const nav = document.querySelector('[data-nav]')
    if (!toggle || !nav) return
    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('open')
      nav.classList.toggle('open', open)
      toggle.setAttribute('aria-expanded', String(open))
      toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航')
    })
    nav.addEventListener('click', () => {
      nav.classList.remove('open')
      toggle.setAttribute('aria-expanded', 'false')
      toggle.setAttribute('aria-label', '打开导航')
    })
  }

  function setupReveal() {
    const items = Array.from(document.querySelectorAll('.reveal'))
    if (
      !items.length ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      items.forEach((item) => item.classList.add('visible'))
      return
    }
    document.body.classList.add('motion-ready')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px' }
    )
    items.forEach((item) => observer.observe(item))
  }

  function setupChoices() {
    document.querySelectorAll('[data-choice-toggle]').forEach((button) => {
      const shell = button.closest('[data-download-shell]')
      const panel = shell?.querySelector('[data-platform-choice]')
      if (!panel) return
      button.addEventListener('click', () => setChoiceOpen(button, panel, panel.hidden))
    })
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      document.querySelectorAll('[data-platform-choice]:not([hidden])').forEach((panel) => {
        const button = panel.closest('[data-download-shell]')?.querySelector('[data-choice-toggle]')
        if (button) setChoiceOpen(button, panel, false)
      })
    })
  }

  function setChoiceOpen(button, panel, open) {
    panel.hidden = !open
    button.setAttribute('aria-expanded', String(open))
    if (open) {
      const recommended = state.recommendedAsset
        ? panel.querySelector(`[data-download="${state.recommendedAsset}"]`)
        : null
      const focusTarget =
        recommended ||
        panel.querySelector('.current-platform [data-download]') ||
        panel.querySelector('a')
      focusTarget?.focus()
    }
  }

  function setupDownloadLinks() {
    document.querySelectorAll('[data-download]').forEach((link) => {
      const asset = normalizeAsset(link.dataset.download)
      const source = link.dataset.source || pageName()
      link.dataset.download = asset
      link.href = core.workerDownloadUrl(asset, source)
      link.addEventListener('click', (event) => {
        if (link.dataset.needsChoice === 'true') {
          event.preventDefault()
          openChoiceFor(link)
          return
        }
        if (link.dataset.mobileCopy === 'true') {
          event.preventDefault()
          copyDesktopAddress(link)
          return
        }
        trackDownloadIntent(
          normalizeAsset(link.dataset.download),
          source,
          link.textContent.trim().slice(0, 48)
        )
      })
    })
  }

  function openChoiceFor(link) {
    const shell = link.closest('[data-download-shell]')
    const panel = shell?.querySelector('[data-platform-choice]')
    const button = shell?.querySelector('[data-choice-toggle]')
    if (panel && button) setChoiceOpen(button, panel, true)
  }

  async function copyDesktopAddress(link) {
    const address = `${location.origin || 'https://qzonephoto.getgit.one'}/`
    try {
      await navigator.clipboard.writeText(address)
      setTemporaryLabel(link, '官网地址已复制', '请在电脑浏览器中打开')
    } catch {
      window.prompt('复制官网地址，在电脑浏览器中打开', address)
    }
  }

  function setupOutboundTracking() {
    document.querySelectorAll('[data-track]').forEach((link) => {
      link.addEventListener('click', () => {
        track('website_outbound_clicked', {
          source: link.dataset.track || 'unknown',
          target: safeHost(link.href),
          status: 'clicked',
          stage: 'outbound',
          platform: state.platform.os,
          referrerType: referrerType()
        })
      })
    })
  }

  function setupFaqTracking() {
    document.querySelectorAll('details[data-faq]').forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return
        track('website_outbound_clicked', {
          source: `faq-${item.dataset.faq}`,
          target: 'faq',
          status: 'opened',
          stage: 'faq',
          platform: state.platform.os
        })
      })
    })
  }

  function renderPlatform(platform) {
    state.platform = platform
    state.recommendedAsset = core.recommendAsset(platform)
    sortPlatformChoices(platform)
    const smartLinks = document.querySelectorAll('[data-smart-download]')

    smartLinks.forEach((link) => {
      delete link.dataset.needsChoice
      delete link.dataset.mobileCopy
      if (platform.mobile) {
        link.dataset.mobileCopy = 'true'
        setLinkCopy(link, '复制电脑端下载地址', '请在电脑浏览器中打开')
        setStatus(link, '手机无法运行桌面安装包，已为你准备复制入口')
        return
      }
      if (platform.os === 'macos' && !state.recommendedAsset) {
        link.dataset.needsChoice = 'true'
        setLinkCopy(link, '选择 Mac 芯片版本', 'Apple 芯片或 Intel')
        setStatus(link, '浏览器无法可靠判断 Mac 芯片，请选择一次')
        return
      }

      const asset = state.recommendedAsset || core.DEFAULT_ASSET
      const info = core.assetInfo[asset]
      const source = link.dataset.source || pageName()
      link.dataset.download = asset
      link.href = core.workerDownloadUrl(asset, source)
      setLinkCopy(link, `下载 ${info.label}`, buildAssetMeta(asset, info.hint))
      setStatus(
        link,
        platform.confident
          ? `已识别当前系统：${info.label}`
          : '未能识别当前系统，默认推荐 Windows 64 位版'
      )
    })

    document.querySelectorAll('[data-recommended-title]').forEach((item) => {
      const info = state.recommendedAsset && core.assetInfo[state.recommendedAsset]
      item.textContent = platform.mobile
        ? '请在电脑上打开官网'
        : platform.os === 'macos' && !info
          ? '选择你的 Mac 芯片'
          : info?.label || 'Windows 64 位版'
    })
    document.querySelectorAll('[data-recommended-copy]').forEach((item) => {
      const info = state.recommendedAsset && core.assetInfo[state.recommendedAsset]
      item.textContent = platform.mobile
        ? '手机版网页不会下载桌面安装包。复制地址后，在 Windows、macOS 或 Linux 电脑上打开。'
        : platform.os === 'macos' && !info
          ? '不同芯片的安装包不能混用。请在“关于本机”中查看芯片名称。'
          : `${info?.hint || '适合大多数 Windows 电脑'}。如果识别不准确，可以在下方手动选择。`
    })
    markRecommendedCard()
  }

  function sortPlatformChoices(platform) {
    document.querySelectorAll('[data-platform-group]').forEach((group) => {
      const current = group.dataset.platformGroup === platform.os
      group.classList.toggle('current-platform', current)
      group.querySelectorAll('[data-download]').forEach((link) => {
        link.style.order = link.dataset.download === state.recommendedAsset ? '0' : '1'
      })
    })
  }

  async function loadHighEntropyPlatform() {
    if (!navigator.userAgentData?.getHighEntropyValues) return
    try {
      const values = await navigator.userAgentData.getHighEntropyValues([
        'architecture',
        'bitness',
        'platform'
      ])
      renderPlatform(core.refinePlatform(state.platform, values))
    } catch {
      // User-Agent Client Hints are optional; the initial platform guess remains usable.
    }
  }

  async function loadManifest() {
    for (const url of config.manifestUrls) {
      try {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 2800)
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          signal: controller.signal
        })
        window.clearTimeout(timeout)
        if (!response.ok) continue
        const manifest = core.normalizeManifest(await response.json())
        if (!manifest.assets.length && url.startsWith('http')) continue
        state.manifest = manifest
        state.manifestSource = url.startsWith('http') ? 'r2' : 'local'
        patchManifestData()
        setManifestStatus('ready')
        renderPlatform(state.platform)
        return
      } catch {
        // Try the next manifest source, then fall back to verified GitHub URLs.
      }
    }
    state.manifestSource = 'fallback'
    setManifestStatus('fallback')
    patchGithubFallbacks()
    renderPlatform(state.platform)
  }

  function patchManifestData() {
    const version = state.manifest.version
    document.querySelectorAll('[data-release-version]').forEach((item) => {
      item.textContent = version ? `v${version}` : '开源工具'
    })
    document.querySelectorAll('[data-asset-card]').forEach((card) => {
      const asset = state.manifest.assets.find((item) => item.id === card.dataset.assetCard)
      const meta = card.querySelector('[data-asset-meta]')
      if (!meta) return
      meta.textContent = asset
        ? [
            version ? `v${version}` : '',
            asset.size ? formatBytes(asset.size) : '',
            asset.sha256 ? `SHA-256 ${asset.sha256.slice(0, 8)}` : ''
          ]
            .filter(Boolean)
            .join(' · ')
        : '可直接下载，也可以查看全部安装包'
    })
    patchGithubReleaseLinks()
    patchGithubFallbacks()
  }

  function patchGithubReleaseLinks() {
    const releaseUrl = state.manifest.githubReleaseUrl || core.DEFAULT_GITHUB_RELEASE_URL
    document.querySelectorAll('[data-github-release]').forEach((link) => {
      link.href = releaseUrl
    })
  }

  function patchGithubFallbacks() {
    patchGithubReleaseLinks()
    document.querySelectorAll('[data-github-fallback]').forEach((link) => {
      link.href = core.githubAssetUrl(state.manifest, link.dataset.githubFallback)
    })
  }

  function setManifestStatus(status) {
    document.querySelectorAll('[data-manifest-status]').forEach((item) => {
      item.classList.remove('ready', 'fallback')
      if (status === 'ready') {
        item.classList.add('ready')
        item.textContent = state.manifestSource === 'r2' ? '最新版本已连接' : '使用页面内置版本信息'
      } else {
        item.classList.add('fallback')
        item.textContent = '版本信息暂时不可用，下载入口仍可使用'
      }
    })
  }

  function markRecommendedCard() {
    document.querySelectorAll('[data-asset-card]').forEach((card) => {
      card.classList.toggle('recommended', card.dataset.assetCard === state.recommendedAsset)
    })
  }

  function setLinkCopy(link, label, meta) {
    const labelNode = link.querySelector('[data-download-label]')
    const metaNode = link.querySelector('[data-download-meta]')
    if (labelNode) labelNode.textContent = label
    if (metaNode) metaNode.textContent = meta
  }

  function setTemporaryLabel(link, label, meta) {
    const labelNode = link.querySelector('[data-download-label]')
    const metaNode = link.querySelector('[data-download-meta]')
    if (!labelNode || !metaNode) return
    const previousLabel = labelNode.textContent
    const previousMeta = metaNode.textContent
    labelNode.textContent = label
    metaNode.textContent = meta
    window.setTimeout(() => {
      labelNode.textContent = previousLabel
      metaNode.textContent = previousMeta
    }, 1800)
  }

  function setStatus(link, text) {
    const status = link.closest('[data-download-shell]')?.querySelector('[data-download-status]')
    if (status) status.textContent = text
  }

  function buildAssetMeta(asset, fallback) {
    const manifestAsset = state.manifest.assets.find((item) => item.id === asset)
    return [
      state.manifest.version ? `v${state.manifest.version}` : '',
      manifestAsset?.size ? formatBytes(manifestAsset.size) : '',
      fallback
    ]
      .filter(Boolean)
      .join(' · ')
  }

  function trackDownloadIntent(asset, source, cta) {
    const info = core.assetInfo[asset] || {}
    track('website_download_clicked', {
      source,
      target: asset,
      status: 'clicked',
      stage: 'download',
      platform: info.platform || state.platform.os,
      arch: info.arch || state.platform.arch,
      asset,
      packageType: info.packageType || 'unknown',
      channel: 'worker',
      releaseVersion: state.manifest.version,
      cta
    })
  }

  function track(event, properties, oncePerPage, options) {
    if (!shouldTrack()) return
    const allowedEvents = new Set([
      'website_visit',
      'website_engaged',
      'website_download_clicked',
      'website_outbound_clicked'
    ])
    if (!allowedEvents.has(event)) return
    const onceKey = `qzonephoto:tracked:${event}:${pageName()}`
    if (oncePerPage && sessionStorage.getItem(onceKey)) return
    if (oncePerPage) sessionStorage.setItem(onceKey, '1')

    const safeProperties = core.safeTelemetryProperties(
      Object.assign(
        {
          siteVersion: config.siteVersion,
          viewport: viewportBucket(),
          browser: browserFamily(),
          language: languageBucket(),
          colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          connectionType: connectionType(),
          connectionSaveData: Boolean(navigator.connection?.saveData),
          pageLoadBucket: pageLoadBucket(),
          referrerType: referrerType(),
          utmSource: param('utm_source'),
          utmMedium: param('utm_medium'),
          utmCampaign: param('utm_campaign')
        },
        properties || {}
      )
    )
    const payload = JSON.stringify({
      event,
      eventName: event,
      appVersion: state.manifest.version || 'website',
      system: `web / ${state.platform.os}`,
      installMode: 'website',
      page: location.pathname || '/',
      sessionId: state.sessionId,
      visitorId: state.visitorId,
      success: true,
      durationMs: Number(options?.durationMs) || undefined,
      properties: safeProperties
    })
    if (options?.unload && typeof navigator.sendBeacon === 'function') {
      const beaconBody = new Blob([payload], { type: 'text/plain;charset=UTF-8' })
      if (navigator.sendBeacon(`${config.apiBaseUrl}/api/health`, beaconBody)) return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2500)
    fetch(`${config.apiBaseUrl}/api/health`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      signal: controller.signal
    })
      .catch(() => {})
      .finally(() => window.clearTimeout(timeout))
  }

  function sessionId() {
    const key = 'qzonephoto:site-session'
    let value = sessionStorage.getItem(key)
    if (value) return value
    value =
      window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `web-${Date.now().toString(36)}`
    sessionStorage.setItem(key, value)
    return value
  }

  function visitorId() {
    const key = 'qzonephoto:site-visitor'
    const maxAge = 180 * 24 * 60 * 60 * 1000
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null')
      if (
        stored &&
        typeof stored.id === 'string' &&
        stored.id.length >= 16 &&
        Number.isFinite(stored.createdAt) &&
        Date.now() - stored.createdAt < maxAge
      ) {
        return stored.id
      }
    } catch {
      // Storage may be unavailable in privacy-focused browser modes.
    }

    const id =
      window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    try {
      localStorage.setItem(key, JSON.stringify({ id, createdAt: Date.now() }))
    } catch {
      // The current page session remains measurable even when persistence is disabled.
    }
    return id
  }

  function normalizeAsset(value) {
    return core.ASSET_IDS.has(String(value || '').toLowerCase())
      ? String(value).toLowerCase()
      : core.DEFAULT_ASSET
  }

  function manifestUrls() {
    const local = rootPath('download-manifest.json')
    return shouldTrack()
      ? ['https://dl.qzonephoto.getgit.one/manifests/latest.json', local]
      : [local]
  }

  function rootPath(file) {
    const depth = location.pathname.split('/').filter(Boolean).length
    return `${depth ? '../' : './'}${file}`
  }

  function shouldTrack() {
    return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(location.hostname)
  }

  function pageName() {
    return document.body.dataset.page || 'unknown'
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name) || ''
  }

  function referrerType() {
    if (!document.referrer) return 'direct'
    try {
      const host = new URL(document.referrer).hostname
      if (host === location.hostname) return 'internal'
      if (/baidu|bing|google|sogou|so\.com/i.test(host)) return 'search'
      return 'external'
    } catch {
      return 'unknown'
    }
  }

  function viewportBucket() {
    if (innerWidth < 480) return 'mobile-small'
    if (innerWidth < 768) return 'mobile'
    if (innerWidth < 1024) return 'tablet'
    if (innerWidth < 1440) return 'desktop'
    return 'desktop-wide'
  }

  function durationBucket(durationMs) {
    if (durationMs < 30000) return '10-29s'
    if (durationMs < 60000) return '30-59s'
    if (durationMs < 3 * 60000) return '1-2m'
    if (durationMs < 5 * 60000) return '3-4m'
    if (durationMs < 10 * 60000) return '5-9m'
    return '10m+'
  }

  function scrollBucket(value) {
    if (value < 25) return '0-24%'
    if (value < 50) return '25-49%'
    if (value < 75) return '50-74%'
    if (value < 100) return '75-99%'
    return '100%'
  }

  function pageLoadBucket() {
    const navigation = performance.getEntriesByType?.('navigation')?.[0]
    const duration = Number(navigation?.duration || 0)
    if (!Number.isFinite(duration) || duration <= 0) return 'unknown'
    if (duration < 500) return '<0.5s'
    if (duration < 1000) return '0.5-1s'
    if (duration < 2000) return '1-2s'
    if (duration < 4000) return '2-4s'
    return '4s+'
  }

  function browserFamily() {
    const ua = navigator.userAgent || ''
    if (/edg\//i.test(ua)) return 'edge'
    if (/firefox\//i.test(ua)) return 'firefox'
    if (/chrome\//i.test(ua) || /crios\//i.test(ua)) return 'chrome'
    if (/safari\//i.test(ua)) return 'safari'
    return 'other'
  }

  function languageBucket() {
    return String(navigator.language || 'unknown')
      .toLowerCase()
      .slice(0, 16)
  }

  function connectionType() {
    return String(navigator.connection?.effectiveType || 'unknown').slice(0, 16)
  }

  function formatBytes(value) {
    if (!Number.isFinite(value) || value <= 0) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
    return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`
  }

  function safeHost(value) {
    try {
      return new URL(value).hostname.slice(0, 120)
    } catch {
      return 'unknown'
    }
  }
})()
