import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadFolderUin } from '../src/main/utils/download-directory.mjs'

test('下载目录使用原样的纯数字 QQ 号', () => {
  assert.equal(downloadFolderUin('12345678'), '12345678')
  assert.equal(downloadFolderUin('o12345678'), '12345678')
  assert.equal(downloadFolderUin(' 12345678 '), '12345678')
})

test('无效账号不进入目录名', () => {
  assert.equal(downloadFolderUin(''), 'unknown')
  assert.equal(downloadFolderUin('012345678'), 'unknown')
  assert.equal(downloadFolderUin('../12345678'), 'unknown')
})
