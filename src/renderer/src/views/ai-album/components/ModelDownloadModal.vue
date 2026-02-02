<template>
  <el-dialog
    v-model="visible"
    title="初始化 AI 引擎"
    width="460px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    align-center
    class="ai-download-dialog"
  >
    <div class="download-content">
      <div class="step-indicator">
        <div class="step" :class="{ active: currentStep === 1, done: currentStep > 1 }">
          <div class="step-num">1</div>
          <div class="step-text">视觉模型</div>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: currentStep === 2, done: currentStep > 2 }">
          <div class="step-num">2</div>
          <div class="step-text">面部检索</div>
        </div>
      </div>

      <div class="loading-area">
        <div class="loading-icon">
          <el-icon class="is-loading"><Loading /></el-icon>
        </div>
        <div class="progress-info">
          <div class="status-row">
            <span class="status-text">正在下载必备模型资源 ({{ currentStep }}/2)...</span>
            <span class="percent-text">{{ progress }}%</span>
          </div>
          <el-progress
            :percentage="progress"
            :show-text="false"
            :stroke-width="6"
            striped
            striped-flow
          />
          <div class="detail-text">模型文件约 152MB，仅首次使用需要下载，请保持网络连接。</div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'complete'])

const visible = ref(props.modelValue)
const progress = ref(0)
const currentStep = ref(1)

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val) startSimulatedDownload()
  }
)

const startSimulatedDownload = () => {
  progress.value = 0
  currentStep.value = 1

  const timer = setInterval(() => {
    progress.value += Math.floor(Math.random() * 5) + 2
    if (progress.value >= 100) {
      if (currentStep.value === 1) {
        currentStep.value = 2
        progress.value = 0
      } else {
        clearInterval(timer)
        setTimeout(() => {
          emit('complete')
          emit('update:modelValue', false)
        }, 500)
      }
    }
  }, 200)
}
</script>

<style lang="scss" scoped>
.ai-download-dialog {
  :deep(.el-dialog) {
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
  }

  :deep(.el-dialog__title) {
    color: #fff;
    font-size: 16px;
    font-weight: 600;
  }
}

.download-content {
  padding: 10px 0;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 0.4;
    transition: all 0.3s;

    &.active {
      opacity: 1;
      .step-num {
        background: #3b82f6;
        border-color: #3b82f6;
      }
    }

    &.done {
      opacity: 1;
      .step-num {
        background: #10b981;
        border-color: #10b981;
      }
    }

    .step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
    }

    .step-text {
      font-size: 12px;
      color: #fff;
    }
  }

  .step-line {
    width: 60px;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
    margin-top: -20px;
  }
}

.loading-area {
  display: flex;
  gap: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;

  .loading-icon {
    font-size: 24px;
    color: #3b82f6;
  }

  .progress-info {
    flex: 1;

    .status-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;

      .status-text {
        font-size: 13px;
        color: #fff;
        font-weight: 500;
      }
      .percent-text {
        font-size: 14px;
        color: #3b82f6;
        font-weight: 600;
      }
    }

    .detail-text {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 10px;
    }
  }
}
</style>
