import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { uploadR2Object, SINGLE_PUT_LIMIT } from './upload-r2-object.mjs'

const execFileAsync = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const setup = async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qzone-r2-upload-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'release sample.dmg')
  const bytes = Buffer.from('synthetic release bytes\0\xff', 'binary')
  await fs.writeFile(file, bytes)
  const remote = {
    ContentLength: bytes.length,
    Metadata: { 'qzone-sha512': createHash('sha512').update(bytes).digest('base64') },
    CacheControl: 'public, max-age=31536000, immutable',
    ContentType: 'application/octet-stream'
  }
  const calls = []
  const sleeps = []
  const options = {
    file,
    bucket: 'synthetic-bucket',
    key: 'releases/v2.9.0/sample.dmg',
    endpoint: 'https://synthetic.r2.cloudflarestorage.com',
    cacheControl: remote.CacheControl,
    runAws: async (args) => {
      calls.push(args)
      return JSON.stringify(remote)
    },
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    onRetry: () => {}
  }
  return { dir, file, bytes, remote, calls, sleeps, options }
}
const flag = (args, name) => args[args.indexOf(name) + 1]
const awsError = (code) =>
  Object.assign(new Error('synthetic aws failure'), {
    code: 255,
    stderr: `An error occurred (${code}) when calling the PutObject operation`
  })

test('R2 installer upload uses a single PUT with byte integrity and verifies remote metadata', async (t) => {
  const app = await setup(t)
  const result = await uploadR2Object(app.options)
  assert.equal(result.size, app.bytes.length)
  assert.deepEqual(
    app.calls.map((args) => args.slice(0, 2)),
    [
      ['s3api', 'put-object'],
      ['s3api', 'head-object']
    ]
  )
  const put = app.calls[0]
  assert.equal(flag(put, '--body'), app.file)
  assert.equal(flag(put, '--content-length'), String(app.bytes.length))
  assert.equal(flag(put, '--content-md5'), createHash('md5').update(app.bytes).digest('base64'))
  assert.deepEqual(JSON.parse(flag(put, '--metadata')), app.remote.Metadata)
  assert.equal(flag(put, '--cache-control'), app.options.cacheControl)
  assert.equal(flag(put, '--content-type'), 'application/octet-stream')
  assert.deepEqual(app.sleeps, [])
})

test('transient R2 failures retry complete identical objects, then verify before succeeding', async (t) => {
  for (const code of ['InvalidPart', 'SlowDown', 'InternalError', 'RequestTimeout']) {
    const app = await setup(t)
    let tries = 0
    await uploadR2Object({
      ...app.options,
      runAws: async (args) => {
        app.calls.push(args)
        if (args[1] === 'put-object' && ++tries < 3) throw awsError(code)
        return JSON.stringify(app.remote)
      }
    })
    assert.equal(app.calls.filter((args) => args[1] === 'put-object').length, 3)
    assert.deepEqual(app.calls[0], app.calls[1])
    assert.deepEqual(app.calls[1], app.calls[2])
    assert.equal(app.calls.at(-1)[1], 'head-object')
    assert.deepEqual(app.sleeps, [5000, 10000])
  }
})

test('persistent upload errors stop after three attempts without claiming verification', async (t) => {
  const app = await setup(t)
  let tries = 0
  await assert.rejects(
    uploadR2Object({
      ...app.options,
      runAws: async (args) => {
        assert.equal(args[1], 'put-object')
        tries++
        throw awsError('InternalError')
      }
    }),
    /R2 upload failed.*InternalError/
  )
  assert.equal(tries, 3)
  assert.deepEqual(app.sleeps, [5000, 10000])
})

test('permissions, credentials and checksum failures fail fast rather than blindly retrying', async (t) => {
  for (const code of ['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'BadDigest']) {
    const app = await setup(t)
    let calls = 0
    await assert.rejects(
      uploadR2Object({
        ...app.options,
        runAws: async () => {
          calls++
          throw awsError(code)
        }
      }),
      new RegExp(code)
    )
    assert.equal(calls, 1)
    assert.deepEqual(app.sleeps, [])
  }
})

test('size, SHA-512, cache policy and MIME mismatches cannot pass the upload gate', async (t) => {
  for (const mutate of [
    (remote) => {
      remote.ContentLength++
    },
    (remote) => {
      remote.Metadata = {}
    },
    (remote) => {
      remote.CacheControl = 'public, max-age=86400'
    },
    (remote) => {
      remote.ContentType = 'text/plain'
    }
  ]) {
    const app = await setup(t)
    mutate(app.remote)
    await assert.rejects(uploadR2Object(app.options), /verification failed/)
    assert.equal(app.calls.length, 2)
    assert.deepEqual(app.sleeps, [])
  }
})

test('YAML and JSON updater pointers retain their required no-cache policy and MIME', async (t) => {
  for (const contentType of ['application/x-yaml', 'application/json']) {
    const app = await setup(t)
    app.remote.ContentType = contentType
    app.remote.CacheControl = 'no-cache,no-store,max-age=0'
    await uploadR2Object({
      ...app.options,
      cacheControl: 'no-cache, no-store, max-age=0',
      contentType
    })
    assert.equal(flag(app.calls[0], '--content-type'), contentType)
  }
})

test('oversized releases and missing files fail before making remote requests', async (t) => {
  const app = await setup(t)
  await fs.truncate(app.file, SINGLE_PUT_LIMIT + 1)
  await assert.rejects(uploadR2Object(app.options), /no larger than 5 GiB/)
  await assert.rejects(uploadR2Object({ ...app.options, file: path.join(app.dir, 'missing') }), {
    code: 'ENOENT'
  })
  assert.equal(app.calls.length, 0)
})

test(
  'the actual workflow wrapper and uploader CLI preserve arguments and stop before pointer switching on failure',
  { skip: process.platform === 'win32' ? 'the production workflow uses Bash on Linux' : false },
  async (t) => {
    const app = await setup(t)
    const workflow = yaml.load(
      await fs.readFile(path.join(root, '.github/workflows/promote-r2.yml'), 'utf8')
    )
    const script = workflow.jobs['promote-release'].steps.find((step) =>
      step.name.startsWith('Upload and verify release files')
    ).run
    const wrapper = script.slice(
      script.indexOf('upload_and_verify() {'),
      script.indexOf('upload_immutable_release_object() {')
    )
    assert.match(wrapper, /node scripts\/upload-r2-object\.mjs/)
    assert.ok(
      script.indexOf('Versioned release files are verified.') <
        script.indexOf('stable_switched=true')
    )
    const stub = path.join(app.dir, 'aws')
    await fs.writeFile(
      stub,
      `#!${process.execPath}\n
      const fs = require('node:fs'); const assert = require('node:assert/strict');
      const { createHash } = require('node:crypto'); const args = process.argv.slice(2);
      const flag = name => args[args.indexOf(name) + 1];
      assert.equal(process.env.AWS_REQUEST_CHECKSUM_CALCULATION, 'when_required');
      assert.equal(args[0], 's3api');
      if (process.env.FAKE_AWS_DENIED === '1') { process.stderr.write('An error occurred (AccessDenied) when calling the PutObject operation'); process.exit(255); }
      const record = process.env.FAKE_AWS_RECORD;
      if (args[1] === 'put-object') {
        const bytes = fs.readFileSync(flag('--body'));
        assert.equal(flag('--content-length'), String(bytes.length));
        assert.equal(flag('--content-md5'), createHash('md5').update(bytes).digest('base64'));
        fs.writeFileSync(record, JSON.stringify({ ContentLength: bytes.length, Metadata: JSON.parse(flag('--metadata')), CacheControl: flag('--cache-control'), ContentType: flag('--content-type') }));
        process.stdout.write('{}');
      } else { assert.equal(args[1], 'head-object'); process.stdout.write(fs.readFileSync(record)); }
    `,
      { mode: 0o755 }
    )
    const env = {
      ...process.env,
      PATH: `${app.dir}${path.delimiter}${process.env.PATH}`,
      R2_BUCKET: app.options.bucket,
      R2_ENDPOINT: app.options.endpoint,
      FAKE_AWS_RECORD: path.join(app.dir, 'record.json')
    }
    const invocation = `${wrapper}\nupload_and_verify "$1" 'releases/latest/latest-mac.yml' 'no-cache, no-store, max-age=0' 'application/x-yaml'\nprintf 'POINTER_SWITCH_ALLOWED'`
    const { stdout } = await execFileAsync(
      'bash',
      ['-Eeuo', 'pipefail', '-c', invocation, 'test', app.file],
      { cwd: root, env }
    )
    assert.match(stdout, /Uploaded and verified R2 object/)
    assert.match(stdout, /POINTER_SWITCH_ALLOWED/)
    assert.equal(
      JSON.parse(await fs.readFile(env.FAKE_AWS_RECORD, 'utf8')).ContentType,
      'application/x-yaml'
    )
    await assert.rejects(
      execFileAsync('bash', ['-Eeuo', 'pipefail', '-c', invocation, 'test', app.file], {
        cwd: root,
        env: { ...env, FAKE_AWS_DENIED: '1' }
      }),
      (error) => {
        assert.match(error.stderr, /AccessDenied/)
        assert.doesNotMatch(error.stdout, /POINTER_SWITCH_ALLOWED/)
        return true
      }
    )
  }
)
