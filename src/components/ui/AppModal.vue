<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Impede fechar clicando fora (ex.: formulários com dados). */
    persistent?: boolean
    /** Diálogo que abre por cima de outro modal (ex.: confirmação). */
    elevated?: boolean
  }>(),
  { size: 'md' },
)
const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const titleId = useId()
let previouslyFocused: HTMLElement | null = null

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      document.body.style.overflow = 'hidden'
      await nextTick()
      const target = panel.value?.querySelector<HTMLElement>('[autofocus]') ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    } else {
      document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4" :class="elevated ? 'z-[70]' : 'z-50'" @keydown="onKeydown">
      <div class="absolute inset-0 animate-fade-in bg-black/40" aria-hidden="true" @click="!persistent && emit('close')" />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="relative flex max-h-[92vh] w-full animate-slide-up flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl"
        :class="widths[size]"
      >
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0">
            <h2 :id="titleId" class="text-base font-semibold text-slate-900">{{ title }}</h2>
            <p v-if="description" class="mt-0.5 text-sm text-slate-500">{{ description }}</p>
          </div>
          <button type="button" class="-mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar" @click="emit('close')">
            <X :size="18" />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-100/50 px-5 py-3">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
