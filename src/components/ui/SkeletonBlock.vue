<script setup lang="ts">
withDefaults(defineProps<{ lines?: number; class?: string }>(), { lines: 1 })
</script>

<template>
  <div class="space-y-2" aria-hidden="true">
    <div v-for="n in lines" :key="n" class="h-4 animate-pulse rounded bg-slate-200/70" :class="[$props.class, n === lines && lines > 1 ? 'w-2/3' : '']" />
  </div>
</template>
