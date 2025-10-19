<template>
  <el-dialog
    v-model="visible"
    title="下载管理器"
    width="750px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :append-to-body="true"
    :lock-scroll="false"
    :modal-append-to-body="false"
    class="download-manager-dialog dark-theme"
  >
    <!-- 顶部操作栏 -->
    <div class="header-actions">
      <div class="actions-left">
        <el-tooltip :content="`当前保存位置：${downloadPath}`" placement="bottom">
          <el-button size="small" @click="changeGlobalLocation">更改位置</el-button>
        </el-tooltip>
        <el-button size="small" title="打开下载文件夹" @click="openGlobalFolder">
          <el-icon><Folder /></el-icon>
        </el-button>

        <!-- 并发数设置 -->
        <div class="setting-group">
          <label class="setting-label">并发数</label>
          <div class="setting-control">
            <el-input-number
              v-model="tempConcurrency"
              :min="1"
              :max="10"
              size="small"
              controls-position="right"
              class="concurrency-input"
              @change="handleConcurrencyChange"
            />
            <span class="setting-hint">建议1-10个</span>
          </div>
        </div>

        <!-- 文件替换设置 -->
        <div class="setting-group compact">
          <div class="setting-control">
            <el-switch
              v-model="replaceExisting"
              size="small"
              active-text=""
              inactive-text=""
              active-color="#409EFF"
              inactive-color="#DCDFE6"
              @change="handleReplaceSettingChange"
            />
            <span class="setting-hint compact">{{
              replaceExisting ? '替换相同文件' : '跳过相同文件'
            }}</span>
          </div>
        </div>
      </div>

      <div class="actions-right">
        <!-- 中间：主要操作 -->
        <el-button size="small" type="success" @click="startAll">全部开始</el-button>
        <el-button size="small" type="warning" @click="pauseAll">暂停全部</el-button>
        <!-- 清空列表按钮 -->
        <el-popconfirm
          title="确定要清空所有任务吗？此操作不可恢复！"
          confirm-button-text="确定清空"
          cancel-button-text="取消"
          confirm-button-type="danger"
          width="250"
          placement="bottom"
          :disabled="clearingTasks"
          @confirm="clearAllTasks"
        >
          <template #reference>
            <el-button
              size="small"
              type="danger"
              :loading="clearingTasks"
              :disabled="clearingTasks"
            >
              {{ clearingTasks ? '清空中...' : '清空列表' }}
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <!-- 分栏布局 -->
    <div class="layout-columns">
      <!-- 左侧进度和统计 - 优化布局 -->
      <div class="left-column optimized-layout">
        <!-- 总体进度区域 -->
        <div class="progress-card">
          <div class="progress-top">
            <div class="progress-circle">
              <el-progress :percentage="overallProgress" type="circle" :width="50" />
            </div>
            <div class="progress-percentage">{{ overallProgress }}%</div>
          </div>
          <div class="progress-bottom">
            <el-tooltip
              :content="`已完成 ${completedTasks} 个，共 ${totalTasks} 个任务`"
              placement="top"
              :disabled="totalTasks < 10000"
            >
              <span class="progress-numbers">
                {{ formatTaskCount(completedTasks) }}/{{ formatTaskCount(totalTasks) }}
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
        <div class="task-header">
          <h4>任务列表</h4>
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
          <div class="pagination-info">
            {{ (currentPage - 1) * pageSize + 1 }} -
            {{ Math.min(currentPage * pageSize, filteredTotalTasks) }} / {{ filteredTotalTasks }}
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
                  <el-image
                    :key="`img_${task.id}`"
                    :src="task.thumbnail_url"
                    fit="cover"
                    class="thumbnail-image"
                    loading="eager"
                    :hide-on-click-modal="true"
                  >
                    <template #error>
                      <div class="thumbnail-placeholder">
                        <el-icon>{{ getTaskIcon(task.type) }}</el-icon>
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
                        <div class="task-name">{{ formatTaskName(task.name) }}</div>
                      </el-tooltip>
                    </div>

                    <div class="task-right">
                      <div class="task-meta">
                        <span class="task-time">{{ formatSmartTime(task.create_time) }}</span>
                        <span class="task-status" :class="task.status">{{
                          getTaskStatusText(task.status)
                        }}</span>
                      </div>

                      <!-- 操作按钮 -->
                      <div class="task-actions">
                        <!-- 下载中：暂停 -->
                        <el-button
                          v-if="task.status === 'downloading'"
                          size="small"
                          text
                          title="暂停下载"
                          @click="pauseTask(task)"
                        >
                          <el-icon><VideoPause /></el-icon>
                        </el-button>

                        <!-- 已暂停：继续 -->
                        <el-button
                          v-else-if="task.status === 'paused'"
                          size="small"
                          text
                          title="继续下载"
                          @click="resumeTask(task)"
                        >
                          <el-icon><VideoPlay /></el-icon>
                        </el-button>

                        <!-- 等待中：暂停任务 -->
                        <el-button
                          v-else-if="task.status === 'waiting'"
                          size="small"
                          text
                          title="暂停任务"
                          @click="pauseTask(task)"
                        >
                          <el-icon><VideoPause /></el-icon>
                        </el-button>

                        <!-- 出错：重试 -->
                        <el-button
                          v-else-if="task.status === 'error'"
                          size="small"
                          text
                          title="重试下载"
                          @click="retryTask(task)"
                        >
                          <el-icon><Refresh /></el-icon>
                        </el-button>

                        <!-- 已取消：重新开始 -->
                        <el-button
                          v-else-if="task.status === 'cancelled'"
                          size="small"
                          text
                          title="重新开始"
                          @click="retryTask(task)"
                        >
                          <el-icon><VideoPlay /></el-icon>
                        </el-button>

                        <!-- 已完成：删除选项 -->
                        <el-dropdown v-else-if="task.status === 'completed'" trigger="click">
                          <el-button size="small" text title="删除选项">
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
                      </div>
                    </div>
                  </div>

                  <!-- 第二行：进度条和详细信息 -->
                  <div class="task-bottom-row">
                    <!-- 进度百分比 -->
                    <div class="progress-percent">{{ task.stableProgress }}%</div>

                    <!-- 进度条 -->
                    <div class="progress-bar-container">
                      <el-progress
                        :percentage="task.stableProgress"
                        :stroke-width="4"
                        :show-text="false"
                        :status="task.status === 'error' ? 'exception' : undefined"
                      />
                    </div>

                    <!-- 详细信息 -->
                    <div class="task-details">
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
        <div v-else class="task-detail-list progress-bar-layout">
          <el-empty description="暂无任务" />
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
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Folder, VideoPlay, VideoPause, Refresh, Delete, Loading } from '@element-plus/icons-vue'
import Pagination from '@renderer/components/Pagination/index.vue'
import { formatTaskCount, formatTaskName } from '@renderer/utils/formatters'
import { APP_NAME } from '@shared/const'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const totalTasks = ref(0)
const totalPages = ref(0)

// 筛选相关
const statusFilter = ref('all')

// 下载路径和设置
const downloadPath = ref('')
const concurrency = ref(3)
const tempConcurrency = ref(3)
const replaceExisting = ref(false)

// 任务数据
const currentPageTasks = ref([]) // 当前页的任务
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
const clearingTasks = ref(false)

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
  try {
    const result = await window.QzoneAPI.download.requestTasksPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value === 'all' ? null : statusFilter.value
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
    currentPageTasks.value = []
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

// 设置事件监听器
const setupEventListeners = () => {
  // 使用preload暴露的API来监听事件
  window.QzoneAPI.download.onStatsUpdate(handleStatsUpdate)
  window.QzoneAPI.download.onActiveTasksUpdate(handleActiveTasksUpdate)
  window.QzoneAPI.download.onTaskChanges(handleTaskChanges)
  window.QzoneAPI.download.onTasksPage(handleTasksPage)
}

// 清理事件监听器
const cleanupEventListeners = () => {
  window.QzoneAPI.download.removeAllListeners()
}

// 处理统计信息更新
const handleStatsUpdate = (...args) => {
  // 通过ipc-client传递时，数据在第一个参数中
  const stats = args[0]
  // console.debug('[DownloadManager] 收到统计信息更新:', stats)
  taskStats.value = stats || taskStats.value
}

// 处理活跃任务更新
const handleActiveTasksUpdate = (...args) => {
  // 通过ipc-client传递时，数据在第一个参数中
  const activeTasks = args[0]
  // console.debug('[DownloadManager] 收到活跃任务更新:', activeTasks?.length || 0, '个任务')

  if (!Array.isArray(activeTasks)) return

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
  activeTasks.forEach((activeTask) => {
    const index = currentPageTasks.value.findIndex((task) => task.id === activeTask.id)
    if (index !== -1) {
      const currentTask = currentPageTasks.value[index]
      // 只更新可能变化的字段，避免触发图片重新加载
      const updatedTask = {
        ...currentTask,
        status: activeTask.status,
        progress: activeTask.progress,
        downloaded: activeTask.downloaded,
        total: activeTask.total,
        speed: activeTask.speed,
        error: activeTask.error,
        update_time: activeTask.update_time
      }
      currentPageTasks.value.splice(index, 1, updatedTask)
    }
  })
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
    loadStats()
    loadTasksPage()
    setupEventListeners()
  } else {
    await window.QzoneAPI.download.setManagerOpen(false)
    cleanupEventListeners()
  }
})

// 监听分页和筛选变化
watch([currentPage, pageSize, statusFilter], () => {
  loadTasksPage()
})

// 组件挂载时初始化
onMounted(async () => {
  if (visible.value) {
    await window.QzoneAPI.download.setManagerOpen(true)
    initDownloadPath()
    initConcurrency()
    initReplaceExistingSetting()
    loadStats()
    loadTasksPage()
    setupEventListeners()
  }
})

// 组件销毁时清理
onUnmounted(async () => {
  await window.QzoneAPI.download.setManagerOpen(false)
  cleanupEventListeners()
})

// 计算属性
const completedTasks = computed(() => taskStats.value.completed || 0)
const overallProgress = computed(() => {
  const total = taskStats.value.total || 0
  if (total === 0) return 0
  return Math.round((completedTasks.value / total) * 100)
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

const getTaskStatusText = (status) => {
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

const getTaskIcon = (type) => {
  const iconMap = {
    image: '🖼️',
    zip: '📁',
    video: '🎬',
    document: '📄'
  }
  return iconMap[type] || '📄'
}

const getTasksByStatus = (status) => {
  if (taskStats.value && typeof taskStats.value[status] === 'number') {
    return { length: taskStats.value[status] }
  }
  return { length: 0 }
}

const getCurrentSpeed = () => {
  const totalSpeed = currentPageTasks.value
    .filter((task) => task.status === 'downloading')
    .reduce((sum, task) => sum + (task.speed || 0), 0)
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

    ElMessage.success('任务列表已清空')
  } catch (error) {
    console.error('清空任务失败:', error)
    ElMessage.error('清空任务失败')
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
</script>
<style lang="scss">
.custom-tooltip {
  max-width: 600px !important;
  word-break: break-all;
}
</style>

<style lang="scss" scoped>
// 原有样式保持不变，从layouts.vue中复制过来
.download-manager-dialog.dark-theme {
  :deep(.el-dialog) {
    background: #1a1a1a;
    border: 1px solid #333;
  }

  :deep(.el-dialog__header) {
    background: #2a2a2a;
    border-bottom: 1px solid #333;

    .el-dialog__title {
      color: #fff;
    }
  }

  :deep(.el-dialog__body) {
    background: #1a1a1a;
    max-height: 500px;
    overflow: hidden;
    padding: 15px 20px;
  }

  :deep(.el-dialog__headerbtn .el-dialog__close) {
    color: #ccc;
    &:hover {
      color: #fff;
    }
  }

  // Tooltip 深色主题样式
  :deep(.el-tooltip__popper) {
    &.is-dark {
      background: #2a2a2a;
      border: 1px solid #444;
      color: #fff;
    }
  }
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 8px 0;
  border-bottom: 1px solid #333;

  .actions-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .total-info {
      color: #ccc;
      font-size: 13px;
    }

    .setting-group {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;

      &.compact {
        gap: 4px;
        margin-left: 6px;
      }

      .setting-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        white-space: nowrap;
        min-width: 18px;
      }

      &.compact .setting-label {
        min-width: 36px;
        font-size: 11px;
      }

      .setting-control {
        display: flex;
        align-items: center;
        gap: 6px;

        .setting-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-left: 8px;
          white-space: nowrap;

          &.compact {
            margin-left: 4px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
            font-weight: 500;
          }
        }

        .concurrency-input {
          width: 50px;

          :deep(.el-input__wrapper) {
            background-color: transparent;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            padding: 0 8px;

            .el-input__inner {
              background-color: transparent;
              color: rgba(255, 255, 255, 0.9);
              text-align: left;
            }

            &:hover {
              border-color: #409eff;
            }

            &.is-focus {
              border-color: #409eff;
              background: rgba(255, 255, 255, 0.05);
            }
          }

          :deep(.el-input-number__increase),
          :deep(.el-input-number__decrease) {
            background-color: transparent;
            border-left: 1px solid rgba(255, 255, 255, 0.3);
            color: rgba(255, 255, 255, 0.7);

            &:hover {
              background-color: rgba(255, 255, 255, 0.1);
              color: rgba(255, 255, 255, 0.9);
            }
          }
        }

        :deep(.el-switch) {
          .el-switch__core {
            background-color: rgba(255, 255, 255, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);

            &:hover {
              background-color: rgba(255, 255, 255, 0.4);
            }

            .el-switch__action {
              background-color: #fff;
            }
          }

          &.is-checked .el-switch__core {
            background-color: #409eff;
            border-color: #409eff;
          }

          .el-switch__label {
            color: rgba(255, 255, 255, 0.8);
            font-size: 11px;

            &.is-active {
              color: #409eff;
            }
          }
        }
      }
    }
  }

  .actions-right {
    display: flex;
    gap: 8px;

    :deep(.el-button) {
      background: #2a2a2a;
      border-color: #444;
      color: #ccc;

      &:hover {
        background: #333;
        border-color: #555;
        color: #fff;
      }

      &.el-button--success {
        background: #67c23a;
        border-color: #67c23a;
        color: #fff;

        &:hover {
          background: #85ce61;
          border-color: #85ce61;
        }
      }

      &.el-button--warning {
        background: #e6a23c;
        border-color: #e6a23c;
        color: #fff;

        &:hover {
          background: #ebb563;
          border-color: #ebb563;
        }
      }

      &.el-button--danger {
        background: #f56c6c;
        border-color: #f56c6c;
        color: #fff;

        &:hover {
          background: #f78989;
          border-color: #f78989;
        }
      }
    }
  }

  @media (max-width: 1000px) {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;

    .actions-left {
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 6px;

      .setting-group {
        margin-left: 0;

        .setting-hint {
          display: none;
        }
      }
    }

    .actions-right {
      justify-content: center;
    }
  }
}

.layout-columns {
  display: flex;
  gap: 20px;
  height: 420px;

  .left-column {
    width: 160px;
    flex-shrink: 0;

    &.optimized-layout {
      .progress-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: #2a2a2a;
        border-radius: 8px;
        border: 1px solid #333;
        margin-bottom: 12px;
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
            color: #409eff;
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
            color: #ccc;
            line-height: 1;
          }
        }
      }

      .speed-card {
        padding: 12px;
        background: #2a2a2a;
        border-radius: 6px;
        border: 1px solid #333;
        margin-bottom: 12px;
        text-align: center;

        h5 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #fff;
          font-weight: 600;
        }

        .speed-info {
          .current-speed {
            font-size: 16px;
            font-weight: 700;
            color: #67c23a;
            line-height: 1;
            margin-bottom: 4px;
          }

          .speed-label {
            font-size: 10px;
            color: #999;
            line-height: 1;
          }
        }
      }

      .status-card {
        padding: 12px;
        background: #2a2a2a;
        border-radius: 6px;
        border: 1px solid #333;

        h5 {
          margin: 0 0 10px 0;
          font-size: 12px;
          color: #fff;
          font-weight: 600;
        }

        .status-list {
          .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 0;
            font-size: 11px;

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              flex-shrink: 0;

              &.downloading {
                background: #409eff;
              }
              &.completed {
                background: #67c23a;
              }
              &.paused {
                background: #e6a23c;
              }
              &.waiting {
                background: #909399;
              }
              &.error {
                background: #f56c6c;
              }
              &.cancelled {
                background: #909399;
              }
            }

            .status-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex: 1;

              .status-name {
                color: #ccc;
              }

              .status-count {
                color: #fff;
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

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding: 0 5px;
      flex-wrap: wrap;
      gap: 10px;

      h4 {
        margin: 0;
        font-size: 14px;
        color: #fff;
      }

      .task-filter {
        flex: 1;
        display: flex;
        justify-content: center;

        :deep(.el-radio-group) {
          .el-radio-button {
            .el-radio-button__inner {
              background: rgba(255, 255, 255, 0.1);
              border-color: rgba(255, 255, 255, 0.2);
              color: rgba(255, 255, 255, 0.8);
              padding: 4px 8px;
              font-size: 11px;
              min-width: auto;

              &:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
                color: rgba(255, 255, 255, 0.9);
              }
            }

            &.is-active .el-radio-button__inner {
              background: #409eff;
              border-color: #409eff;
              color: #fff;
            }
          }
        }
      }

      .pagination-info {
        font-size: 12px;
        color: #999;
        width: 100px;
        text-align: right;
      }

      @media (max-width: 768px) {
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
          background: #2a2a2a;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 8px;
          margin-bottom: 6px;
          transition: all 0.2s ease;

          &:hover {
            background: #333;
            border-color: #444;
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
                background: rgba(255, 255, 255, 0.05);

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
                  background: rgba(255, 255, 255, 0.1);
                  color: rgba(255, 255, 255, 0.6);
                  font-size: 16px;

                  .loading-icon {
                    animation: spin 1s linear infinite;
                  }
                }

                .type-badge {
                  position: absolute;
                  top: 2px;
                  right: 2px;
                  background: rgba(0, 0, 0, 0.7);
                  border-radius: 2px;
                  padding: 1px 2px;
                  font-size: 10px;
                  color: #fff;
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
                      color: #fff;
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
                      color: #999;
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
                          background: rgba(64, 158, 255, 0.2);
                          color: #409eff;
                        }
                        &.completed {
                          background: rgba(103, 194, 58, 0.2);
                          color: #67c23a;
                        }
                        &.paused {
                          background: rgba(230, 162, 60, 0.2);
                          color: #e6a23c;
                        }
                        &.waiting {
                          background: rgba(144, 147, 153, 0.2);
                          color: #909399;
                        }
                        &.error {
                          background: rgba(245, 108, 108, 0.2);
                          color: #f56c6c;
                        }
                        &.cancelled {
                          background: rgba(144, 147, 153, 0.2);
                          color: #909399;
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
                    color: #409eff;
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
                          background-color: #333;
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
                      color: #999;
                      white-space: nowrap;
                    }

                    .speed-info {
                      color: #67c23a;
                      white-space: nowrap;
                    }

                    .eta-info {
                      color: #e6a23c;
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

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
