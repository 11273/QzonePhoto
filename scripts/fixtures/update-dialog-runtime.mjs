import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { app, BrowserWindow } from 'electron'

app.setPath('userData', process.env.QZONE_UPDATE_PROFILE)
app.disableHardwareAcceleration()
app
  .whenReady()
  .then(runChecks)
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })

async function runChecks() {
  console.log('Update dialog Electron ready')
  app.dock?.hide()
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: `update-test-${process.pid}`,
      sandbox: true,
      backgroundThrottling: false
    }
  })
  const errors = []
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message)
  })
  let cases = 0
  try {
    for (const platform of ['windows', 'mac', 'linux']) {
      for (const [width, height] of [
        [375, 812],
        [540, 375],
        [900, 500],
        [1080, 750],
        [1440, 900]
      ]) {
        for (const zoom of [1, 1.5, 2]) {
          window.setContentSize(Math.round(width * zoom), Math.round(height * zoom))
          window.webContents.setZoomFactor(zoom)
          await window.loadURL(
            `${process.env.QZONE_UPDATE_URL}/scripts/fixtures/update-dialog.html?platform=${platform}`
          )
          for (let attempt = 0; attempt < 100; attempt++) {
            if (await window.webContents.executeJavaScript('Boolean(window.updateDialogReady)'))
              break
            await delay(30)
          }
          assert.equal(await window.webContents.executeJavaScript('window.updateDialogReady'), true)
          await window.webContents.executeJavaScript('window.updateFixture.show()')
          await delay(340)
          const result = await window.webContents.executeJavaScript(
            'window.updateFixture.inspect()'
          )
          assert.ok(
            Math.abs(result.width - width) <= 1 && Math.abs(result.height - height) <= 1,
            `viewport did not settle ${JSON.stringify(result)}`
          )
          assert.deepEqual(
            result.issues,
            [],
            `${platform} ${width}x${height} zoom=${zoom}: ${result.issues}`
          )
          assert.equal(
            result.macHelp,
            false,
            'first-install instructions do not belong in the running desktop client'
          )
          assert.ok(result.notes || result.hasFallback)
          assert.doesNotMatch(result.notes, /macOS 首次打开|系统设置 → 隐私与安全性|shields\.io/)
          cases++
          if (
            process.env.QZONE_UPDATE_SCREENSHOTS &&
            width === 1080 &&
            zoom === 1 &&
            platform !== 'linux'
          ) {
            await fs.writeFile(
              path.join(process.env.QZONE_UPDATE_SCREENSHOTS, `update-${platform}.png`),
              (await window.webContents.capturePage()).toPNG()
            )
          }
        }
      }
    }
    for (const state of [
      'available',
      'checking',
      'downloading',
      'downloaded',
      'error',
      'no-update'
    ]) {
      await window.webContents.executeJavaScript(
        `window.updateFixture.transition(${JSON.stringify(state)})`
      )
      await delay(340)
      assert.deepEqual(
        (await window.webContents.executeJavaScript('window.updateFixture.inspect()')).issues,
        [],
        state
      )
    }
    await window.webContents.executeJavaScript('window.updateFixture.show("available", "release")')
    await delay(340)
    assert.doesNotMatch(
      (await window.webContents.executeJavaScript('window.updateFixture.inspect()')).notes,
      /macOS 首次打开|系统设置 → 隐私与安全性|shields\.io/
    )
    await window.webContents.executeJavaScript('window.updateFixture.show("available", "long")')
    await delay(340)
    assert.deepEqual(
      (await window.webContents.executeJavaScript('window.updateFixture.inspect()')).issues,
      []
    )
    await window.webContents.executeJavaScript('window.updateFixture.show("available", "empty")')
    await delay(340)
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelector(".update-reassurance").textContent'
      ),
      '本次更新包含体验优化和问题修复。'
    )
    await window.webContents.executeJavaScript('window.updateFixture.show()')
    await delay(340)
    await window.webContents.executeJavaScript('document.querySelector(".btn-primary").click()')
    assert.deepEqual(await window.webContents.executeJavaScript('window.updateFixture.actions'), [
      'download'
    ])
    await window.webContents.executeJavaScript('document.querySelector(".btn-primary").focus()')
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' })
    await delay(30)
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.activeElement.classList.contains("close-btn")'
      ),
      true
    )
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
    await delay(340)
    assert.equal(
      await window.webContents.executeJavaScript('document.activeElement.id'),
      'update-trigger'
    )
    assert.deepEqual(errors, [])
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    })
    await window.webContents.executeJavaScript('window.updateFixture.show()')
    await delay(30)
    assert.equal(
      await window.webContents.executeJavaScript(
        'getComputedStyle(document.querySelector(".update-icon svg")).animationName'
      ),
      'none'
    )
    assert.equal(
      await window.webContents.executeJavaScript(
        'getComputedStyle(document.querySelector(".update-stage")).transitionDuration'
      ),
      '0s'
    )
    window.webContents.debugger.detach()
    // Exercise the actual help page without sending analytics or cloud requests.
    window.webContents.session.webRequest.onBeforeRequest((request, callback) => {
      callback({
        cancel:
          /^https?:/.test(request.url) &&
          !request.url.startsWith(process.env.QZONE_UPDATE_URL + '/')
      })
    })
    await window.loadURL(
      `${process.env.QZONE_UPDATE_URL}/website/privacy/index.html#macos-first-open`
    )
    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        await window.webContents.executeJavaScript(
          'document.querySelector("#macos-first-open")?.open === true'
        )
      )
        break
      await delay(30)
    }
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelector("#macos-first-open").open'
      ),
      true
    )
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelectorAll("#macos-first-open .help-steps li").length'
      ),
      4
    )
    await window.webContents.executeJavaScript(
      'document.querySelector("#macos-first-open").open = false; location.hash = "faq"'
    )
    await delay(30)
    await window.webContents.executeJavaScript('location.hash = "macos-first-open"')
    await delay(100)
    assert.equal(
      await window.webContents.executeJavaScript(
        'document.querySelector("#macos-first-open").open'
      ),
      true
    )
    console.log(
      `Update dialog: ${cases} platform/viewport/zoom cases; all states, long/legacy notes, no desktop install tutorial, actions, keyboard and website help deep links passed.`
    )
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
}
