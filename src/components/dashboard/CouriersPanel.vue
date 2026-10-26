<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { UserX } from 'lucide-vue-next'
import CourierStatusBadge from '@/components/ui/CourierStatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useFleetStore } from '@/stores/fleet'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from '@/composables/useNow'
import { formatDuration, minutesBetween } from '@/utils/format'

/** Situação dos motoboys agora: quem está livre, quem está em rota e a carga de cada um. */
const fleet = useFleetStore()
const settings = useSettingsStore()
const now = useNow()

const ORDER = { available: 0, busy: 1, unavailable: 2 } as const
const list = computed(() => [...fleet.views].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.profile.name.localeCompare(b.profile.name, 'pt-BR')))
const max = computed(() => settings.settings?.maxConcurrentDeliveriesPerCourier ?? 3)
const free = computed(() => fleet.views.filter((c) => c.status === 'available').length)
</script>

<template>
  <section class="card self-start" aria-labelledby="couriers-title">
    <div class="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
      <div>
        <h2 id="couriers-title" class="text-sm font-semibold text-slate-900">Motoboys</h2>
        <p class="text-xs text-slate-500">{{ free }} {{ free === 1 ? 'livre' : 'livres' }} agora</p>
      </div>
      <RouterLink :to="{ name: 'couriers' }" class="text-xs font-medium text-brand-600 hover:text-brand-700">Gerenciar</RouterLink>
    </div>

    <ul v-if="list.length" class="px-2 pb-2">
      <li v-for="c in list" :key="c.profile.id">
        <RouterLink :to="{ name: 'courier-detail', params: { id: c.profile.id } }" class="block rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-100/60">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium text-slate-900">{{ c.profile.name }}</span>
            <CourierStatusBadge :status="c.status" :overloaded="c.overloaded" />
          </div>
          <div class="mt-1.5 flex items-center gap-2">
            <div class="flex h-1.5 flex-1 gap-0.5" role="meter" :aria-valuenow="c.activeDeliveries.length" :aria-valuemax="max" :aria-label="`Carga de ${c.profile.name}`">
              <span v-for="n in max" :key="n" class="flex-1 rounded-full" :class="n <= c.activeDeliveries.length ? (c.overloaded ? 'bg-amber-500' : 'bg-primary') : 'bg-slate-200'" />
            </div>
            <span class="tabular text-xs text-slate-500">{{ c.activeDeliveries.length }}/{{ max }}</span>
          </div>
          <p class="mt-1 text-xs text-slate-500">
            <template v-if="c.onRouteSince">Em rota há {{ formatDuration(minutesBetween(c.onRouteSince, now)) }}</template>
            <template v-else-if="c.status === 'unavailable'">Fora de turno</template>
            <template v-else-if="c.activeDeliveries.length">Aguardando saída</template>
            <template v-else>Sem entregas</template>
          </p>
        </RouterLink>
      </li>
    </ul>
    <EmptyState v-else compact :icon="UserX" title="Nenhum motoboy cadastrado" description="Cadastre entregadores para atribuir pedidos.">
      <RouterLink :to="{ name: 'couriers' }" class="text-sm font-medium text-brand-600">Cadastrar motoboy</RouterLink>
    </EmptyState>
  </section>
</template>
