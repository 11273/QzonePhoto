import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { app, BrowserWindow } from 'electron'
import { getVideoMetadata } from '../../src/main/services/video-metadata.js'

app.setPath('userData', process.env.QZONE_RATE_PROFILE)
app.disableHardwareAcceleration()
app
  .whenReady()
  .then(async () => {
    app.dock?.hide()
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        backgroundThrottling: false,
        partition: `rates-${process.pid}`
      }
    })
    const errors = []
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') errors.push(event.message)
    })
    try {
      let cases = 0
      for (const mode of ['download', 'upload', 'upload-manager']) {
        for (const [width, height] of [
          [375, 812],
          [540, 375],
          [1080, 750]
        ]) {
          for (const zoom of [1, 2]) {
            console.log(`Checking ${mode} ${width}x${height} @${zoom}`)
            window.setContentSize(width * zoom, height * zoom)
            window.webContents.setZoomFactor(zoom)
            await window.loadURL(
              `${process.env.QZONE_RATE_URL}/scripts/fixtures/download-layout.html?mode=${mode}`
            )
            for (let attempt = 0; attempt < 500; attempt++) {
              if (
                await window.webContents.executeJavaScript(
                  'typeof window.exerciseTransferLimitSettings === "function"'
                )
              )
                break
              await delay(30)
            }
            assert.equal(
              await window.webContents.executeJavaScript('window.exerciseTransferLimitSettings()'),
              true,
              `${mode} ${width}x${height} @${zoom}`
            )
            if (process.env.QZONE_RATE_SCREENSHOTS && width === 1080 && zoom === 1) {
              await fs.writeFile(
                path.join(process.env.QZONE_RATE_SCREENSHOTS, `${mode}.png`),
                (await window.webContents.capturePage(undefined, { stayHidden: true })).toPNG()
              )
            }
            // Hidden native windows can drop sendInputEvent after macOS resize/zoom.
            // Exercise the actual Vue keyboard handler without requiring OS foreground focus.
            await window.webContents.executeJavaScript(
              `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))`
            )
            await window.webContents.executeJavaScript('window.checkRateEnterSaved()')
            if (mode === 'upload' && width === 1080 && zoom === 1) {
              assert.equal(
                await window.webContents.executeJavaScript('window.exerciseUploadSubmission()'),
                true
              )
            }
            cases++
          }
        }
      }
      assert.deepEqual(errors, [])
      const openWindows = BrowserWindow.getAllWindows().length
      for (const abortBeforeStart of [true, false]) {
        const controller = new AbortController()
        if (abortBeforeStart) controller.abort()
        const pending = getVideoMetadata('/isolated-upload-cancel.mp4', controller.signal)
        if (!abortBeforeStart) controller.abort()
        await assert.rejects(pending, (error) => error.cancelled === true)
        await delay(30)
        assert.equal(BrowserWindow.getAllWindows().length, openWindows)
      }
      console.log('UPLOAD_ENTRY_OK: batch cover, single retry and native metadata cancellation')
      console.log(`TRANSFER_SETTINGS_OK: ${cases} real dialog/viewport/zoom cases passed`)
      window.destroy()
      app.exit(0)
    } catch (error) {
      console.error('Renderer errors:', errors)
      console.error(
        'Rate state:',
        await window.webContents.executeJavaScript('window.rateDebugState?.()')
      )
      console.error(
        'Focused control:',
        await window.webContents.executeJavaScript('document.activeElement?.outerHTML')
      )
      if (process.env.QZONE_RATE_SCREENSHOTS) {
        await fs.writeFile(
          path.join(process.env.QZONE_RATE_SCREENSHOTS, 'failure.png'),
          (await window.webContents.capturePage(undefined, { stayHidden: true })).toPNG()
        )
      }
      console.error(error)
      window.destroy()
      app.exit(1)
    }
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
