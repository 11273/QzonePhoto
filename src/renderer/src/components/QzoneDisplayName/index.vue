<template>
  <span class="qzone-display-name">
    <template v-for="token in nameTokens" :key="token.key">
      <img
        v-if="token.type === 'emoji'"
        class="friend-emoji"
        :src="`https://qzonestyle.gtimg.cn/qzone/em/${token.value}.gif`"
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable="false"
        referrerpolicy="no-referrer"
      />
      <span v-else>{{ token.value }}</span>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: [String, Number], default: '' }
})

const nameTokens = computed(() => {
  const value = String(props.name || '')
  const pattern = /\[em\](e\d+)\[\/em\]/g
  const tokens = []
  let cursor = 0
  let match = pattern.exec(value)

  while (match) {
    if (match.index > cursor) {
      tokens.push({ type: 'text', value: value.slice(cursor, match.index) })
    }
    tokens.push({ type: 'emoji', value: match[1] })
    cursor = match.index + match[0].length
    match = pattern.exec(value)
  }

  if (cursor < value.length || tokens.length === 0) {
    tokens.push({ type: 'text', value: value.slice(cursor) })
  }

  return tokens.map((token, index) => ({ ...token, key: `${token.type}-${index}` }))
})
</script>

<style scoped>
.qzone-display-name {
  display: inline;
  min-width: 0;
}

.friend-emoji {
  width: 1em;
  height: 1em;
  display: inline-block;
  object-fit: contain;
  vertical-align: -0.12em;
}
</style>
