import { createApp, h, nextTick, reactive } from 'vue'
import '@renderer/assets/main.css'
import '@renderer/styles/design-tokens.css'
import '@renderer/styles/themes/qzone-dark.css'
import UpdateDialog from '@renderer/components/UpdateManager/UpdateDialog.vue'
import release from '../../RELEASE_NOTES.md?raw'

const platform = new URLSearchParams(location.search).get('platform') || 'windows'
Object.defineProperty(navigator, 'platform', {
  value: { windows: 'Win32', mac: 'MacIntel', linux: 'Linux x86_64' }[platform]
})
Object.defineProperty(navigator, 'userAgent', { value: platform })

// No updater IPC, installation, real downloads, accounts or persistent data.
const state = reactive({ visible: false, updateState: 'available', notes: release })
const actions = []
window.api = { invoke: async (...args) => actions.push(args) }
createApp({
  render: () =>
    h(UpdateDialog, {
      visible: state.visible,
      updateState: state.updateState,
      updateInfo: {
        currentVersion: '2.8.0',
        version: '2.9.0',
        releaseNotes: state.notes,
        releaseDate: '2026-10-20T13:01:00Z'
      },
      errorInfo: { errorType: 'NETWORK_ERROR', canRetry: true },
      downloadProgress: { percent: 99.9, downloaded: 150, total: 151, speed: 8192 },
      onDownload: () => actions.push('download'),
      onInstall: () => actions.push('install'),
      onCancel: () => actions.push('cancel'),
      onRetry: () => actions.push('retry'),
      onDismiss: () => {
        state.visible = false
      }
    })
}).mount('#app')

window.updateFixture = {
  actions,
  async transition(updateState) {
    state.updateState = updateState
    await nextTick()
  },
  async show(updateState = 'available', kind = 'release') {
    state.visible = false
    await nextTick()
    state.updateState = updateState
    state.notes = kind === 'empty' ? '' : kind === 'long' ? release.repeat(10) : release
    document.querySelector('#update-trigger').focus()
    state.visible = true
    await nextTick()
    await new Promise(requestAnimationFrame)
  },
  inspect() {
    const dialog = document.querySelector('.update-container')
    const box = dialog.getBoundingClientRect()
    const issues = []
    if (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1)
      issues.push('dialog exceeds viewport')
    if (dialog.scrollWidth > dialog.clientWidth + 1) issues.push('horizontal dialog overflow')
    const content = document.querySelector('.update-content')
    if (content.scrollWidth > content.clientWidth + 1) issues.push('horizontal content overflow')
    for (const el of document.querySelectorAll('.update-footer button, .close-btn')) {
      const rect = el.getBoundingClientRect()
      if (rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.right > box.right + 1)
        issues.push('action clipped')
    }
    const nested = [...content.querySelectorAll('*')].filter(
      (el) =>
        /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1
    )
    if (nested.length) issues.push('nested content scroll region')
    return {
      issues,
      width: innerWidth,
      height: innerHeight,
      macHelp: Boolean(document.querySelector('.mac-install-guide')),
      notes: document.querySelector('.release-notes-scroll')?.innerText || '',
      hasFallback: Boolean(document.querySelector('.update-reassurance'))
    }
  }
}
window.updateDialogReady = true
