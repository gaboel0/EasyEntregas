<script setup lang="ts">
/**
 * Primitivo de skeleton: uma forma neutra com brilho suave (shimmer, definido em style.css).
 * Sempre decorativo (aria-hidden); o contêiner que o usa deve anunciar o carregamento
 * (ver SkeletonRegion). Use largura/altura em qualquer unidade CSS.
 */
withDefaults(defineProps<{ w?: string; h?: string; circle?: boolean; rounded?: string }>(), { w: '100%', h: '1rem', rounded: '0.375rem' })
</script>

<template>
  <span class="skeleton block" :style="{ width: w, height: h, borderRadius: circle ? '9999px' : rounded }" aria-hidden="true" />
</template>
