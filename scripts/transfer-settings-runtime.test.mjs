import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'electron'
import test from 'node:test'

test(
  'native Electron transfer settings: real dialogs, units, rollback, errors, keyboard and zoom',
  { timeout: 90000 },
  async () => {
    const root = fileURLToPath(new URL('../', import.meta.url))
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-rate-settings-'))
    const server = await createServer({
      configFile: false,
      root,
      cacheDir: path.join(directory, 'vite-cache'),
      plugins: [vue()],
      optimizeDeps: { entries: ['scripts/fixtures/download-layout.html'] },
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
        QZONE_RATE_PROFILE: directory,
        QZONE_RATE_URL: `http://127.0.0.1:${server.httpServer.address().port}`
      }
      delete env.ELECTRON_RUN_AS_NODE
      const headless = process.platform === 'linux' && !env.DISPLAY
      const args = [
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
        path.join(root, 'scripts/fixtures/transfer-settings-runtime.mjs')
      ]
      const { stdout } = await promisify(execFile)(
        headless ? 'xvfb-run' : electron,
        headless ? ['--auto-servernum', electron, ...args] : args,
        { env, timeout: 80000 }
      )
      assert.match(stdout, /TRANSFER_SETTINGS_OK/)
      console.log(stdout.trim())
    } finally {
      await server.close()
      await fs.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
)
