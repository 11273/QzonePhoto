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
      <div v-if="submittedFeedback" class="fd-success">
        <div class="fd-success-icon">
          <el-icon><CircleCheck /></el-icon>
        </div>
        <div class="fd-success-title">反馈已收到</div>
        <div class="fd-success-desc">
          <button
            v-if="submittedFeedback.issue"
            class="fd-issue-link"
            type="button"
            @click="openSubmittedIssue"
          >
            GitHub #{{ submittedFeedback.issue }}
            <el-icon><TopRight /></el-icon>
          </button>
          <span v-else>感谢你的提醒</span>
        </div>
        <div class="fd-success-note">作者会集中查看这些反馈；复杂问题也可以继续用 GitHub 反馈页补截图。</div>
      </div>

      <template v-else>
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
      </template>
    </div>

    <template #footer>
      <div v-if="submittedFeedback" class="fd-footer">
        <el-button text @click="resetFeedbackForm">继续反馈</el-button>
        <el-button type="primary" @click="emit('update:visible', false)">完成</el-button>
      </div>
      <div v-else class="fd-footer">
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
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ChatDotRound,
  CircleCheck,
  EditPen,
  Help,
  MagicStick,
  Star,
  TopRight
} from '@element-plus/icons-vue'
import { IPC_SHELL } from '@shared/ipc-channels'

const props = defineProps({
  visible: { type: Boolean, default: false },
  appVersion: { type: String, default: '' },
  appHomepage: { type: String, default: '' },
  runtimeInfo: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:visible'])

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const feedbackEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/feedback` : ''

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
const extraExpanded = ref(false)
const recentErrors = ref([])
const submittedFeedback = ref(null)
let errorSeq = 0

const runtime = computed(() => props.runtimeInfo || {})
const systemText = computed(() =>
  [platformNameMap[runtime.value.platform] || runtime.value.platform || 'unknown', runtime.value.arch || '']
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

const openGitHubIssue = async () => {
  const homepage = (props.appHomepage || 'https://github.com/11273/QzonePhoto').replace(/\/$/, '')
  const version = props.appVersion && props.appVersion !== 'unknown' ? `[${props.appVersion}]` : ''
  const system = systemText.value && systemText.value !== 'unknown' ? `[${systemText.value.split('/')[0].trim()}]` : ''
  const title = `[${typeLabelMap[form.type] || '反馈'}]${version}${system} ${contentTitle.value}`.trim()
  const url = `${homepage}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(buildFeedbackText())}`
  await window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, url)
}

const submitQuickFeedback = async () => {
  if (!hasEnoughContent.value) {
    ElMessage.warning('至少写 8 个字再提交')
    return
  }

  if (!feedbackEndpoint) {
    ElMessage.error('当前版本未配置快捷提交，请使用 GitHub 反馈页')
    return
  }

  submitting.value = true
  try {
    const payload = {
      type: form.type,
      title: contentTitle.value,
      content: form.content,
      contact: form.contact,
      env: buildFeedbackEnv(),
      createdAt: new Date().toISOString()
    }
    const res = await fetch(feedbackEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const result = await parseFeedbackResponse(res)
    if (!result.ok) throw new Error(result.message)
    submittedFeedback.value = {
      issue: result.issue || '',
      issueUrl: result.issueUrl || ''
    }
    ElMessage.success(result.issue ? `反馈已提交到 GitHub #${result.issue}` : '反馈已提交，感谢你的提醒')
    form.content = ''
    form.contact = ''
  } catch (error) {
    console.error('[FeedbackDialog] submit failed:', error)
    const message =
      error?.name === 'AbortError' || error instanceof TypeError
        ? '快捷提交暂时不可用，请使用 GitHub 反馈页'
        : error?.message || '快捷提交失败，请使用 GitHub 反馈页'
    ElMessage.error(message)
  } finally {
    submitting.value = false
  }
}

const parseFeedbackResponse = async (res) => {
  try {
    const data = await res.clone().json()
    if (typeof data?.message === 'string') {
      return {
        ok: res.ok && data.ok !== false,
        message: data.message,
        issue: data.data?.issue,
        issueUrl: data.data?.issueUrl
      }
    }
    if (typeof data?.error === 'string') {
      return { ok: false, message: data.error }
    }
  } catch {
    // ignore non-JSON response
  }
  if (res.status === 429) return { ok: false, message: '提交太频繁了，请稍后再试' }
  if (res.status >= 500) return { ok: false, message: '反馈服务暂时不可用，请稍后再试' }
  if (res.ok) return { ok: true, message: '反馈已提交' }
  return { ok: false, message: '提交失败，请检查内容后再试' }
}

const normalizeError = (type, message, source = '') => ({
  id: ++errorSeq,
  type,
  message: String(message || '未知错误').replace(/\s+/g, ' ').slice(0, 180),
  source: String(source || '').slice(0, 80),
  time: new Date().toISOString()
})

const resetFeedbackForm = () => {
  submittedFeedback.value = null
  form.type = 'bug'
  form.content = ''
  form.contact = ''
  extraExpanded.value = false
}

const openSubmittedIssue = async () => {
  if (!submittedFeedback.value?.issue) return
  const homepage = (props.appHomepage || 'https://github.com/11273/QzonePhoto').replace(/\/$/, '')
  const issueUrl = submittedFeedback.value.issueUrl || `${homepage}/issues/${submittedFeedback.value.issue}`
  await window.api.invoke(IPC_SHELL.OPEN_EXTERNAL, issueUrl)
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
})
</script>

<style scoped lang="scss">
:deep(.feedback-dialog) {
  --el-dialog-padding-primary: 0;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 72px);
  overflow: hidden;
}

:global(.feedback-dialog-overlay) {
  background: rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(2px);
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

.fd-success {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 22px 18px 18px;
  text-align: center;
}

.fd-success-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  color: #d1fae5;
  font-size: 22px;
  background: rgba(52, 211, 153, 0.16);
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: 16px;
}

.fd-success-title {
  color: var(--ds-text-primary);
  font-size: 16px;
  font-weight: 800;
}

.fd-success-desc {
  color: #bfdbfe;
  font-size: 13px;
  font-weight: 750;
}

.fd-issue-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  color: #bfdbfe;
  font: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: var(--ds-transition-all);
}

.fd-issue-link:hover {
  color: #fff;
}

.fd-success-note {
  max-width: 280px;
  color: var(--ds-text-tertiary);
  font-size: 12px;
  line-height: 1.55;
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
  transition: box-shadow var(--ds-dur-fast) var(--ds-ease-soft), background var(--ds-dur-fast) var(--ds-ease-soft);
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
