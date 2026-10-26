<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * Campo numérico que aceita vírgula decimal (padrão brasileiro) e emite `number | null`.
 */
const props = withDefaults(
  defineProps<{
    modelValue: number | null
    id?: string
    prefix?: string
    suffix?: string
    decimals?: number
    min?: number
    placeholder?: string
    invalid?: boolean
    describedby?: string
    disabled?: boolean
  }>(),
  { decimals: 2 },
)
defineOptions({ inheritAttrs: false })
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const format = (v: number | null) =>
  v === null || !Number.isFinite(v) ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: props.decimals, useGrouping: false })

const text = ref(format(props.modelValue))

watch(
  () => props.modelValue,
  (v) => {
    if (parse(text.value) !== v) text.value = format(v)
  },
)

function parse(value: string): number | null {
  // Com vírgula, pontos são separadores de milhar ("1.234,5"); sem vírgula, o ponto é decimal ("6.19").
  let normalized = value.trim().replace(/\s/g, '')
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.')
  if (normalized === '' || normalized === '-') return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/[^\d,.-]/g, '')
  text.value = raw
  emit('update:modelValue', parse(raw))
}

function onBlur() {
  text.value = format(parse(text.value))
}
</script>

<template>
  <div class="relative">
    <span v-if="prefix" class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500">{{ prefix }}</span>
    <input
      :id="id"
      :value="text"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      class="field-input tabular"
      :class="{ 'pl-9': prefix, 'pr-12': suffix }"
      :placeholder="placeholder"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      :disabled="disabled"
      v-bind="$attrs"
      @input="onInput"
      @blur="onBlur"
    />
    <span v-if="suffix" class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{{ suffix }}</span>
  </div>
</template>
