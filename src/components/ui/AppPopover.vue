<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

withDefaults(defineProps<{ align?: 'left' | 'right'; width?: string }>(), { align: 'right', width: 'w-80' })

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function close() {
  open.value = false
}

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    close()
    root.value?.querySelector<HTMLElement>('[data-popover-trigger] button, [data-popover-trigger]')?.focus()
  }
}

watch(open, (value) => {
  if (value) document.addEventListener('mousedown', onDocumentClick)
  else document.removeEventListener('mousedown', onDocumentClick)
})

onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <div data-popover-trigger>
      <slot name="trigger" :open="open" :toggle="() => (open = !open)" />
    </div>
    <div
      v-if="open"
      class="absolute top-full z-40 mt-2 max-w-[calc(100vw-2rem)] animate-slide-up rounded-xl border border-slate-200 bg-surface shadow-lg"
      :class="[align === 'right' ? 'right-0' : 'left-0', width]"
    >
      <slot :close="close" />
    </div>
  </div>
</template>
