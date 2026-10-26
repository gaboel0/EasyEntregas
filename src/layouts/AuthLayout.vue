<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { Bike } from 'lucide-vue-next'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <a href="#conteudo" class="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Pular para o formulário</a>
    <header class="flex items-center justify-between px-4 py-4 sm:px-8">
      <RouterLink to="/login" class="flex items-center gap-2.5" aria-label="EasyEntregas">
        <span class="grid size-9 place-items-center rounded-xl bg-accent-solid text-[#0f172a]" aria-hidden="true"><Bike :size="18" /></span>
        <span class="text-base font-semibold tracking-tight text-slate-900">EasyEntregas</span>
      </RouterLink>
      <ThemeToggle />
    </header>

    <main id="conteudo" class="flex flex-1 items-start justify-center px-4 pt-4 pb-10 sm:items-center sm:pt-0" tabindex="-1">
      <div class="w-full max-w-md animate-slide-up">
        <RouterView />
      </div>
    </main>

    <footer class="px-4 pb-6 text-center text-xs text-slate-500">© EasyEntregas · Gestão de entregas para o seu delivery</footer>
  </div>
</template>
