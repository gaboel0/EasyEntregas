<script setup lang="ts">
import { Bike, Store } from 'lucide-vue-next'
import type { AuthRole } from '@/services'

const model = defineModel<AuthRole>({ required: true })

const OPTIONS = [
  { value: 'establishment' as AuthRole, label: 'Sou estabelecimento', icon: Store },
  { value: 'courier' as AuthRole, label: 'Sou entregador', icon: Bike },
]

function onKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return
  event.preventDefault()
  const next = OPTIONS[(index + (event.key === 'ArrowRight' ? 1 : -1) + OPTIONS.length) % OPTIONS.length]!
  model.value = next.value
  ;(event.currentTarget as HTMLElement).parentElement?.querySelectorAll('button')[OPTIONS.indexOf(next)]?.focus()
}
</script>

<template>
  <div role="radiogroup" aria-label="Tipo de conta" class="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
    <button
      v-for="(option, index) in OPTIONS"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :tabindex="model === option.value ? 0 : -1"
      class="flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors"
      :class="model === option.value ? 'bg-surface text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'"
      @click="model = option.value"
      @keydown="onKeydown($event, index)"
    >
      <component :is="option.icon" :size="16" aria-hidden="true" />
      {{ option.label }}
    </button>
  </div>
</template>
