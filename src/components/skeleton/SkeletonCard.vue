<script setup lang="ts">
import AppSkeleton from './AppSkeleton.vue'

/** Card genérico: título + linhas de texto, ou uma área (gráfico/mapa) de altura fixa. */
withDefaults(defineProps<{ lines?: number; height?: string; title?: boolean }>(), { lines: 3, title: true })
</script>

<template>
  <div class="card">
    <div v-if="title" class="card-header"><AppSkeleton w="9rem" h="0.9rem" /></div>
    <div class="p-4">
      <AppSkeleton v-if="height" :h="height" rounded="0.75rem" />
      <div v-else class="space-y-3">
        <AppSkeleton v-for="n in lines" :key="n" :w="n === lines ? '60%' : '100%'" h="0.85rem" />
      </div>
    </div>
  </div>
</template>
