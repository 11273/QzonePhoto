<template>
  <div v-if="supported" class="transfer-limit-setting">
    <div class="limit-copy">
      <label :for="id">{{ label }}限速</label>
      <span :id="`${id}-hint`">全部{{ label }}任务共用</span>
    </div>
    <div class="limit-controls">
      <select
        :id="id"
        v-model="selection"
        :disabled="busy"
        :aria-label="`${label}限速`"
        :aria-describedby="`${id}-hint`"
        @change="selectRate"
      >
        <option value="0">不限速</option>
        <option v-for="rate in presets" :key="rate" :value="String(rate)">
          {{ format(rate) }}
        </option>
        <option value="custom">自定义</option>
      </select>
      <form
        v-if="selection === 'custom'"
        class="limit-custom"
        novalidate
        @submit.prevent="applyCustom"
      >
        <input
          v-model="amount"
          type="number"
          min="0"
          step="any"
          :disabled="busy"
          :aria-label="`${label}限速数值`"
          :aria-invalid="Boolean(error)"
          :aria-describedby="`${id}-error`"
          @keydown.enter.stop.prevent="applyCustom"
        />
        <select v-model="unit" :disabled="busy" :aria-label="`${label}限速单位`">
          <option :value="1024">KB/s</option>
          <option :value="1048576">MB/s</option>
        </select>
        <button type="submit" :disabled="busy">{{ busy ? '保存中…' : '应用' }}</button>
      </form>
      <span v-if="selection === 'custom'" class="limit-current" role="status"
        >当前：{{ format(applied) }}</span
      >
      <p v-if="error" :id="`${id}-error`" class="limit-error" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { normalizeTransferRate } from '@shared/transfer-rate.mjs'

const props = defineProps({
  direction: {
    type: String,
    required: true,
    validator: (value) => ['download', 'upload'].includes(value)
  },
  active: { type: Boolean, default: true }
})
const id = useId()
const label = computed(() => (props.direction === 'download' ? '下载' : '上传'))
const api = window.QzoneAPI?.[props.direction]
const supported = Boolean(api?.getSpeedLimit && api?.setSpeedLimit)
const presets = [128 * 1024, 512 * 1024, 1024 ** 2, 2 * 1024 ** 2, 5 * 1024 ** 2]
const applied = ref(0)
const selection = ref('0')
const amount = ref('1')
const unit = ref(1048576)
const busy = ref(false)
const error = ref('')
const format = (rate) =>
  !rate ? '不限速' : rate >= 1048576 ? `${rate / 1048576} MB/s` : `${rate / 1024} KB/s`

const sync = (rate) => {
  applied.value = normalizeTransferRate(rate)
  selection.value = !rate || presets.includes(rate) ? String(rate) : 'custom'
  unit.value = rate >= 1048576 ? 1048576 : 1024
  amount.value = rate ? String(rate / unit.value) : '1'
}
watch(
  () => props.active,
  async (active) => {
    if (!active || !supported || busy.value) return
    busy.value = true
    error.value = ''
    try {
      sync(await api.getSpeedLimit())
    } catch {
      error.value = '读取限速设置失败，请重新打开设置重试'
    } finally {
      busy.value = false
    }
  },
  { immediate: true }
)

const save = async (rate) => {
  error.value = ''
  try {
    normalizeTransferRate(rate)
    busy.value = true
    sync(await api.setSpeedLimit(rate))
  } catch (cause) {
    error.value = cause.message || '保存失败，请重试'
  } finally {
    busy.value = false
  }
}
const selectRate = async () => {
  error.value = ''
  if (selection.value === 'custom') return
  const previous = applied.value
  await save(Number(selection.value))
  if (error.value)
    selection.value = !previous || presets.includes(previous) ? String(previous) : 'custom'
}
const applyCustom = () => {
  if (
    !String(amount.value).trim() ||
    !Number.isFinite(Number(amount.value)) ||
    Number(amount.value) <= 0
  ) {
    error.value = '请输入至少 1 KB/s 的速度，取消限速请选择“不限速”'
    return
  }
  return save(Math.round(Number(amount.value) * unit.value))
}
</script>

<style scoped>
.transfer-limit-setting {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  min-width: 0;
}
.limit-copy {
  display: grid;
  gap: 2px;
}
.limit-copy label {
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.limit-copy span,
.limit-current {
  color: var(--theme-text-muted);
  font-size: 11px;
}
.limit-controls {
  display: grid;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}
select,
input,
button {
  min-height: 32px;
  min-width: 0;
  padding: 4px 8px;
  color: var(--theme-text-primary);
  background: var(--theme-surface-soft);
  border: 1px solid var(--theme-border-subtle);
  border-radius: var(--theme-radius-sm);
  font: inherit;
  font-size: 12px;
}
select,
button {
  cursor: pointer;
}
select:focus-visible,
input:focus-visible,
button:focus-visible {
  outline: 2px solid var(--theme-info);
  outline-offset: 2px;
}
:disabled {
  cursor: wait;
  opacity: 0.6;
}
.limit-custom {
  display: grid;
  grid-template-columns: minmax(0, 90px) minmax(0, 78px) auto;
  gap: 6px;
  max-width: 100%;
}
.limit-error {
  color: var(--theme-danger);
  font-size: 12px;
  margin: 0;
  max-width: 260px;
  overflow-wrap: anywhere;
}
input[aria-invalid='true'] {
  border-color: var(--theme-danger);
}
</style>
