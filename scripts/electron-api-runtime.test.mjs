import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import electron from 'electron'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))

test(
  'actual Electron preserves selected-account cookies and typed read failures across contextBridge',
  { timeout: 30000 },
  async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-api-runtime-'))
    t.after(() => fs.rm(dir, { recursive: true, force: true }))
    const boundaries = {
      electron: 'export const net = globalThis.__qzoneTestNet',
      '@main/api/utils/request': 'export default {}'
    }
    await build({
      entryPoints: [path.join(root, 'src/main/api/qzone/user.js')],
      outfile: path.join(dir, 'user.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      alias: { '@main': path.join(root, 'src/main'), '@shared': path.join(root, 'src/shared') },
      plugins: [
        {
          name: 'loopback-network',
          setup(build) {
            build.onResolve({ filter: /.*/ }, ({ path }) =>
              Object.hasOwn(boundaries, path) ? { path, namespace: 'boundary' } : undefined
            )
            build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({
              contents: boundaries[path],
              loader: 'js'
            }))
          }
        }
      ]
    })
    await build({
      entryPoints: [path.join(root, 'src/preload/index.js')],
      outfile: path.join(dir, 'preload.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['electron'],
      alias: {
        '@shared': path.join(root, 'src/shared'),
        '@preload': path.join(root, 'src/preload')
      },
      plugins: [
        {
          name: 'synthetic-account',
          setup(build) {
            build.onResolve({ filter: /^@shared\/utils\/auth$/ }, () => ({
              path: 'auth',
              namespace: 'boundary'
            }))
            build.onLoad({ filter: /.*/, namespace: 'boundary' }, () => ({
              contents:
                "export const getLocalUserInfo = () => ({ uin: 'o10001', p_skey: 'synthetic-secret' })",
              loader: 'js'
            }))
          }
        }
      ]
    })
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    // GitHub's Linux runners have no desktop. Run the same Electron assertions
    // under their installed Xvfb rather than silently skipping the bridge test.
    const headlessLinux = process.platform === 'linux' && !env.DISPLAY
    const args = [
      // Only the isolated loopback test may bypass Linux CI's unavailable user
      // namespaces. This does not change any production window/sandbox settings.
      ...(headlessLinux ? ['--no-sandbox'] : []),
      path.join(root, 'scripts/fixtures/electron-api-runtime.cjs'),
      dir
    ]
    const child = spawn(
      headlessLinux ? 'xvfb-run' : electron,
      headlessLinux ? ['--auto-servernum', electron, ...args] : args,
      { env }
    )
    t.after(() => {
      if (child.exitCode === null) child.kill()
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    const [code] = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (...args) => resolve(args))
    })
    assert.equal(code, 0, output)
    assert.match(output, /ELECTRON_API_RUNTIME_OK/)
  }
)
