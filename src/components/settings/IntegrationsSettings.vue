<script setup lang="ts">
import { Plug } from 'lucide-vue-next'
import { INTEGRATIONS } from '@/services/integrations'
</script>

<template>
  <section class="card">
    <div class="card-header"><h2 class="card-title">Integrações</h2></div>
    <p class="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
      Nenhuma integração externa está ativa nesta versão. Os pedidos são cadastrados manualmente. Cada integração abaixo será configurada no backend, que guarda as credenciais com segurança.
    </p>
    <ul class="divide-y divide-slate-100">
      <li v-for="i in INTEGRATIONS" :key="i.key" class="flex gap-3 px-4 py-3">
        <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500" aria-hidden="true"><Plug :size="16" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-medium text-slate-900">{{ i.name }}</p>
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Não conectado</span>
          </div>
          <p class="text-sm text-slate-600">{{ i.description }}</p>
          <p class="mt-0.5 text-xs text-slate-500"><strong class="font-medium">Necessário:</strong> {{ i.requires }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>
