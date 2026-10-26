<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { ArrowUpRight } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    label: string
    value: string
    hint?: string
    icon?: Component
    tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'info'
    to?: RouteLocationRaw
    /** Explicação de como o número é calculado (tooltip nativo). */
    definition?: string
  }>(),
  { tone: 'neutral' },
)

const ICON_TONE = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-50 text-sky-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
}
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to"
    class="card group relative flex flex-col gap-2 p-4 transition-colors"
    :class="to ? 'hover:border-brand-200 hover:bg-brand-50/30 focus-visible:border-brand-300' : ''"
    :title="definition"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-slate-500">{{ label }}</span>
      <span v-if="icon" class="grid size-7 place-items-center rounded-lg" :class="ICON_TONE[tone]" aria-hidden="true">
        <component :is="icon" :size="15" />
      </span>
    </div>
    <span class="tabular text-2xl leading-none font-semibold tracking-tight text-slate-900">{{ value }}</span>
    <span v-if="hint" class="text-xs text-slate-500">{{ hint }}</span>
    <ArrowUpRight
      v-if="to"
      :size="14"
      class="absolute right-3 bottom-3 text-slate-300 transition-colors group-hover:text-brand-500"
      aria-hidden="true"
    />
  </component>
</template>
