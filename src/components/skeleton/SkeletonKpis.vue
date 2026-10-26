<script setup lang="ts">
import AppSkeleton from './AppSkeleton.vue'

withDefaults(defineProps<{ count?: number }>(), { count: 10 })
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    <div v-for="n in count" :key="n" class="card flex flex-col gap-3 p-4">
      <div class="flex items-center justify-between">
        <AppSkeleton w="45%" h="0.75rem" />
        <AppSkeleton w="1.75rem" h="1.75rem" rounded="0.5rem" />
      </div>
      <AppSkeleton w="55%" h="1.5rem" />
      <AppSkeleton w="70%" h="0.75rem" />
    </div>
  </div>
</template>
