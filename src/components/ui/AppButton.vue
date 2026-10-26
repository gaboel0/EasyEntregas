<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { LoaderCircle } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
    size?: 'sm' | 'md'
    type?: 'button' | 'submit'
    icon?: Component
    iconRight?: Component
    loading?: boolean
    disabled?: boolean
    to?: RouteLocationRaw
    block?: boolean
    title?: string
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)

const classes = computed(() => [
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors select-none',
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  props.size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
  props.block ? 'w-full' : '',
  {
    primary: 'bg-primary text-white shadow-xs hover:bg-primary-hover active:bg-primary-active',
    secondary: 'border border-slate-300 bg-surface text-slate-700 shadow-xs hover:bg-slate-100/70 active:bg-slate-100',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-danger text-white shadow-xs hover:bg-danger-hover active:bg-danger-hover',
    subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  }[props.variant],
])

const iconSize = computed(() => (props.size === 'sm' ? 14 : 16))
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes" :aria-disabled="disabled || undefined" :title="title">
    <component :is="icon" v-if="icon" :size="iconSize" aria-hidden="true" />
    <slot />
    <component :is="iconRight" v-if="iconRight" :size="iconSize" aria-hidden="true" />
  </RouterLink>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined" :title="title">
    <LoaderCircle v-if="loading" :size="iconSize" class="animate-spin" aria-hidden="true" />
    <component :is="icon" v-else-if="icon" :size="iconSize" aria-hidden="true" />
    <slot />
    <component :is="iconRight" v-if="iconRight" :size="iconSize" aria-hidden="true" />
  </button>
</template>
