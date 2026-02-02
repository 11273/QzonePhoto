<template>
  <Transition name="fade">
    <div v-if="visible" class="ai-status-container" :class="statusClass">
      <div class="status-content">
        <!-- 核心状态图标 -->
        <div class="icon-box">
          <el-icon v-if="status === 'STARTING' || status === 'BUSY'" class="is-loading"
            ><Loading
          /></el-icon>
          <el-icon v-else-if="status === 'READY'"><Picture /></el-icon>
          <el-icon v-else-if="status === 'FATAL_ERROR'"><WarningFilled /></el-icon>
        </div>

        <!-- 文本描述 -->
        <div class="text-box">
          <span class="title">{{ statusText }}</span>
          <span v-if="msg" class="msg">{{ msg }}</span>
        </div>

        <!-- 操作按钮 -->
        <div v-if="status === 'FATAL_ERROR'" class="action-box">
          <el-button type="danger" size="small" @click="handleRestart"> 重启引擎 </el-button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Loading, Picture, WarningFilled } from '@element-plus/icons-vue'
import { IPC_AI } from '@shared/ipc-channels'

/**
 * AIStatus 组件: 实时显示 AI 引擎（Hidden Renderer）的运行状态
 * @description 该组件独立挂载在页面底部，监听来自主进程的状态变更推送，并提供引擎重启等交互。
 * 符合 Folder/index.vue 目录规范与运行时健壮性要求。
 */

// 1. Props 定义 (首席架构师严格规范)
const props = defineProps({
  /** 是否允许手动隐藏 */
  allowDismiss: {
    type: Boolean,
    default: true
  },
  /** 初始显隐状态 */
  initialVisible: {
    type: Boolean,
    default: true
  }
})

// 2. Emits 定义
const emit = defineEmits(['status-change'])

// 3. 逻辑代码
/** 对应后端 AIService 状态机 @type {import('vue').Ref<'STOPPED' | 'STARTING' | 'READY' | 'BUSY' | 'ERROR' | 'FATAL_ERROR'>} */
const status = ref('STOPPED')
/** 详细描述信息 @type {import('vue').Ref<string>} */
const msg = ref('')
/** 控制组件显隐 @type {import('vue').Ref<boolean>} */
const visible = ref(props.initialVisible)

// 状态映射表
const statusMap = {
  STOPPED: { text: 'AI 引擎未启动', type: 'info' },
  STARTING: { text: '正在初始化 WebGPU 引擎...', type: 'primary' },
  READY: { text: 'AI 引擎就绪 (WebGPU)', type: 'success' },
  BUSY: { text: '正在全力进行 AI 识别...', type: 'warning' },
  ERROR: { text: '引擎异常，正在尝试恢复', type: 'warning' },
  FATAL_ERROR: { text: 'AI 引擎已崩溃', type: 'danger' }
}

const statusText = computed(() => statusMap[status.value]?.text || '未知状态')
const statusClass = computed(() => `status-${statusMap[status.value]?.type || 'info'}`)

/**
 * 监听来自主进程的状态变更推送
 * @param {Object} event
 * @param {Object} payload
 */
const onStatusUpdate = (event, payload) => {
  status.value = payload.status
  msg.value = payload.msg || ''
  emit('status-change', payload.status)

  if (status.value === 'READY') {
    // 准备就绪，保持常驻或按需调整
  } else {
    visible.value = true
  }
}

/**
 * 触发手动重启 AI 引擎
 * @async
 */
const handleRestart = async () => {
  try {
    if (window.QzoneAPI?.ai?.restart) {
      await window.QzoneAPI.ai.restart()
    }
  } catch (err) {
    console.error('[UI] 重启 AI 引擎失败:', err)
  }
}

onMounted(async () => {
  if (window.QzoneAPI?.ai) {
    window.QzoneAPI.ai.onStatusChange(onStatusUpdate)

    // 主动同步
    try {
      const res = await window.QzoneAPI.ai.getServiceStatus()
      if (res && res.data && res.data.status) {
        status.value = res.data.status
        if (status.value !== 'READY') {
          visible.value = true
        }
      }
    } catch (error) {
      console.warn('[AIStatus] 获取初始状态失败:', error)
    }
  }
})

onUnmounted(() => {
  if (window.QzoneAPI?.ai) {
    window.QzoneAPI.ai.removeStatusChange()
  }
})
</script>

<style scoped>
.ai-status-container {
  @apply fixed bottom-4 right-4 z-50 p-3 rounded-lg shadow-xl border backdrop-blur-md transition-all duration-300;
  min-width: 240px;
}

.status-content {
  @apply flex items-center gap-3;
}

.icon-box {
  @apply text-xl flex items-center justify-center;
}

.text-box {
  @apply flex flex-col flex-1;
}

.title {
  @apply text-sm font-semibold;
}

.msg {
  @apply text-xs opacity-80 mt-0.5;
}

.action-box {
  @apply ml-2;
}

/* 状态主题样式 */
.status-info {
  @apply bg-gray-100/80 border-gray-200 text-gray-700;
}
.status-primary {
  @apply bg-blue-50/80 border-blue-200 text-blue-700;
}
.status-success {
  @apply bg-green-50/80 border-green-200 text-green-700;
}
.status-warning {
  @apply bg-orange-50/80 border-orange-200 text-orange-700;
}
.status-danger {
  @apply bg-red-50/80 border-red-200 text-red-700;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
