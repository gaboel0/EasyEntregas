<script setup lang="ts" generic="T extends string">
defineProps<{
  options: readonly { value: T; label: string; count?: number }[]
  label: string
  size?: 'sm' | 'md'
}>()
const model = defineModel<T>({ required: true })

function onKeydown(event: KeyboardEvent, options: readonly { value: T }[], index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
  model.value = options[next]!.value
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')
  buttons?.[next]?.focus()
}
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5">
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :tabindex="model === option.value ? 0 : -1"
      class="inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors"
      :class="[
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        model === option.value ? 'bg-surface text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900',
      ]"
      @click="model = option.value"
      @keydown="onKeydown($event, options, index)"
    >
      {{ option.label }}
      <span
        v-if="option.count !== undefined"
        class="tabular rounded-full px-1.5 text-xs"
        :class="model === option.value ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'"
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
