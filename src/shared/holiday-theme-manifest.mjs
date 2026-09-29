/**
 * Source manifest consumed by the desktop bundle.
 * `website/holiday-theme-manifest.json` is the deployable mirror; the theme
 * contract test compares both structures so desktop and website cannot drift.
 */
const HOLIDAY_THEME_MANIFEST = Object.freeze({
  schemaVersion: 1,
  revision: '2026-holiday-calendar-v3',
  timezone: 'Asia/Shanghai',
  generatedAt: '2026-09-28T00:00:00+08:00',
  validUntil: '2027-02-28T23:59:59+08:00',
  defaultThemeId: 'qzone-dark',
  killSwitch: false,
  assetsVersion: 'holiday-2026-2027-v3',
  targets: Object.freeze(['desktop', 'website']),
  campaigns: Object.freeze([
    Object.freeze({
      id: 'national-day-2026',
      themeId: 'national-day-dark',
      kind: 'fixed',
      phases: Object.freeze([
        Object.freeze({
          id: 'holiday',
          start: '2026-09-28T00:00:00+08:00',
          end: '2026-10-07T23:59:59+08:00'
        })
      ])
    }),
    Object.freeze({
      id: 'new-year-2027',
      themeId: 'new-year-dark',
      kind: 'fixed',
      phases: Object.freeze([
        Object.freeze({
          id: 'holiday',
          start: '2027-01-01T00:00:00+08:00',
          end: '2027-01-03T23:59:59+08:00'
        })
      ])
    }),
    Object.freeze({
      id: 'spring-festival-2027',
      themeId: 'spring-festival-dark',
      kind: 'fixed',
      phases: Object.freeze([
        Object.freeze({
          id: 'holiday',
          start: '2027-01-30T00:00:00+08:00',
          end: '2027-02-20T23:59:59+08:00'
        })
      ])
    })
  ])
})

export default HOLIDAY_THEME_MANIFEST
