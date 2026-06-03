<template>
  <!--
    通用评论列表 + 回复树。
    使用方负责把不同 API（photo getFeeds / shuoshuo emotion_msglist）的字段
    normalize 成统一 shape 再传进来：

    Comment {
      id?: string,
      uin: string,
      author: string,
      text: string,
      time: string,        // 已格式化的时间字符串
      deviceName?: string, // 评论者设备（可选；通常来自 shuoshuo enrichment）
      responses?: Array<Reply>
    }
    Reply {
      id?: string,
      uin: string,
      author: string,
      text: string,
      time: string,
      targetUin?: string,
      targetNick?: string
    }
  -->
  <div v-if="normalizedComments.length > 0" class="feed-comments">
    <div v-for="comment in normalizedComments" :key="comment.id || comment.uin + comment.time" class="comment-item">
      <div class="comment-row">
        <el-tooltip :content="`QQ: ${comment.uin}`" placement="top">
          <img
            :src="getAvatarUrl(comment.uin)"
            :alt="comment.author"
            class="comment-avatar"
            @error="onAvatarError"
          />
        </el-tooltip>
        <div class="comment-content">
          <div class="comment-header">
            <el-tooltip :content="`QQ: ${comment.uin}`" placement="top">
              <span class="comment-author" @click="emit('author-click', comment)">
                {{ comment.author }}
              </span>
            </el-tooltip>
            <span v-if="comment.time" class="comment-time">{{ comment.time }}</span>
            <span
              v-if="comment.deviceName"
              class="comment-device"
              :title="`来自 ${comment.deviceName}`"
            >
              <Smartphone :size="10" />{{ comment.deviceName }}
            </span>
          </div>
          <RichText
            :text="comment.text"
            class="comment-text-content"
            @mention-click="(m) => emit('mention-click', m)"
          />

          <div v-if="comment.responses && comment.responses.length > 0" class="comment-responses">
            <div
              v-for="reply in comment.responses"
              :key="reply.id || reply.uin + reply.time"
              class="response-row"
            >
              <div class="response-content">
                <div class="response-header">
                  <el-tooltip :content="`QQ: ${reply.uin}`" placement="top">
                    <span class="response-author" @click="emit('author-click', reply)">
                      {{ reply.author }}
                    </span>
                  </el-tooltip>
                  <span v-if="reply.targetNick" class="response-target">
                    回复 <span class="target-name">@{{ reply.targetNick }}</span>
                  </span>
                  <span v-if="reply.time" class="response-time">{{ reply.time }}</span>
                </div>
                <RichText
                  :text="reply.text"
                  class="response-text-content"
                  @mention-click="(m) => emit('mention-click', m)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RichText from '@renderer/components/RichText/index.vue'
import { getQQAvatarUrl } from '@renderer/utils/formatters'
import { Smartphone } from '@lucide/vue'

const props = defineProps({
  comments: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['mention-click', 'author-click'])

const cleanCommentText = (value) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^(?:回复\s*)?[:：]\s*/, '')
    .trim()

const cleanName = (value) =>
  String(value || '')
    .replace(/\[em\]e\d+\[\/em\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const cleanComment = (item) => ({
  ...item,
  author: cleanName(item?.author),
  targetNick: cleanName(item?.targetNick),
  text: cleanCommentText(item?.text),
  responses: Array.isArray(item?.responses) ? item.responses.map(cleanComment) : []
})

const normalizedComments = computed(() => props.comments.map(cleanComment))

const getAvatarUrl = (uin) => getQQAvatarUrl(uin)

const onAvatarError = (e) => {
  // 头像加载失败兜底为 QQ 默认头像
  e.target.src = 'https://qzonestyle.gtimg.cn/qzone/em/u120.gif'
}
</script>

<style lang="scss" scoped>
.feed-comments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  flex-basis: 100%;
  margin-top: 6px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px 12px;
}

.comment-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.comment-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.comment-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.06);
  object-fit: cover;
}

.comment-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.comment-author {
  color: #60a5fa;
  font-weight: 500;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: #93c5fd;
  }
}

.comment-time {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  flex-shrink: 0;
  white-space: nowrap;
}

.comment-device {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 10px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comment-text-content {
  display: block !important;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
  text-align: left;
  white-space: normal !important;

  :deep(.rich-text) {
    display: block;
    text-align: left;
    white-space: normal;
  }
}

/* ========== 回复树（层级 2） ========== */
.comment-responses {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.025);
  border-left: 2px solid rgba(96, 165, 250, 0.25);
  border-radius: 0 6px 6px 0;
}

.response-row {
  display: block;
  min-width: 0;
}

.response-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
}

.response-author {
  color: #60a5fa;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: #93c5fd;
  }
}

/* 修复：评论中的评论不要左右分栏，昵称与内容保持自然流 */
.response-target {
  color: rgba(255, 255, 255, 0.4);
  .target-name {
    color: #60a5fa;
  }
}

.response-time {
  color: rgba(255, 255, 255, 0.35);
}

.response-text-content {
  display: block !important;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  width: 100%;
  word-break: break-word;
  white-space: normal !important;

  :deep(.rich-text) {
    display: block;
    text-align: left;
    white-space: normal;
  }

  :deep(.text-segment) {
    white-space: normal;
  }
}
</style>
