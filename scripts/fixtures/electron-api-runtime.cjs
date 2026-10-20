// Isolated actual Electron regression: synthetic credentials and loopback only.
const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const { app, BrowserWindow, ipcMain, net, session } = require('electron')

const dir = process.argv[2]
app.setPath('userData', path.join(dir, 'profile'))
app.disableHardwareAcceleration()
app
  .whenReady()
  .then(async () => {
    app.dock?.hide()
    let cookie = ''
    let body = 'callback({"code":0,"msglist":[{"tid":"synthetic"}]})'
    let status = 200
    const server = http.createServer((req, res) => {
      cookie = req.headers.cookie || ''
      res.writeHead(status, { 'Content-Type': 'text/html' })
      res.end(req.url === '/page' ? '<!doctype html><title>API runtime regression</title>' : body)
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    let window
    try {
      await session.defaultSession.cookies.set({
        url: origin,
        name: 'p_skey',
        value: 'stale-secret'
      })
      const headers = { Cookie: 'uin=o10001; p_skey=synthetic-secret' }
      await (await net.fetch(`${origin}/control`, { headers })).text()
      assert.match(
        cookie,
        /stale-secret/,
        'control must reproduce Chromium session-cookie replacement'
      )
      assert.doesNotMatch(cookie, /synthetic-secret/)
      globalThis.__qzoneTestNet = {
        fetch: (url, options) => {
          assert.equal(new URL(url).hostname, 'user.qzone.qq.com')
          // Keep the same cookie/session semantics; only adapt HTTPS referrers for
          // our HTTP loopback origin to avoid Chromium's downgrade protection.
          assert.match(options.headers.Referer, /^https:\/\/user\.qzone\.qq\.com\//)
          return net.fetch(`${origin}/qzone${new URL(url).search}`, {
            ...options,
            headers: { ...options.headers, Referer: origin, Origin: origin }
          })
        }
      }
      const { getShuoshuo } = require(path.join(dir, 'user.cjs'))
      for (const [uin, secret] of [
        ['o10001', 'synthetic-secret'],
        ['o10002', 'next-secret']
      ]) {
        assert.equal((await getShuoshuo(uin, secret)).msglist.length, 1)
        assert.match(cookie, new RegExp(`uin=${uin}`))
        assert.match(cookie, new RegExp(`p_skey=${secret}`))
        assert.doesNotMatch(cookie, /stale-secret/)
      }
      assert.equal(
        (await session.defaultSession.cookies.get({ url: origin, name: 'p_skey' }))[0].value,
        'stale-secret'
      )
      for (const [nextStatus, nextBody, expectedCode] of [
        [200, 'callback({"code":0,"msglist":[]})', 0],
        [200, 'callback({"code":-3000,"message":"expired"})', -3000],
        [200, '<html>invalid response</html>', -1],
        [503, 'unavailable', -503]
      ]) {
        status = nextStatus
        body = nextBody
        assert.equal((await getShuoshuo('o10001', 'synthetic-secret')).code, expectedCode)
      }
      status = 200
      let result = { code: 0, data: {} }
      for (const channel of [
        'auth:listenScanResult',
        'photo:getPhotoList',
        'user:getShuoshuo',
        'app:fetchNotices'
      ]) {
        ipcMain.handle(channel, () => result)
      }
      window = new BrowserWindow({
        show: false,
        webPreferences: {
          contextIsolation: true,
          sandbox: false,
          preload: path.join(dir, 'preload.cjs')
        }
      })
      const errors = []
      window.webContents.on('console-message', (event) => {
        if (event.level === 'error') errors.push(event.message)
      })
      await window.loadURL(`${origin}/page`)
      const evaluate = (script) => window.webContents.executeJavaScript(script)
      const failure = (expression) =>
        evaluate(
          `(${expression}).then(()=>({unexpectedSuccess:true})).catch(e=>({name:e.name,message:e.message,code:e.code,detail:e.detail,originalData:e.originalData}))`
        )
      for (const code of [66, 67, 65, 0]) {
        result = { code: 0, data: { code, message: 'normal QR state' } }
        assert.equal(await evaluate('QzoneAPI.checkLoginState({}).then(r=>r.code)'), code)
      }
      assert.equal(errors.length, 0)
      result = {
        code: 0,
        data: { code: -10805, message: 'permission denied', data: { reason: 'private' } }
      }
      const permission = await failure('QzoneAPI.getPhotoList({})')
      assert.equal(permission.name, 'IpcError')
      assert.equal(permission.code, -10805)
      assert.equal(permission.message, 'permission denied')
      assert.equal(permission.detail.data.reason, 'private')
      result = { code: 'ETIMEDOUT', message: 'timeout', detail: { retryable: true } }
      const timeout = await failure('QzoneAPI.getPhotoList({})')
      assert.equal(timeout.code, 'ETIMEDOUT')
      assert.equal(timeout.detail.retryable, true)
      result = { code: 500, error: { code: 'NETWORK_ERROR', message: 'network unavailable' } }
      assert.equal((await failure('QzoneAPI.getPhotoList({})')).code, 'NETWORK_ERROR')
      const count = errors.length
      result = { code: 0, data: { code: -3000, message: 'expired' } }
      await evaluate('window.authEvents=0; api.onAuthExpired(()=>window.authEvents++)')
      assert.equal(
        (await failure('QzoneAPI.getShuoshuo({}, {background:true,skipAuthCheck:true})')).code,
        -3000
      )
      assert.equal((await failure('QzoneAPI.app.fetchNotices({background:true})')).code, -3000)
      assert.equal(errors.length, count)
      assert.equal(await evaluate('window.authEvents'), 0)
      const expired = await failure('QzoneAPI.getPhotoList({})')
      assert.equal(expired.name, 'AuthExpiredError')
      assert.equal(expired.code, -3000)
      assert.equal(expired.originalData.code, -3000)
      await failure('QzoneAPI.getPhotoList({})')
      assert.equal(
        await evaluate('window.authEvents'),
        1,
        'concurrent failures must log out only once'
      )
      result = { code: 0, data: { code: 0, msglist: [] } }
      assert.deepEqual(await evaluate('QzoneAPI.getShuoshuo({})'), result.data)
      assert.doesNotMatch(errors.join('\n'), /synthetic-secret|stale-secret|o10001|"reason"/)
      console.log(
        'ELECTRON_API_RUNTIME_OK: cookie isolation, account switching, QR states, bridge errors, passive failures, auth expiry, recovery'
      )
    } finally {
      window?.destroy()
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
      app.quit()
    }
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
