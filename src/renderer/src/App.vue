<script setup>
import { ref, provide } from 'vue'
import { useRouter } from 'vue-router'
import CustomTitleBar from '@renderer/components/CustomTitleBar/index.vue'
import TransitionOverlay from '@renderer/components/TransitionOverlay/index.vue'

const router = useRouter()

// 全局过渡动画状态
const transitionVisible = ref(false)
const transitionMode = ref('ai') // 'ai' | 'album'

/**
 * 触发页面切换过渡动画
 * @param {string|Function} target 目标路由路径 或 回调函数
 * @param {string} mode 过渡模式 'ai' | 'album'
 */
const triggerTransition = (target, mode = 'ai') => {
  transitionMode.value = mode
  transitionVisible.value = true

  // 等待动画覆盖屏幕 (600ms)
  setTimeout(() => {
    if (typeof target === 'function') {
      target()
    } else if (typeof target === 'string') {
      router.push(target)
    }
  }, 600)
}

// 动画完成回调
const handleTransitionComplete = () => {
  transitionVisible.value = false
}

// 提供给子组件使用
provide('triggerTransition', triggerTransition)
</script>

<template>
  <div class="app-container">
    <!-- 全局过渡动画遮罩 -->
    <TransitionOverlay
      :visible="transitionVisible"
      :mode="transitionMode"
      @complete="handleTransitionComplete"
    />

    <!-- 自定义标题栏 -->
    <CustomTitleBar />

    <!-- 主要内容区域 -->
    <div class="main-content">
      <RouterView />
    </div>
  </div>
</template>

<style>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: hidden; /* 防止主容器出现滚动条 */
  display: flex;
  flex-direction: column;
  height: calc(100vh - 38px);
}

/* 确保内部内容正确处理滚动 */
.main-content > * {
  flex: 1;
  overflow: auto; /* 让具体的内容组件自己处理滚动 */
}

/* 调整Element Plus通知位置，避免被标题栏遮挡 */
.el-notification {
  top: 50px !important; /* 标题栏高度34px + 16px间距 */
}

/* 调整Element Plus消息提示位置 */
.el-message {
  top: 50px !important;
}

/* 调整Element Plus确认框位置 */
.el-message-box__wrapper {
  padding-top: 60px;
}
</style>
