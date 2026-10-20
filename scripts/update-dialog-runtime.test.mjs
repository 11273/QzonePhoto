import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'electron'

test(
  'actual update dialog stays readable without first-install clutter in isolated Electron',
  { timeout: 90000 },
  async () => {
    const root = fileURLToPath(new URL('../', import.meta.url))
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-update-ui-'))
    const server = await createServer({
      configFile: false,
      root,
      cacheDir: path.join(profile, 'vite-cache'),
      optimizeDeps: { entries: ['scripts/fixtures/update-dialog.html'] },
      plugins: [vue()],
      resolve: {
        alias: {
          '@renderer': path.join(root, 'src/renderer/src'),
          '@shared': path.join(root, 'src/shared')
        }
      },
      server: { host: '127.0.0.1', port: 0 }
    })
    try {
      await server.listen()
      const env = {
        ...process.env,
        QZONE_UPDATE_PROFILE: profile,
        QZONE_UPDATE_URL: `http://127.0.0.1:${server.httpServer.address().port}`
      }
      delete env.ELECTRON_RUN_AS_NODE
      const headlessLinux = process.platform === 'linux' && !env.DISPLAY
      const args = [
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
        path.join(root, 'scripts/fixtures/update-dialog-runtime.mjs')
      ]
      const { stdout } = await promisify(execFile)(
        headlessLinux ? 'xvfb-run' : electron,
        headlessLinux
          ? ['--auto-servernum', '--server-args=-screen 0 3200x2400x24', electron, ...args]
          : args,
        {
          timeout: 80000,
          env
        }
      )
      assert.match(stdout, /Update dialog: 45 platform\/viewport\/zoom cases/)
      console.log(stdout.trim())
    } finally {
      await server.close()
      await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
)
