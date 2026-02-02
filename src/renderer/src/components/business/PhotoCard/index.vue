<template>
  <div v-show="!isHidden" class="photo-card" :class="[size, { 'is-selected': selected }]">
    <div class="image-wrapper" @click="handleClick">
      <img
        :src="`qzone-local://${photo.path}`"
        loading="lazy"
        class="photo-img"
        @error="handleLoadError"
      />
      <div v-if="selectable" class="select-overlay" @click.stop="toggleSelect">
        <div class="checkbox" :class="{ checked: selected }">
          <el-icon v-if="selected"><Check /></el-icon>
        </div>
      </div>
      <div class="photo-info">
        <span class="date">{{ formatDate(photo.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Check } from '@element-plus/icons-vue'

/**
 * AI 相册照片卡片组件
 * 支持“懒删除”逻辑：加载失败时自动通知后端同步并隐藏
 */

const props = defineProps({
  photo: {
    type: Object,
    required: true
  },
  size: {
    type: String,
    default: 'm' // xs, s, m, l
  },
  selected: {
    type: Boolean,
    default: false
  },
  selectable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click', 'select', 'delete'])

const isHidden = ref(false)

/**
 * 懒删除逻辑：图片加载失败说明文件已被移动或删除
 */
const handleLoadError = () => {
  console.warn('[PhotoCard] Image load failed, triggering lazy delete:', props.photo.path)
  isHidden.value = true

  // 1. 通知后端删除数据库记录
  if (window.QzoneAPI?.ai?.deletePhoto) {
    window.QzoneAPI.ai.deletePhoto(props.photo.path)
  }

  // 2. 通知父组件
  emit('delete', props.photo)
}

const handleClick = () => {
  emit('click', props.photo)
}

const toggleSelect = () => {
  emit('select', !props.selected)
}

const formatDate = (ts) => {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString()
}
</script>

<style scoped>
.photo-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  transition: transform 0.2s ease;
  aspect-ratio: 1;
}

.photo-card:hover {
  transform: scale(1.02);
}

.photo-card.m {
  width: 160px;
  height: 160px;
}
.photo-card.s {
  width: 120px;
  height: 120px;
}
.photo-card.xs {
  width: 80px;
  height: 80px;
}
.photo-card.l {
  width: 240px;
  height: 240px;
}

.image-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: pointer;
}

.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.select-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
}

.checkbox {
  width: 100%;
  height: 100%;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.checkbox.checked {
  background: #3b82f6;
  border-color: #3b82f6;
}

.photo-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  color: #fff;
  font-size: 10px;
  opacity: 0;
  transition: opacity 0.2s;
}

.photo-card:hover .photo-info {
  opacity: 1;
}
</style>
