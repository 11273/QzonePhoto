// Run after `pnpm dev`: pnpm test:download-ui. Uses a separate in-memory session.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { spawn } from 'node:child_process'
import {
  handleLocalMediaRequest,
  registerLocalMedia
} from '../src/main/utils/local-media-registry.js'

async function runElectronChecks() {
  const { app, BrowserWindow, protocol } = await import('electron')
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'qzone-local',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
  app.setPath('userData', process.env.QZONE_LAYOUT_PROFILE)
  app.disableHardwareAcceleration()
  console.log('Starting isolated download layout regression…')
  app
    .whenReady()
    .then(async () => {
      console.log('Electron ready')
      app.dock?.hide()
      const window = new BrowserWindow({
        width: 1080,
        height: 750,
        show: false,
        webPreferences: {
          partition: `layout-${process.pid}`,
          sandbox: true,
          contextIsolation: true,
          backgroundThrottling: false
        }
      })
      let exitCode = 0
      try {
        const videoBytes = Buffer.from(
          await fs.readFile(
            new URL('./fixtures/download-preview.webm.base64', import.meta.url),
            'utf8'
          ),
          'base64'
        )
        let videoRequests = 0
        const videoPath = path.join(process.env.QZONE_LAYOUT_PROFILE, 'preview.webm')
        await fs.writeFile(videoPath, videoBytes)
        const imagePath = path.join(process.env.QZONE_LAYOUT_PROFILE, 'preview.png')
        await fs.writeFile(
          imagePath,
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAACAAAAAYCAIAAAAUMWhjAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAI0lEQVR4nGNgYPhLYzRqwagFoxaMWjBqwagFoxaMWjAkLAAA8CD3H1axTwcAAAAASUVORK5CYII=',
            'base64'
          )
        )
        const videoSource = `qzone-local://local/${registerLocalMedia(videoPath)}`
        const localImageSource = `qzone-local://local/${registerLocalMedia(imagePath)}`
        window.webContents.session.protocol.handle('qzone-local', (request) => {
          if (request.url === videoSource) videoRequests++
          return handleLocalMediaRequest(request)
        })
        const fixturePath = fileURLToPath(
          new URL('./fixtures/download-layout.html', import.meta.url)
        )
        const origin = process.env.QZONE_RENDERER_URL || 'http://localhost:5173'
        window.webContents.on('console-message', (event) => {
          if (event.level === 'error') console.error(event.message)
        })
        await window.loadURL(
          `${origin}/@fs/${fixturePath.split(path.sep).join('/')}?videoSource=${encodeURIComponent(videoSource)}&localImageSource=${encodeURIComponent(localImageSource)}`
        )
        console.log('Fixture loaded')
        assert.equal(
          await Promise.race([
            window.webContents.executeJavaScript('window.downloadLayoutReady'),
            delay(15000).then(() => {
              throw new Error('Download layout fixture timed out')
            })
          ]),
          true
        )
        assert.equal(
          await window.webContents.executeJavaScript('window.rejectOldDownloadProgressLayout()'),
          true,
          'the original 4ch/100% layout must fail the browser assertion'
        )
        const failures = []
        let cases = 0
        for (const [width, height] of [
          [375, 812],
          [540, 750],
          [540, 375],
          [900, 500],
          [768, 900],
          [960, 750],
          [1080, 750],
          [1440, 900]
        ]) {
          for (const zoom of [1, 1.25, 1.5, 1.75, 2]) {
            window.setContentSize(Math.round(width * zoom), Math.round(height * zoom))
            window.webContents.setZoomFactor(zoom)
            // A fresh document commits native zoom after large hidden-window resizes.
            await window.loadURL(window.webContents.getURL())
            await window.webContents.executeJavaScript('window.downloadLayoutReady')
            for (let attempt = 0; attempt < 20; attempt++) {
              const viewport = await window.webContents.executeJavaScript(
                '({width: innerWidth, height: innerHeight})'
              )
              if (Math.abs(viewport.width - width) <= 1 && Math.abs(viewport.height - height) <= 1)
                break
              // Native window resize and Chromium zoom are asynchronous on macOS.
              // Reapply the requested zoom after resize rather than testing an old scale.
              window.webContents.setZoomFactor(zoom)
              await delay(25)
            }
            for (const font of ['', 'Arial, sans-serif', 'monospace']) {
              const result = await window.webContents.executeJavaScript(
                `window.inspectDownloadLayout(${JSON.stringify(font)})`
              )
              if (Math.abs(result.width - width) > 1 || Math.abs(result.height - height) > 1)
                result.issues.push(
                  `native viewport did not settle to ${width}x${height}: zoom ${window.webContents.getZoomFactor()}, bounds ${JSON.stringify(window.getContentBounds())}`
                )
              result.issues.push(
                ...(await window.webContents.executeJavaScript(
                  'window.exerciseDownloadProgressLayout()'
                ))
              )
              cases++
              if (result.issues.length)
                failures.push({
                  viewport: `${result.width}x${result.height}`,
                  zoom,
                  font: font || 'system',
                  issues: result.issues
                })
            }
          }
        }
        assert.equal(failures.length, 0, JSON.stringify(failures, null, 2))
        console.log(
          `Download layout: ${cases} viewport/zoom/font cases passed, 10 mixed-state rows each.`
        )
        for (const [width, height] of [
          [375, 812],
          [540, 375],
          [1080, 750]
        ]) {
          window.webContents.setZoomFactor(1)
          window.setContentSize(width, height)
          await window.loadURL(window.webContents.getURL())
          await window.webContents.executeJavaScript('window.downloadLayoutReady')
          assert.equal(
            await window.webContents.executeJavaScript('window.exerciseDownloadSettingsViewport()'),
            true
          )
          window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' })
          window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESC' })
          await window.webContents.executeJavaScript('window.waitForDownloadSettingsClosed()')
          assert.equal(
            await window.webContents.executeJavaScript('window.isDownloadFixtureOpen()'),
            true
          )
          assert.equal(
            await window.webContents.executeJavaScript('window.exerciseDownloadBatchViewport()'),
            true
          )
        }
        window.webContents.setZoomFactor(1)
        window.setContentSize(1080, 750)
        await window.loadURL(window.webContents.getURL())
        await window.webContents.executeJavaScript('window.downloadLayoutReady')
        assert.equal(
          await window.webContents.executeJavaScript('window.exerciseDownloadStatusStability()'),
          true
        )
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' })
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESC' })
        await window.webContents.executeJavaScript('window.waitForDownloadFailureClosed()')
        assert.equal(
          await window.webContents.executeJavaScript('window.isDownloadFixtureOpen()'),
          true,
          'Escape on error details must keep the download manager open'
        )
        assert.equal(
          await window.webContents.executeJavaScript('window.exerciseDownloadBackupRows()'),
          true
        )
        const realtime = await window.webContents.executeJavaScript(
          'window.exerciseDownloadRealtimePage()'
        )
        console.log('Download responsiveness:', realtime)
        assert.equal(
          await window.webContents.executeJavaScript('window.exerciseDownloadFilters()'),
          true
        )
        for (let attempt = 0; attempt < 8; attempt++) {
          assert.equal(
            await window.webContents.executeJavaScript('window.exerciseDownloadProgressTiming()'),
            true
          )
        }
        assert.equal(
          await window.webContents.executeJavaScript('window.exerciseDownloadMissingCover()'),
          true
        )
        assert.equal(
          await window.webContents.executeJavaScript('window.openDownloadFixtureImage()'),
          true
        )
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' })
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESC' })
        await window.webContents.executeJavaScript('window.waitForDownloadPreviewClosed()')
        const afterEscape = await window.webContents.executeJavaScript(
          '({viewerClosed: !document.querySelector(".media-preview-mask"), managerOpen: window.isDownloadFixtureOpen(), thumbnailFocused: document.activeElement?.matches(".task-thumbnail")})'
        )
        assert.deepEqual(
          afterEscape,
          { viewerClosed: true, managerOpen: true, thumbnailFocused: true },
          'Escape must close only the viewer and restore thumbnail focus'
        )
        assert.equal(
          await window.webContents.executeJavaScript(
            'window.exerciseDownloadPreviewDuringQueueChange()'
          ),
          true
        )
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'ESC' })
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'ESC' })
        await window.webContents.executeJavaScript('window.waitForDownloadPreviewClosed()')
        assert.equal(
          await window.webContents.executeJavaScript(
            'document.activeElement?.getAttribute("aria-label") === "关闭下载管理" && window.isDownloadFixtureOpen()'
          ),
          true,
          'queue changes must not strand keyboard focus outside the manager'
        )
        await window.webContents.executeJavaScript('window.restoreDownloadFixturePage()')
        assert.equal(
          await window.webContents.executeJavaScript('window.openDownloadFixtureVideo()'),
          true
        )
        assert.equal(videoRequests, 0, 'hover/open must not request any video bytes')
        assert.equal(
          await window.webContents.executeJavaScript('window.playDownloadFixtureVideo()', true),
          true
        )
        assert.ok(videoRequests > 0, 'explicit play must load the real video')
        await window.webContents.executeJavaScript(
          '(() => {const video=document.querySelector("video.mp-video");video.volume=0.22;video.muted=true;video.dispatchEvent(new Event("volumechange"))})()'
        )
        await window.webContents.executeJavaScript(
          'document.querySelector(".mp-action-close").click()'
        )
        await window.webContents.executeJavaScript('window.waitForDownloadPreviewClosed()')
        assert.equal(
          await window.webContents.executeJavaScript(
            '!document.querySelector("video.mp-video") && window.isDownloadFixtureOpen()'
          ),
          true
        )
        const requestsBeforeReopen = videoRequests
        assert.equal(
          await window.webContents.executeJavaScript('window.openDownloadFixtureVideo()'),
          true
        )
        assert.equal(
          videoRequests,
          requestsBeforeReopen,
          'reopening must not resume video loading automatically'
        )
        assert.equal(
          await window.webContents.executeJavaScript(
            'document.querySelector("video.mp-video").volume === 0.22 && document.querySelector("video.mp-video").muted'
          ),
          true,
          'the next player must retain the chosen volume'
        )
        await window.webContents.executeJavaScript(
          'document.querySelector(".mp-action-close").click()'
        )
        await window.webContents.executeJavaScript('window.waitForDownloadPreviewClosed()')
        window.webContents.debugger.attach('1.3')
        await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
        })
        assert.equal(
          await window.webContents.executeJavaScript(
            'matchMedia("(prefers-reduced-motion: reduce)").matches && [...document.querySelectorAll(".el-progress-bar__inner")].every(el => parseFloat(getComputedStyle(el).transitionDuration) <= 0.001 && getComputedStyle(el).animationName === "none")'
          ),
          true,
          'reduced motion must disable progress interpolation and indeterminate animation'
        )
        window.webContents.debugger.detach()
        console.log(
          'Download status, realtime page races, error details, image/video preview, focus and zero autoplay checks passed.'
        )
      } catch (error) {
        exitCode = 1
        console.error(error.message)
      } finally {
        window.destroy()
        app.exit(exitCode)
      }
    })
    .catch((error) => {
      console.error(error)
      app.exit(1)
    })
}

if (process.versions.electron) {
  await runElectronChecks()
} else {
  // Remove the disposable profile only after Electron exits (Windows holds locks).
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-layout-'))
  const { default: electronPath } = await import('electron')
  const child = spawn(electronPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: { ...process.env, QZONE_LAYOUT_PROFILE: directory }
  })
  const timeout = setTimeout(() => {
    console.error('Download layout regression timed out; start pnpm dev first.')
    child.kill()
  }, 90000)
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code) => resolve(code ?? 1))
    })
  } finally {
    clearTimeout(timeout)
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}
