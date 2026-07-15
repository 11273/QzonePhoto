<template>
  <span
    class="icon-wrapper"
    :class="[size, { clickable: clickable }]"
    :style="iconStyle"
    @click="handleClick"
  >
    <!-- 组件型图标：Element Plus / Lucide / 任意 Vue 组件 -->
    <component :is="icon" v-if="isComponentIcon" :class="iconClass" />

    <!-- 内联SVG -->
    <svg
      v-else-if="isInlineSvg"
      :width="iconSize"
      :height="iconSize"
      :viewBox="computedViewBox"
      :fill="color"
      :class="iconClass"
    >
      <path :d="computedSvgPath" />
    </svg>

    <!-- 未识别的字符串不再作为文本图标渲染，避免 emoji fallback 混入 UI -->
    <span v-else class="icon-placeholder" aria-hidden="true"></span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: {
    type: [String, Object, Function],
    required: true
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['mini', 'small', 'medium', 'large', 'xl'].includes(value)
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  clickable: {
    type: Boolean,
    default: false
  },
  // 用于内联SVG
  svgPath: {
    type: String,
    default: ''
  },
  viewBox: {
    type: String,
    default: '0 0 24 24'
  }
})

const emit = defineEmits(['click'])

// 预定义的图标数据
const ICON_DEFINITIONS = {
  github: {
    path: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.30.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
    viewBox: '0 0 24 24'
  },
  qzone: {
    path: 'M512 242a270 270 0 1 1 0 540 270 270 0 1 1 0-540zm0 94a176 176 0 1 0 0 352 176 176 0 1 0 0-352zM603 592l118 118-58 58-118-118zM512 400l28 75 80 4-63 50 21 77-66-43-66 43 21-77-63-50 80-4z',
    viewBox: '0 0 1024 1024'
  },
  minimize: {
    path: 'M2 5.5h8v1H2z',
    viewBox: '0 0 12 12'
  },
  maximize: {
    path: 'M2 2h8v8H2V2z',
    viewBox: '0 0 12 12'
  },
  restore: {
    path: 'M3 1h7v7H8V3H3V1zM1 3h7v7H1V3z',
    viewBox: '0 0 12 12'
  },
  close: {
    path: 'M1 1l10 10M11 1L1 11',
    viewBox: '0 0 12 12'
  }
}

// Vue 组件类（Element Plus icon、lucide-vue-next icon、任意 SFC）都走 <component :is> 渲染
const isComponentIcon = computed(() => {
  return typeof props.icon === 'object' || typeof props.icon === 'function'
})

const isInlineSvg = computed(() => {
  return typeof props.icon === 'string' && (ICON_DEFINITIONS[props.icon] || props.svgPath)
})

const iconDefinition = computed(() => {
  if (typeof props.icon === 'string' && ICON_DEFINITIONS[props.icon]) {
    return ICON_DEFINITIONS[props.icon]
  }
  return {
    path: props.svgPath,
    viewBox: props.viewBox
  }
})

const computedSvgPath = computed(() => iconDefinition.value.path)
const computedViewBox = computed(() => iconDefinition.value.viewBox || props.viewBox)

const iconSize = computed(() => {
  const sizes = {
    mini: 12,
    small: 14,
    medium: 16,
    large: 20,
    xl: 24
  }
  return sizes[props.size]
})

const iconStyle = computed(() => ({
  color: props.color,
  cursor: props.clickable ? 'pointer' : 'default'
}))

const iconClass = computed(() => ({
  'icon-element': isComponentIcon.value,
  'icon-svg': isInlineSvg.value
}))

const handleClick = (event) => {
  if (props.clickable) {
    emit('click', event)
  }
}
</script>

<style scoped>
.icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  transition: all 0.2s ease;

  &.mini {
    width: 12px;
    height: 12px;
  }

  &.small {
    width: 14px;
    height: 14px;
  }

  &.medium {
    width: 16px;
    height: 16px;
  }

  &.large {
    width: 20px;
    height: 20px;
  }

  &.xl {
    width: 24px;
    height: 24px;
  }

  &.clickable {
    cursor: pointer;

    &:hover {
      opacity: 0.8;
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }
  }
}

.icon-element,
.icon-svg {
  width: 100%;
  height: 100%;
}

.icon-svg {
  fill: currentColor;
  stroke: none;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
}

/* 特殊图标样式 */
.icon-wrapper.close .icon-svg {
  stroke: currentColor;
  fill: none;
  stroke-width: 1.5;
}
</style>
