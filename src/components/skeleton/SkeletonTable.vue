<script setup lang="ts">
import AppSkeleton from './AppSkeleton.vue'

/** Tabela em carregamento: cabeçalho + linhas com a primeira coluna mais forte. */
withDefaults(defineProps<{ rows?: number; cols?: number }>(), { rows: 6, cols: 6 })
</script>

<template>
  <div class="overflow-hidden" aria-hidden="true">
    <div class="flex gap-4 border-b border-slate-200 px-3 py-3">
      <AppSkeleton v-for="c in cols" :key="c" :w="c === 1 ? '3rem' : '4.5rem'" h="0.65rem" />
    </div>
    <div v-for="r in rows" :key="r" class="flex items-center gap-4 border-b border-slate-200/60 px-3 py-3.5 last:border-0">
      <div v-for="c in cols" :key="c" class="min-w-0" :class="c === 2 ? 'flex-[2]' : 'flex-1'">
        <AppSkeleton :w="c === 1 ? '3rem' : c === cols ? '4rem' : `${60 + ((r * 7 + c * 13) % 35)}%`" h="0.8rem" />
        <AppSkeleton v-if="c === 2 || c === 3" class="mt-1.5" w="45%" h="0.6rem" />
      </div>
    </div>
  </div>
</template>
