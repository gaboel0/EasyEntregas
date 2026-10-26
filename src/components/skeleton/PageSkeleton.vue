<script setup lang="ts">
import AppSkeleton from './AppSkeleton.vue'
import SkeletonRegion from './SkeletonRegion.vue'
import SkeletonKpis from './SkeletonKpis.vue'
import SkeletonCard from './SkeletonCard.vue'
import SkeletonTable from './SkeletonTable.vue'
import type { SkeletonVariant } from './variants'

/** Esqueleto de página inteira, usado enquanto os dados do estabelecimento carregam. */
withDefaults(defineProps<{ variant?: SkeletonVariant }>(), { variant: 'generic' })
</script>

<template>
  <SkeletonRegion label="Carregando a página…">
    <!-- cabeçalho comum (título, descrição e ação) -->
    <div class="mb-5 flex items-end justify-between gap-4">
      <div class="space-y-2.5">
        <AppSkeleton w="12rem" h="1.4rem" />
        <AppSkeleton w="min(26rem, 70vw)" h="0.8rem" />
      </div>
      <AppSkeleton v-if="variant !== 'dashboard' && variant !== 'settings'" class="hidden sm:block" w="7.5rem" h="2.25rem" rounded="0.5rem" />
    </div>

    <template v-if="variant === 'dashboard'">
      <SkeletonKpis :count="10" />
      <div class="mt-5 grid gap-5 xl:grid-cols-3">
        <div class="xl:col-span-2"><SkeletonCard height="14rem" /></div>
        <SkeletonCard :lines="8" />
      </div>
      <div class="mt-5 grid gap-5 xl:grid-cols-3">
        <div class="card xl:col-span-2">
          <div class="card-header"><AppSkeleton w="9rem" h="0.9rem" /></div>
          <SkeletonTable :rows="5" :cols="5" />
        </div>
        <SkeletonCard :lines="7" />
      </div>
    </template>

    <div v-else-if="variant === 'list'" class="card">
      <div class="space-y-3 p-3">
        <div class="flex gap-2 overflow-hidden"><AppSkeleton v-for="n in 6" :key="n" w="7rem" h="2rem" rounded="0.5rem" /></div>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><AppSkeleton v-for="n in 5" :key="n" h="2.25rem" rounded="0.5rem" /></div>
      </div>
      <SkeletonTable :rows="9" :cols="7" />
    </div>

    <div v-else-if="variant === 'detail'" class="space-y-5">
      <div class="card flex justify-between gap-4 p-5"><AppSkeleton v-for="n in 6" :key="n" w="2rem" h="2rem" circle /></div>
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="space-y-5"><SkeletonCard :lines="4" /><SkeletonCard :lines="5" /><SkeletonCard :lines="4" /></div>
        <div class="space-y-5"><SkeletonCard :lines="5" /><SkeletonCard :lines="6" /></div>
      </div>
    </div>

    <div v-else-if="variant === 'form'" class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-5">
        <div v-for="n in 3" :key="n" class="card">
          <div class="card-header"><AppSkeleton w="9rem" h="0.9rem" /></div>
          <div class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="f in 6" :key="f" class="space-y-1.5"><AppSkeleton w="40%" h="0.65rem" /><AppSkeleton h="2.25rem" rounded="0.5rem" /></div>
          </div>
        </div>
      </div>
      <div class="space-y-5"><SkeletonCard :lines="4" /><SkeletonCard :lines="6" /></div>
    </div>

    <div v-else-if="variant === 'map'" class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <SkeletonCard :lines="12" />
      <div class="card"><AppSkeleton h="min(32rem, 60vh)" rounded="0.75rem" /></div>
    </div>

    <div v-else-if="variant === 'settings'" class="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div class="space-y-2"><AppSkeleton v-for="n in 7" :key="n" h="2.25rem" rounded="0.5rem" /></div>
      <div class="card">
        <div class="card-header"><AppSkeleton w="10rem" h="0.9rem" /></div>
        <div class="grid gap-4 p-4 sm:grid-cols-2">
          <div v-for="f in 8" :key="f" class="space-y-1.5"><AppSkeleton w="40%" h="0.65rem" /><AppSkeleton h="2.25rem" rounded="0.5rem" /></div>
        </div>
      </div>
    </div>

    <div v-else class="space-y-5"><SkeletonCard :lines="4" /><SkeletonCard :lines="6" /></div>
  </SkeletonRegion>
</template>
