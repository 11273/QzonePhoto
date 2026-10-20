import { createApp, h, nextTick, ref } from 'vue'
import { createPinia } from 'pinia'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import '@renderer/assets/main.css'
import '@renderer/styles/design-tokens.css'
import '@renderer/styles/index.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '@renderer/styles/app-dialog.scss'
import '@renderer/styles/interaction-polish.css'
import '@renderer/styles/download-batch.css'
import '@renderer/styles/themes/qzone-dark.css'
import '@renderer/styles/element-theme.css'
import '@renderer/styles/ui-refinement.css'
import DownloadManager from '@renderer/components/DownloadManager/index.vue'

// No real IPC, login, network transfers, files or persistent account data are used.
const noop = async () => {}
const listeners = new Set()
const statsListeners = new Set()
const activeListeners = new Set()
let fixtureConcurrency = 3
let fixtureAutomaticConcurrency = true
let rejectConcurrencyChange = false
const imageSource = new URL('./download-preview.svg', import.meta.url).href
const videoSource = new URLSearchParams(location.search).get('videoSource') || ''
const localImageSource = new URLSearchParams(location.search).get('localImageSource') || imageSource
const states = [
  ['completed', 100],
  ['downloading', 0],
  ['downloading', 9],
  ['downloading', 10],
  ['downloading', 99],
  ['downloading', 0],
  ['paused', 88],
  ['waiting', 0],
  ['error', 99],
  ['cancelled', 55]
]
const tasks = states.map(([status, progress], index) => ({
  id: `layout-${index}`,
  type: index === 4 ? 'video' : 'image',
  url: index === 4 ? videoSource : imageSource,
  thumbnail_url: imageSource,
  name: `${'很长的文件名称_'.repeat(index === 0 ? 16 : 1)}${index}.jpg`,
  directory: '/isolated-layout-test',
  status,
  progress,
  create_time: 1700000000000,
  total: index === 5 ? 0 : 1023.99 * 1024 ** 3,
  downloaded: index === 5 ? 1024 : (1023.99 * 1024 ** 3 * progress) / 100,
  speed: status === 'downloading' ? 1023.9 * 1024 ** 2 : 0,
  batch_label: index % 2 ? '相册：111' : `相册：${'超长批次标签'.repeat(12)}`,
  used_fallback: index === 3,
  download_quality: 'standard',
  error: status === 'error' ? 'Request failed with status code 404' : ''
}))
const stats = tasks.reduce(
  (stats, task) => {
    stats[task.status]++
    return stats
  },
  {
    total: tasks.length,
    downloading: 0,
    waiting: 0,
    completed: 0,
    paused: 0,
    error: 0,
    cancelled: 0,
    currentSpeed: 1023.9 * 1024 ** 2
  }
)
let queryTasks = tasks
let pageResponseDelay = 0
let pageRequests = 0
let pendingRequests = 0
let peakPendingRequests = 0
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mergeQueryChanges = (changes) => {
  const changed = new Map(changes.map((task) => [task.id, task]))
  queryTasks = queryTasks
    .map((task) => changed.get(task.id) || task)
    .filter((task) => !task.deleted)
}
window.QzoneAPI = {
  download: {
    getTasks: async ({ status = null, page = 1, pageSize = 10 } = {}) => {
      const filtered = queryTasks.filter((task) => !status || task.status === status)
      const result = JSON.parse(
        JSON.stringify({
          tasks: filtered.slice((page - 1) * pageSize, page * pageSize),
          pagination: {
            page: 1,
            pageSize: 10,
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / pageSize)
          }
        })
      )
      pageRequests++
      peakPendingRequests = Math.max(peakPendingRequests, ++pendingRequests)
      await sleep(pageResponseDelay)
      pendingRequests--
      return result
    },
    getTaskPreview: async () => ({ src: localImageSource }),
    getStats: async () => stats,
    getBatches: async () =>
      Array.from({ length: 8 }, (_, index) => ({
        id: `batch-${index}`,
        label: '相册：很长的测试批次名称'.repeat(5),
        date_label: '2026/10/19',
        matched: 207,
        skipped: 1,
        missing_time: 1,
        auto_start: index % 2 === 0
      })),
    getDefaultPath: async () => '/isolated-layout-test',
    getConcurrency: async () => 3,
    getConcurrencySettings: async () => ({
      concurrency: fixtureConcurrency,
      automatic: fixtureAutomaticConcurrency
    }),
    setConcurrency: async (value) => {
      if (rejectConcurrencyChange) throw new Error('isolated settings failure')
      fixtureConcurrency = value
      fixtureAutomaticConcurrency = false
      return value
    },
    setAutomaticConcurrency: async (value) => {
      fixtureAutomaticConcurrency = value
      return { concurrency: fixtureConcurrency, automatic: value }
    },
    getReplaceExistingSetting: async () => false,
    getWriteFeedDescriptionSetting: async () => true,
    getTimePreference: async () => 'shoot',
    setManagerOpen: noop,
    onStatsUpdate: (callback) => {
      statsListeners.add(callback)
      return () => statsListeners.delete(callback)
    },
    onActiveTasksUpdate: (callback) => {
      const receive = (changes) => {
        mergeQueryChanges(changes)
        callback(changes)
      }
      activeListeners.add(receive)
      return () => activeListeners.delete(receive)
    },
    onTaskChanges: (callback) => {
      const receive = (changes) => {
        mergeQueryChanges(changes)
        callback(changes)
      }
      listeners.add(receive)
      return () => listeners.delete(receive)
    }
  }
}
sessionStorage.setItem('global-privacy-mode', 'false')
const managerOpen = ref(true)
window.isDownloadFixtureOpen = () => managerOpen.value
createApp({
  render: () =>
    h(
      ElConfigProvider,
      { locale: zhCn },
      {
        default: () =>
          h(DownloadManager, {
            modelValue: managerOpen.value,
            'onUpdate:modelValue': (value) => {
              managerOpen.value = value
            }
          })
      }
    )
})
  .use(createPinia())
  .mount('#app')

window.downloadLayoutReady = (async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 350))
  await document.fonts.ready
  return document.querySelectorAll('[data-task-id]').length === tasks.length
})()

window.inspectDownloadLayout = (fontFamily = '') => {
  document.querySelector('.download-manager-dialog').style.fontFamily = fontFamily
  const issues = []
  const columnWidths = []
  const barWidths = []
  const rowHeights = []
  const numericColumns = new Map()
  const header = document.querySelector('.task-header')
  if (header.scrollWidth > header.clientWidth + 1)
    issues.push('task filters or sorting controls overflow the header')
  const rect = (el) => el.getBoundingClientRect()
  const content = (el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
  }
  for (const row of document.querySelectorAll('[data-task-id]')) {
    rowHeights.push(rect(row).height)
    const label = row.querySelector('.progress-percent')
    const bounds = rect(label)
    columnWidths.push(bounds.width)
    const lines = content(label)
    const tops = new Set(lines.map((r) => Math.round(r.top * 10)))
    if (
      tops.size !== 1 ||
      lines.some((r) => r.right > bounds.right + 0.75 || r.left < bounds.left - 0.75)
    ) {
      issues.push(`${row.dataset.taskId}: ${label.textContent.trim()} wraps or overflows`)
    }
    if (row.scrollWidth > row.clientWidth + 1) issues.push(`${row.dataset.taskId}: row overflows`)
    const bar = rect(row.querySelector('.progress-bar-container'))
    barWidths.push(bar.width)
    if (bounds.right > bar.left + 0.75 || bar.width < 48)
      issues.push(`${row.dataset.taskId}: progress columns collide`)
    if (Math.abs((bounds.top + bounds.bottom) / 2 - (bar.top + bar.bottom) / 2) > 0.75) {
      issues.push(`${row.dataset.taskId}: progress label is vertically misaligned`)
    }
    for (const field of row.querySelectorAll('.size-info, .speed-info, .eta-info')) {
      const box = rect(field)
      if (!numericColumns.has(field.className)) numericColumns.set(field.className, [])
      numericColumns.get(field.className).push(box.left)
      if (content(field).some((r) => r.left < box.left - 0.75 || r.right > box.right + 0.75)) {
        issues.push(`${row.dataset.taskId}: ${field.className} text overflows its column`)
      }
    }
    const details = row.querySelector('.task-details')
    if (details.scrollWidth > details.clientWidth + 1)
      issues.push(`${row.dataset.taskId}: details are clipped`)
  }
  if (Math.max(...rowHeights) - Math.min(...rowHeights) > 0.75)
    issues.push('mixed task states, including errors, have different row heights')
  if (Math.max(...columnWidths) - Math.min(...columnWidths) > 0.75) {
    issues.push('percentage column widths vary between 0%, 9%, 10%, 99%, 100% and unknown size')
  }
  if (Math.max(...barWidths) - Math.min(...barWidths) > 0.75)
    issues.push('progress tracks have inconsistent widths between rows')
  for (const [name, positions] of numericColumns) {
    if (Math.max(...positions) - Math.min(...positions) > 0.75)
      issues.push(`${name} columns are misaligned between rows`)
  }
  return { width: innerWidth, height: innerHeight, rows: tasks.length, issues }
}

// A negative control proves that the browser test catches the original 100% bug.
window.rejectOldDownloadProgressLayout = () => {
  const label = document.querySelector('[data-task-id="layout-0"] .progress-percent')
  const previousStyle = label.style.cssText
  Object.assign(label.style, {
    width: '4ch',
    minWidth: '0',
    whiteSpace: 'normal',
    overflowWrap: 'break-word'
  })
  const rejected = window
    .inspectDownloadLayout('Arial, sans-serif')
    .issues.some((issue) => issue.includes('layout-0: 100% wraps'))
  label.style.cssText = previousStyle
  return rejected
}

window.exerciseDownloadProgressLayout = async () => {
  const row = document.querySelector('[data-task-id="layout-0"]')
  const widths = []
  const heights = []
  const issues = []
  for (const progress of [0, 9, 10, 99, 100]) {
    for (const callback of listeners)
      callback([
        {
          ...tasks[0],
          status: progress === 100 ? 'completed' : 'downloading',
          progress,
          downloaded: (tasks[0].total * progress) / 100,
          speed: progress === 100 ? 0 : 1023.9 * 1024 ** 2
        }
      ])
    await nextTick()
    if (row !== document.querySelector('[data-task-id="layout-0"]'))
      issues.push('progress recreated the row')
    widths.push(row.querySelector('.progress-bar-container').getBoundingClientRect().width)
    heights.push(row.getBoundingClientRect().height)
  }
  if (Math.max(...widths) - Math.min(...widths) > 0.75)
    issues.push('progress bar shifts while percentage changes')
  if (Math.max(...heights) - Math.min(...heights) > 0.75)
    issues.push('row height changes while percentage changes')
  for (const callback of statsListeners)
    callback({
      ...stats,
      completed: stats.total,
      downloading: 0,
      waiting: 0,
      paused: 0,
      error: 0,
      cancelled: 0,
      currentSpeed: 0
    })
  await nextTick()
  for (const label of document.querySelectorAll(
    '.progress-card .progress-percentage, .progress-circle .el-progress__text span'
  )) {
    const range = document.createRange()
    range.selectNodeContents(label)
    const lines = [...range.getClientRects()]
    const box = label.getBoundingClientRect()
    if (
      label.textContent.trim() !== '100%' ||
      new Set(lines.map((r) => r.top)).size !== 1 ||
      lines.some((r) => r.left < box.left - 0.75 || r.right > box.right + 0.75)
    ) {
      issues.push('overall 100% label wraps or overflows')
    }
  }
  for (const callback of statsListeners) callback(stats)
  await nextTick()
  return issues
}

const ensure = (condition, message) => {
  if (!condition) throw new Error(message)
}
const waitFor = async (condition, message, timeout = 2000) => {
  const until = performance.now() + timeout
  while (performance.now() < until) {
    if (condition()) return
    await sleep(20)
  }
  throw new Error(message)
}

window.exerciseDownloadStatusStability = async () => {
  const nodes = [...document.querySelectorAll('.status-card .status-item')]
  ensure(nodes.length === 6, 'all six status rows must stay mounted, including zero counts')
  const rects = () =>
    [
      ...document.querySelectorAll(
        '.download-manager-dialog, .location-block, .actions-right, .progress-card, .speed-card, .status-card, .status-card .status-item'
      )
    ].map((el) => {
      const box = el.getBoundingClientRect()
      const dialog = document.querySelector('.download-manager-dialog').getBoundingClientRect()
      // Ignore the dialog's intentional entrance translation, not internal shifts.
      return [box.x - dialog.x, box.y - dialog.y, box.width, box.height]
    })
  const baseline = rects()
  const sameRects = () =>
    rects().every((values, index) =>
      values.every((value, axis) => Math.abs(value - baseline[index][axis]) <= 0.75)
    )
  for (const state of ['downloading', 'waiting', 'paused', 'error', 'completed', 'cancelled']) {
    const next = {
      ...stats,
      downloading: 0,
      waiting: 0,
      paused: 0,
      error: 0,
      completed: 0,
      cancelled: 0,
      [state]: 10,
      currentSpeed: state === 'downloading' ? 1024 : 0
    }
    for (const callback of statsListeners) callback(next)
    await nextTick()
    const speedLabel = document.querySelector('.speed-label').textContent.trim()
    const expectedSpeedLabel =
      state === 'downloading' || state === 'waiting'
        ? ''
        : state === 'paused'
          ? '已暂停 · 继续后恢复下载'
          : '当前没有正在下载的任务'
    ensure(speedLabel === expectedSpeedLabel, `unexpected speed description for ${state}`)
    ensure(
      document.querySelector('.current-speed').textContent.trim(),
      `download speed must remain visible for ${state}`
    )
    const token = {
      downloading: 'info',
      waiting: 'info',
      paused: 'warning',
      error: 'danger',
      completed: 'success',
      cancelled: 'text-muted'
    }[state]
    const probe = document.createElement('span')
    probe.style.color = `var(--theme-${token})`
    document.body.append(probe)
    ensure(
      getComputedStyle(document.querySelector('.el-progress-circle__path')).stroke ===
        getComputedStyle(probe).color,
      `overall color is inconsistent for ${state}`
    )
    probe.remove()
    ensure(sameRects(), `cards or status rows jump for ${state}`)
    ensure(
      nodes.every(
        (node, index) => node === document.querySelectorAll('.status-card .status-item')[index]
      ),
      'status row was remounted'
    )
  }
  for (const callback of statsListeners) callback(stats)
  await nextTick()
  const error = document.querySelector('[data-task-id="layout-8"] .task-error-trigger')
  error.click()
  await waitFor(
    () => document.querySelector('.download-failure-detail'),
    'error details did not open'
  )
  ensure(
    document.querySelector('.download-failure-detail').textContent.includes('源文件已失效'),
    'failure does not explain recovery'
  )
  ensure(
    sameRects(),
    `error details moved the status workspace: ${JSON.stringify({ baseline, after: rects() })}`
  )
  document.body.click()
  return true
}

window.exerciseDownloadRealtimePage = async () => {
  await sleep(200)
  const freshTask = { ...tasks[1], id: 'next-active', progress: 10 }
  queryTasks = [freshTask, ...tasks]
  const startedAt = performance.now()
  for (const callback of activeListeners) callback([freshTask])
  await waitFor(
    () => document.querySelector('[data-task-id="next-active"]'),
    'new active task never appeared'
  )
  const latency = performance.now() - startedAt
  ensure(latency < 400, `new active task took ${Math.round(latency)}ms, still feels batched`)
  await sleep(200)
  pageResponseDelay = 350
  peakPendingRequests = 0
  const oldRequests = pageRequests
  for (const callback of statsListeners) callback({ ...stats, total: 11 })
  await sleep(180)
  for (let progress = 20; progress <= 70; progress += 10) {
    const updated = { ...freshTask, progress }
    for (const callback of listeners) callback([updated])
    for (const callback of statsListeners)
      callback({ ...stats, total: 11, downloading: progress, completed: 0 })
    await sleep(25)
  }
  await sleep(210)
  ensure(peakPendingRequests === 1, 'background page reads overlapped')
  ensure(
    document.querySelector('[data-task-id="next-active"] .progress-percent').textContent.trim() ===
      '70%',
    'slow page response overwrote newer streamed progress'
  )
  ensure(pageRequests - oldRequests < 4, 'each update caused a full page request')
  pageResponseDelay = 0
  queryTasks = tasks
  for (const callback of activeListeners)
    callback(tasks.filter((task) => task.status === 'downloading'))
  for (const callback of statsListeners) callback(stats)
  await sleep(800)
  return { latency: Math.round(latency), peakPendingRequests }
}

window.openDownloadFixtureImage = async () => {
  const thumbnail = document.querySelector('[data-task-id="layout-0"] .task-thumbnail')
  thumbnail.focus()
  thumbnail.click()
  await waitFor(
    () => document.querySelector('.mp-img')?.naturalWidth > 0,
    'download image did not decode'
  )
  await waitFor(
    () => document.querySelector('.mp-img')?.src === localImageSource,
    'local source did not replace the thumbnail'
  )
  if (localImageSource.startsWith('qzone-local:')) {
    await waitFor(
      () => document.querySelector('.mp-img')?.naturalWidth === 32,
      'local PNG response did not decode'
    )
  }
  const mask = document.querySelector('.media-preview-mask')
  const box = mask.getBoundingClientRect()
  ensure(
    box.x === 0 && box.y === 0 && box.width === innerWidth && box.height === innerHeight,
    'enlarged preview is clipped to the parent dialog'
  )
  ensure(mask.contains(document.activeElement), 'parent dialog stole preview focus')
  return true
}

window.openDownloadFixtureVideo = async () => {
  const thumbnail = document.querySelector('[data-task-id="layout-4"] .task-thumbnail')
  thumbnail.focus()
  thumbnail.dispatchEvent(new MouseEvent('mouseenter'))
  await sleep(650)
  ensure(
    !thumbnail.querySelector('video, .hvp-mute, .hover-video-preview'),
    'small thumbnail loaded hover playback controls'
  )
  thumbnail.click()
  await waitFor(
    () => document.querySelector('video.mp-video'),
    'download video preview did not open'
  )
  const video = document.querySelector('video.mp-video')
  ensure(
    video.paused && !video.getAttribute('src') && video.preload === 'none',
    'opening preview preloaded or played the video'
  )
  return true
}

window.playDownloadFixtureVideo = async () => {
  document.querySelector('.mp-video-play').click()
  await waitFor(
    () => document.querySelector('video.mp-video')?.currentTime > 0,
    'video did not play after explicit click',
    5000
  )
  return true
}

window.waitForDownloadPreviewClosed = () =>
  waitFor(() => !document.querySelector('.media-preview-mask'), 'preview did not close')

window.exerciseDownloadBackupRows = async () => {
  for (const index of [7, 8, 9]) {
    const updated = {
      ...tasks[index],
      type: 'contact-backup',
      backup_title: '联系人备份',
      backup_category: '好友',
      backup_detail: '很长的备份进度说明'.repeat(30),
      status: ['downloading', 'completed', 'error'][index - 7]
    }
    for (const callback of listeners) callback([updated])
  }
  await nextTick()
  ensure(
    window.inspectDownloadLayout().issues.length === 0,
    'contact backup rows clip, resize or misalign'
  )
  for (const index of [7, 8, 9]) for (const callback of listeners) callback([tasks[index]])
  await nextTick()
  return true
}

window.waitForDownloadFailureClosed = () =>
  waitFor(() => !document.querySelector('.download-failure-detail'), 'error popover did not close')

window.exerciseDownloadProgressTiming = async () => {
  const paintFrame = () => new Promise(requestAnimationFrame)
  await paintFrame()
  const task = { ...tasks[1], progress: 80 }
  for (const callback of listeners) callback([task])
  await nextTick()
  const bar = document.querySelector('[data-task-id="layout-1"] .el-progress-bar__inner')
  ensure(
    parseFloat(getComputedStyle(bar).transitionDuration) <= 0.15,
    'progress animation still lags behind the data'
  )
  // A hidden Electron window can run a timer before its animation timeline gets
  // a compositor frame. Measure painted progress, not that stale timer sample.
  await paintFrame()
  await sleep(200)
  await paintFrame()
  const ratio = bar.getBoundingClientRect().width / bar.parentElement.getBoundingClientRect().width
  const diagnostic = {
    connected: bar.isConnected,
    target: bar.style.width,
    ratio,
    transition: getComputedStyle(bar).transition,
    progress: document.querySelector('[data-task-id="layout-1"] .progress-percent')?.textContent,
    backendProgress: queryTasks.find((item) => item.id === 'layout-1')?.progress
  }
  ensure(ratio > 0.79, `progress still catching up after 200ms: ${JSON.stringify(diagnostic)}`)
  for (const callback of listeners) callback([{ ...task, status: 'completed', progress: 100 }])
  await nextTick()
  ensure(
    parseFloat(getComputedStyle(bar).transitionDuration) === 0,
    'completed progress must settle immediately'
  )
  ensure(
    bar.getBoundingClientRect().width === bar.parentElement.getBoundingClientRect().width,
    'completed progress does not fill the track'
  )
  for (const callback of listeners) callback([tasks[1]])
  await sleep(250)
  return true
}

window.exerciseDownloadMissingCover = async () => {
  const task = { ...tasks[4], thumbnail_url: videoSource }
  for (const callback of listeners) callback([task])
  await nextTick()
  ensure(
    !document.querySelector('[data-task-id="layout-4"] img')?.getAttribute('src'),
    'legacy missing-cover task requested the video as an image'
  )
  for (const callback of listeners) callback([tasks[4]])
  await nextTick()
  return true
}

window.exerciseDownloadFilters = async () => {
  document.querySelector('.status-dot.waiting').closest('button').click()
  await waitFor(
    () =>
      document.querySelectorAll('[data-task-id]').length === 1 &&
      document.querySelector('[data-task-id]')?.dataset.taskStatus === 'waiting',
    'status shortcut did not filter the list'
  )
  ensure(
    document.querySelector('.task-filter input[value="waiting"]').checked,
    'filter controls disagree'
  )
  queryTasks = tasks.filter((task) => task.status !== 'waiting')
  for (const callback of statsListeners) callback({ ...stats, total: 9, waiting: 0 })
  await waitFor(
    () => document.querySelector('.empty-title')?.textContent.includes('当前筛选没有任务'),
    'zero-count status cannot recover to an empty filter'
  )
  ensure(document.querySelectorAll('.status-item').length === 6, 'zero-count status vanished')
  const recover = [...document.querySelectorAll('.task-detail-list button')].find((button) =>
    button.textContent.includes('查看全部任务')
  )
  ensure(recover, 'empty filter has no recovery action')
  recover.click()
  await waitFor(
    () => document.querySelectorAll('[data-task-id]').length === 9,
    'clearing empty filter did not restore records'
  )
  queryTasks = tasks
  for (const callback of statsListeners) callback(stats)
  await waitFor(
    () => document.querySelectorAll('[data-task-id]').length === 10,
    'restored task did not reappear'
  )
  return true
}

window.exerciseDownloadPreviewDuringQueueChange = async () => {
  await window.openDownloadFixtureImage()
  const caption = document.querySelector('.mp-caption').textContent
  queryTasks = tasks.filter((task) => task.id !== 'layout-0')
  for (const callback of listeners) callback([{ id: 'layout-0', deleted: true }])
  await sleep(250)
  ensure(
    !document.querySelector('[data-task-id="layout-0"]'),
    'queue removal did not update the task list'
  )
  ensure(
    document.querySelector('.mp-caption').textContent === caption,
    'queue changes moved the open media preview'
  )
  return true
}

window.restoreDownloadFixturePage = async () => {
  queryTasks = tasks
  for (const callback of statsListeners) callback({ ...stats, total: 9 })
  for (const callback of statsListeners) callback(stats)
  await waitFor(
    () => document.querySelectorAll('[data-task-id]').length === 10,
    'fixture page did not recover'
  )
}

window.exerciseDownloadSettingsViewport = async () => {
  const body = document.querySelector('.el-dialog__body')
  if (innerHeight <= 540) {
    ensure(getComputedStyle(body).overflowY === 'auto', 'short viewport clips the workspace')
    body.scrollTop = body.scrollHeight
    const bottom = document.querySelector('.pagination-wrapper').getBoundingClientRect()
    ensure(
      bottom.bottom <= body.getBoundingClientRect().bottom + 1,
      'pagination is unreachable at high zoom'
    )
    ensure(
      bottom.top >= body.getBoundingClientRect().top,
      'pagination cannot be scrolled into view'
    )
    body.scrollTop = 0
  }
  document.querySelector('[title="调整下载与保存设置"]').click()
  await waitFor(
    () => document.querySelector('.download-settings-popover')?.contains(document.activeElement),
    'settings did not receive keyboard focus'
  )
  const popup = document.querySelector('.download-settings-popover')
  const panel = popup.querySelector('.download-settings-panel')
  const rect = popup.getBoundingClientRect()
  ensure(
    rect.left >= 0 &&
      rect.right <= innerWidth + 1 &&
      rect.top >= 0 &&
      rect.bottom <= innerHeight + 1,
    `settings overflow viewport: ${JSON.stringify(rect.toJSON())}`
  )
  ensure(panel.scrollWidth <= panel.clientWidth + 1, 'settings fields overflow horizontally')
  ensure(document.documentElement.scrollWidth <= innerWidth + 1, 'settings widen the document')
  const select = panel.querySelector('#download-concurrency')
  ensure(select.value === 'auto', 'untouched concurrency must default to automatic')
  const changeConcurrency = async (value) => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    await waitFor(() => !select.disabled, 'concurrency settings never finished saving')
  }
  await changeConcurrency('2')
  ensure(!fixtureAutomaticConcurrency && fixtureConcurrency === 2, 'manual selection was not saved')
  rejectConcurrencyChange = true
  await changeConcurrency('5')
  rejectConcurrencyChange = false
  ensure(select.value === '2', 'failed preference change was not rolled back')
  await changeConcurrency('auto')
  ensure(
    fixtureAutomaticConcurrency && select.value === 'auto',
    'automatic selection was not saved'
  )
  select.focus()
  return true
}

window.waitForDownloadSettingsClosed = () =>
  waitFor(() => {
    const popup = document.querySelector('.download-settings-popover')
    return !popup || getComputedStyle(popup).display === 'none'
  }, 'Escape did not close settings')

window.exerciseDownloadBatchViewport = async () => {
  document.querySelector('.batch-summary-trigger').click()
  await waitFor(() => {
    const popup = document.querySelector('.batch-summary-popover')
    return popup && getComputedStyle(popup).display !== 'none'
  }, 'recent batch summary did not open')
  await sleep(80)
  const popup = document.querySelector('.batch-summary-popover')
  const box = popup.getBoundingClientRect()
  ensure(
    box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1,
    'recent batch summary overflows the viewport'
  )
  document.querySelector('.batch-summary-trigger').click()
  return true
}
