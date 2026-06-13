<template>
  <el-dialog
    :model-value="visible"
    width="420px"
    align-center
    append-to-body
    modal-class="feedback-dialog-overlay"
    class="feedback-dialog feedback-dialog-v2 ds-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="fd-header">
        <div class="fd-icon">
          <el-icon><ChatDotRound /></el-icon>
        </div>
        <div class="fd-heading">
          <div class="fd-title">反馈与建议</div>
          <div class="fd-subtitle">写一句遇到的问题或想法就可以。</div>
        </div>
      </div>
    </template>

    <div class="fd-body">
      <div class="fd-type-list" role="radiogroup" aria-label="反馈类型">
        <button
          v-for="option in typeOptions"
          :key="option.value"
          class="fd-type-btn"
          :class="{ active: form.type === option.value }"
          type="button"
          role="radio"
          :aria-checked="form.type === option.value"
          @click="form.type = option.value"
        >
          <el-icon><component :is="option.icon" /></el-icon>
          <span>{{ option.label }}</span>
        </button>
      </div>

      <el-input
        v-model.trim="form.content"
        class="fd-content"
        type="textarea"
        :rows="6"
        maxlength="1200"
        show-word-limit
        resize="none"
        placeholder="比如：下载按钮点了没反应；希望照片能按年份筛选；这个页面有点看不懂。"
      />
      <div class="fd-hint" :class="{ warning: form.content && !hasEnoughContent }">
        至少 8 个字，最多 1200 个字。不要填写密码、验证码或登录凭证。
      </div>
      <label class="fd-log-option">
        <input v-model="attachLogs" type="checkbox" />
        <span>
          <strong>附带诊断日志</strong>
          <small>会自动隐藏账号、路径、登录凭证和链接</small>
        </span>
      </label>
      <transition name="fd-slide">
        <div v-if="smartHint" class="fd-smart-hint">
          {{ smartHint }}
        </div>
      </transition>

      <button class="fd-fold" type="button" @click="extraExpanded = !extraExpanded">
        <span>联系方式和附带信息</span>
        <el-icon :class="{ expanded: extraExpanded }"><ArrowDown /></el-icon>
      </button>

      <transition name="fd-slide">
        <div v-if="extraExpanded" class="fd-extra">
          <label class="fd-label">联系方式，可不填</label>
          <el-input
            v-model.trim="form.contact"
            maxlength="80"
            placeholder="邮箱 / 昵称 / 其他能联系到你的方式"
          />

          <dl class="fd-env">
            <template v-for="item in envItems" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </template>
          </dl>
          <div v-if="recentErrors.length" class="fd-errors">
            <div class="fd-errors-title">最近错误</div>
            <div v-for="item in recentErrors" :key="item.id" class="fd-error-item">
              {{ item.message }}
            </div>
          </div>
        </div>
      </transition>

      <div class="fd-manual">
        <div>
          <div class="fd-manual-title">需要发截图或详细说明？</div>
          <div class="fd-manual-desc">可以打开 GitHub 反馈页手动填写，适合复杂问题。</div>
        </div>
        <button class="fd-link-btn" type="button" @click="openGitHubIssue">
          <span>打开反馈页</span>
          <el-icon><TopRight /></el-icon>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="fd-footer">
        <el-button text @click="emit('update:visible', false)">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!hasEnoughContent"
          @click="submitQuickFeedback"
        >
          提交反馈
        </el-button>
      </div>
    </template>
  </el-dialog>

  <transition name="feedback-toast">
    <div v-if="feedbackNotice.visible" class="feedback-toast-card">
      <div class="feedback-toast-main">
        <div class="feedback-toast-badge" :class="`is-${feedbackNotice.state}`">
          <span v-if="feedbackNotice.state === 'pending'" class="feedback-toast-spinner"></span>
          <el-icon v-else-if="feedbackNotice.state === 'success'"><CircleCheck /></el-icon>
          <el-icon v-else><WarningFilled /></el-icon>
        </div>
        <div class="feedback-toast-copy">
          <div class="feedback-toast-title">{{ feedbackNotice.title }}</div>
          <div class="feedback-toast-text">{{ feedbackNotice.message }}</div>
          <div v-if="feedbackNotice.issue" class="feedback-toast-actions">
            <button
              class="feedback-toast-link"
              type="button"
              @click="openIssueUrl(feedbackNotice.issueUrl)"
            >
              查看 GitHub #{{ feedbackNotice.issue }}
            </button>
          </div>
        </div>
        <button class="feedback-toast-close" type="button" @click="closeFeedbackNotice">
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ChatDotRound,
  CircleCheck,
  Close,
  EditPen,
  Help,
  MagicStick,
  Star,
  WarningFilled,
  TopRight
} from '@element-plus/icons-vue'
import { IPC_SHELL } from '@shared/ipc-channels'

const props = defineProps({
  visible: { type: Boolean, default: false },
  appVersion: { type: String, default: '' },
  appHomepage: { type: String, default: '' },
  runtimeInfo: { type: Object, default: () => ({}) },
  apiBaseUrl: { type: String, default: '' }
})

const emit = defineEmits(['update:visible'])

const typeOptions = [
  { label: '问题', value: 'bug', icon: Help },
  { label: '建议', value: 'feature', icon: MagicStick },
  { label: '不好用', value: 'ux', icon: Star },
  { label: '其他', value: 'other', icon: EditPen }
]

const typeLabelMap = Object.fromEntries(typeOptions.map((item) => [item.value, item.label]))
const platformNameMap = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux'
}

const form = reactive({
  type: 'bug',
  content: '',
  contact: ''
})

const submitting = ref(false)
const attachLogs = ref(false)
const extraExpanded = ref(false)
const recentErrors = ref([])
let errorSeq = 0
let feedbackNoticeTimer = 0

const feedbackNotice = reactive({
  visible: false,
  state: 'pending',
  title: '',
  message: '',
  issue: '',
  issueUrl: ''
})

const runtime = computed(() => props.runtimeInfo || {})
const systemText = computed(() =>
  [
    platformNameMap[runtime.value.platform] || runtime.value.platform || 'unknown',
    runtime.value.arch || ''
  ]
    .filter(Boolean)
    .join(' / ')
)

const envItems = computed(() => [
  { key: 'appVersion', label: '版本', value: props.appVersion || 'unknown' },
  { key: 'system', label: '系统', value: systemText.value || 'unknown' },
  { key: 'installMode', label: '安装', value: runtime.value.isPackaged ? '安装包' : '开发模式' },
  { key: 'page', label: '页面', value: window.location.hash || 'unknown' }
])

const contentTitle = computed(() => {
  const content = form.content.trim().replace(/\s+/g, ' ')
  return content ? content.slice(0, 28) : '用户反馈'
})

const hasEnoughContent = computed(() => form.content.trim().length >= 8)

const smartHint = computed(() => {
  const content = form.content.trim()
  if (!content || content.length < 8) return ''
  if (content.length >= 24) return ''
  if (/失败|报错|异常|打不开|没反应|不能|无法|崩溃|闪退/.test(content)) {
    return '可以再补一句：你点了哪个按钮，或者当时停在哪个页面。'
  }
  if (form.type === 'feature') {
    return '可以简单写一下你希望它出现在哪里、解决什么麻烦。'
  }
  return '如果愿意，可以补充一下发生位置，这样更容易定位。'
})

const buildFeedbackEnv = () => ({
  ...Object.fromEntries(envItems.value.map((item) => [item.key, item.value])),
  recentErrors: recentErrors.value.map(({ time, type, message, source }) => ({
    time,
    type,
    message,
    source
  }))
})

const buildLogExtraLines = () =>
  recentErrors.value.map((item) =>
    [item.time, item.type, item.message, item.source].filter(Boolean).join(' | ')
  )

const buildFeedbackText = () => {
  const lines = [
    `### ${typeLabelMap[form.type] || '反馈'}：${contentTitle.value}`,
    '',
    form.content || '未填写内容',
    ''
  ]
  if (form.contact) {
    lines.push('### 联系方式', '', form.contact, '')
  }
  lines.push('### 附带信息', '')
  envItems.value.forEach((item) => {
    lines.push(`- ${item.label}：${item.value}`)
  })
  if (recentErrors.value.length) {
    lines.push('', '### 最近错误', '')
    recentErrors.value.forEach((item) => {
      lines.push(`- ${item.message}`)
    })
  }
  return lines.join('\n')
}

const openIssueUrl = async (issueUrl = '') => {
  if (!issueUrl) return
  await window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, issueUrl)
}

const clearFeedbackNoticeTimer = () => {
  if (feedbackNoticeTimer) {
    window.clearTimeout(feedbackNoticeTimer)
    feedbackNoticeTimer = 0
  }
}

const scheduleFeedbackNoticeClose = (duration = 0) => {
  clearFeedbackNoticeTimer()
  if (!duration) return
  feedbackNoticeTimer = window.setTimeout(() => {
    closeFeedbackNotice()
  }, duration)
}

const updateFeedbackNotice = ({
  state,
  title,
  message,
  issue = '',
  issueUrl = '',
  duration = 0
}) => {
  feedbackNotice.visible = true
  feedbackNotice.state = state
  feedbackNotice.title = title
  feedbackNotice.message = message
  feedbackNotice.issue = issue
  feedbackNotice.issueUrl = issueUrl
  scheduleFeedbackNoticeClose(duration)
}

const closeFeedbackNotice = () => {
  clearFeedbackNoticeTimer()
  feedbackNotice.visible = false
}

const showFeedbackPendingNotice = () => {
  updateFeedbackNotice({
    state: 'pending',
    title: '已接收反馈',
    message: '正在处理，请稍候。'
  })
}

const showFeedbackResultNotice = (result) => {
  if (result.issue) {
    updateFeedbackNotice({
      state: 'success',
      title: '提交成功',
      message: `已创建 GitHub Issue #${result.issue}`,
      issue: String(result.issue),
      issueUrl: result.issueUrl || '',
      duration: 12000
    })
    return
  }

  updateFeedbackNotice({
    state: 'success',
    title: '提交成功',
    message: '反馈已记录。',
    duration: 8000
  })
}

const showFeedbackErrorNotice = (message) => {
  updateFeedbackNotice({
    state: 'error',
    title: '提交失败',
    message,
    duration: 12000
  })
}

const openGitHubIssue = async () => {
  const homepage = (props.appHomepage || 'https://github.com/11273/QzonePhoto').replace(/\/$/, '')
  const version = props.appVersion && props.appVersion !== 'unknown' ? `[${props.appVersion}]` : ''
  const system =
    systemText.value && systemText.value !== 'unknown'
      ? `[${systemText.value.split('/')[0].trim()}]`
      : ''
  const title =
    `[${typeLabelMap[form.type] || '反馈'}]${version}${system} ${contentTitle.value}`.trim()
  const url = `${homepage}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(buildFeedbackText())}`
  await window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, url)
}

const submitQuickFeedback = async () => {
  if (!hasEnoughContent.value) {
    ElMessage.warning('至少写 8 个字再提交')
    return
  }

  if (!window.QzoneAPI?.app?.submitFeedback) {
    ElMessage.error('当前版本未配置快捷提交，请使用 GitHub 反馈页')
    return
  }

  submitting.value = true
  let logId = ''
  if (attachLogs.value && window.QzoneAPI?.app?.uploadLogs) {
    try {
      const logResult = await window.QzoneAPI.app.uploadLogs({
        page: window.location.hash || '#/feedback',
        reason: 'manual_feedback',
        extraLines: buildLogExtraLines()
      })
      logId = logResult?.logId || ''
      reportFeedbackEvent('diagnostic_log_uploaded', { status: logId ? 'success' : 'empty' })
    } catch (error) {
      console.warn('[FeedbackDialog] diagnostic log upload failed:', error)
      reportFeedbackEvent('diagnostic_log_upload_failed', {
        errorCode: error?.name || 'log_upload_failed'
      })
    }
  }
  const payload = {
    type: form.type,
    title: contentTitle.value,
    content: form.content,
    contact: form.contact,
    env: {
      ...buildFeedbackEnv(),
      logId: logId || undefined
    },
    createdAt: new Date().toISOString()
  }

  form.content = ''
  form.contact = ''
  attachLogs.value = false
  extraExpanded.value = false
  emit('update:visible', false)
  showFeedbackPendingNotice()

  try {
    const result = await window.QzoneAPI.app.submitFeedback(payload)
    if (!result.ok) throw new Error(result.message)
    reportFeedbackEvent('feedback_submitted', { status: result.delivery || 'unknown' })
    showFeedbackResultNotice(result)
  } catch (error) {
    console.error('[FeedbackDialog] submit failed:', error)
    reportFeedbackEvent('feedback_submit_failed', {
      errorCode: error?.name || 'submit_failed'
    })
    const message =
      error?.name === 'AbortError' || error instanceof TypeError
        ? '本次未完成提交，请稍后重试或使用 GitHub 反馈页'
        : error?.message || '本次未完成提交，请稍后重试或使用 GitHub 反馈页'
    showFeedbackErrorNotice(message)
  } finally {
    submitting.value = false
  }
}

const reportFeedbackEvent = (event, properties = {}) => {
  if (!window.QzoneAPI?.app?.reportHealth) return
  const success = event === 'feedback_submitted' || event === 'diagnostic_log_uploaded'
  window.QzoneAPI.app
    .reportHealth({
      event,
      page: window.location.hash || '#/feedback',
      success,
      errorCode: properties.errorCode,
      properties
    })
    .catch(() => {})
}

const normalizeError = (type, message, source = '') => ({
  id: ++errorSeq,
  type,
  message: String(message || '未知错误')
    .replace(/\s+/g, ' ')
    .slice(0, 180),
  source: String(source || '').slice(0, 80),
  time: new Date().toISOString()
})

const resetFeedbackForm = () => {
  form.type = 'bug'
  form.content = ''
  form.contact = ''
  extraExpanded.value = false
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resetFeedbackForm()
    }
  }
)

const pushRecentError = (item) => {
  recentErrors.value = [item, ...recentErrors.value].slice(0, 5)
}

const handleWindowError = (event) => {
  pushRecentError(normalizeError('error', event.message || event.error?.message, event.filename))
}

const handleUnhandledRejection = (event) => {
  const reason = event.reason
  pushRecentError(normalizeError('unhandledrejection', reason?.message || reason))
}

onMounted(() => {
  window.addEventListener('error', handleWindowError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
})

onUnmounted(() => {
  window.removeEventListener('error', handleWindowError)
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  clearFeedbackNoticeTimer()
})
</script>

<style scoped lang="scss">
:deep(.feedback-dialog) {
  --el-dialog-padding-primary: 0;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 72px);
  overflow: hidden;
  background: #191a20;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5);
  backdrop-filter: none;
}

:global(.feedback-dialog-overlay) {
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: none;
}

:deep(.feedback-dialog .el-dialog__header) {
  padding: 18px 18px 12px;
  margin-right: 0;
}

:deep(.feedback-dialog .el-dialog__body) {
  padding: 0;
}

:deep(.feedback-dialog .el-dialog__footer) {
  padding: 12px 18px 16px;
  border-top: 1px solid var(--ds-border-faint);
}

.fd-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 11px;
}

.fd-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(135deg, #f15a24, #60a5fa);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(96, 165, 250, 0.18);
}

.fd-heading {
  min-width: 0;
}

.fd-title {
  color: var(--ds-text-primary);
  font-size: 16px;
  font-weight: 750;
  line-height: 1.25;
}

.fd-subtitle {
  margin-top: 3px;
  color: var(--ds-text-tertiary);
  font-size: 12px;
  line-height: 1.45;
}

.fd-body {
  max-height: calc(100vh - 184px);
  overflow: auto;
  padding: 2px 18px 0;
}

.fd-type-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.fd-type-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 32px;
  gap: 4px;
  padding: 0 8px;
  color: var(--ds-text-secondary);
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--ds-border-faint);
  border-radius: 10px;
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.fd-type-btn .el-icon {
  font-size: 14px;
}

.fd-type-btn:hover {
  color: var(--ds-text-primary);
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--ds-border-light);
}

.fd-type-btn.active {
  color: #dbeafe;
  background: rgba(96, 165, 250, 0.16);
  border-color: rgba(96, 165, 250, 0.42);
}

:deep(.fd-content .el-textarea__inner),
:deep(.el-input__wrapper) {
  color: var(--ds-text-primary);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--ds-border-light) inset;
  transition:
    box-shadow var(--ds-dur-fast) var(--ds-ease-soft),
    background var(--ds-dur-fast) var(--ds-ease-soft);
}

:deep(.fd-content .el-textarea__inner:hover),
:deep(.el-input__wrapper:hover) {
  background: rgba(255, 255, 255, 0.055);
}

:deep(.fd-content .el-textarea__inner:focus),
:deep(.el-input__wrapper.is-focus) {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.62) inset;
}

:deep(.fd-content .el-textarea__inner) {
  line-height: 1.55;
}

.fd-hint {
  margin: 7px 0 10px;
  color: var(--ds-text-quaternary);
  font-size: 11px;
  line-height: 1.45;
}

.fd-hint.warning {
  color: var(--ds-accent-yellow);
}

.fd-log-option {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin: 0 0 10px;
  padding: 9px 10px;
  color: var(--ds-text-secondary);
  font-size: 12px;
  line-height: 1.35;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid var(--ds-border-faint);
  border-radius: 10px;
  cursor: pointer;
}

.fd-log-option input {
  width: 14px;
  height: 14px;
  margin: 1px 0 0;
  accent-color: #60a5fa;
}

.fd-log-option strong,
.fd-log-option small {
  display: block;
}

.fd-log-option small {
  margin-top: 2px;
  color: var(--ds-text-quaternary);
  font-size: 11px;
}

.fd-smart-hint {
  margin: -2px 0 8px;
  padding: 7px 9px;
  color: #bfdbfe;
  font-size: 11px;
  line-height: 1.45;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.14);
  border-radius: 10px;
}

.fd-fold {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 34px;
  padding: 0 2px;
  color: var(--ds-text-secondary);
  font-size: 12px;
  font-weight: 700;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.fd-fold .el-icon {
  transition: transform var(--ds-dur-base) var(--ds-ease-soft);
}

.fd-fold .el-icon.expanded {
  transform: rotate(180deg);
}

.fd-extra {
  display: grid;
  gap: 9px;
  padding: 9px 0 12px;
}

.fd-label {
  color: var(--ds-text-tertiary);
  font-size: 12px;
  font-weight: 650;
}

.fd-env {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 5px 9px;
  margin: 0;
  padding: 9px 10px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--ds-border-faint);
  border-radius: 10px;
}

.fd-env dt {
  color: var(--ds-text-quaternary);
}

.fd-env dd {
  min-width: 0;
  margin: 0;
  color: var(--ds-text-secondary);
  word-break: break-all;
}

.fd-errors {
  display: grid;
  gap: 5px;
  padding: 9px 10px;
  font-size: 11px;
  background: rgba(255, 193, 7, 0.06);
  border: 1px solid rgba(255, 193, 7, 0.14);
  border-radius: 10px;
}

.fd-errors-title {
  color: var(--ds-accent-yellow);
  font-weight: 750;
}

.fd-error-item {
  color: var(--ds-text-tertiary);
  line-height: 1.45;
  word-break: break-all;
}

.fd-manual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding: 11px 12px;
  background: rgba(96, 165, 250, 0.07);
  border: 1px solid rgba(96, 165, 250, 0.16);
  border-radius: 13px;
}

.fd-manual-title {
  color: var(--ds-text-primary);
  font-size: 12px;
  font-weight: 750;
}

.fd-manual-desc {
  margin-top: 3px;
  color: var(--ds-text-tertiary);
  font-size: 11px;
  line-height: 1.4;
}

.fd-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  height: 30px;
  gap: 4px;
  padding: 0 10px;
  color: #bfdbfe;
  font-size: 12px;
  font-weight: 750;
  background: rgba(96, 165, 250, 0.13);
  border: 1px solid rgba(96, 165, 250, 0.26);
  border-radius: 999px;
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.fd-link-btn:hover {
  color: #fff;
  background: rgba(96, 165, 250, 0.2);
}

:deep(.feedback-dialog-v2) .fd-header {
  justify-content: flex-start !important;
}

:deep(.feedback-dialog-v2) .fd-heading {
  flex: 1 1 auto !important;
}

:deep(.feedback-dialog-v2) .fd-type-list {
  display: grid !important;
}

:deep(.feedback-dialog-v2) .fd-type-btn {
  border: 1px solid var(--ds-border-faint) !important;
  background: rgba(255, 255, 255, 0.04) !important;
  border-radius: 10px !important;
}

:deep(.feedback-dialog-v2) .fd-type-btn.active {
  color: #dbeafe !important;
  background: rgba(96, 165, 250, 0.18) !important;
  border-color: rgba(96, 165, 250, 0.46) !important;
}

:deep(.feedback-dialog-v2) .fd-manual {
  display: flex !important;
}

.fd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}

.fd-slide-enter-active,
.fd-slide-leave-active {
  transition: all var(--ds-dur-base) var(--ds-ease-soft);
}

.fd-slide-enter-from,
.fd-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.feedback-toast-card {
  position: fixed;
  top: 56px;
  right: 18px;
  z-index: 3200;
  width: min(320px, calc(100vw - 24px));
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  background: rgba(24, 25, 31, 0.96);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(14px);
}

.feedback-toast-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.feedback-toast-badge {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  border-radius: 11px;
  border: 1px solid transparent;
  font-size: 16px;
}

.feedback-toast-badge.is-pending {
  color: #bfdbfe;
  background: rgba(96, 165, 250, 0.14);
  border-color: rgba(96, 165, 250, 0.24);
}

.feedback-toast-badge.is-success {
  color: #d1fae5;
  background: rgba(52, 211, 153, 0.16);
  border-color: rgba(52, 211, 153, 0.26);
}

.feedback-toast-badge.is-error {
  color: #fde68a;
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.22);
}

.feedback-toast-spinner {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(191, 219, 254, 0.24);
  border-top-color: #bfdbfe;
  border-radius: 50%;
  animation: feedback-spin 0.88s linear infinite;
}

.feedback-toast-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.feedback-toast-title {
  color: #f3f4f6;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
}

.feedback-toast-text {
  margin-top: 5px;
  color: rgba(229, 231, 235, 0.82);
  font-size: 12px;
  line-height: 1.5;
}

.feedback-toast-actions {
  margin-top: 10px;
}

.feedback-toast-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 11px;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 999px;
  background: rgba(96, 165, 250, 0.14);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.feedback-toast-link:hover {
  background: rgba(96, 165, 250, 0.22);
  color: #ffffff;
}

.feedback-toast-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  color: rgba(255, 255, 255, 0.62);
  background: transparent;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.feedback-toast-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.feedback-toast-enter-active,
.feedback-toast-leave-active {
  transition: all 0.22s var(--ds-ease-soft);
}

.feedback-toast-enter-from,
.feedback-toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

@keyframes feedback-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 520px) {
  .fd-type-list {
    grid-template-columns: repeat(2, 1fr);
  }

  .fd-manual {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
