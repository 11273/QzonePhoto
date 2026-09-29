<template>
  <div
    :class="[
      'app-number-stepper',
      `is-${size}`,
      { 'is-disabled': disabled, 'is-readonly': readonly },
      $attrs.class
    ]"
    :style="$attrs.style"
  >
    <input
      :id="id"
      ref="inputRef"
      class="number-stepper-input"
      type="number"
      :name="name"
      :value="draftValue"
      :min="inputMin"
      :max="inputMax"
      :step="step"
      :disabled="disabled"
      :readonly="readonly"
      :aria-label="ariaLabel"
      inputmode="numeric"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @keydown.enter.prevent="commitAndBlur"
      @keydown.up.prevent="adjust(step)"
      @keydown.down.prevent="adjust(-step)"
      @keydown.home.prevent="setBoundary(min)"
      @keydown.end.prevent="setBoundary(max)"
    />

    <div class="number-stepper-actions">
      <button
        type="button"
        class="number-stepper-button is-increase"
        :disabled="disabled || readonly || atMaximum"
        :aria-label="increaseLabel"
        @click="adjust(step)"
      />
      <button
        type="button"
        class="number-stepper-button is-decrease"
        :disabled="disabled || readonly || atMinimum"
        :aria-label="decreaseLabel"
        @click="adjust(-step)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  min: {
    type: Number,
    default: Number.NEGATIVE_INFINITY
  },
  max: {
    type: Number,
    default: Number.POSITIVE_INFINITY
  },
  step: {
    type: Number,
    default: 1,
    validator: (value) => Number.isFinite(value) && value > 0
  },
  size: {
    type: String,
    default: 'default',
    validator: (value) => ['small', 'default'].includes(value)
  },
  id: {
    type: String,
    default: undefined
  },
  name: {
    type: String,
    default: undefined
  },
  ariaLabel: {
    type: String,
    default: undefined
  },
  increaseLabel: {
    type: String,
    default: '增加数值'
  },
  decreaseLabel: {
    type: String,
    default: '减少数值'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const inputRef = ref(null)
const isFocused = ref(false)

const decimalPlaces = computed(() => {
  const stepText = String(props.step)
  if (stepText.includes('e-')) return Number(stepText.split('e-')[1]) || 0
  return stepText.includes('.') ? stepText.split('.')[1].length : 0
})

const clampValue = (value) => {
  const numericValue = Number(value)
  const fallback = Number.isFinite(Number(props.modelValue)) ? Number(props.modelValue) : 0
  const safeValue = Number.isFinite(numericValue) ? numericValue : fallback
  const boundedValue = Math.min(props.max, Math.max(props.min, safeValue))
  return Number(boundedValue.toFixed(decimalPlaces.value))
}

const normalizedValue = computed(() => clampValue(props.modelValue))
const draftValue = ref(String(normalizedValue.value))
const lastCommittedValue = ref(normalizedValue.value)

const inputMin = computed(() => (Number.isFinite(props.min) ? props.min : undefined))
const inputMax = computed(() => (Number.isFinite(props.max) ? props.max : undefined))
const atMinimum = computed(() => normalizedValue.value <= props.min)
const atMaximum = computed(() => normalizedValue.value >= props.max)

watch(
  () => props.modelValue,
  (value) => {
    if (!isFocused.value) {
      const nextValue = clampValue(value)
      draftValue.value = String(nextValue)
      lastCommittedValue.value = nextValue
    }
  }
)

const commitValue = (value, notifyChange = true) => {
  const nextValue = clampValue(value)
  draftValue.value = String(nextValue)

  const modelChanged = !Object.is(nextValue, props.modelValue)
  const committedChanged = !Object.is(nextValue, lastCommittedValue.value)

  if (modelChanged) {
    emit('update:modelValue', nextValue)
  }
  if (notifyChange && committedChanged) {
    lastCommittedValue.value = nextValue
    emit('change', nextValue)
  }
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
  commitValue(draftValue.value)
}

const handleInput = (event) => {
  draftValue.value = event.target.value
  if (event.target.value === '') return

  const parsedValue = Number(event.target.value)
  if (Number.isFinite(parsedValue) && parsedValue >= props.min && parsedValue <= props.max) {
    emit('update:modelValue', parsedValue)
  }
}

const commitAndBlur = () => {
  inputRef.value?.blur()
}

const adjust = (offset) => {
  if (props.disabled || props.readonly) return
  commitValue(normalizedValue.value + offset)
}

const setBoundary = (value) => {
  if (props.disabled || props.readonly || !Number.isFinite(value)) return
  commitValue(value)
}
</script>

<style lang="scss" scoped>
.app-number-stepper {
  --number-stepper-height: var(--theme-control);
  --number-stepper-action-width: 28px;

  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--number-stepper-action-width);
  width: 96px;
  height: var(--number-stepper-height);
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-sm);
  background: var(--theme-surface-raised);
  transition:
    border-color var(--theme-duration-fast) var(--theme-ease),
    background-color var(--theme-duration-fast) var(--theme-ease),
    box-shadow var(--theme-duration-fast) var(--theme-ease);

  &.is-small {
    --number-stepper-height: var(--theme-control-sm);
    --number-stepper-action-width: 26px;
  }

  &:hover:not(.is-disabled) {
    border-color: var(--theme-border-strong);
    background: var(--theme-surface-hover);
  }

  &:focus-within:not(.is-disabled) {
    border-color: var(--theme-brand-accent);
    background: var(--theme-surface-hover);
    box-shadow: 0 0 0 2px var(--theme-focus-ring);
  }

  &.is-disabled,
  &.is-readonly {
    background: var(--theme-surface-disabled);
  }

  &.is-disabled {
    opacity: 0.46;
  }
}

.number-stepper-input {
  width: 100%;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0 10px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--theme-text-primary);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  appearance: textfield;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
  }

  &:disabled,
  &:read-only {
    cursor: not-allowed;
  }
}

.number-stepper-actions {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--theme-border);
}

.number-stepper-button {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  outline: 0;
  background: var(--theme-surface-soft);
  color: var(--theme-text-muted);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    color var(--theme-duration-fast) var(--theme-ease),
    background-color var(--theme-duration-fast) var(--theme-ease);

  &::before {
    width: 5px;
    height: 5px;
    box-sizing: border-box;
    border-top: 1px solid currentColor;
    border-left: 1px solid currentColor;
    content: '';
  }

  &.is-increase {
    border-bottom: 1px solid var(--theme-border);

    &::before {
      transform: translateY(1px) rotate(45deg);
    }
  }

  &.is-decrease::before {
    transform: translateY(-1px) rotate(225deg);
  }

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: var(--theme-surface-active);
    color: var(--theme-text-primary);
  }

  &:focus-visible:not(:disabled) {
    box-shadow: inset 0 0 0 1px var(--theme-focus);
  }

  &:active:not(:disabled) {
    background: var(--theme-brand-soft);
    color: var(--theme-brand-text);
  }

  &:disabled {
    color: var(--theme-text-disabled);
    cursor: not-allowed;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-number-stepper,
  .number-stepper-button {
    transition: none;
  }
}
</style>
