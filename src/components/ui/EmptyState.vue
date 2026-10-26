<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from 'lucide-vue-next'

withDefaults(defineProps<{ title: string; description?: string; icon?: Component; compact?: boolean }>(), { icon: () => Inbox })
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center" :class="compact ? 'px-4 py-6' : 'px-6 py-12'">
    <span class="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
      <component :is="icon" :size="20" />
    </span>
    <p class="mt-3 text-sm font-medium text-slate-900">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-slate-500">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
