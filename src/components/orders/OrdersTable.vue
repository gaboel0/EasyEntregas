<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Clock, MapPinOff } from 'lucide-vue-next'
import type { OrderView } from '@/modules/orders/orderViews'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useOrderActions } from '@/composables/useOrderActions'
import { ORDER_SOURCE_LABEL } from '@/modules/orders/orderLabels'
import { formatCurrency, formatDuration, formatKm, formatOrderNumber, formatPhone, formatRelative, formatTime } from '@/utils/format'
import { useNow } from '@/composables/useNow'

withDefaults(defineProps<{ views: OrderView[]; compact?: boolean; showActions?: boolean }>(), { showActions: true })
const emit = defineEmits<{ select: [view: OrderView] }>()

const now = useNow()
const actions = useOrderActions()

function openOrder(view: OrderView, event: MouseEvent) {
  if ((event.target as HTMLElement).closest('a, button')) return
  emit('select', view)
}
</script>

<template>
  <ul class="divide-y divide-slate-200/60 md:hidden">
    <li v-for="v in views" :key="`m-${v.order.id}`" :class="v.isDispatchLate ? 'bg-amber-50/50' : ''">
      <button type="button" class="block w-full px-4 py-3.5 text-left" :aria-label="`Abrir pedido ${formatOrderNumber(v.order.number)} de ${v.order.customerName}`" @click="emit('select', v)">
        <span class="flex items-start justify-between gap-3">
          <span class="min-w-0 font-semibold text-slate-900">{{ formatOrderNumber(v.order.number) }} {{ v.order.customerName }}</span>
          <span class="tabular shrink-0 font-semibold text-slate-900">{{ formatCurrency(v.total) }}</span>
        </span>
        <span class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <StatusBadge :status="v.order.status" :pickup="v.order.fulfillment === 'pickup'" />
          <span>{{ ORDER_SOURCE_LABEL[v.order.source] }}, {{ formatTime(v.order.createdAt) }}</span>
        </span>
        <span class="mt-1 block truncate text-xs" :class="v.isDispatchLate ? 'font-medium text-amber-800' : 'text-slate-500'">
          {{ v.order.fulfillment === 'pickup' ? 'Retirada no balcão' : v.courier ? `Motoboy ${v.courier.name.split(' ')[0]}` : v.isDispatchLate ? `Sem motoboy, pronto há ${formatDuration(v.waitingMinutes)}` : 'Sem motoboy' }}
        </span>
      </button>
    </li>
  </ul>

  <div class="hidden overflow-x-auto md:block">
    <table class="table-base">
      <thead>
        <tr>
          <th scope="col">Pedido</th>
          <th scope="col">Cliente</th>
          <th scope="col" :class="{ 'hidden xl:table-cell': compact }">Endereço</th>
          <th v-if="!compact" scope="col">Origem</th>
          <th scope="col">Motoboy</th>
          <th scope="col">Status</th>
          <th scope="col" class="text-right">Total</th>
          <th v-if="showActions" scope="col" class="text-right"><span class="sr-only">Ações</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="v in views"
          :key="v.order.id"
          class="cursor-pointer transition-colors hover:bg-slate-100/70"
          :class="{ 'bg-amber-50/60 hover:bg-amber-50': v.isDispatchLate }"
          @click="openOrder(v, $event)"
        >
          <td class="whitespace-nowrap">
            <RouterLink :to="{ name: 'order-detail', params: { id: v.order.id } }" class="font-semibold text-slate-900 hover:text-brand-700">
              {{ formatOrderNumber(v.order.number) }}
            </RouterLink>
            <p class="tabular text-xs text-slate-500" :title="formatRelative(v.order.createdAt, now)">{{ formatTime(v.order.createdAt) }}</p>
          </td>
          <td class="max-w-48">
            <p class="truncate font-medium text-slate-800">{{ v.order.customerName }}</p>
            <p class="tabular truncate text-xs text-slate-500">{{ formatPhone(v.order.customerPhone) }}</p>
          </td>
          <td class="max-w-64" :class="{ 'hidden xl:table-cell': compact }">
            <p v-if="v.order.fulfillment === 'pickup'" class="truncate text-slate-700">Retirada no balcão</p>
            <p v-else class="truncate text-slate-700">{{ v.order.address.street }}, {{ v.order.address.number }}</p>
            <p v-if="v.order.fulfillment !== 'pickup'" class="flex items-center gap-1 truncate text-xs text-slate-500">
              {{ v.order.address.district }}
              <span v-if="v.order.address.distanceKm !== null">· {{ formatKm(v.order.address.distanceKm) }}</span>
              <MapPinOff v-if="!v.order.address.location" :size="12" class="text-slate-400" aria-label="sem coordenadas" />
            </p>
          </td>
          <td v-if="!compact" class="text-xs whitespace-nowrap text-slate-600">{{ ORDER_SOURCE_LABEL[v.order.source] }}</td>
          <td class="max-w-36 truncate text-sm">
            <span v-if="v.courier" class="text-slate-700">{{ v.courier.name.split(' ')[0] }}</span>
            <span v-else-if="v.order.fulfillment === 'pickup'" class="text-xs text-slate-400">Retirada</span>
            <span v-else class="text-xs text-slate-400">Não atribuído</span>
          </td>
          <td class="whitespace-nowrap">
            <StatusBadge :status="v.order.status" :pickup="v.order.fulfillment === 'pickup'" />
            <p v-if="v.waitingMinutes !== null" class="mt-1 flex items-center gap-1 text-xs" :class="v.isDispatchLate ? 'font-semibold text-amber-700' : 'text-slate-500'">
              <Clock :size="11" aria-hidden="true" /> pronto há {{ formatDuration(v.waitingMinutes) }}
            </p>
          </td>
          <td class="tabular text-right whitespace-nowrap">
            <p class="font-medium text-slate-900">{{ formatCurrency(v.total) }}</p>
            <p class="text-xs text-slate-500">frete {{ formatCurrency(v.order.freightFee) }}</p>
          </td>
          <td v-if="showActions" class="text-right whitespace-nowrap">
            <template v-for="action in [actions.primaryAction(v)]" :key="action?.to ?? 'none'">
              <AppButton
                v-if="action"
                size="sm"
                :variant="action.blockedReason ? 'ghost' : 'secondary'"
                :disabled="!!action.blockedReason"
                :loading="actions.isPending(v.order.id)"
                :title="action.blockedReason ?? action.label"
                @click="actions.changeStatus(v, action.to)"
              >
                {{ action.label }}
              </AppButton>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
