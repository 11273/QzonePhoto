<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="visible" class="transition-overlay" :class="mode">
        <!-- 背景遮罩与模糊效果 -->
        <div class="overlay-backdrop"></div>

        <!-- 粒子效果 -->
        <div class="particles-container">
          <div v-for="i in 12" :key="i" class="particle" :style="getParticleStyle(i)"></div>
        </div>

        <!-- 中心图标 -->
        <div class="icon-container" :class="{ 'icon-animate': iconAnimate }">
          <!-- AI 模式：魔法棒 -->
          <div v-if="mode === 'ai'" class="ai-icon">
            <svg viewBox="0 0 24 24" class="magic-wand-svg">
              <defs>
                <linearGradient id="wand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#a78bfa" />
                  <stop offset="50%" stop-color="#8b5cf6" />
                  <stop offset="100%" stop-color="#7c3aed" />
                </linearGradient>
              </defs>
              <!-- 魔法棒主体 -->
              <path
                d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96a.996.996 0 0 0 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 0 0 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"
                fill="url(#wand-gradient)"
              />
            </svg>
            <!-- 发光环 -->
            <div class="glow-ring"></div>
            <div class="glow-ring delay-1"></div>
            <div class="glow-ring delay-2"></div>
          </div>

          <!-- Album 模式：QQ 空间 icon -->
          <div v-else class="album-icon">
            <svg viewBox="0 0 1024 1024" class="qzone-svg">
              <defs>
                <linearGradient id="qzone-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ff8a00" />
                  <stop offset="50%" stop-color="#f15a24" />
                  <stop offset="100%" stop-color="#e64a19" />
                </linearGradient>
              </defs>
              <path
                d="M513 811.6s-278.2 171-295.4 157.1C200.4 954.7 274 636 274 636S24.9 426.1 35.1 400.4c10.2-25.8 330.3-48.5 330.3-48.5S484.2 49.2 513 49.2c28.8 0 147.7 302.7 147.7 302.7s321.4 22.9 330.3 48.5S752 636 752 636s3.1 20.4 6.7 35.6c0.2 1-115.7 3.7-210.7 0-49.9-1.9-110-11.3-110-11.3L713 462s-99.5-18.1-200-21.7c-110.1-4-222.9 6.7-239 10.9-10.1 2.6 71.2 2.4 164 10.9 64.9 5.9 150.4 21.7 150.4 21.7l-275 207.1s117.8 7.2 223.4 6.5c118.9-0.8 226.2-15.8 226.9-12.9 20.7 90.6 58.9 269.7 44.7 284.3C789.1 988.5 513 811.6 513 811.6z"
                fill="url(#qzone-gradient)"
              />
            </svg>
            <!-- 收束光环 -->
            <div class="converge-ring"></div>
            <div class="converge-ring delay-1"></div>
          </div>
        </div>

        <!-- 文字提示 -->
        <div class="transition-text">
          {{ mode === 'ai' ? '正在进入智能相册...' : '正在返回 QQ 相册...' }}
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  /** 是否显示过渡动画 */
  visible: {
    type: Boolean,
    default: false
  },
  /** 过渡模式：'ai' = 切换到智能相册，'album' = 返回 QQ 相册 */
  mode: {
    type: String,
    default: 'ai',
    validator: (value) => ['ai', 'album'].includes(value)
  }
})

const emit = defineEmits(['complete'])

// 图标动画状态
const iconAnimate = ref(false)

/**
 * 生成粒子样式
 * @param {number} index 粒子索引
 */
const getParticleStyle = (index) => {
  const angle = (index / 12) * 360
  const delay = (index % 4) * 0.1
  const size = 4 + Math.random() * 6

  return {
    '--angle': `${angle}deg`,
    '--delay': `${delay}s`,
    '--size': `${size}px`,
    '--distance': `${80 + Math.random() * 60}px`
  }
}

// 监听显示状态，控制动画时序
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible) {
      // 显示后触发图标动画
      setTimeout(() => {
        iconAnimate.value = true
      }, 50)

      // 动画完成后触发回调（匹配 view-switch 动画总时长）
      setTimeout(() => {
        emit('complete')
      }, 1200)
    } else {
      iconAnimate.value = false
    }
  }
)
</script>

<style lang="scss" scoped>
.transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: all;
}

/* 背景遮罩 */
.overlay-backdrop {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(20px);
  transition: all 0.4s ease;
}

/* AI 模式背景 */
.ai .overlay-backdrop {
  background: radial-gradient(
    ellipse at center,
    rgba(139, 92, 246, 0.3) 0%,
    rgba(124, 58, 237, 0.2) 40%,
    rgba(30, 27, 46, 0.95) 100%
  );
}

/* Album 模式背景 */
.album .overlay-backdrop {
  background: radial-gradient(
    ellipse at center,
    rgba(241, 90, 36, 0.25) 0%,
    rgba(255, 138, 0, 0.15) 40%,
    rgba(30, 27, 46, 0.95) 100%
  );
}

/* 粒子容器 */
.particles-container {
  position: absolute;
  width: 300px;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 粒子样式 */
.particle {
  position: absolute;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  opacity: 0;
  animation: particle-burst 1.2s ease-out forwards;
  animation-delay: var(--delay);
}

/* AI 模式粒子 - 紫色发散 */
.ai .particle {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.8);
}

/* Album 模式粒子 - 橙色收束 */
.album .particle {
  background: linear-gradient(135deg, #ff8a00, #f15a24);
  box-shadow: 0 0 10px rgba(241, 90, 36, 0.8);
}

@keyframes particle-burst {
  0% {
    opacity: 1;
    transform: rotate(var(--angle)) translateX(0);
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(var(--distance));
  }
}

/* Album 模式粒子收束动画 */
.album .particle {
  animation-name: particle-converge;
}

@keyframes particle-converge {
  0% {
    opacity: 0;
    transform: rotate(var(--angle)) translateX(var(--distance));
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 1;
    transform: rotate(var(--angle)) translateX(0);
  }
}

/* 图标容器 */
.icon-container {
  position: relative;
  z-index: 1;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform: scale(0.5);
  opacity: 0;
}

.icon-container.icon-animate {
  transform: scale(1);
  opacity: 1;
}

/* AI 图标 */
.ai-icon {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.magic-wand-svg {
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.6));
  animation: wand-float 2s ease-in-out infinite;
}

@keyframes wand-float {
  0%,
  100% {
    transform: translateY(0) rotate(-5deg);
  }
  50% {
    transform: translateY(-8px) rotate(5deg);
  }
}

/* 发光环 */
.glow-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(139, 92, 246, 0.5);
  border-radius: 50%;
  animation: glow-expand 1.5s ease-out infinite;
}

.glow-ring.delay-1 {
  animation-delay: 0.3s;
}
.glow-ring.delay-2 {
  animation-delay: 0.6s;
}

@keyframes glow-expand {
  0% {
    transform: scale(0.8);
    opacity: 1;
    border-color: rgba(139, 92, 246, 0.8);
  }
  100% {
    transform: scale(2);
    opacity: 0;
    border-color: rgba(139, 92, 246, 0);
  }
}

/* Album 图标 */
.album-icon {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qzone-svg {
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 0 20px rgba(241, 90, 36, 0.6));
  animation: qzone-pulse 1.5s ease-in-out infinite;
}

@keyframes qzone-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

/* 收束光环 */
.converge-ring {
  position: absolute;
  width: 200%;
  height: 200%;
  border: 2px solid rgba(241, 90, 36, 0.3);
  border-radius: 50%;
  animation: converge-shrink 1.2s ease-in infinite;
}

.converge-ring.delay-1 {
  animation-delay: 0.4s;
}

@keyframes converge-shrink {
  0% {
    transform: scale(2);
    opacity: 0;
    border-color: rgba(241, 90, 36, 0);
  }
  50% {
    opacity: 0.8;
    border-color: rgba(241, 90, 36, 0.6);
  }
  100% {
    transform: scale(0.8);
    opacity: 0;
    border-color: rgba(241, 90, 36, 0.2);
  }
}

/* 文字提示 */
.transition-text {
  position: relative;
  z-index: 1;
  margin-top: 32px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
  opacity: 0;
  animation: text-fade-in 0.5s ease-out 0.3s forwards;
}

.ai .transition-text {
  color: rgba(167, 139, 250, 0.9);
  text-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
}

.album .transition-text {
  color: rgba(255, 138, 0, 0.9);
  text-shadow: 0 0 20px rgba(241, 90, 36, 0.5);
}

@keyframes text-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 过渡动画 */
.overlay-enter-active {
  animation: overlay-in 0.4s ease-out;
}

.overlay-leave-active {
  animation: overlay-out 0.3s ease-in;
}

@keyframes overlay-in {
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(20px);
  }
}

@keyframes overlay-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
