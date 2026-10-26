<script setup lang="ts">
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const ICON = { success: CircleCheck, error: CircleX, info: Info, warning: TriangleAlert }
const TONE = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  info: 'text-brand-600',
  warning: 'text-amber-600',
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite" aria-atomic="false">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-surface p-3 shadow-lg"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
      >
        <component :is="ICON[toast.tone]" :size="18" class="mt-0.5 shrink-0" :class="TONE[toast.tone]" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-900">{{ toast.title }}</p>
          <p v-if="toast.description" class="mt-0.5 text-xs text-slate-600">{{ toast.description }}</p>
        </div>
        <button type="button" class="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Fechar aviso" @click="dismiss(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
