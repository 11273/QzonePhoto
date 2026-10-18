<template>
  <el-dialog
    :model-value="visible"
    width="min(720px, calc(100vw - 32px))"
    align-center
    append-to-body
    modal-class="feedback-dialog-overlay"
    class="feedback-dialog feedback-dialog-v3 ds-dialog"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="fd-header">
        <div class="fd-brand">
          <span class="fd-brand-mark" aria-hidden="true">
            <el-icon><ChatDotRound /></el-icon>
          </span>
          <div>
            <div class="fd-title">反馈中心</div>
            <div class="fd-subtitle">每一句都会被认真看见</div>
          </div>
        </div>
        <div class="fd-tabs" role="tablist" aria-label="反馈中心">
          <button
            type="button"
            role="tab"
            :aria-selected="activeView === 'compose'"
            :class="{ active: activeView === 'compose' }"
            @click="activeView = 'compose'"
          >
            <el-icon><EditPen /></el-icon>
            发反馈
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeView === 'inbox'"
            :aria-label="unreadCount ? `我的反馈，有 ${unreadCount} 条未读回复` : '我的反馈'"
            :class="{ active: activeView === 'inbox' }"
            @click="openInbox"
          >
            <el-icon><ChatLineRound /></el-icon>
            我的反馈
            <span v-if="unreadCount" class="fd-tab-badge" aria-hidden="true"></span>
          </button>
        </div>
      </div>
    </template>

    <transition name="fd-view" mode="out-in">
      <div v-if="activeView === 'compose'" key="compose" class="fd-compose">
        <div class="fd-compose-lead">
          <span class="fd-kicker"
            ><el-icon><MagicStick /></el-icon> 一起把体验变得更好</span
          >
          <h3>今天哪里可以再顺手一点？</h3>
          <p>问题、建议，或只是一个突然冒出来的好点子，都可以直接告诉我们。</p>
        </div>

        <div class="fd-types" role="radiogroup" aria-label="反馈类型">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="form.type === option.value"
            :class="{ active: form.type === option.value }"
            @click="form.type = option.value"
          >
            <el-icon><component :is="option.icon" /></el-icon>
            <span>{{ option.label }}</span>
          </button>
        </div>

        <label class="fd-input-label" for="feedback-content">
          <span>写下最重要的一件事</span>
          <small :class="{ 'is-invalid': contentTooShort }">{{ contentLength }} / 1200</small>
        </label>
        <el-input
          id="feedback-content"
          v-model.trim="form.content"
          class="fd-content"
          :class="{ 'is-invalid': contentTooShort }"
          type="textarea"
          :rows="4"
          maxlength="1200"
          resize="none"
          :aria-invalid="contentTooShort ? 'true' : 'false'"
          aria-describedby="feedback-content-help"
          placeholder="比如：下载完成后，希望能直接打开所在文件夹……"
        />
        <div
          id="feedback-content-help"
          class="fd-compose-hint"
          :class="{ 'is-invalid': contentTooShort }"
          :role="contentTooShort ? 'alert' : 'status'"
          aria-live="polite"
        >
          <span class="fd-requirement">
            <el-icon v-if="contentTooShort"><WarningFilled /></el-icon>
            {{ contentRequirement }}
          </span>
          <span v-if="smartHint" class="fd-smart-hint">
            <el-icon><Opportunity /></el-icon>{{ smartHint }}
          </span>
        </div>

        <div class="fd-compose-actions">
          <button class="fd-github-link" type="button" @click="openGitHubIssue">
            <el-icon><TopRight /></el-icon>
            需要附图？前往 GitHub
          </button>
          <el-button
            class="fd-submit"
            type="primary"
            :loading="submitting"
            :disabled="!hasEnoughContent"
            :title="hasEnoughContent ? '发送反馈' : contentRequirement"
            @click="submitQuickFeedback"
          >
            <el-icon v-if="!submitting"><Promotion /></el-icon>
            发送给我们
          </el-button>
        </div>
      </div>

      <div v-else key="inbox" class="fd-inbox">
        <div class="fd-list-heading">
          <div>
            <strong>我的反馈</strong>
            <span>{{ threads.length ? `${threads.length} 条记录` : '处理结果会显示在这里' }}</span>
          </div>
          <button
            type="button"
            aria-label="刷新反馈记录"
            :disabled="threadsLoading"
            @click="loadFeedbackThreads(true)"
          >
            <el-icon :class="{ spinning: threadsLoading }"><Refresh /></el-icon>
            <span>刷新</span>
          </button>
        </div>

        <div class="fd-ticket-list" aria-label="反馈记录">
          <div v-if="threadsLoading && !threads.length" class="fd-empty">
            <span class="fd-empty-icon is-loading"
              ><el-icon><Refresh /></el-icon
            ></span>
            <strong>正在读取反馈</strong>
            <small>马上就好</small>
          </div>
          <div v-else-if="threadsError && !threads.length" class="fd-empty is-error">
            <span class="fd-empty-icon"
              ><el-icon><WarningFilled /></el-icon
            ></span>
            <strong>暂时没能读取</strong>
            <small>{{ threadsError }}</small>
            <button type="button" @click="loadFeedbackThreads(true)">再试一次</button>
          </div>
          <div v-else-if="!threads.length" class="fd-empty">
            <span class="fd-empty-icon"
              ><el-icon><ChatLineRound /></el-icon
            ></span>
            <strong>还没有提交过反馈</strong>
            <small>提交后，处理状态和官方回复都会回到这里</small>
            <button type="button" @click="activeView = 'compose'">写一条反馈</button>
          </div>

          <template v-else>
            <article
              v-for="thread in threads"
              :key="thread.feedbackId"
              class="fd-ticket"
              :class="{
                'is-open': selectedFeedbackId === thread.feedbackId,
                'is-unread': isThreadUnread(thread)
              }"
            >
              <button
                type="button"
                class="fd-ticket-summary"
                :aria-expanded="selectedFeedbackId === thread.feedbackId"
                @click="toggleThread(thread)"
              >
                <span class="fd-ticket-icon" aria-hidden="true">
                  <el-icon><component :is="typeIconMap[thread.type] || ChatDotRound" /></el-icon>
                </span>
                <span class="fd-ticket-copy">
                  <span class="fd-ticket-title">
                    <i v-if="isThreadUnread(thread)"></i>
                    {{ thread.title || '反馈' }}
                  </span>
                  <span class="fd-ticket-meta">
                    {{ typeLabelMap[thread.type] || '反馈' }} ·
                    {{ formatTime(thread.updatedAt || thread.submittedAt) }}
                  </span>
                </span>
                <span
                  class="fd-ticket-state"
                  :class="{ replied: Boolean(latestAdminMessage(thread)) }"
                >
                  <el-icon>
                    <CircleCheck v-if="latestAdminMessage(thread)" />
                    <ChatDotRound v-else />
                  </el-icon>
                  {{ latestAdminMessage(thread) ? '官方已回复' : '已收到' }}
                </span>
                <el-icon class="fd-ticket-chevron"><ArrowDown /></el-icon>
              </button>

              <transition name="fd-slide">
                <div v-if="selectedFeedbackId === thread.feedbackId" class="fd-ticket-detail">
                  <ol class="fd-conversation" aria-label="反馈沟通记录">
                    <li
                      v-for="(message, messageIndex) in feedbackTimeline(thread)"
                      :key="message.id ?? `${thread.feedbackId}-${messageIndex}`"
                      class="fd-message"
                      :class="{ 'is-official': message.sender === 'admin' }"
                    >
                      <span class="fd-message-marker" aria-hidden="true">
                        <el-icon>
                          <CircleCheck v-if="message.sender === 'admin'" />
                          <ChatDotRound v-else />
                        </el-icon>
                      </span>
                      <div class="fd-message-body">
                        <div class="fd-message-heading">
                          <strong>{{ feedbackMessageLabel(message, messageIndex) }}</strong>
                          <time>{{ formatTime(message.createdAt) }}</time>
                        </div>
                        <p>{{ message.content }}</p>
                      </div>
                    </li>
                  </ol>

                  <section v-if="!latestAdminMessage(thread)" class="fd-awaiting-reply">
                    <span class="fd-awaiting-icon"
                      ><el-icon><ChatDotRound /></el-icon
                    ></span>
                    <div>
                      <strong>反馈已经收到</strong>
                      <p>需要处理或进一步确认时，我们会在这里更新结果。</p>
                    </div>
                  </section>

                  <div v-if="latestAdminMessage(thread)" class="fd-ticket-actions">
                    <button
                      type="button"
                      class="fd-secondary-action"
                      :aria-expanded="supplementFeedbackId === thread.feedbackId"
                      @click="toggleSupplement(thread.feedbackId)"
                    >
                      <el-icon><EditPen /></el-icon>
                      {{ supplementFeedbackId === thread.feedbackId ? '取消补充' : '补充信息' }}
                    </button>
                  </div>

                  <transition name="fd-slide">
                    <div v-if="supplementFeedbackId === thread.feedbackId" class="fd-supplement">
                      <label for="feedback-supplement">补充信息</label>
                      <p>仅在需要补充现场、结果或复现步骤时填写，内容只对你和管理员可见。</p>
                      <el-input
                        id="feedback-supplement"
                        v-model.trim="replyContent"
                        type="textarea"
                        :rows="2"
                        maxlength="1200"
                        resize="none"
                        placeholder="补充新的信息……"
                        @keydown.meta.enter.prevent="sendFollowup"
                        @keydown.ctrl.enter.prevent="sendFollowup"
                      />
                      <div class="fd-supplement-actions">
                        <small>Ctrl / ⌘ + Enter 发送</small>
                        <el-button
                          type="primary"
                          size="small"
                          :loading="replySending"
                          :disabled="!replyContent.trim()"
                          @click="sendFollowup"
                        >
                          发送补充
                        </el-button>
                      </div>
                    </div>
                  </transition>
                </div>
              </transition>
            </article>
          </template>
        </div>
      </div>
    </transition>
  </el-dialog>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  Brush,
  ChatDotRound,
  ChatLineRound,
  CircleCheck,
  EditPen,
  Help,
  MagicStick,
  MoreFilled,
  Opportunity,
  Promotion,
  Refresh,
  TopRight,
  WarningFilled
} from '@element-plus/icons-vue'
import { IPC_SHELL } from '@shared/ipc-channels'
import {
  buildFeedbackEnvironment,
  feedbackSubmitErrorMessage,
  resolveFeedbackSubmissionAttempt
} from './feedback-payload'
import {
  countUnreadFeedbackThreads,
  isFeedbackThreadUnread,
  markFeedbackThreadSeen
} from './feedback-read-state'

const props = defineProps({
  visible: { type: Boolean, default: false },
  appVersion: { type: String, default: '' },
  appHomepage: { type: String, default: '' },
  runtimeInfo: { type: Object, default: () => ({}) },
  apiBaseUrl: { type: String, default: '' }
})

const emit = defineEmits(['update:visible', 'unread-count'])
const typeOptions = [
  { label: '遇到问题', value: 'bug', icon: Help },
  { label: '功能建议', value: 'feature', icon: MagicStick },
  { label: '体验改进', value: 'ux', icon: Brush },
  { label: '其他想法', value: 'other', icon: MoreFilled }
]
const typeLabelMap = Object.fromEntries(typeOptions.map((item) => [item.value, item.label]))
const typeIconMap = Object.fromEntries(typeOptions.map((item) => [item.value, item.icon]))
const platformNameMap = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }
const MIN_FEEDBACK_CONTENT_LENGTH = 8

const form = reactive({ type: 'bug', content: '' })
const activeView = ref('compose')
const submitting = ref(false)
const recentErrors = ref([])
const threads = ref([])
const threadsLoading = ref(false)
const threadsError = ref('')
const selectedFeedbackId = ref(0)
const supplementFeedbackId = ref(0)
const replyContent = ref('')
const replySending = ref(false)
let errorSeq = 0
let submissionAttempt = null
let followupAttempt = null

const runtime = computed(() => props.runtimeInfo || {})
const systemText = computed(() =>
  [
    platformNameMap[runtime.value.platform] || runtime.value.platform || 'unknown',
    runtime.value.arch
  ]
    .filter(Boolean)
    .join(' / ')
)
const contentLength = computed(() => form.content.trim().length)
const hasEnoughContent = computed(() => contentLength.value >= MIN_FEEDBACK_CONTENT_LENGTH)
const contentTooShort = computed(
  () => contentLength.value > 0 && contentLength.value < MIN_FEEDBACK_CONTENT_LENGTH
)
const contentRequirement = computed(() => {
  if (contentTooShort.value) {
    return `还差 ${MIN_FEEDBACK_CONTENT_LENGTH - contentLength.value} 个字才能发送`
  }
  if (!contentLength.value) return `填写至少 ${MIN_FEEDBACK_CONTENT_LENGTH} 个字后即可发送`
  return '内容已完整，请勿填写密码、验证码或登录凭证'
})
const selectedThread = computed(() =>
  threads.value.find((thread) => thread.feedbackId === selectedFeedbackId.value)
)
const unreadCount = ref(0)
const latestAdminMessage = (thread) =>
  [...(Array.isArray(thread?.messages) ? thread.messages : [])]
    .reverse()
    .find((message) => message?.sender === 'admin')
const feedbackTimeline = (thread) => {
  const messages = Array.isArray(thread?.messages) ? thread.messages : []
  if (messages.some((message) => message?.sender === 'user')) return messages

  const fallbackContent = String(thread?.title || '').trim()
  if (!fallbackContent) return messages
  return [
    {
      id: `feedback-${thread.feedbackId}`,
      sender: 'user',
      kind: 'initial',
      content: fallbackContent,
      createdAt: thread.submittedAt
    },
    ...messages
  ]
}
const feedbackMessageLabel = (message, messageIndex) => {
  if (message?.sender === 'admin') return '官方回复'
  return message?.kind === 'initial' || messageIndex === 0 ? '我的反馈' : '我的补充'
}
const smartHint = computed(() => {
  const content = form.content.trim()
  if (content.length < 8 || content.length >= 24) return ''
  const hasFailure = /失败|报错|异常|打不开|没反应|没有反应|不能|无法|崩溃|闪退/.test(content)
  const hasScene = /页面|首页|登录|相册|照片|视频|下载|上传|动态|好友|群|亲密度|收藏|日志/.test(
    content
  )
  if (hasFailure && !hasScene) {
    return '再补一句发生在哪个页面，会更容易定位。'
  }
  return ''
})

const formatTime = (value) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
const isThreadUnread = (thread) => isFeedbackThreadUnread(thread)
const updateUnreadCount = () => {
  unreadCount.value = countUnreadFeedbackThreads(threads.value)
  emit('unread-count', unreadCount.value)
}

const loadFeedbackThreads = async (force = false) => {
  if (!window.QzoneAPI?.app?.fetchFeedbackThreads || (threadsLoading.value && !force)) return
  threadsLoading.value = true
  threadsError.value = ''
  try {
    const result = await window.QzoneAPI.app.fetchFeedbackThreads()
    threads.value = Array.isArray(result?.threads) ? result.threads : []
    if (selectedFeedbackId.value && !selectedThread.value) selectedFeedbackId.value = 0
    if (activeView.value === 'inbox' && selectedThread.value) {
      markFeedbackThreadSeen(selectedThread.value)
    }
    updateUnreadCount()
  } catch (error) {
    threadsError.value = error?.message || '暂时无法读取反馈记录'
  } finally {
    threadsLoading.value = false
  }
}

const selectThread = (thread) => {
  if (selectedFeedbackId.value !== thread.feedbackId) {
    supplementFeedbackId.value = 0
    replyContent.value = ''
  }
  selectedFeedbackId.value = thread.feedbackId
  markFeedbackThreadSeen(thread)
  updateUnreadCount()
}
const toggleThread = (thread) => {
  if (selectedFeedbackId.value === thread.feedbackId) {
    selectedFeedbackId.value = 0
    supplementFeedbackId.value = 0
    replyContent.value = ''
    return
  }
  selectThread(thread)
}
const toggleSupplement = (feedbackId) => {
  supplementFeedbackId.value = supplementFeedbackId.value === feedbackId ? 0 : feedbackId
  if (!supplementFeedbackId.value) {
    replyContent.value = ''
    followupAttempt = null
  }
}
const openInbox = async () => {
  activeView.value = 'inbox'
  await loadFeedbackThreads()
  const target = threads.value.find(isThreadUnread) || threads.value[0]
  if (target && !selectedFeedbackId.value) selectThread(target)
}

const buildEnv = (logId = '') =>
  buildFeedbackEnvironment({
    appVersion: props.appVersion,
    system: systemText.value,
    installMode: runtime.value.isPackaged ? '安装包' : '开发模式',
    page: window.location.hash,
    recentErrors: recentErrors.value,
    logId
  })

const submitQuickFeedback = async () => {
  if (!hasEnoughContent.value) return
  if (!window.QzoneAPI?.app?.submitFeedback) {
    ElMessage.error('当前版本未配置反馈服务')
    return
  }
  submitting.value = true
  try {
    submissionAttempt = resolveFeedbackSubmissionAttempt(submissionAttempt, {
      type: form.type,
      content: form.content
    })
    let logId = ''
    if (window.QzoneAPI?.app?.uploadLogs) {
      try {
        const logResult = await window.QzoneAPI.app.uploadLogs({
          page: window.location.hash || '#/index',
          reason: 'manual_feedback',
          extraLines: recentErrors.value.map((item) => item.message)
        })
        logId = logResult?.logId || ''
      } catch (error) {
        console.warn('[FeedbackDialog] diagnostic log upload failed:', error)
      }
    }
    const result = await window.QzoneAPI.app.submitFeedback({
      type: form.type,
      title: form.content.trim().replace(/\s+/g, ' ').slice(0, 28),
      content: form.content,
      env: buildEnv(logId),
      eventId: submissionAttempt.eventId,
      createdAt: submissionAttempt.createdAt
    })
    if (!result?.ok) throw new Error(result?.message || '提交失败')
    form.content = ''
    submissionAttempt = null
    ElMessage.success('反馈已收到，你可以在“我的反馈”中查看回复')
    await loadFeedbackThreads(true)
    activeView.value = 'inbox'
    const target =
      threads.value.find((thread) => thread.feedbackId === Number(result.feedbackId)) ||
      threads.value[0]
    if (target) selectThread(target)
  } catch (error) {
    ElMessage.error(feedbackSubmitErrorMessage(error))
  } finally {
    submitting.value = false
  }
}

const sendFollowup = async () => {
  const content = replyContent.value.trim()
  if (!selectedThread.value || !content || replySending.value) return
  replySending.value = true
  try {
    followupAttempt = resolveFeedbackSubmissionAttempt(followupAttempt, {
      type: `followup:${selectedThread.value.feedbackId}`,
      content
    })
    const result = await window.QzoneAPI.app.submitFeedbackMessage(
      selectedThread.value.feedbackId,
      {
        content,
        eventId: followupAttempt.eventId,
        createdAt: followupAttempt.createdAt
      }
    )
    if (!result?.message) throw new Error('消息发送失败')
    selectedThread.value.messages.push(result.message)
    selectedThread.value.updatedAt = result.message.createdAt
    replyContent.value = ''
    followupAttempt = null
    supplementFeedbackId.value = 0
    ElMessage.success('补充信息已发送')
  } catch (error) {
    ElMessage.error(error?.message || '消息发送失败，请稍后重试')
  } finally {
    replySending.value = false
  }
}

const openGitHubIssue = async () => {
  const homepage = (props.appHomepage || 'https://github.com/11273/QzonePhoto').replace(/\/$/, '')
  const title = `[反馈][${props.appVersion || 'unknown'}] ${form.content.trim().slice(0, 28) || '用户反馈'}`
  const body = `${form.content || '请描述问题'}\n\n版本：${props.appVersion || 'unknown'}\n系统：${systemText.value}`
  await window.api.invoke(
    IPC_SHELL.OPEN_EXTERNAL,
    `${homepage}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
  )
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
const captureError = (type, message, source) => {
  recentErrors.value = [normalizeError(type, message, source), ...recentErrors.value].slice(0, 5)
}
const handleWindowError = (event) =>
  captureError('error', event.message || event.error?.message, event.filename)
const handleUnhandledRejection = (event) =>
  captureError('unhandledrejection', event.reason?.message || event.reason)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    activeView.value = 'compose'
    loadFeedbackThreads().then(() => {
      if (!props.visible || !unreadCount.value) return
      const unreadThread = threads.value.find(isThreadUnread)
      if (!unreadThread) return
      activeView.value = 'inbox'
      selectThread(unreadThread)
    })
  }
)

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
  --fd-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  width: min(720px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow: hidden;
  background:
    linear-gradient(145deg, var(--theme-material-highlight), transparent 36%),
    var(--theme-surface-overlay);
  border: 1px solid var(--theme-material-border);
  border-radius: var(--theme-radius-xl);
  box-shadow:
    var(--theme-shadow-lg),
    inset 0 1px 0 var(--theme-material-highlight);
  transform-origin: 50% 44%;
  animation: fd-dialog-in 260ms var(--fd-ease-out) both;
}
:global(.feedback-dialog-overlay) {
  background: var(--theme-backdrop);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  backdrop-filter: blur(10px) saturate(120%);
}
:deep(.feedback-dialog .el-dialog__header) {
  padding: 16px 18px;
  margin: 0;
  border-bottom: 1px solid var(--ds-border-faint);
}
:deep(.feedback-dialog .el-dialog__headerbtn) {
  top: 13px;
  right: 14px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  transition:
    color 160ms ease,
    background 160ms ease,
    transform 100ms ease-out;
}
:deep(.feedback-dialog .el-dialog__headerbtn:hover) {
  background: var(--theme-surface-hover);
}
:deep(.feedback-dialog .el-dialog__headerbtn:active) {
  transform: scale(0.94);
}
:deep(.feedback-dialog .el-dialog__body) {
  padding: 0;
}
.fd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 42px;
}
.fd-brand {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 11px;
}
.fd-brand-mark {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  flex: 0 0 38px;
  color: var(--theme-text-inverse);
  font-size: 19px;
  background: linear-gradient(145deg, var(--theme-brand-hover), var(--theme-brand));
  border: 1px solid var(--theme-brand-border);
  border-radius: 12px;
  box-shadow:
    var(--theme-shadow-brand),
    inset 0 1px 0 var(--theme-material-highlight);
}
.fd-brand-mark::after {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 5px;
  height: 5px;
  content: '';
  background: var(--theme-warning);
  border: 2px solid var(--theme-brand);
  border-radius: 50%;
}
.fd-title {
  color: var(--ds-text-primary);
  font-size: 17px;
  font-weight: 720;
  line-height: 1.2;
  letter-spacing: -0.015em;
}
.fd-subtitle {
  margin-top: 4px;
  color: var(--ds-text-tertiary);
  font-size: 11px;
  line-height: 1.35;
}
.fd-tabs {
  display: flex;
  padding: 3px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  box-shadow: inset 0 1px 0 var(--theme-material-highlight);
}
.fd-tabs button {
  position: relative;
  display: inline-flex;
  min-width: 92px;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  color: var(--ds-text-secondary);
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition:
    color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease,
    transform 100ms ease-out;
}
.fd-tabs button .el-icon {
  font-size: 14px;
}
.fd-tabs button:hover:not(.active) {
  color: var(--ds-text-primary);
  background: var(--theme-surface-hover);
}
.fd-tabs button.active {
  color: var(--ds-text-primary);
  background: var(--theme-surface-raised);
  box-shadow: var(--theme-shadow-sm);
}
.fd-tabs button:active {
  transform: scale(0.97);
}
.fd-tab-badge {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  background: var(--theme-danger);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--theme-surface-soft);
  pointer-events: none;
}
.fd-tabs button.active .fd-tab-badge {
  box-shadow: 0 0 0 2px var(--theme-surface-raised);
}
.fd-compose {
  position: relative;
  max-height: calc(100dvh - 126px);
  padding: 18px 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.fd-compose::before {
  position: absolute;
  top: -1px;
  right: 34px;
  width: 180px;
  height: 86px;
  pointer-events: none;
  content: '';
  background: radial-gradient(ellipse at top, var(--theme-brand-soft), transparent 70%);
  opacity: 0.5;
}
.fd-compose-lead {
  position: relative;
  margin-bottom: 16px;
}
.fd-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
  color: var(--theme-brand-text);
  font-size: 11px;
  font-weight: 650;
}
.fd-compose-lead h3 {
  margin: 0;
  color: var(--ds-text-primary);
  font-size: 22px;
  font-weight: 730;
  line-height: 1.25;
  letter-spacing: -0.025em;
}
.fd-compose-lead p {
  margin: 6px 0 0;
  color: var(--ds-text-tertiary);
  font-size: 12px;
  line-height: 1.55;
}
.fd-types {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 15px;
}
.fd-types button {
  display: inline-flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--ds-text-secondary);
  font-size: 12px;
  font-weight: 620;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border);
  border-radius: 11px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 var(--theme-material-highlight);
  transition:
    color 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 120ms ease-out;
}
.fd-types button .el-icon {
  color: var(--ds-text-tertiary);
  font-size: 15px;
  transition:
    color 180ms ease,
    transform 180ms var(--fd-ease-out);
}
.fd-types button:hover {
  color: var(--ds-text-primary);
  background: var(--theme-surface-hover);
  border-color: var(--theme-border-strong);
  transform: translateY(-1px);
}
.fd-types button.active {
  color: var(--theme-brand-text);
  background: linear-gradient(145deg, var(--theme-brand-soft-hover), var(--theme-brand-soft));
  border-color: var(--theme-brand-border);
  box-shadow:
    inset 0 1px 0 var(--theme-material-highlight),
    var(--theme-shadow-sm);
}
.fd-types button.active .el-icon {
  color: var(--theme-brand);
  transform: scale(1.08);
}
.fd-types button:active {
  transform: scale(0.98);
}
.fd-input-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 2px 7px;
  color: var(--ds-text-secondary);
  font-size: 12px;
  font-weight: 650;
}
.fd-input-label small {
  color: var(--ds-text-quaternary);
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.fd-input-label small.is-invalid {
  color: var(--theme-danger-text);
  font-weight: 650;
}
.fd-content :deep(textarea) {
  min-height: 112px;
  padding: 13px 14px;
  color: var(--ds-text-primary);
  line-height: 1.6;
  background:
    linear-gradient(145deg, var(--theme-material-highlight), transparent 38%),
    var(--theme-surface-soft);
  border-radius: 13px;
  box-shadow: inset 0 0 0 1px var(--theme-border);
  transition:
    background 180ms ease,
    box-shadow 180ms ease;
}
.fd-content :deep(textarea:hover) {
  background: var(--theme-surface-hover);
  box-shadow: inset 0 0 0 1px var(--theme-border-strong);
}
.fd-content :deep(textarea:focus) {
  background: var(--theme-surface-raised);
  box-shadow:
    inset 0 0 0 1px var(--theme-brand-accent),
    0 0 0 3px var(--theme-focus-ring);
}
.fd-content.is-invalid :deep(textarea) {
  background: var(--theme-danger-soft);
  box-shadow:
    inset 0 0 0 1px var(--theme-danger-border),
    0 0 0 3px color-mix(in srgb, var(--theme-danger) 12%, transparent);
}
.fd-content.is-invalid :deep(textarea:focus) {
  box-shadow:
    inset 0 0 0 1px var(--theme-danger),
    0 0 0 3px color-mix(in srgb, var(--theme-danger) 16%, transparent);
}
.fd-compose-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 21px;
  padding: 7px 2px 0;
  color: var(--ds-text-tertiary);
  font-size: 11px;
}
.fd-requirement {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}
.fd-compose-hint.is-invalid .fd-requirement {
  color: var(--theme-danger-text);
  font-weight: 650;
}
.fd-smart-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--theme-warning);
  font-weight: 600;
}
.fd-github-link,
.fd-list-heading button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ds-text-tertiary);
  background: transparent;
  border: 0;
  cursor: pointer;
  transition:
    color 160ms ease,
    background 160ms ease,
    transform 100ms ease-out;
}
.fd-github-link:active,
.fd-list-heading button:active {
  transform: scale(0.95);
}
.fd-compose-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}
.fd-github-link {
  height: 34px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 9px;
}
.fd-github-link:hover {
  color: var(--theme-brand);
  background: var(--theme-brand-soft);
}
.fd-submit {
  min-width: 126px;
  height: 38px;
  border-radius: 10px;
  box-shadow: var(--theme-shadow-brand);
  transition:
    transform 100ms ease-out,
    filter 180ms ease;
}
.fd-submit:not(.is-disabled):hover {
  filter: brightness(1.04);
}
.fd-submit:not(.is-disabled):active {
  transform: scale(0.97);
}
.fd-inbox {
  max-height: min(560px, calc(100dvh - 132px));
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--theme-surface-overlay);
}
.fd-list-heading {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  padding: 8px 18px;
  background: color-mix(in srgb, var(--theme-surface-overlay) 90%, transparent);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
  box-shadow: 0 1px 0 var(--ds-border-faint);
}
.fd-list-heading > div {
  display: grid;
  gap: 3px;
}
.fd-list-heading strong {
  color: var(--ds-text-primary);
  font-size: 13px;
  font-weight: 680;
}
.fd-list-heading > div > span {
  color: var(--ds-text-tertiary);
  font-size: 10px;
}
.fd-list-heading button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  font-size: 11px;
  border-radius: 8px;
}
.fd-list-heading button:hover:not(:disabled) {
  color: var(--ds-text-primary);
  background: var(--theme-surface-hover);
}
.fd-list-heading button:disabled {
  cursor: default;
  opacity: 0.55;
}
.fd-ticket-list {
  display: grid;
  gap: 10px;
  padding: 14px 18px 18px;
}
.fd-ticket {
  overflow: hidden;
  background: var(--theme-surface-soft);
  border: 1px solid var(--ds-border-faint);
  border-radius: 13px;
  box-shadow: inset 0 1px 0 var(--theme-material-highlight);
  transition:
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.fd-ticket:hover {
  border-color: var(--theme-border-strong);
}
.fd-ticket.is-open {
  background: var(--theme-surface-raised);
  border-color: var(--theme-brand-border);
  box-shadow:
    inset 3px 0 0 var(--theme-brand),
    var(--theme-shadow-sm);
}
.fd-ticket-summary {
  display: flex;
  width: 100%;
  min-height: 58px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition:
    background 160ms ease,
    transform 160ms var(--fd-ease-out);
}
.fd-ticket-summary:hover {
  background: var(--theme-surface-hover);
}
.fd-ticket-summary:active {
  transform: scale(0.985);
}
.fd-ticket-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  flex: 0 0 34px;
  color: var(--ds-text-tertiary);
  background: var(--theme-surface-raised);
  border: 1px solid var(--ds-border-faint);
  border-radius: 10px;
}
.fd-ticket.is-open .fd-ticket-icon {
  color: var(--theme-brand);
  background: var(--theme-brand-soft);
  border-color: var(--theme-brand-border);
}
.fd-ticket-copy {
  min-width: 0;
  flex: 1;
}
.fd-ticket-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--ds-text-primary);
  font-size: 13px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fd-ticket-title i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  background: var(--theme-danger);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--theme-danger-soft);
}
.fd-ticket-meta {
  display: block;
  margin-top: 4px;
  color: var(--ds-text-tertiary);
  font-size: 10px;
}
.fd-ticket-state {
  display: inline-flex;
  height: 25px;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 0 8px;
  color: var(--theme-info-text);
  font-size: 10px;
  background: var(--theme-info-soft);
  border: 1px solid var(--theme-info-border);
  border-radius: var(--theme-radius-pill);
}
.fd-ticket-state.replied {
  color: var(--theme-success-text);
  background: var(--theme-success-soft);
  border-color: var(--theme-success-border);
}
.fd-ticket-chevron {
  flex: 0 0 auto;
  color: var(--ds-text-tertiary);
  transition: transform 180ms var(--fd-ease-out);
}
.fd-ticket.is-open .fd-ticket-chevron {
  transform: rotate(180deg);
}
.fd-ticket-detail {
  display: grid;
  gap: 10px;
  padding: 12px 12px 12px 56px;
  border-top: 1px solid var(--ds-border-faint);
}
.fd-conversation {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.fd-message {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 9px;
}
.fd-message:not(:last-child)::after {
  position: absolute;
  top: 29px;
  bottom: -10px;
  left: 13px;
  width: 1px;
  background: var(--ds-border-faint);
  content: '';
}
.fd-message-marker {
  z-index: 1;
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  flex: 0 0 27px;
  color: var(--theme-brand-text);
  font-size: 13px;
  background: var(--theme-brand-soft);
  border: 1px solid var(--theme-brand-border);
  border-radius: 50%;
}
.fd-message.is-official .fd-message-marker {
  color: var(--theme-success-text);
  background: var(--theme-success-soft);
  border-color: var(--theme-success-border);
}
.fd-message-body {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--ds-border-faint);
  border-radius: 10px;
}
.fd-message.is-official .fd-message-body {
  background: linear-gradient(145deg, var(--theme-success-soft), var(--theme-surface-soft));
  border-color: var(--theme-success-border);
}
.fd-message-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--ds-text-tertiary);
  font-size: 10px;
}
.fd-message-heading strong {
  color: var(--ds-text-secondary);
  font-size: 10px;
  font-weight: 680;
}
.fd-message.is-official .fd-message-heading strong {
  color: var(--theme-success-text);
}
.fd-message-body > p,
.fd-awaiting-reply p {
  margin: 6px 0 0;
  color: var(--ds-text-primary);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.fd-awaiting-reply {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 11px;
  background: var(--theme-info-soft);
  border: 1px solid var(--theme-info-border);
  border-radius: 10px;
}
.fd-awaiting-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  flex: 0 0 30px;
  color: var(--theme-info-text);
  background: var(--theme-surface-raised);
  border: 1px solid var(--theme-info-border);
  border-radius: 9px;
}
.fd-awaiting-reply strong {
  color: var(--ds-text-secondary);
  font-size: 11px;
}
.fd-awaiting-reply p {
  margin-top: 3px;
  color: var(--ds-text-tertiary);
  font-size: 10px;
}
.fd-ticket-actions {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}
.fd-secondary-action {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  color: var(--ds-text-secondary);
  font-size: 10px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--ds-border-faint);
  border-radius: 8px;
  cursor: pointer;
}
.fd-secondary-action:hover {
  color: var(--theme-brand-text);
  background: var(--theme-brand-soft);
  border-color: var(--theme-brand-border);
}
.fd-supplement {
  padding: 11px;
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-brand-border);
  border-radius: 11px;
}
.fd-supplement > label {
  color: var(--ds-text-secondary);
  font-size: 11px;
  font-weight: 650;
}
.fd-supplement > p {
  margin: 3px 0 8px;
  color: var(--ds-text-tertiary);
  font-size: 10px;
  line-height: 1.45;
}
.fd-supplement :deep(textarea) {
  padding: 9px 10px;
  background: var(--theme-surface-raised);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--theme-border);
}
.fd-supplement :deep(textarea:focus) {
  box-shadow:
    inset 0 0 0 1px var(--theme-brand-accent),
    0 0 0 3px var(--theme-focus-ring);
}
.fd-supplement-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}
.fd-supplement-actions small {
  color: var(--ds-text-tertiary);
  font-size: 9px;
}
.fd-empty {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  padding: 24px;
  color: var(--ds-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.fd-empty-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  margin-bottom: 5px;
  color: var(--theme-brand);
  font-size: 19px;
  background: var(--theme-brand-soft);
  border: 1px solid var(--theme-brand-border);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 var(--theme-material-highlight);
}
.fd-empty-icon.is-loading .el-icon {
  animation: fd-spin 0.8s linear infinite;
}
.fd-empty strong {
  color: var(--ds-text-secondary);
  font-size: 12px;
}
.fd-empty small {
  color: var(--ds-text-tertiary);
  font-size: 10px;
  line-height: 1.45;
}
.fd-empty button {
  height: 30px;
  margin-top: 7px;
  padding: 0 10px;
  color: var(--theme-brand-text);
  font-size: 11px;
  background: var(--theme-brand-soft);
  border: 1px solid var(--theme-brand-border);
  border-radius: 8px;
  cursor: pointer;
}
.fd-empty.is-error {
  color: var(--theme-danger);
}
.fd-empty.is-error .fd-empty-icon {
  color: var(--theme-danger-text);
  background: var(--theme-danger-soft);
  border-color: var(--theme-danger-border);
}
.fd-compose,
.fd-inbox,
.fd-content :deep(textarea),
.fd-supplement :deep(textarea) {
  scrollbar-width: none;
}
.fd-compose::-webkit-scrollbar,
.fd-inbox::-webkit-scrollbar,
.fd-content :deep(textarea::-webkit-scrollbar),
.fd-supplement :deep(textarea::-webkit-scrollbar) {
  display: none;
}
.fd-tabs button:focus-visible,
.fd-types button:focus-visible,
.fd-github-link:focus-visible,
.fd-list-heading button:focus-visible,
.fd-ticket-summary:focus-visible,
.fd-secondary-action:focus-visible,
.fd-empty button:focus-visible {
  outline: 2px solid var(--theme-focus);
  outline-offset: 2px;
}
.spinning {
  animation: fd-spin 0.8s linear infinite;
}
.fd-view-enter-active,
.fd-view-leave-active {
  transition:
    opacity 170ms ease,
    transform 210ms var(--fd-ease-out);
}
.fd-view-enter-from {
  opacity: 0;
  transform: translateX(8px) scale(0.992);
}
.fd-view-leave-to {
  opacity: 0;
  transform: translateX(-6px) scale(0.995);
}
.fd-slide-enter-active,
.fd-slide-leave-active {
  transition:
    opacity 150ms ease,
    transform 180ms var(--fd-ease-out);
}
.fd-slide-enter-from,
.fd-slide-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.99);
}
@keyframes fd-dialog-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.975);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes fd-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 680px) {
  .fd-header {
    align-items: stretch;
    padding-right: 38px;
  }
  .fd-subtitle {
    display: none;
  }
  .fd-tabs button {
    min-width: 72px;
    padding: 0 8px;
  }
  .fd-compose-lead p {
    max-width: 90%;
  }
  .fd-types {
    grid-template-columns: repeat(2, 1fr);
  }
  .fd-ticket-list {
    padding: 12px;
  }
  .fd-ticket-detail {
    padding: 0 10px 10px;
  }
  .fd-ticket-state {
    padding: 0 6px;
  }
  .fd-ticket-state .el-icon {
    display: none;
  }
  .fd-compose-hint {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  :deep(.feedback-dialog),
  .fd-empty-icon.is-loading .el-icon,
  .spinning {
    animation: none;
  }
  .fd-view-enter-active,
  .fd-view-leave-active,
  .fd-slide-enter-active,
  .fd-slide-leave-active,
  .fd-tabs button,
  .fd-types button,
  .fd-ticket,
  .fd-ticket-summary,
  .fd-submit {
    transition-duration: 1ms;
  }
  .fd-view-enter-from,
  .fd-view-leave-to,
  .fd-slide-enter-from,
  .fd-slide-leave-to {
    transform: none;
  }
}
@media (prefers-reduced-transparency: reduce) {
  :deep(.feedback-dialog),
  .fd-list-heading {
    background: var(--theme-surface-overlay);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
@media (prefers-contrast: more) {
  :deep(.feedback-dialog),
  .fd-types button,
  .fd-content :deep(textarea),
  .fd-ticket,
  .fd-message-body,
  .fd-supplement {
    border-color: var(--theme-border-strong);
  }
}
</style>
