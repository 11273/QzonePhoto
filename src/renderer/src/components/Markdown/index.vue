<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-content" v-html="sanitizedHtml"></div>
</template>

<script setup>
import { computed, onUnmounted } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

// 更新说明中常见的代码语言按需注册，避免将 highlight.js 的完整语言库打进桌面端。
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

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

// 配置 DOMPurify 钩子，为所有链接添加 target="_blank"
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  // 如果是 a 标签
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
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
      'img', // 添加 img 标签
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td'
    ],
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'class',
      'src', // 图片源
      'alt', // 图片替代文本
      'title', // 标题
      'width', // 宽度
      'height', // 高度
      'style' // 样式（如果需要）
    ]
  })
})

// 组件卸载时移除钩子
onUnmounted(() => {
  DOMPurify.removeAllHooks()
})
</script>

<style scoped>
/* 引入 highlight.js 的暗色主题 */
@import 'highlight.js/styles/github-dark.css';

.markdown-content {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-wrap: break-word;
  user-select: text;
}

/* 添加图片样式 */
.markdown-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 8px 0;
  display: inline-block;
  vertical-align: middle;
}

/* 徽章样式优化 */
.markdown-content :deep(a img) {
  margin: 0 2px;
  vertical-align: middle;
  display: inline;
}

/* 徽章链接不显示外链图标 */
.markdown-content :deep(a:has(img)):after {
  display: none;
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
  color: var(--theme-text-primary);
}

.markdown-content :deep(h1) {
  font-size: 20px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--theme-border);
}

.markdown-content :deep(h2) {
  font-size: 18px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--theme-border-subtle);
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
  border-top: 1px solid var(--theme-border);
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
  color: var(--theme-text-secondary);
}

.markdown-content :deep(ul li)::marker {
  color: var(--theme-success);
}

.markdown-content :deep(ol li)::marker {
  color: var(--theme-info);
  font-weight: 600;
}

/* 强调样式 */
.markdown-content :deep(strong) {
  font-weight: 600;
  color: var(--theme-text-primary);
}

.markdown-content :deep(em) {
  font-style: italic;
  color: var(--theme-text-secondary);
}

.markdown-content :deep(del) {
  text-decoration: line-through;
  color: var(--theme-text-muted);
}

/* 代码样式 */
.markdown-content :deep(code) {
  background: var(--theme-surface-active);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: var(--theme-success);
}

.markdown-content :deep(pre) {
  background: color-mix(in srgb, var(--theme-canvas) 30%, transparent);
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  overflow-x: auto;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
  color: var(--theme-text-secondary);
  display: block;
}

/* 引用样式 */
.markdown-content :deep(blockquote) {
  border-left: 4px solid var(--theme-info);
  padding-left: 12px;
  margin: 12px 0;
  color: var(--theme-text-secondary);
  background: color-mix(in srgb, var(--theme-info) 5%, transparent);
  border-radius: 0 4px 4px 0;
  padding: 8px 12px;
}

/* 链接样式 */
.markdown-content :deep(a) {
  color: var(--theme-info);
  text-decoration: none;
  transition: color var(--ds-dur-fast) var(--ds-ease-soft);
  position: relative;
}

.markdown-content :deep(a:hover) {
  color: var(--theme-info);
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
  background: color-mix(in srgb, var(--theme-text-inverse) 2%, transparent);
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  overflow: hidden;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--theme-border-subtle);
}

.markdown-content :deep(th) {
  background: color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
  font-weight: 600;
  color: var(--theme-text-primary);
}

.markdown-content :deep(tr:last-child td) {
  border-bottom: none;
}

.markdown-content :deep(tr:hover) {
  background: var(--theme-surface-soft);
}

/* 代码高亮优化 */
.markdown-content :deep(.hljs) {
  background: transparent;
  color: var(--theme-text-secondary);
}

/* 滚动条样式 */
.markdown-content :deep(pre)::-webkit-scrollbar {
  height: 6px;
}

.markdown-content :deep(pre)::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--theme-text-inverse) 5%, transparent);
  border-radius: 3px;
}

.markdown-content :deep(pre)::-webkit-scrollbar-thumb {
  background: var(--theme-border-strong);
  border-radius: 3px;
}

.markdown-content :deep(pre)::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--theme-text-inverse) 30%, transparent);
}
</style>
