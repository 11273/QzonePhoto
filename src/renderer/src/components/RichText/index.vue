<template>
  <span class="rich-text">
    <template v-for="(segment, index) in parsedSegments" :key="index">
      <!-- 普通文本 -->
      <span v-if="segment.type === 'text'" class="text-segment">{{ segment.content }}</span>

      <!-- @提及 -->
      <el-tooltip
        v-else-if="segment.type === 'mention'"
        :content="`QQ: ${segment.uin}`"
        placement="top"
      >
        <span class="mention-segment" @click="handleMentionClick(segment)"
          >@{{ segment.nick }}</span
        >
      </el-tooltip>

      <!-- 表情 -->
      <img
        v-else-if="segment.type === 'emoji'"
        :src="segment.url"
        :alt="segment.code"
        :title="segment.code"
        class="emoji-segment"
        @error="handleEmojiError"
      />
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { parseRichText } from '@renderer/utils/formatters'

const props = defineProps({
  text: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['mention-click'])

// 解析文本
const parsedSegments = computed(() => {
  return parseRichText(props.text)
})

// 处理@提及点击
const handleMentionClick = (mention) => {
  emit('mention-click', mention)
}

// 处理表情加载失败
const handleEmojiError = (event) => {
  // 如果图片加载失败,显示表情代码
  const img = event.target
  const code = img.alt
  // 创建一个span替换img
  const span = document.createElement('span')
  span.className = 'emoji-fallback'
  span.textContent = `[${code}]`
  span.title = code
  img.parentNode.replaceChild(span, img)
}
</script>

<style scoped>
.rich-text {
  display: inline;
  white-space: pre-wrap;
  word-break: break-word;
}

.text-segment {
  color: inherit;
}

.mention-segment {
  color: #60a5fa;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0 2px;
  border-radius: 2px;
}

.mention-segment:hover {
  color: #93c5fd;
  background: rgba(96, 165, 250, 0.1);
}

.emoji-segment {
  display: inline-block;
  width: 15px;
  height: 15px;
  vertical-align: middle;
  margin: 0 1px;
}

.emoji-fallback {
  display: inline;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}
</style>
