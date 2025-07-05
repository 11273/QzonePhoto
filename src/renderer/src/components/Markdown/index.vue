<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-content" v-html="sanitizedHtml"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

// 配置 marked
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        console.error('Highlight error:', err)
      }
    }
    return code
  },
  breaks: true,
  gfm: true
})

// 渲染并清理 HTML
const sanitizedHtml = computed(() => {
  if (!props.content) return ''

  // 渲染 Markdown
  const rawHtml = marked(props.content)

  // 清理 HTML，防止 XSS
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'del',
      'code',
      'pre',
      'blockquote',
      'a',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
  })
})
</script>

<style scoped>
/* 引入 highlight.js 的暗色主题 */
@import 'highlight.js/styles/github-dark.css';

.markdown-content {
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  line-height: 1.6;
  word-wrap: break-word;
  user-select: text;
}

/* 标题样式 */
.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin: 12px 0 8px;
  font-weight: 600;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.95);
}

.markdown-content :deep(h1) {
  font-size: 20px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.markdown-content :deep(h2) {
  font-size: 18px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.markdown-content :deep(h3) {
  font-size: 16px;
}

.markdown-content :deep(h4) {
  font-size: 14px;
}

/* 段落和基础元素 */
.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 16px 0;
}

/* 列表样式 */
.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
  color: rgba(255, 255, 255, 0.8);
}

.markdown-content :deep(ul li)::marker {
  color: #67c23a;
}

.markdown-content :deep(ol li)::marker {
  color: #409eff;
  font-weight: 600;
}

/* 强调样式 */
.markdown-content :deep(strong) {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.markdown-content :deep(em) {
  font-style: italic;
  color: rgba(255, 255, 255, 0.85);
}

.markdown-content :deep(del) {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.5);
}

/* 代码样式 */
.markdown-content :deep(code) {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: #67c23a;
}

.markdown-content :deep(pre) {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  overflow-x: auto;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
  color: rgba(255, 255, 255, 0.85);
  display: block;
}

/* 引用样式 */
.markdown-content :deep(blockquote) {
  border-left: 4px solid #409eff;
  padding-left: 12px;
  margin: 12px 0;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(64, 158, 255, 0.05);
  border-radius: 0 4px 4px 0;
  padding: 8px 12px;
}

/* 链接样式 */
.markdown-content :deep(a) {
  color: #409eff;
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
}

.markdown-content :deep(a:hover) {
  color: #66b3ff;
  text-decoration: underline;
}

.markdown-content :deep(a:after) {
  content: '↗';
  font-size: 12px;
  margin-left: 2px;
  opacity: 0.5;
}

/* 表格样式 */
.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.markdown-content :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.markdown-content :deep(tr:last-child td) {
  border-bottom: none;
}

.markdown-content :deep(tr:hover) {
  background: rgba(255, 255, 255, 0.03);
}

/* 代码高亮优化 */
.markdown-content :deep(.hljs) {
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
}

/* 滚动条样式 */
.markdown-content :deep(pre)::-webkit-scrollbar {
  height: 6px;
}

.markdown-content :deep(pre)::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.markdown-content :deep(pre)::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.markdown-content :deep(pre)::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
