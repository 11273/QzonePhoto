<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :append-to-body="true"
    :lock-scroll="false"
    :modal-append-to-body="false"
    :before-close="handleDialogBeforeClose"
    :class="[
      'download-manager-dialog dark-theme',
      { 'is-empty-manager': !loading && !hasAnyTasks }
    ]"
    aria-label="下载管理"
  >
    <template #header="{ close }">
      <AppDialogHeader
        title="下载管理"
        :subtitle="managerSummary"
        close-label="关闭下载管理"
        @close="close"
      />
    </template>

    <!-- 顶部操作栏 -->
    <div class="header-actions" :class="{ 'is-empty-toolbar': !loading && !hasAnyTasks }">
      <div class="toolbar-row toolbar-primary">
        <div class="location-block">
          <div class="location-copy">
            <span class="location-label">保存位置</span>
            <span class="location-path" :title="downloadPath || '正在获取保存位置'">
              {{ compactDownloadPath }}
            </span>
          </div>
          <div class="location-actions">
            <AppActionButton ui-size="compact" @click="changeGlobalLocation">
              更改
            </AppActionButton>
            <AppActionButton
              ui-size="compact"
              icon-only
              title="打开下载文件夹"
              aria-label="打开下载文件夹"
              @click="openGlobalFolder"
            >
              <template #icon
                ><el-icon><Folder /></el-icon
              ></template>
            </AppActionButton>
            <el-popover
              v-model:visible="downloadSettingsVisible"
              placement="bottom-start"
              trigger="click"
              :width="520"
              popper-class="download-settings-popover"
              @after-enter="focusDownloadSettings"
              @after-leave="restoreDownloadSettingsFocus"
            >
              <template #reference>
                <AppActionButton
                  ref="downloadSettingsTriggerRef"
                  ui-size="compact"
                  title="调整后续下载任务设置"
                >
                  <template #icon
                    ><el-icon><Setting /></el-icon
                  ></template>
                  下载设置
                </AppActionButton>
              </template>

              <section
                ref="downloadSettingsPanelRef"
                class="download-settings-panel"
                aria-label="下载设置"
                @keydown.esc.capture.stop.prevent="closeDownloadSettingsWithFocus"
              >
                <header class="settings-panel-heading">
                  <strong>下载设置</strong>
                  <span>仅影响后续创建的任务</span>
                </header>
                <div class="settings-panel-grid">
                  <div class="settings-panel-item">
                    <div class="settings-panel-copy">
                      <label for="download-concurrency">并发任务</label>
                      <span>同时下载 1–10 个</span>
                    </div>
                    <AppNumberStepper
                      id="download-concurrency"
                      v-model="tempConcurrency"
                      :min="1"
                      :max="10"
                      size="small"
                      aria-label="并发任务"
                      class="settings-number-input"
                      @change="handleConcurrencyChange"
                    />
                  </div>

                  <div class="settings-panel-item">
                    <div class="settings-panel-copy">
                      <span class="settings-panel-label">同名文件</span>
                      <span>{{ replaceExisting ? '覆盖已有文件' : '跳过已有文件' }}</span>
                    </div>
                    <el-switch
                      v-model="replaceExisting"
                      size="small"
                      active-text=""
                      inactive-text=""
                      :aria-label="`同名文件处理：${replaceExisting ? '覆盖已有文件' : '跳过已有文件'}`"
                      @change="handleReplaceSettingChange"
                    />
                  </div>

                  <el-tooltip
                    content="将文案、发布者、QQ 号、发布时间和相册信息保存在下载的图片与视频中。"
                    placement="bottom"
                  >
                    <div class="settings-panel-item">
                      <div class="settings-panel-copy">
                        <span class="settings-panel-label">动态信息</span>
                        <span>{{ writeFeedDescription ? '写入媒体文件' : '不写入文件' }}</span>
                      </div>
                      <el-switch
                        v-model="writeFeedDescription"
                        size="small"
                        active-text=""
                        inactive-text=""
                        aria-label="保留动态信息"
                        @change="handleWriteFeedDescriptionChange"
                      />
                    </div>
                  </el-tooltip>

                  <el-tooltip
                    content="用于下载文件名、本地文件时间和 JPEG EXIF 日期。"
                    placement="bottom"
                  >
                    <div class="settings-panel-item">
                      <div class="settings-panel-copy">
                        <label class="settings-panel-label">文件时间</label>
                        <span>用于名称与 EXIF</span>
                      </div>
                      <el-select
                        v-model="downloadTimePreference"
                        size="small"
                        class="settings-time-select"
                        aria-label="选择下载文件使用的时间"
                        @change="handleTimePreferenceChange"
                      >
                        <el-option label="拍摄时间优先" value="shoot" />
                        <el-option label="使用上传时间" value="upload" />
                      </el-select>
                    </div>
                  </el-tooltip>
                </div>
              </section>
            </el-popover>
          </div>
        </div>

        <div v-if="hasAnyTasks" class="actions-right">
          <AppActionButton
            variant="primary"
            ui-size="compact"
            :disabled="!canStartAll"
            @click="startAll"
          >
            全部开始
          </AppActionButton>
          <AppActionButton ui-size="compact" :disabled="!canPauseAll" @click="pauseAll">
            暂停全部
          </AppActionButton>
          <el-popconfirm
            title="确定清空全部下载记录吗？不会删除已下载文件。"
            confirm-button-text="清空记录"
            cancel-button-text="取消"
            confirm-button-type="danger"
            width="250"
            placement="bottom"
            :disabled="clearingTasks"
            @confirm="clearAllTasks"
          >
            <template #reference>
              <AppActionButton
                variant="danger"
                ui-size="compact"
                :loading="clearingTasks"
                :disabled="clearingTasks || !hasAnyTasks"
              >
                {{ clearingTasks ? '清空中...' : '清空记录' }}
              </AppActionButton>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- 分栏布局 -->
    <div v-if="hasAnyTasks" class="layout-columns">
      <!-- 左侧进度和统计 - 优化布局 -->
      <div class="left-column optimized-layout">
        <!-- 总体进度区域 -->
        <div
          class="progress-card"
          data-material-light="subtle"
          role="status"
          aria-live="polite"
          :aria-label="`下载总体进度 ${overallProgress}%，已完成 ${completedTasks} 个，共 ${globalTotalTasks} 个任务`"
        >
          <div class="progress-top">
            <div class="progress-circle">
              <el-progress
                :percentage="overallProgress"
                type="circle"
                :width="50"
                :color="overallProgressColor"
              />
            </div>
            <div class="progress-percentage" :style="{ color: overallProgressColor }">
              {{ overallProgress }}%
            </div>
          </div>
          <div class="progress-bottom">
            <el-tooltip
              :content="`已完成 ${completedTasks} 个，共 ${globalTotalTasks} 个任务`"
              placement="top"
              :disabled="globalTotalTasks < 10000"
            >
              <span class="progress-numbers">
                {{ formatTaskCount(completedTasks) }}/{{ formatTaskCount(globalTotalTasks) }}
              </span>
            </el-tooltip>
            <span class="progress-label">完成</span>
          </div>
        </div>

        <!-- 下载速度区域 -->
        <div class="speed-card">
          <h5>下载速度</h5>
          <div class="speed-info">
            <div class="current-speed">{{ getCurrentSpeed() }}</div>
            <div class="speed-label">当前总速度</div>
          </div>
        </div>

        <!-- 状态统计区域 -->
        <div class="status-card">
          <h5>任务状态</h5>
          <div class="status-list">
            <div class="status-item">
              <span class="status-dot downloading"></span>
              <span class="status-info">
                <span class="status-name">下载中</span>
                <span class="status-count">{{ getTasksByStatus('downloading').length }}</span>
              </span>
            </div>
            <div class="status-item">
              <span class="status-dot completed"></span>
              <span class="status-info">
                <span class="status-name">已完成</span>
                <span class="status-count">{{ getTasksByStatus('completed').length }}</span>
              </span>
            </div>
            <div class="status-item">
              <span class="status-dot paused"></span>
              <span class="status-info">
                <span class="status-name">已暂停</span>
                <span class="status-count">{{ getTasksByStatus('paused').length }}</span>
              </span>
            </div>
            <div class="status-item">
              <span class="status-dot waiting"></span>
              <span class="status-info">
                <span class="status-name">等待中</span>
                <span class="status-count">{{ getTasksByStatus('waiting').length }}</span>
              </span>
            </div>
            <div class="status-item">
              <span class="status-dot error"></span>
              <span class="status-info">
                <span class="status-name">出错</span>
                <span class="status-count">{{ getTasksByStatus('error').length }}</span>
              </span>
            </div>
            <div class="status-item">
              <span class="status-dot cancelled"></span>
              <span class="status-info">
                <span class="status-name">已取消</span>
                <span class="status-count">{{ getTasksByStatus('cancelled').length }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧任务列表 -->
      <div class="right-column">
        <div v-if="loadError" class="task-load-error" role="alert">
          <span>{{ loadError }}</span>
          <AppActionButton ui-size="compact" @click="loadTasksPage">重新加载</AppActionButton>
        </div>
        <div class="task-header">
          <div class="task-heading">
            <h4>任务列表</h4>
            <el-popover
              v-if="recentBatches.length"
              placement="bottom-start"
              trigger="click"
              :width="300"
              popper-class="batch-summary-popover"
            >
              <template #reference>
                <button class="batch-summary-trigger" type="button" aria-label="查看最近下载批次">
                  <span>最近批次</span>
                  <strong>{{ recentBatches[0].matched }}</strong>
                </button>
              </template>
              <div class="batch-summary-list" aria-label="最近下载批次">
                <div v-for="batch in recentBatches" :key="batch.id" class="batch-summary-item">
                  <div class="batch-summary-main">
                    <span class="batch-summary-title">{{ batch.label }}</span>
                    <span class="batch-summary-date">{{ batch.date_label }}</span>
                  </div>
                  <div class="batch-summary-counts">
                    <span>匹配 {{ batch.matched }}</span>
                    <span v-if="batch.skipped">跳过 {{ batch.skipped }}</span>
                    <span v-if="batch.missing_time">缺少时间 {{ batch.missing_time }}</span>
                    <span :class="batch.auto_start ? 'is-auto' : 'is-queued'">
                      {{ batch.auto_start ? '自动开始' : '仅加入队列' }}
                    </span>
                  </div>
                </div>
              </div>
            </el-popover>
          </div>
          <!-- 状态筛选器 -->
          <div class="task-filter">
            <el-radio-group v-model="statusFilter" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="downloading">下载中</el-radio-button>
              <el-radio-button value="completed">已完成</el-radio-button>
              <el-radio-button value="paused">已暂停</el-radio-button>
              <el-radio-button value="waiting">等待中</el-radio-button>
              <el-radio-button value="error">出错</el-radio-button>
              <el-radio-button value="cancelled">已取消</el-radio-button>
            </el-radio-group>
          </div>
          <div class="task-list-meta">
            <el-select
              v-model="sortOrder"
              size="small"
              class="task-sort-select"
              aria-label="任务排序方式"
            >
              <el-option label="最新创建" :value="DOWNLOAD_TASK_SORT.CREATED_DESC" />
              <el-option label="最早创建" :value="DOWNLOAD_TASK_SORT.CREATED_ASC" />
              <el-option label="状态优先" :value="DOWNLOAD_TASK_SORT.STATUS_PRIORITY" />
            </el-select>
            <div class="pagination-info">
              {{ filteredTotalTasks === 0 ? 0 : (currentPage - 1) * pageSize + 1 }} -
              {{ Math.min(currentPage * pageSize, filteredTotalTasks) }} /
              {{ filteredTotalTasks }}
            </div>
          </div>
        </div>

        <!-- 进度条式任务布局 -->
        <div v-if="stableTasks.length > 0" class="task-detail-list progress-bar-layout">
          <el-scrollbar height="100%">
            <div
              v-for="task in stableTasks"
              :key="task._renderKey"
              class="progress-task optimized-task"
            >
              <div class="task-container">
                <!-- 左侧：缩略图 -->
                <div class="task-thumbnail">
                  <div
                    v-if="privacyStore.privacyMode && task.type !== 'contact-backup'"
                    class="privacy-overlay"
                  >
                    <el-icon class="privacy-icon"><Hide /></el-icon>
                  </div>
                  <div
                    v-if="task.type === 'contact-backup'"
                    class="thumbnail-placeholder backup-thumbnail"
                    :title="task.backup_category || '联系人'"
                  >
                    <component :is="getContactBackupIcon(task.backup_category)" :size="19" />
                  </div>
                  <el-image
                    v-else
                    :key="`img_${task.id}`"
                    :src="task.thumbnail_url"
                    fit="cover"
                    class="thumbnail-image"
                    loading="eager"
                    :hide-on-click-modal="true"
                  >
                    <template #error>
                      <div class="thumbnail-placeholder">
                        <el-icon><component :is="getTaskIcon(task.type)" /></el-icon>
                      </div>
                    </template>
                    <template #placeholder>
                      <div class="thumbnail-placeholder">
                        <el-icon class="loading-icon"><Loading /></el-icon>
                      </div>
                    </template>
                  </el-image>
                  <!-- 文件类型标识 -->
                  <div v-if="task.type === 'video'" class="type-badge">
                    <el-icon><VideoPlay /></el-icon>
                  </div>
                </div>

                <!-- 右侧：任务信息和进度 -->
                <div class="task-content">
                  <!-- 第一行：任务名称、状态、操作 -->
                  <div class="task-top-row">
                    <div class="task-basic">
                      <el-tooltip
                        :content="`${task.directory}/${task.name}`"
                        placement="top"
                        :show-after="500"
                        popper-class="custom-tooltip"
                      >
                        <div class="task-name">
                          {{
                            task.type === 'contact-backup'
                              ? task.backup_title || '联系人备份'
                              : formatTaskName(task.name)
                          }}
                        </div>
                      </el-tooltip>
                    </div>

                    <div class="task-right">
                      <div class="task-meta">
                        <span class="task-time">{{ formatSmartTime(task.create_time) }}</span>
                        <span class="task-status" :class="task.status">{{
                          getTaskStatusText(task.status, task.type)
                        }}</span>
                      </div>

                      <!-- 操作按钮 -->
                      <div class="task-actions">
                        <!-- 下载中：暂停 -->
                        <el-button
                          v-if="task.status === 'downloading' && task.type !== 'contact-backup'"
                          size="small"
                          text
                          title="暂停下载"
                          aria-label="暂停下载"
                          @click="pauseTask(task)"
                        >
                          <el-icon><VideoPause /></el-icon>
                        </el-button>

                        <!-- 已暂停：继续 -->
                        <el-button
                          v-else-if="task.status === 'paused' && task.type !== 'contact-backup'"
                          size="small"
                          text
                          title="继续下载"
                          aria-label="继续下载"
                          @click="resumeTask(task)"
                        >
                          <el-icon><VideoPlay /></el-icon>
                        </el-button>

                        <!-- 等待中：暂停任务 -->
                        <el-button
                          v-else-if="task.status === 'waiting' && task.type !== 'contact-backup'"
                          size="small"
                          text
                          title="暂停任务"
                          aria-label="暂停任务"
                          @click="pauseTask(task)"
                        >
                          <el-icon><VideoPause /></el-icon>
                        </el-button>

                        <!-- 出错：重试 -->
                        <el-button
                          v-else-if="task.status === 'error' && task.type === 'contact-backup'"
                          size="small"
                          text
                          :loading="isContactBackupRetrying(task.id)"
                          :disabled="isContactBackupRetrying(task.id)"
                          title="重新备份相同范围"
                          aria-label="重新备份相同范围"
                          @click="retryContactBackup(task)"
                        >
                          <el-icon><Refresh /></el-icon>
                        </el-button>
                        <el-button
                          v-else-if="task.status === 'error'"
                          size="small"
                          text
                          title="重试下载"
                          aria-label="重试下载"
                          @click="retryTask(task)"
                        >
                          <el-icon><Refresh /></el-icon>
                        </el-button>

                        <!-- 已取消：重新开始 -->
                        <el-button
                          v-else-if="task.status === 'cancelled' && task.type !== 'contact-backup'"
                          size="small"
                          text
                          title="重新开始"
                          aria-label="重新开始下载"
                          @click="retryTask(task)"
                        >
                          <el-icon><VideoPlay /></el-icon>
                        </el-button>

                        <!-- 已完成：打开备份位置 / 删除选项 -->
                        <template v-else-if="task.status === 'completed'">
                          <el-button
                            v-if="task.type === 'contact-backup'"
                            size="small"
                            text
                            title="查看备份总览"
                            aria-label="查看备份总览"
                            @click="openContactBackupOverview(task)"
                          >
                            <FileText :size="15" />
                          </el-button>
                          <el-button
                            v-if="task.type === 'contact-backup'"
                            size="small"
                            text
                            title="打开备份文件夹"
                            aria-label="打开备份文件夹"
                            @click="openTaskFolder(task)"
                          >
                            <el-icon><Folder /></el-icon>
                          </el-button>
                          <el-dropdown trigger="click">
                            <el-button size="small" text title="删除选项" aria-label="打开删除选项">
                              <el-icon><Delete /></el-icon>
                            </el-button>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item @click="handleDeleteConfirm(task, 'task')">
                                  仅删除任务
                                </el-dropdown-item>
                                <el-dropdown-item @click="handleDeleteConfirm(task, 'both')">
                                  删除任务和文件
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </template>
                      </div>
                    </div>
                  </div>

                  <!-- 第二行：进度条和详细信息 -->
                  <div class="task-bottom-row">
                    <!-- 进度百分比 -->
                    <div
                      class="progress-percent"
                      :style="{ color: getTaskProgressColor(task.status) }"
                    >
                      {{ task.stableProgress }}%
                    </div>

                    <!-- 进度条 -->
                    <div class="progress-bar-container">
                      <el-progress
                        :percentage="task.stableProgress"
                        :stroke-width="4"
                        :show-text="false"
                        :status="task.status === 'error' ? 'exception' : undefined"
                        :color="getTaskProgressColor(task.status)"
                      />
                    </div>

                    <!-- 详细信息 -->
                    <div class="task-details">
                      <span
                        v-if="task.type === 'contact-backup'"
                        class="backup-task-detail"
                        :role="task.status === 'error' ? 'alert' : 'status'"
                        aria-live="polite"
                      >
                        {{ task.backup_detail || '正在整理联系人数据' }}
                      </span>
                      <template v-else>
                        <span class="size-info"
                          >{{ formatFileSize(task.downloaded) }}/{{
                            formatFileSize(task.total)
                          }}</span
                        >
                        <span v-if="task.speed > 0" class="speed-info">{{
                          formatSpeed(task.speed)
                        }}</span>
                        <span v-if="task.status === 'downloading'" class="eta-info">{{
                          getEstimatedTime(task)
                        }}</span>
                        <span
                          v-if="task.batch_label"
                          class="batch-task-info"
                          :title="task.batch_label"
                        >
                          {{ task.batch_label }}
                        </span>
                        <span v-if="task.used_fallback" class="fallback-info">
                          {{ downloadQualityText(task.download_quality) }}
                        </span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
        <div v-else class="task-detail-list progress-bar-layout">
          <EmptyState
            :icon="Archive"
            :title="statusFilter === 'all' ? '暂无下载任务' : '当前筛选没有任务'"
            :description="
              statusFilter === 'all'
                ? '照片、视频和联系人备份任务都会出现在这里'
                : '可以切换其他状态，或清除当前筛选。'
            "
            size="medium"
          >
            <AppActionButton
              v-if="statusFilter !== 'all'"
              ui-size="compact"
              @click="statusFilter = 'all'"
            >
              查看全部任务
            </AppActionButton>
          </EmptyState>
        </div>

        <!-- 分页器 -->
        <div class="pagination-wrapper">
          <Pagination
            v-model:page="currentPage"
            v-model:limit="pageSize"
            :total="filteredTotalTasks"
            :background="true"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[5, 10, 15, 20, 30]"
          />
        </div>
      </div>
    </div>
    <div v-else class="download-empty-workspace" role="status" aria-live="polite">
      <EmptyState
        :icon="Archive"
        :title="loading ? '正在读取下载任务' : loadError ? '下载任务读取失败' : '还没有下载任务'"
        :description="
          loadError
            ? '没有清空已有数据，请重新加载任务列表。'
            : '开始下载后，任务和进度会显示在这里。'
        "
        :semantic-role="loadError ? 'alert' : 'status'"
        size="small"
      >
        <AppActionButton v-if="loadError" ui-size="compact" @click="loadTasksPage">
          重新加载
        </AppActionButton>
      </EmptyState>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Folder,
  VideoPlay,
  VideoPause,
  Refresh,
  Delete,
  Setting,
  Loading,
  Hide
} from '@element-plus/icons-vue'
import {
  Image as LucideImage,
  Archive,
  Clapperboard,
  ContactRound,
  FileText,
  HeartHandshake,
  Users,
  UsersRound
} from '@lucide/vue'
import Pagination from '@renderer/components/Pagination/index.vue'
import EmptyState from '@renderer/components/EmptyState/index.vue'
import AppActionButton from '@renderer/components/AppActionButton/index.vue'
import AppDialogHeader from '@renderer/components/AppDialogHeader/index.vue'
import AppNumberStepper from '@renderer/components/AppNumberStepper/index.vue'
import { usePrivacyStore } from '@renderer/store/privacy.store'
import { useFriendStore } from '@renderer/store/friend.store'
import { formatTaskCount, formatTaskName } from '@renderer/utils/formatters'
import { APP_NAME } from '@shared/const'
import { DOWNLOAD_TASK_SORT, normalizeDownloadTaskSort } from '@shared/download-task-sort'

const privacyStore = usePrivacyStore()
const friendStore = useFriendStore()

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const downloadSettingsVisible = ref(false)
const downloadSettingsTriggerRef = ref(null)
const downloadSettingsPanelRef = ref(null)
const shouldRestoreDownloadSettingsFocus = ref(false)

const focusableSelector =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const focusComponentRoot = (component) => {
  const root = component?.$el || component
  const focusTarget = root?.matches?.(focusableSelector)
    ? root
    : root?.querySelector?.(focusableSelector)
  focusTarget?.focus?.()
}

const focusDownloadSettings = async () => {
  await nextTick()
  downloadSettingsPanelRef.value?.querySelector(focusableSelector)?.focus()
}

const closeDownloadSettingsWithFocus = () => {
  shouldRestoreDownloadSettingsFocus.value = true
  downloadSettingsVisible.value = false
}

const restoreDownloadSettingsFocus = async () => {
  if (!shouldRestoreDownloadSettingsFocus.value || !visible.value) return
  shouldRestoreDownloadSettingsFocus.value = false
  await nextTick()
  focusComponentRoot(downloadSettingsTriggerRef.value)
}

const clearDownloadSettingsPopover = () => {
  shouldRestoreDownloadSettingsFocus.value = false
  downloadSettingsVisible.value = false
}

const handleDialogBeforeClose = async (done) => {
  clearDownloadSettingsPopover()
  await nextTick()
  done()
}

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const totalTasks = ref(0)
const totalPages = ref(0)

// 筛选相关
const statusFilter = ref('all')
const sortOrder = ref(
  normalizeDownloadTaskSort(localStorage.getItem('download-task-sort') || undefined)
)

// 下载路径和设置
const downloadPath = ref('')
const concurrency = ref(3)
const tempConcurrency = ref(3)
const replaceExisting = ref(false)
const writeFeedDescription = ref(true)
const downloadTimePreference = ref('shoot')

// 任务数据
const currentPageTasks = ref([]) // 当前页的任务
const activeDownloadTasks = ref([])
const recentBatches = ref([])
const taskStats = ref({
  total: 0,
  waiting: 0,
  downloading: 0,
  completed: 0,
  error: 0,
  paused: 0,
  cancelled: 0,
  active: 0
})

// 加载状态
const loading = ref(false)
const loadError = ref('')
const clearingTasks = ref(false)
const retryingContactBackupIds = ref(new Set())
let batchReloadTimer = null

// 初始化下载路径
const initDownloadPath = async () => {
  try {
    const savedPath = localStorage.getItem('download-path')
    if (savedPath) {
      downloadPath.value = savedPath
      return
    }
    const defaultPath = await window.QzoneAPI.download.getDefaultPath()
    if (defaultPath) {
      downloadPath.value = defaultPath
      localStorage.setItem('download-path', defaultPath)
    }
  } catch (error) {
    console.error('获取下载路径失败:', error)
    downloadPath.value = '/Users/用户名/Downloads/' + APP_NAME
  }
}

// 初始化并发数
const initConcurrency = async () => {
  try {
    const currentConcurrency = await window.QzoneAPI.download.getConcurrency()
    concurrency.value = currentConcurrency || 3
    tempConcurrency.value = currentConcurrency || 3
  } catch (error) {
    console.error('获取并发数失败:', error)
  }
}

// 初始化文件替换设置
const initReplaceExistingSetting = async () => {
  try {
    // 优先从后端API获取设置
    const backendSetting = await window.QzoneAPI.download.getReplaceExistingSetting()
    if (backendSetting !== null && backendSetting !== undefined) {
      replaceExisting.value = backendSetting
      // 同步到localStorage
      localStorage.setItem('download-replace-existing', JSON.stringify(backendSetting))
      return
    }

    // 如果后端没有设置，从localStorage获取本地保存的设置
    const savedSetting = localStorage.getItem('download-replace-existing')
    if (savedSetting !== null) {
      const localSetting = JSON.parse(savedSetting)
      replaceExisting.value = localSetting
      // 同步到后端
      await window.QzoneAPI.download.setReplaceExistingSetting(localSetting)
      return
    }

    // 默认设置为false（跳过）
    replaceExisting.value = false
    localStorage.setItem('download-replace-existing', JSON.stringify(false))
    await window.QzoneAPI.download.setReplaceExistingSetting(false)
  } catch (error) {
    console.error('获取文件替换设置失败:', error)
    // 降级到localStorage
    const savedSetting = localStorage.getItem('download-replace-existing')
    replaceExisting.value = savedSetting ? JSON.parse(savedSetting) : false
  }
}

const initWriteFeedDescriptionSetting = async () => {
  try {
    writeFeedDescription.value = Boolean(
      await window.QzoneAPI.download.getWriteFeedDescriptionSetting()
    )
  } catch (error) {
    console.error('获取动态信息设置失败:', error)
    writeFeedDescription.value = true
  }
}

const initTimePreference = async () => {
  try {
    downloadTimePreference.value = await window.QzoneAPI.download.getTimePreference()
  } catch (error) {
    console.error('获取文件时间设置失败:', error)
    downloadTimePreference.value = 'shoot'
  }
}

// 处理并发数变化
const handleConcurrencyChange = async (newConcurrency) => {
  try {
    const updatedConcurrency = await window.QzoneAPI.download.setConcurrency(newConcurrency)
    concurrency.value = updatedConcurrency
    tempConcurrency.value = updatedConcurrency
    ElMessage.success(`并发数已设置为 ${updatedConcurrency}`)
  } catch (error) {
    console.error('设置并发数失败:', error)
    ElMessage.error('设置并发数失败')
    tempConcurrency.value = concurrency.value
    initConcurrency()
  }
}

// 加载任务列表（分页）
const loadTasksPage = async () => {
  if (loading.value) return

  loading.value = true
  loadError.value = ''
  try {
    const result = await window.QzoneAPI.download.requestTasksPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value === 'all' ? null : statusFilter.value,
      sort: sortOrder.value
    })

    if (result && result.tasks) {
      currentPageTasks.value = result.tasks
      if (result.pagination) {
        totalTasks.value = result.pagination.total
        totalPages.value = result.pagination.totalPages
      }
    }
  } catch (error) {
    console.error('加载任务失败:', error)
    loadError.value = '下载任务加载失败，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}

// 加载统计信息
const loadStats = async () => {
  try {
    const stats = await window.QzoneAPI.download.getStats()
    taskStats.value = stats || {
      total: 0,
      waiting: 0,
      downloading: 0,
      completed: 0,
      error: 0,
      paused: 0,
      cancelled: 0,
      active: 0
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

const loadBatches = async () => {
  try {
    recentBatches.value = await window.QzoneAPI.download.getBatches(3)
  } catch (error) {
    console.error('加载下载批次失败:', error)
    recentBatches.value = []
  }
}

const scheduleBatchReload = () => {
  if (batchReloadTimer) clearTimeout(batchReloadTimer)
  batchReloadTimer = setTimeout(() => {
    batchReloadTimer = null
    loadBatches()
  }, 500)
}

// 设置事件监听器
const downloadListenerCleanups = []
const setupEventListeners = () => {
  cleanupEventListeners()
  downloadListenerCleanups.push(
    window.QzoneAPI.download.onStatsUpdate(handleStatsUpdate),
    window.QzoneAPI.download.onActiveTasksUpdate(handleActiveTasksUpdate),
    window.QzoneAPI.download.onTaskChanges(handleTaskChanges),
    window.QzoneAPI.download.onTasksPage(handleTasksPage)
  )
}

// 清理事件监听器
const cleanupEventListeners = () => {
  downloadListenerCleanups.splice(0).forEach((cleanup) => cleanup?.())
}

// 处理统计信息更新
const handleStatsUpdate = (...args) => {
  // 通过ipc-client传递时，数据在第一个参数中
  const stats = args[0]
  // console.debug('[DownloadManager] 收到统计信息更新:', stats)
  taskStats.value = stats || taskStats.value
  scheduleBatchReload()
}

// 处理活跃任务更新
const handleActiveTasksUpdate = (...args) => {
  // 通过ipc-client传递时，数据在第一个参数中
  const activeTasks = args[0]
  // console.debug('[DownloadManager] 收到活跃任务更新:', activeTasks?.length || 0, '个任务')

  if (!Array.isArray(activeTasks)) return

  activeDownloadTasks.value = activeTasks.filter((task) => task.status === 'downloading')

  // 调试信息：显示下载中任务的速度
  const downloadingTasks = activeTasks.filter((task) => task.status === 'downloading')
  if (downloadingTasks.length > 0) {
    // console.debug(
    //   '[DownloadManager] 下载中任务速度:',
    //   downloadingTasks.map((task) => ({
    //     name: task.name,
    //     speed: task.speed,
    //     progress: task.progress
    //   }))
    // )
  }

  // 更新当前页面中的活跃任务 - 只更新变化的字段
  let orderMayHaveChanged = false
  activeTasks.forEach((activeTask) => {
    const index = currentPageTasks.value.findIndex((task) => task.id === activeTask.id)
    if (index !== -1) {
      const currentTask = currentPageTasks.value[index]
      if (
        sortOrder.value === DOWNLOAD_TASK_SORT.STATUS_PRIORITY &&
        currentTask.status !== activeTask.status
      ) {
        orderMayHaveChanged = true
      }
      // 只更新可能变化的字段，避免触发图片重新加载
      const updatedTask = {
        ...currentTask,
        status: activeTask.status,
        progress: activeTask.progress,
        downloaded: activeTask.downloaded,
        total: activeTask.total,
        speed: activeTask.speed,
        error: activeTask.error,
        backup_detail: activeTask.backup_detail,
        output_path: activeTask.output_path,
        update_time: activeTask.update_time
      }
      currentPageTasks.value.splice(index, 1, updatedTask)
    }
  })

  if (orderMayHaveChanged) loadTasksPage()
}

// 处理任务变化
const handleTaskChanges = (...args) => {
  // 通过ipc-client传递时，数据在第一个参数中
  const changedTasks = args[0]
  // console.debug('[DownloadManager] 收到任务变化:', changedTasks?.length || 0, '个任务')
  if (!Array.isArray(changedTasks)) return

  let needReload = false

  changedTasks.forEach((changedTask) => {
    if (changedTask.deleted) {
      const index = currentPageTasks.value.findIndex((task) => task.id === changedTask.id)
      if (index !== -1) {
        currentPageTasks.value.splice(index, 1)
        needReload = true
      }
    } else {
      const index = currentPageTasks.value.findIndex((task) => task.id === changedTask.id)
      if (index !== -1) {
        if (
          sortOrder.value === DOWNLOAD_TASK_SORT.STATUS_PRIORITY &&
          currentPageTasks.value[index].status !== changedTask.status
        ) {
          needReload = true
        }
        currentPageTasks.value.splice(index, 1, { ...changedTask })
      } else {
        needReload = true // 新任务可能需要重新加载分页
      }
    }
  })

  // 如果有删除或新增任务，重新加载当前页
  if (needReload) {
    loadTasksPage()
  }
}

// 处理分页任务列表推送
const handleTasksPage = (...args) => {
  // 通过ipc-client传递时，数据在第一个参数中
  const pageData = args[0]
  // console.debug('[DownloadManager] 收到分页数据:', pageData)
  if (pageData && pageData.tasks) {
    currentPageTasks.value = pageData.tasks
    if (pageData.pagination) {
      totalTasks.value = pageData.pagination.total
      totalPages.value = pageData.pagination.totalPages
    }
  }
}

// 监听对话框打开
watch(visible, async (newVisible) => {
  if (newVisible) {
    await window.QzoneAPI.download.setManagerOpen(true)
    initDownloadPath()
    initConcurrency()
    initReplaceExistingSetting()
    initWriteFeedDescriptionSetting()
    initTimePreference()
    loadStats()
    loadTasksPage()
    loadBatches()
    setupEventListeners()
  } else {
    clearDownloadSettingsPopover()
    await window.QzoneAPI.download.setManagerOpen(false)
    cleanupEventListeners()
  }
})

// 翻页时直接加载；筛选、分页大小或排序变化时先回到第一页。
watch(currentPage, () => {
  loadTasksPage()
})

watch([pageSize, statusFilter, sortOrder], () => {
  localStorage.setItem('download-task-sort', sortOrder.value)
  if (currentPage.value !== 1) {
    currentPage.value = 1
    return
  }
  loadTasksPage()
})

// 组件挂载时初始化
onMounted(async () => {
  if (visible.value) {
    await window.QzoneAPI.download.setManagerOpen(true)
    initDownloadPath()
    initConcurrency()
    initReplaceExistingSetting()
    initWriteFeedDescriptionSetting()
    initTimePreference()
    loadStats()
    loadTasksPage()
    loadBatches()
    setupEventListeners()
  }
})

// 组件销毁时清理
onUnmounted(async () => {
  if (batchReloadTimer) clearTimeout(batchReloadTimer)
  await window.QzoneAPI.download.setManagerOpen(false)
  cleanupEventListeners()
})

// 计算属性
const completedTasks = computed(() => taskStats.value.completed || 0)
const globalTotalTasks = computed(() => taskStats.value.total || totalTasks.value || 0)
const hasAnyTasks = computed(() => globalTotalTasks.value > 0)
const canStartAll = computed(
  () =>
    (taskStats.value.waiting || 0) +
      (taskStats.value.paused || 0) +
      (taskStats.value.error || 0) +
      (taskStats.value.cancelled || 0) >
    0
)
const canPauseAll = computed(
  () => (taskStats.value.downloading || 0) + (taskStats.value.waiting || 0) > 0
)
const compactDownloadPath = computed(() => {
  if (!downloadPath.value) return '正在获取…'
  const normalized = downloadPath.value.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 2) return normalized
  return `…/${parts.slice(-2).join('/')}`
})
const managerSummary = computed(() => {
  if (globalTotalTasks.value === 0) return ''
  const activeCount = (taskStats.value.downloading || 0) + (taskStats.value.waiting || 0)
  if (activeCount > 0)
    return `${activeCount} 个进行中 · ${completedTasks.value}/${globalTotalTasks.value} 已完成`
  return `${completedTasks.value}/${globalTotalTasks.value} 已完成`
})
const overallProgress = computed(() => {
  const total = taskStats.value.total || 0
  if (total === 0) return 0
  return Math.round((completedTasks.value / total) * 100)
})
const overallProgressColor = computed(() => {
  if ((taskStats.value.error || 0) > 0) return 'var(--theme-danger)'
  if (globalTotalTasks.value > 0 && completedTasks.value === globalTotalTasks.value) {
    return 'var(--theme-success)'
  }
  if ((taskStats.value.downloading || 0) > 0) return 'var(--theme-info)'
  if ((taskStats.value.paused || 0) > 0) return 'var(--theme-warning)'
  return 'var(--theme-brand-accent)'
})

// 当前页任务列表（用于模板）

// 筛选后的任务总数（用于分页器）
const filteredTotalTasks = computed(() => totalTasks.value)

// 计算属性：稳定的任务列表（避免频繁重新渲染）
const stableTasks = computed(() => {
  return currentPageTasks.value.map((task) => ({
    ...task,
    // 添加稳定的key用于渲染优化 - 进度每10%变化一次key，减少渲染频率
    _renderKey: `${task.id}_${task.status}_${Math.floor(task.progress / 10) * 10}`,
    // 稳定的进度显示 - 避免小数位变化导致重新渲染
    stableProgress: Math.round(task.progress)
  }))
})

// 工具函数
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
  return formatFileSize(bytesPerSecond) + '/s'
}

const formatSmartTime = (date) => {
  if (!date) return ''
  const now = new Date()
  const targetDate = new Date(date)
  const timeStr = targetDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (
    targetDate.getDate() === now.getDate() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getFullYear() === now.getFullYear()
  ) {
    return timeStr
  }

  if (targetDate.getFullYear() === now.getFullYear()) {
    const monthDay = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`
    return `${monthDay} ${timeStr}`
  }

  const year = targetDate.getFullYear()
  const month = targetDate.getMonth() + 1
  const day = targetDate.getDate()
  return `${year}/${month}/${day} ${timeStr}`
}

const getTaskStatusText = (status, type = '') => {
  if (type === 'contact-backup') {
    const backupStatusMap = {
      waiting: '等待备份',
      downloading: '备份中',
      paused: '已暂停',
      completed: '已备份',
      error: '备份失败',
      cancelled: '已取消'
    }
    return backupStatusMap[status] || '未知'
  }
  const statusMap = {
    waiting: '等待中',
    downloading: '下载中',
    paused: '已暂停',
    completed: '已完成',
    error: '出错',
    cancelled: '已取消'
  }
  return statusMap[status] || '未知'
}

const getTaskProgressColor = (status) => {
  const colorMap = {
    downloading: 'var(--theme-info)',
    completed: 'var(--theme-success)',
    paused: 'var(--theme-warning)',
    waiting: 'var(--theme-text-muted)',
    error: 'var(--theme-danger)',
    cancelled: 'var(--theme-text-muted)'
  }
  return colorMap[status] || 'var(--theme-info)'
}

const downloadQualityText = (quality) => {
  if (quality === 'standard') return '已回退普通图'
  if (quality === 'preview') return '已回退预览图'
  return '已自动回退'
}

const getTaskIcon = (type) => {
  const iconMap = {
    image: LucideImage,
    zip: Archive,
    video: Clapperboard,
    document: FileText,
    'contact-backup': ContactRound
  }
  return iconMap[type] || FileText
}

const getContactBackupIcon = (category) => {
  if (category === '好友') return Users
  if (category === '群') return UsersRound
  if (category === '亲密度') return HeartHandshake
  return ContactRound
}

const getTasksByStatus = (status) => {
  if (taskStats.value && typeof taskStats.value[status] === 'number') {
    return { length: taskStats.value[status] }
  }
  return { length: 0 }
}

const getCurrentSpeed = () => {
  const totalSpeed = activeDownloadTasks.value.reduce((sum, task) => sum + (task.speed || 0), 0)
  return formatSpeed(totalSpeed)
}

const getEstimatedTime = (task) => {
  if (!task.speed || task.speed === 0) return '未知'
  const remaining = task.total - task.downloaded
  const seconds = Math.round(remaining / task.speed)
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`
  return `${Math.round(seconds / 3600)}小时`
}

// 任务操作方法
const pauseTask = async (task) => {
  try {
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1, {
        ...task,
        status: 'paused',
        speed: 0
      })
    }
    await window.QzoneAPI.download.pauseTask(task.id)
    ElMessage.success('任务已暂停')
  } catch (error) {
    console.error('暂停任务失败:', error)
    ElMessage.error('暂停任务失败')
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1, { ...task })
    }
  }
}

const resumeTask = async (task) => {
  try {
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1, {
        ...task,
        status: 'waiting',
        speed: 0
      })
    }
    await window.QzoneAPI.download.resumeTask(task.id)
    ElMessage.success('任务已继续')
  } catch (error) {
    console.error('继续任务失败:', error)
    ElMessage.error('继续任务失败')
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1, { ...task })
    }
  }
}

const retryTask = async (task) => {
  try {
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1, {
        ...task,
        status: 'waiting',
        speed: 0,
        progress: 0,
        downloaded: 0,
        error: null
      })
    }
    await window.QzoneAPI.download.retryTask(task.id)
    ElMessage.success('任务重试中')
  } catch (error) {
    console.error('重试任务失败:', error)
    ElMessage.error('重试任务失败')
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1, { ...task })
    }
  }
}

const isContactBackupRetrying = (taskId) => retryingContactBackupIds.value.has(taskId)

const retryContactBackup = async (task) => {
  if (isContactBackupRetrying(task.id)) return
  retryingContactBackupIds.value = new Set(retryingContactBackupIds.value).add(task.id)
  try {
    const result = await friendStore.startContactBackup(task.backup_scope || 'all')
    if (!result.success) {
      ElMessage.error(result.message)
      return
    }
    if (result.warningCount) {
      ElMessage.warning(`重新备份完成；${result.warningCount} 项暂时无法读取，其他可用内容已保存`)
    } else {
      ElMessage.success('重新备份完成，可打开新任务的保存位置')
    }
  } finally {
    const next = new Set(retryingContactBackupIds.value)
    next.delete(task.id)
    retryingContactBackupIds.value = next
    await loadStats()
    await loadTasksPage()
  }
}

const handleDeleteConfirm = async (task, command) => {
  try {
    let message = '确定要删除此任务吗？'
    if (command === 'both') {
      message = '确定要删除任务和文件吗？文件删除后无法恢复！'
    }

    await ElMessageBox.confirm(message, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: command === 'both' ? 'el-button--danger' : ''
    })

    const deleteFile = command === 'both'
    const index = currentPageTasks.value.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      currentPageTasks.value.splice(index, 1)
    }

    await window.QzoneAPI.download.deleteTask({ taskId: task.id, deleteFile })
    ElMessage.success(deleteFile ? '任务和文件已删除' : '任务已删除')

    // 重新加载当前页
    loadTasksPage()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除任务失败:', error)
      ElMessage.error('删除任务失败')
    }
  }
}

const clearAllTasks = async () => {
  clearingTasks.value = true
  try {
    await window.QzoneAPI.download.clearTasks()

    // 立即清空本地状态
    currentPageTasks.value = []
    taskStats.value = {
      total: 0,
      waiting: 0,
      downloading: 0,
      completed: 0,
      error: 0,
      paused: 0,
      cancelled: 0,
      active: 0
    }
    totalTasks.value = 0
    totalPages.value = 0
    currentPage.value = 1

    // 重新加载数据确保同步
    await loadStats()
    await loadTasksPage()

    ElMessage.success('下载记录已清空，已下载文件仍保留在本地')
  } catch (error) {
    console.error('清空下载记录失败:', error)
    ElMessage.error('清空下载记录失败')
  } finally {
    clearingTasks.value = false
  }
}

const pauseAll = async () => {
  try {
    await window.QzoneAPI.download.cancelAll()

    // 立即更新本地任务状态
    currentPageTasks.value = currentPageTasks.value.map((task) => {
      if (['waiting', 'downloading'].includes(task.status)) {
        return { ...task, status: 'paused', speed: 0 }
      }
      return task
    })

    // 重新加载统计信息
    await loadStats()

    ElMessage.success('所有任务已暂停')
  } catch (error) {
    console.error('暂停所有任务失败:', error)
    ElMessage.error('暂停所有任务失败')
  }
}

const openGlobalFolder = async () => {
  try {
    await window.QzoneAPI.download.openFolder()
  } catch (error) {
    console.error('打开文件夹失败:', error)
    ElMessage.error('打开文件夹失败')
  }
}

const openTaskFolder = async (task) => {
  const folderPath = task?.output_path || [task?.directory, task?.name].filter(Boolean).join('/')
  try {
    await window.QzoneAPI.download.openFolder(folderPath)
  } catch (error) {
    console.error('打开备份位置失败:', error)
    ElMessage.error('打开备份位置失败')
  }
}

const openContactBackupOverview = async (task) => {
  try {
    const result = await window.QzoneAPI.download.openContactBackupOverview(task.id)
    if (result?.error) {
      ElMessage.error(result.error)
    }
  } catch (error) {
    console.error('打开备份总览失败:', error)
    ElMessage.error('备份总览暂时无法打开')
  }
}

const changeGlobalLocation = async () => {
  try {
    const newPath = await window.QzoneAPI.download.selectDirectory()
    if (newPath) {
      downloadPath.value = newPath
      localStorage.setItem('download-path', newPath)
      await window.QzoneAPI.download.setDefaultPath(newPath)
      ElMessage.success('下载路径已更改')
    }
  } catch (error) {
    console.error('更改下载路径失败:', error)
    ElMessage.error('更改下载路径失败')
  }
}

const startAll = async () => {
  try {
    await window.QzoneAPI.download.resumeAll()

    // 立即更新本地任务状态 - 不重置进度，保持断点续传
    currentPageTasks.value = currentPageTasks.value.map((task) => {
      if (task.status === 'paused') {
        return { ...task, status: 'waiting', speed: 0 }
      }
      return task
    })

    // 重新加载统计信息
    await loadStats()

    ElMessage.success('已重新开始所有暂停的任务（已完成的任务不会重复下载）')
  } catch (error) {
    console.error('开始所有任务失败:', error)
    ElMessage.error('开始所有任务失败')
  }
}

// 获取当前文件替换设置
const getReplaceExistingSetting = () => {
  return replaceExisting.value
}

// 暴露给父组件使用
defineExpose({
  getReplaceExistingSetting
})

// 处理文件替换设置变化
const handleReplaceSettingChange = async (newValue) => {
  try {
    // 优先保存到后端
    const updatedValue = await window.QzoneAPI.download.setReplaceExistingSetting(newValue)

    // 同步到localStorage
    localStorage.setItem('download-replace-existing', JSON.stringify(updatedValue))

    replaceExisting.value = updatedValue
    ElMessage.success(`文件替换设置已更新：${updatedValue ? '会替换相同文件' : '会跳过相同文件'}`)
  } catch (error) {
    console.error('保存文件替换设置失败:', error)

    // 降级处理：仅保存到localStorage
    try {
      localStorage.setItem('download-replace-existing', JSON.stringify(newValue))
      replaceExisting.value = newValue
      ElMessage.warning('设置已保存到本地，但后端同步失败')
    } catch (localError) {
      console.error('本地保存也失败:', localError)
      ElMessage.error('保存设置失败')
      // 回滚设置
      replaceExisting.value = !newValue
    }
  }
}

const handleWriteFeedDescriptionChange = async (enabled) => {
  try {
    const updatedValue = await window.QzoneAPI.download.setWriteFeedDescriptionSetting(enabled)
    writeFeedDescription.value = updatedValue
    ElMessage.success(updatedValue ? '后续下载会保留动态信息' : '后续下载不再写入动态信息')
  } catch (error) {
    console.error('保存动态信息设置失败:', error)
    writeFeedDescription.value = !enabled
    ElMessage.error('保存动态信息设置失败')
  }
}

const handleTimePreferenceChange = async (preference) => {
  const previous = preference === 'upload' ? 'shoot' : 'upload'
  try {
    downloadTimePreference.value = await window.QzoneAPI.download.setTimePreference(preference)
    ElMessage.success(
      downloadTimePreference.value === 'upload'
        ? '后续下载将使用上传时间'
        : '后续下载将优先使用原始拍摄时间'
    )
  } catch (error) {
    console.error('保存文件时间设置失败:', error)
    downloadTimePreference.value = previous
    ElMessage.error('保存文件时间设置失败')
  }
}
</script>
<style lang="scss">
.custom-tooltip {
  max-width: 600px !important;
  word-break: break-all;
}

.batch-summary-popover.el-popper {
  padding: 8px;
  border-color: var(--theme-border);
  background: var(--theme-surface-overlay);
  box-shadow: var(--theme-shadow-lg);
}

.download-settings-popover.el-popper {
  padding: 12px;
  border-color: var(--theme-border);
  background: var(--theme-surface-overlay);
  box-shadow: var(--theme-shadow-lg);
}

.download-settings-panel {
  display: grid;
  gap: 10px;
}

.settings-panel-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--theme-text-primary);
  font-size: 13px;
}

.settings-panel-heading span,
.settings-panel-copy span {
  color: var(--theme-text-muted);
  font-size: 11px;
}

.settings-panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.settings-panel-item {
  display: flex;
  min-width: 0;
  min-height: 54px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--theme-border-subtle);
  border-radius: var(--theme-radius-sm);
  background: var(--theme-surface-soft);
}

.settings-panel-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.settings-panel-copy label,
.settings-panel-label {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.settings-number-input {
  width: 84px;
  flex: 0 0 84px;
}

.settings-time-select {
  width: 132px;
  flex: 0 0 132px;
}
</style>

<style lang="scss" scoped>
.header-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 18px 8px;
  padding: 8px 0 10px;
  border-bottom: 1px solid var(--theme-border-subtle);

  .toolbar-row {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .toolbar-primary {
    justify-content: space-between;
    gap: 16px;
  }

  .location-block {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    align-items: center;
    gap: 12px;
  }

  .location-copy {
    display: grid;
    flex: 1 1 auto;
    min-width: 0;
    gap: 1px;
  }

  .location-label,
  .setting-label {
    color: var(--theme-text-secondary);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
  }

  .location-path {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-muted);
    font-size: 11px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .location-actions,
  .actions-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-preferences {
    display: grid;
    min-width: 0;
    gap: 7px;
  }

  .preferences-heading {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding-inline: 2px;
    color: var(--theme-text-secondary);
    font-size: 12px;
    font-weight: 600;

    small {
      color: var(--theme-text-subtle);
      font-size: 11px;
      font-weight: 400;
    }
  }

  .preferences-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    border: 1px solid var(--theme-border-subtle);
    border-radius: var(--theme-radius-md);
    background: var(--theme-border-subtle);
  }

  .setting-group {
    display: flex;
    min-width: 0;
    min-height: 52px;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    background: var(--theme-surface-soft);
  }

  .setting-copy {
    display: grid;
    min-width: 0;
    gap: 1px;
  }

  .setting-hint {
    overflow: hidden;
    color: var(--theme-text-subtle);
    font-size: 10px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .time-preference-select {
    width: 136px;
    min-width: 136px;
    flex: 0 0 136px;

    :deep(.el-select__selected-item) {
      overflow: visible;
      text-overflow: clip;
    }
  }

  :deep(.el-switch) {
    flex: 0 0 auto;

    .el-switch__core {
      border: 1px solid var(--theme-border);
      background-color: var(--theme-surface-active);

      &:hover {
        background-color: var(--theme-surface-hover);
      }

      .el-switch__action {
        background-color: var(--theme-text-primary);
      }
    }

    &.is-checked .el-switch__core {
      border-color: var(--theme-brand-hover);
      background-color: var(--theme-brand);
    }
  }

  .actions-right {
    flex: 0 0 auto;
    :deep(.el-button) {
      background: var(--theme-surface-soft);
      border-color: var(--theme-border);
      color: var(--theme-text-secondary);

      &:hover {
        background: var(--theme-surface-hover);
        border-color: var(--theme-border-strong);
        color: var(--theme-text-primary);
      }

      &.el-button--primary {
        background: var(--theme-brand);
        border-color: var(--theme-brand);
        color: var(--theme-text-inverse);

        &:hover {
          background: var(--theme-brand-hover);
          border-color: var(--theme-brand-accent);
        }
      }

      &.el-button--danger {
        background: var(--theme-danger-soft);
        border-color: var(--theme-danger-border);
        color: var(--theme-danger-text);

        &:hover {
          background: color-mix(in srgb, var(--theme-danger-soft) 70%, var(--theme-danger) 30%);
          border-color: var(--theme-danger);
        }
      }
    }
  }

  @media (max-width: 1000px) {
    .toolbar-primary {
      flex-wrap: wrap;
    }

    .preferences-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .actions-right {
      margin-left: auto;
    }
  }

  @media (max-width: 760px) {
    .toolbar-primary {
      align-items: stretch;
      flex-direction: column;
    }

    .location-block {
      width: 100%;
    }

    .actions-right {
      width: 100%;
      margin-left: 0;
      flex-wrap: wrap;
    }
  }
}

.header-actions.is-empty-toolbar {
  gap: 14px;
  margin-bottom: 0;
  padding-bottom: 12px;

  .preferences-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .header-actions {
    margin-inline: 14px;

    .location-block {
      align-items: flex-end;
    }

    .preferences-grid {
      grid-template-columns: 1fr;
    }

    .setting-group {
      min-height: 48px;
    }
  }
}

.download-empty-workspace {
  display: grid;
  flex: 1 1 auto;
  min-height: 0;
  place-items: center;
  padding: 0 24px 18px;

  :deep(.empty-state) {
    max-width: 360px;
    padding-block: 10px;
  }

  :deep(.empty-icon) {
    margin-bottom: 8px;
  }

  :deep(.empty-title) {
    margin-bottom: 4px;
    font-size: 14px;
  }

  :deep(.empty-description) {
    margin-bottom: 0;
    font-size: 12px;
  }
}

.layout-columns {
  display: flex;
  gap: 20px;
  height: 420px;

  /* 1024px 以下：双列改单列，左列横铺 */
  @media (max-width: 1024px) {
    flex-direction: column;
    height: auto;
    max-height: 80vh;
    gap: 12px;

    .left-column {
      width: 100% !important;
      max-height: 180px;
      display: flex;
      gap: 8px;
      overflow-x: auto;

      > * {
        flex: 1;
        min-width: 140px;
      }
    }

    .right-column {
      flex: 1;
      min-height: 280px;
    }
  }

  /* 480px 以下：左列堆叠 */
  @media (max-width: 480px) {
    .left-column {
      flex-direction: column;
      max-height: none;

      > * {
        width: 100%;
      }
    }
  }

  .left-column {
    width: 170px;
    flex-shrink: 0;
    padding: 8px 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 8px;

    &.optimized-layout {
      .progress-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        background: var(--theme-surface-soft);
        border-radius: 8px;
        border: 1px solid var(--theme-border-subtle);
        margin-bottom: 0;
        flex: 1 1 0;
        min-height: 0;
        justify-content: center;
        text-align: center;

        .progress-top {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;

          .progress-circle {
            flex-shrink: 0;
          }

          .progress-percentage {
            font-size: 18px;
            font-weight: 700;
            color: var(--theme-brand-accent);
            line-height: 1;
          }
        }

        .progress-bottom {
          display: flex;
          align-items: center;
          justify-content: center;

          .progress-numbers {
            font-size: 10px;
            padding: 2px 6px;
            line-height: 1;
            white-space: nowrap;
          }

          .progress-label {
            font-size: 10px;
            color: var(--theme-text-secondary);
            line-height: 1;
          }
        }
      }

      .speed-card {
        padding: 8px 10px;
        background: var(--theme-surface-soft);
        border-radius: 6px;
        border: 1px solid var(--theme-border-subtle);
        margin-bottom: 0;
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;

        h5 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: var(--theme-text-primary);
          font-weight: 600;
        }

        .speed-info {
          .current-speed {
            font-size: 16px;
            font-weight: 700;
            color: var(--theme-text-primary);
            line-height: 1;
            margin-bottom: 4px;
          }

          .speed-label {
            font-size: 10px;
            color: var(--theme-text-muted);
            line-height: 1;
          }
        }
      }

      .status-card {
        padding: 8px 10px;
        background: var(--theme-surface-soft);
        border-radius: 6px;
        border: 1px solid var(--theme-border-subtle);
        flex: 1.6 1 0; // 有 6 行内容，份额更大
        min-height: 0;
        display: flex;
        flex-direction: column;

        h5 {
          flex-shrink: 0;
          margin: 0 0 6px 0;
          font-size: 12px;
          color: var(--theme-text-primary);
          font-weight: 600;
        }

        .status-list {
          .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 2px 0;
            font-size: 11px;

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;

              &.downloading {
                background: var(--theme-info);
              }
              &.completed {
                background: var(--theme-success);
              }
              &.paused {
                background: var(--theme-warning);
              }
              &.waiting {
                background: var(--theme-text-muted);
              }
              &.error {
                background: var(--theme-danger);
              }
              &.cancelled {
                background: var(--theme-text-muted);
              }
            }

            .status-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex: 1;

              .status-name {
                color: var(--theme-text-secondary);
              }

              .status-count {
                color: var(--theme-text-primary);
                font-weight: 600;
              }
            }
          }
        }
      }
    }
  }

  .right-column {
    flex: 1;
    display: flex;
    flex-direction: column;

    .task-load-error {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 38px;
      margin: 0 5px 10px;
      padding: 5px 6px 5px 10px;
      border: 1px solid var(--theme-danger-border);
      border-radius: var(--theme-radius-sm);
      color: var(--theme-danger-text);
      background: var(--theme-danger-soft);
      font-size: 11px;
    }

    .task-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      margin-bottom: 10px;
      padding: 0 5px;
      gap: 10px;

      h4 {
        margin: 0;
        font-size: 14px;
        color: var(--theme-text-primary);
      }

      .task-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: max-content;
      }

      .batch-summary-trigger {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 26px;
        padding: 0 8px;
        border: 1px solid var(--theme-border-subtle);
        border-radius: var(--theme-radius-pill);
        color: var(--theme-text-muted);
        background: var(--theme-surface-soft);
        font: inherit;
        font-size: 10px;
        cursor: pointer;
        transition:
          color var(--theme-duration-fast) var(--theme-ease),
          border-color var(--theme-duration-fast) var(--theme-ease),
          background-color var(--theme-duration-fast) var(--theme-ease);

        strong {
          min-width: 18px;
          padding-inline: 4px;
          border-radius: var(--theme-radius-pill);
          color: var(--theme-brand-text);
          background: var(--theme-brand-soft);
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          line-height: 18px;
          text-align: center;
        }

        &:hover {
          color: var(--theme-text-primary);
          border-color: var(--theme-brand-border);
          background: var(--theme-surface-hover);
        }

        &:focus-visible {
          outline: 2px solid var(--theme-focus);
          outline-offset: 2px;
        }
      }

      .task-filter {
        display: flex;
        min-width: 0;
        width: 100%;

        :deep(.el-radio-group) {
          display: flex;
          width: 100%;

          .el-radio-button {
            flex: 1 1 0;

            .el-radio-button__inner {
              width: 100%;
              background: var(--theme-surface-soft);
              border-color: var(--theme-border);
              color: var(--theme-text-secondary);
              padding: 4px 8px;
              font-size: 11px;
              min-width: auto;

              &:hover {
                background: var(--theme-surface-hover);
                border-color: var(--theme-border-strong);
                color: var(--theme-text-primary);
              }
            }

            &.is-active .el-radio-button__inner {
              background: var(--theme-brand);
              border-color: var(--theme-brand);
              color: var(--theme-text-inverse);
            }
          }
        }
      }

      .pagination-info {
        font-size: 12px;
        color: var(--theme-text-muted);
        min-width: 88px;
        text-align: right;
      }

      .task-list-meta {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;

        .task-sort-select {
          width: 104px;

          :deep(.el-select__wrapper) {
            min-height: 28px;
            background: var(--theme-surface-soft);
            box-shadow: 0 0 0 1px var(--theme-border) inset;
          }

          :deep(.el-select__selected-item) {
            color: var(--theme-text-primary);
            font-size: 12px;
          }
        }
      }

      @media (max-width: 768px) {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;

        .task-filter {
          justify-content: flex-start;
          overflow-x: auto;

          :deep(.el-radio-group) {
            .el-radio-button .el-radio-button__inner {
              font-size: 10px;
              padding: 3px 6px;
            }
          }
        }

        .task-list-meta {
          justify-content: space-between;
        }
      }
    }

    .task-detail-list {
      flex: 1;
      height: 0; // 强制flex子项占用剩余高度

      // 为滚动条预留空间
      :deep(.el-scrollbar__wrap) {
        padding-right: 10px; // 为滚动条预留空间
      }

      // 进度条式布局
      &.progress-bar-layout {
        .progress-task {
          background: var(--theme-surface-soft);
          border: 1px solid var(--theme-border-subtle);
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 6px;
          transition: all 0.2s ease;

          &:hover {
            background: var(--theme-surface-hover);
            border-color: var(--theme-border);
          }

          &.optimized-task {
            .task-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 8px;

              .task-thumbnail {
                width: 40px;
                height: 40px;
                border-radius: 4px;
                overflow: hidden;
                position: relative;
                background: var(--theme-surface-hover);

                .privacy-overlay {
                  position: absolute;
                  inset: 0;
                  z-index: 3;
                  background: var(--theme-privacy-backdrop);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  backdrop-filter: blur(2px);
                  pointer-events: none;
                  border-radius: inherit; /* 跟随父 .task-thumbnail 圆角 */

                  .privacy-icon {
                    font-size: 16px;
                    color: var(--theme-privacy-icon);
                  }
                }

                .thumbnail-image {
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                }

                .thumbnail-placeholder {
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: var(--theme-surface-hover);
                  color: var(--theme-text-muted);
                  font-size: 16px;

                  .loading-icon {
                    animation: spin 1s linear infinite;
                  }

                  &.backup-thumbnail {
                    border: 1px solid var(--theme-info-border);
                    color: var(--theme-info-text);
                    background: var(--theme-info-soft);
                  }
                }

                .type-badge {
                  position: absolute;
                  top: 2px;
                  right: 2px;
                  background: var(--theme-backdrop);
                  border-radius: 2px;
                  padding: 1px 2px;
                  font-size: 10px;
                  color: var(--theme-text-inverse);
                  display: flex;
                  align-items: center;
                  justify-content: center;

                  .el-icon {
                    font-size: 8px;
                  }
                }
              }

              // 响应式调整
              @media (max-width: 1200px) {
                .task-content {
                  .task-top-row {
                    .task-basic {
                      max-width: 250px;
                    }
                  }
                }
              }

              @media (max-width: 992px) {
                .task-content {
                  .task-top-row {
                    .task-basic {
                      max-width: 200px;
                    }
                  }
                }
              }

              .task-content {
                flex: 1;
                min-width: 0;

                .task-top-row {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 8px;

                  .task-basic {
                    flex: 1;
                    min-width: 0;
                    max-width: 300px; // 设置最大宽度，防止过度占用空间

                    .task-name {
                      color: var(--theme-text-inverse);
                      font-size: 12px;
                      font-weight: 500;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      flex: 1;
                      min-width: 0;
                      width: 100%;

                      // 确保自定义的省略文本也能正常显示
                      display: block;
                      line-height: 1.4;
                    }
                  }

                  .task-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;

                    .task-meta {
                      display: flex;
                      align-items: center;
                      gap: 6px;
                      font-size: 9px;
                      color: var(--theme-text-muted);
                      flex-shrink: 0;
                      min-width: 0;

                      .task-time {
                        white-space: nowrap;
                      }

                      .task-status {
                        padding: 1px 3px;
                        border-radius: 2px;
                        flex-shrink: 0;

                        &.downloading {
                          background: var(--theme-info-soft);
                          color: var(--theme-info);
                        }
                        &.completed {
                          background: var(--theme-success-soft);
                          color: var(--theme-success);
                        }
                        &.paused {
                          background: var(--theme-warning-soft);
                          color: var(--theme-warning);
                        }
                        &.waiting {
                          background: var(--theme-surface-active);
                          color: var(--theme-text-muted);
                        }
                        &.error {
                          background: var(--theme-danger-soft);
                          color: var(--theme-danger);
                        }
                        &.cancelled {
                          background: var(--theme-surface-active);
                          color: var(--theme-text-muted);
                        }
                      }
                    }

                    .task-actions {
                      display: flex;
                      gap: 2px;
                      flex-shrink: 0;

                      :deep(.el-button) {
                        padding: 2px 4px;
                        font-size: 12px;
                        min-height: auto;
                      }
                    }
                  }
                }

                .task-bottom-row {
                  display: flex;
                  align-items: center;
                  gap: 8px;

                  .progress-percent {
                    font-size: 11px;
                    color: var(--theme-info);
                    font-weight: 600;
                    text-align: right;
                    flex-shrink: 0;
                  }

                  .progress-bar-container {
                    flex: 1;
                    min-width: 120px;
                    max-width: 200px;

                    // Element Plus Progress 样式重写
                    :deep(.el-progress) {
                      .el-progress-bar {
                        padding-right: 0;

                        .el-progress-bar__outer {
                          background-color: var(--theme-surface-disabled);
                          border-radius: 2px;
                        }

                        .el-progress-bar__inner {
                          border-radius: 2px;
                        }
                      }
                    }
                  }

                  .task-details {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 9px;
                    flex-shrink: 0;
                    min-width: 0;

                    .size-info {
                      color: var(--theme-text-muted);
                      white-space: nowrap;
                    }

                    .speed-info {
                      color: var(--theme-info-text);
                      white-space: nowrap;
                    }

                    .eta-info {
                      color: var(--theme-warning);
                      white-space: nowrap;
                    }

                    .backup-task-detail {
                      max-width: 180px;
                      overflow: hidden;
                      color: var(--theme-info-text);
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  .pagination-wrapper {
    margin-top: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

.batch-summary-list {
  display: grid;
  gap: 6px;
}

.batch-summary-item {
  padding: 8px 10px;
  border: 1px solid var(--theme-border-subtle);
  border-radius: 8px;
  background: var(--theme-surface-soft);
}

.batch-summary-main,
.batch-summary-counts {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.batch-summary-main {
  justify-content: space-between;
  margin-bottom: 5px;
}

.batch-summary-title {
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.batch-summary-date,
.batch-summary-counts {
  color: var(--theme-text-muted);
  font-size: 9px;
  white-space: nowrap;
}

.batch-summary-counts {
  flex-wrap: wrap;
}

.batch-summary-counts .is-auto {
  color: var(--theme-success-text);
}

.batch-summary-counts .is-queued {
  color: var(--theme-warning);
}

.batch-task-info {
  max-width: 110px;
  overflow: hidden;
  color: var(--theme-info-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fallback-info {
  color: var(--theme-warning);
  white-space: nowrap;
}

/*
 * 窄窗口把统计区变成一条真正的摘要栏。这里必须放在基础卡片规则之后，
 * 否则基础列布局会覆盖断点规则，导致三张统计卡被压成细线并互相重叠。
 */
@media (max-width: 1024px) {
  .layout-columns {
    display: grid;
    grid-template-rows: 96px minmax(220px, 1fr);
    gap: 10px;
    width: 100%;
    height: min(420px, calc(100vh - 264px));
    max-height: none;
  }

  .layout-columns .left-column.optimized-layout {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(150px, 0.8fr) minmax(310px, 1.65fr);
    gap: 8px;
    width: 100% !important;
    height: 96px;
    max-height: none;
    padding: 0;
    overflow: visible;
  }

  .layout-columns .left-column.optimized-layout > * {
    min-width: 0;
    min-height: 0;
  }

  .layout-columns .left-column.optimized-layout .progress-card,
  .layout-columns .left-column.optimized-layout .speed-card,
  .layout-columns .left-column.optimized-layout .status-card {
    margin: 0;
    padding: 8px 12px;
  }

  .layout-columns .left-column.optimized-layout .status-card .status-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(72px, 1fr));
    column-gap: 12px;
  }

  .layout-columns .right-column {
    min-height: 0;
    overflow: hidden;
  }
}

@media (max-width: 720px) {
  .layout-columns {
    grid-template-rows: auto minmax(200px, 1fr);
    height: min(460px, calc(100vh - 320px));
  }

  .layout-columns .left-column.optimized-layout {
    grid-template-columns: 1fr 1fr;
    height: auto;
  }

  .layout-columns .left-column.optimized-layout .status-card {
    grid-column: 1 / -1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
