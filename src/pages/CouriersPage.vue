<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { Pencil, Plus, Search, UserX } from 'lucide-vue-next'
import type { CourierProfile, CourierStatus } from '@/types/domain'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import CourierStatusBadge from '@/components/ui/CourierStatusBadge.vue'
import CourierFormModal from '@/components/couriers/CourierFormModal.vue'
import { useFleetStore } from '@/stores/fleet'
import { useOrdersStore } from '@/stores/orders'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { LINK_TYPE_LABEL, VEHICLE_TYPE_LABEL, describeCompensation } from '@/modules/couriers/courierLabels'
import { formatPhone } from '@/utils/format'
import { normalizeText } from '@/utils/text'
import { rangeForPreset, isWithin } from '@/utils/date'
import { useNow } from '@/composables/useNow'

const route = useRoute()
const router = useRouter()
const fleet = useFleetStore()
const orders = useOrdersStore()
const settings = useSettingsStore()
const session = useSessionStore()
const now = useNow()

type Filter = 'all' | CourierStatus
const filter = computed<Filter>({
  get: () => (typeof route.query.status === 'string' ? (route.query.status as Filter) : 'all'),
  set: (v) => router.replace({ query: { ...route.query, status: v === 'all' ? undefined : v } }),
})
const search = ref('')

const options = computed(() => [
  { value: 'all' as Filter, label: 'Todos', count: fleet.views.length },
  { value: 'available' as Filter, label: 'Disponíveis', count: fleet.views.filter((c) => c.status === 'available').length },
  { value: 'busy' as Filter, label: 'Ocupados', count: fleet.views.filter((c) => c.status === 'busy').length },
  { value: 'unavailable' as Filter, label: 'Indisponíveis', count: fleet.views.filter((c) => c.status === 'unavailable').length },
])

const deliveredLast30 = computed(() => {
  const range = rangeForPreset('last30', now.value)
  const map = new Map<string, number>()
  for (const d of orders.deliveries) {
    if (d.status === 'delivered' && d.courierId && d.completedAt && isWithin(d.completedAt, range)) map.set(d.courierId, (map.get(d.courierId) ?? 0) + 1)
  }
  return map
})

const list = computed(() => {
  const term = normalizeText(search.value.trim())
  return fleet.views.filter(
    (c) =>
      (filter.value === 'all' || c.status === filter.value) &&
      (!term || normalizeText(`${c.profile.name} ${c.profile.link.internalCode} ${c.profile.phone}`).includes(term)),
  )
})

const formOpen = ref(false)
const editing = ref<CourierProfile | null>(null)
function openForm(courier: CourierProfile | null) {
  editing.value = courier
  formOpen.value = true
}

function goTo(id: string, event: MouseEvent) {
  if ((event.target as HTMLElement).closest('a, button')) return
  router.push({ name: 'courier-detail', params: { id } })
}
</script>

<template>
  <div>
    <PageHeader title="Motoboys" description="Entregadores vinculados a este estabelecimento, sua disponibilidade e regras de remuneração.">
      <template #actions>
        <AppButton v-if="session.can('couriers.manage')" variant="primary" :icon="Plus" @click="openForm(null)">Cadastrar motoboy</AppButton>
      </template>
    </PageHeader>

    <div class="card">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl v-model="filter" :options="options" label="Filtrar por status" size="sm" />
        <div class="relative lg:w-72">
          <Search :size="15" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input v-model="search" type="search" class="field-input pl-9" placeholder="Nome, código ou telefone" aria-label="Buscar motoboys" />
        </div>
      </div>

      <div v-if="list.length" class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr>
              <th scope="col">Motoboy</th>
              <th scope="col">Telefone</th>
              <th scope="col">Vínculo</th>
              <th scope="col">Remuneração</th>
              <th scope="col">Veículo</th>
              <th scope="col">Status</th>
              <th scope="col" class="text-right">Ativas</th>
              <th scope="col" class="text-right">Entregas (30 dias)</th>
              <th scope="col"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in list" :key="c.profile.id" class="cursor-pointer hover:bg-slate-100/70" @click="goTo(c.profile.id, $event)">
              <td>
                <RouterLink :to="{ name: 'courier-detail', params: { id: c.profile.id } }" class="font-medium text-slate-900 hover:text-brand-700">{{ c.profile.name }}</RouterLink>
                <p class="text-xs text-slate-500">{{ c.profile.link.internalCode }}</p>
              </td>
              <td class="tabular whitespace-nowrap text-slate-600">{{ formatPhone(c.profile.phone) }}</td>
              <td class="text-slate-600">{{ LINK_TYPE_LABEL[c.profile.link.linkType] }}</td>
              <td class="whitespace-nowrap text-slate-600">{{ describeCompensation(c.profile.link.compensation) }}</td>
              <td class="text-slate-600">
                {{ VEHICLE_TYPE_LABEL[c.profile.vehicle.type] }}
                <p v-if="c.profile.vehicle.consumptionKmPerLiter" class="text-xs text-slate-500">{{ c.profile.vehicle.consumptionKmPerLiter }} km/l</p>
              </td>
              <td><CourierStatusBadge :status="c.status" :overloaded="c.overloaded" /></td>
              <td class="tabular text-right">{{ c.activeDeliveries.length }}/{{ settings.settings?.maxConcurrentDeliveriesPerCourier }}</td>
              <td class="tabular text-right">{{ deliveredLast30.get(c.profile.id) ?? 0 }}</td>
              <td class="text-right">
                <AppButton v-if="session.can('couriers.manage')" size="sm" variant="ghost" :icon="Pencil" :title="`Editar ${c.profile.name}`" @click="openForm(c.profile)">
                  <span class="sr-only">Editar</span>
                </AppButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else :icon="UserX" :title="fleet.views.length ? 'Nenhum motoboy neste filtro' : 'Nenhum motoboy cadastrado'" description="Cadastre os entregadores que atendem o estabelecimento.">
        <AppButton v-if="session.can('couriers.manage')" variant="primary" @click="openForm(null)">Cadastrar motoboy</AppButton>
      </EmptyState>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      Cada motoboy é vinculado ao estabelecimento por um vínculo próprio (código, remuneração e observações). Na versão com aplicativo, o mesmo entregador poderá atender outros
      estabelecimentos mediante autorização, sem que um estabelecimento veja os dados do outro.
    </p>

    <CourierFormModal :open="formOpen" :courier="editing" @close="formOpen = false" />
  </div>
</template>
