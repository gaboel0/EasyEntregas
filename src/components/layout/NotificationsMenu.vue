<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Bell, CircleX, Clock, PackagePlus } from 'lucide-vue-next'
import AppPopover from '@/components/ui/AppPopover.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useNotificationsStore } from '@/stores/notifications'
import { formatRelative } from '@/utils/format'
import { useNow } from '@/composables/useNow'

const notifications = useNotificationsStore()
const now = useNow()

const ICON = { warning: Clock, danger: CircleX, info: PackagePlus }
const TONE = { warning: 'bg-amber-50 text-amber-600', danger: 'bg-rose-50 text-rose-600', info: 'bg-brand-50 text-brand-600' }
</script>

<template>
  <AppPopover width="w-96">
    <template #trigger="{ toggle, open }">
      <button
        type="button"
        class="relative grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        :aria-label="`Notificações${notifications.unread.length ? ` (${notifications.unread.length} não lidas)` : ''}`"
        :aria-expanded="open"
        @click="toggle"
      >
        <Bell :size="18" />
        <span
          v-if="notifications.unread.length"
          class="tabular absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white"
        >
          {{ notifications.unread.length > 9 ? '9+' : notifications.unread.length }}
        </span>
      </button>
    </template>
    <template #default="{ close }">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p class="text-sm font-semibold text-slate-900">Alertas da operação</p>
        <button
          v-if="notifications.unread.length"
          type="button"
          class="text-xs font-medium text-brand-600 hover:text-brand-700"
          @click="notifications.markAllRead()"
        >
          Marcar todos como lidos
        </button>
      </div>
      <ul v-if="notifications.items.length" class="max-h-[60vh] overflow-y-auto py-1">
        <li v-for="n in notifications.items.slice(0, 20)" :key="n.id">
          <RouterLink
            :to="n.to"
            class="flex gap-3 px-4 py-2.5 hover:bg-slate-100/70"
            @click="notifications.markRead(n.id), close()"
          >
            <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg" :class="TONE[n.tone]" aria-hidden="true">
              <component :is="ICON[n.tone]" :size="14" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-slate-900">{{ n.title }}</span>
                <span v-if="!notifications.unread.some((u) => u.id === n.id)" class="sr-only">(lido)</span>
                <span v-else class="size-1.5 shrink-0 rounded-full bg-brand-500" aria-label="não lido" />
              </span>
              <span class="block truncate text-xs text-slate-500">{{ n.description }}</span>
              <span class="block text-[11px] text-slate-400">{{ formatRelative(n.at, now) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
      <EmptyState v-else compact title="Nenhum alerta no momento" description="Avisos sobre atrasos, falhas e novos pedidos aparecem aqui." />
      <p class="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Ajuste quais alertas aparecem em Configurações › Notificações.</p>
    </template>
  </AppPopover>
</template>
