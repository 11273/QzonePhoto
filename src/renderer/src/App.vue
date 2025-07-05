<script>
import CustomTitleBar from '@renderer/components/CustomTitleBar/index.vue'

export default {
  components: {
    CustomTitleBar
  }
}
</script>

<template>
  <div class="app-container">
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
