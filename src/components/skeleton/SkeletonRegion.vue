<script setup lang="ts">
/** Envolve um conjunto de skeletons e anuncia o carregamento para leitores de tela. */
withDefaults(defineProps<{ label?: string }>(), { label: 'Carregando…' })
</script>

<template>
  <div role="status" aria-busy="true" aria-live="polite">
    <span class="sr-only">{{ label }}</span>
    <slot />
  </div>
</template>
