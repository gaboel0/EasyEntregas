<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Info, RotateCcw, Save } from 'lucide-vue-next'
import type { CompensationModel, RouteMode } from '@/types/domain'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormField from '@/components/ui/FormField.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import FreightBreakdown from '@/components/deliveries/FreightBreakdown.vue'
import { useSettingsStore } from '@/stores/settings'
import { useCouriersStore } from '@/stores/couriers'
import { useOrdersStore } from '@/stores/orders'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import { estimateFreight } from '@/modules/deliveries/freightCalculator'
import { COMPENSATION_MODEL_LABEL } from '@/modules/couriers/courierLabels'
import { ACTIVE_STATUSES } from '@/modules/orders/orderWorkflow'
import { formatCurrency, formatKm, formatOrderNumber } from '@/utils/format'
import { errorMessage } from '@/services'

const settingsStore = useSettingsStore()
const couriers = useCouriersStore()
const orders = useOrdersStore()
const session = useSessionStore()
const toast = useToast()

interface CalcState {
  oneWayKm: number | null
  routeMode: RouteMode
  consumption: number | null
  fuelPrice: number | null
  otherPerKm: number | null
  includeVehicleCosts: boolean
  compensation: { model: CompensationModel; perDelivery: number | null; perKm: number | null }
  freight: number | null
}

function defaults(): CalcState {
  const s = settingsStore.current()
  return {
    oneWayKm: 3,
    routeMode: s.routeMode,
    consumption: s.defaultConsumptionKmPerLiter,
    fuelPrice: s.fuelPricePerLiter,
    otherPerKm: s.variableCostPerKm,
    includeVehicleCosts: true,
    compensation: { ...s.defaultCompensation },
    freight: s.defaultFreightFee,
  }
}

const state = reactive<CalcState>(defaults())
const sourceOrder = ref('')
const sourceCourier = ref('')

const routeOptions = [
  { value: 'round_trip' as RouteMode, label: 'Ida e volta' },
  { value: 'one_way' as RouteMode, label: 'Somente ida' },
]

const input = computed(() => ({
  oneWayDistanceKm: state.oneWayKm,
  routeMode: state.routeMode,
  consumptionKmPerLiter: state.consumption,
  fuelPricePerLiter: state.fuelPrice ?? 0,
  otherCostsPerKm: state.otherPerKm ?? 0,
  compensation: { model: state.compensation.model, perDelivery: state.compensation.perDelivery ?? 0, perKm: state.compensation.perKm ?? 0 },
  includeVehicleCosts: state.includeVehicleCosts,
  freightCharged: state.freight ?? 0,
  breakEvenTolerancePct: settingsStore.current().breakEvenTolerancePct,
}))

const result = computed(() => estimateFreight(input.value))

/** Frete que zera o resultado e frete para atingir 30% de margem, com os mesmos parâmetros. */
const suggestions = computed(() => {
  const cost = result.value.operationalCost
  return { breakEven: cost, margin30: cost / 0.7 }
})

const table = computed(() =>
  [1, 2, 3, 4, 5, 6, 8].map((km) => ({ km, r: estimateFreight({ ...input.value, oneWayDistanceKm: km }) })),
)

const activeOrders = computed(() => orders.views.filter((v) => ACTIVE_STATUSES.includes(v.order.status)))

watch(sourceOrder, (id) => {
  const v = orders.viewById.get(id)
  if (!v) return
  state.oneWayKm = v.order.address.distanceKm
  state.freight = v.order.freightFee
  if (v.courier) sourceCourier.value = v.courier.id
})

watch(sourceCourier, (id) => {
  const c = couriers.couriers.find((x) => x.id === id)
  if (!c) return
  state.compensation = { ...c.link.compensation }
  state.includeVehicleCosts = c.link.vehicleCostsPaidByEstablishment && c.vehicle.type !== 'bicycle'
  if (c.vehicle.consumptionKmPerLiter) state.consumption = c.vehicle.consumptionKmPerLiter
})

function restore() {
  Object.assign(state, defaults())
  sourceOrder.value = ''
  sourceCourier.value = ''
}

const savingDefaults = ref(false)
async function saveAsDefaults() {
  if (!state.fuelPrice || !state.consumption) {
    toast.error('Informe preço do combustível e consumo para salvar')
    return
  }
  savingDefaults.value = true
  try {
    const s = settingsStore.current()
    await settingsStore.updateSettings({
      ...s,
      fuelPricePerLiter: state.fuelPrice,
      defaultConsumptionKmPerLiter: state.consumption,
      variableCostPerKm: state.otherPerKm ?? 0,
      routeMode: state.routeMode,
    })
    toast.success('Parâmetros salvos como padrão', 'As estimativas dos pedidos em andamento foram atualizadas.')
  } catch (e) {
    toast.error('Não foi possível salvar', errorMessage(e))
  } finally {
    savingDefaults.value = false
  }
}

const usesPerDelivery = computed(() => state.compensation.model === 'per_delivery' || state.compensation.model === 'per_delivery_plus_km')
const usesPerKm = computed(() => state.compensation.model === 'per_km' || state.compensation.model === 'per_delivery_plus_km')
</script>

<template>
  <div>
    <PageHeader title="Calculadora de viabilidade do frete" description="Estime o custo de uma entrega e veja se o frete cobrado cobre a operação.">
      <template #actions>
        <AppButton :icon="RotateCcw" @click="restore">Restaurar padrões</AppButton>
        <AppButton v-if="session.can('settings.manage')" :icon="Save" :loading="savingDefaults" @click="saveAsDefaults">Salvar custos como padrão</AppButton>
      </template>
    </PageHeader>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div class="space-y-5">
        <section class="card" aria-labelledby="calc-route">
          <div class="card-header"><h2 id="calc-route" class="card-title">Percurso</h2></div>
          <div class="grid gap-4 p-4 sm:grid-cols-2">
            <FormField v-slot="{ id }" class="sm:col-span-2" label="Carregar dados de um pedido em andamento (opcional)">
              <select :id="id" v-model="sourceOrder" class="field-input">
                <option value="">Simulação livre</option>
                <option v-for="v in activeOrders" :key="v.order.id" :value="v.order.id">
                  {{ formatOrderNumber(v.order.number) }} · {{ v.order.customerName }} · {{ v.order.address.district }} · {{ formatKm(v.order.address.distanceKm) }}
                </option>
              </select>
            </FormField>
            <FormField v-slot="{ id }" label="Distância do estabelecimento ao cliente (só ida)" hint="Deixe vazio se não houver estimativa confiável.">
              <NumberInput :id="id" v-model="state.oneWayKm" suffix="km" :decimals="1" />
            </FormField>
            <div>
              <p class="mb-1 text-xs font-medium text-slate-700">Percurso considerado no custo</p>
              <SegmentedControl v-model="state.routeMode" :options="routeOptions" label="Percurso considerado" />
              <p class="tabular mt-1.5 text-xs text-slate-600">
                <template v-if="state.oneWayKm">
                  Distância usada no cálculo:
                  <strong>{{ formatKm(result.distanceUsedKm) }}</strong>
                  {{ state.routeMode === 'round_trip' ? `(${formatKm(state.oneWayKm)} de ida + ${formatKm(state.oneWayKm)} de volta)` : '(sem considerar o retorno)' }}
                </template>
                <template v-else>Sem distância, apenas valores fixos entram no cálculo.</template>
              </p>
            </div>
          </div>
        </section>

        <section class="card" aria-labelledby="calc-vehicle">
          <div class="card-header"><h2 id="calc-vehicle" class="card-title">Veículo e custos variáveis</h2></div>
          <div class="grid gap-4 p-4 sm:grid-cols-3">
            <div class="sm:col-span-3">
              <AppSwitch
                v-model="state.includeVehicleCosts"
                label="Combustível e custos do veículo pagos pelo estabelecimento"
                description="Desative quando o motoboy usa o próprio veículo e o custo já está embutido na remuneração."
              />
            </div>
            <FormField v-slot="{ id }" label="Consumo médio da moto">
              <NumberInput :id="id" v-model="state.consumption" suffix="km/l" :decimals="1" :disabled="!state.includeVehicleCosts" />
            </FormField>
            <FormField v-slot="{ id }" label="Preço da gasolina">
              <NumberInput :id="id" v-model="state.fuelPrice" prefix="R$" suffix="/L" :disabled="!state.includeVehicleCosts" />
            </FormField>
            <FormField v-slot="{ id }" label="Outros custos por km" hint="Manutenção, pneus, desgaste">
              <NumberInput :id="id" v-model="state.otherPerKm" prefix="R$" suffix="/km" :disabled="!state.includeVehicleCosts" />
            </FormField>
          </div>
        </section>

        <section class="card" aria-labelledby="calc-pay">
          <div class="card-header"><h2 id="calc-pay" class="card-title">Remuneração e frete</h2></div>
          <div class="grid gap-4 p-4 sm:grid-cols-3">
            <FormField v-slot="{ id }" class="sm:col-span-3" label="Usar regra de um motoboy (opcional)">
              <select :id="id" v-model="sourceCourier" class="field-input">
                <option value="">Regra personalizada</option>
                <option v-for="c in couriers.couriers" :key="c.id" :value="c.id">{{ c.name }} · {{ COMPENSATION_MODEL_LABEL[c.link.compensation.model] }}</option>
              </select>
            </FormField>
            <FormField v-slot="{ id }" label="Forma de remuneração">
              <select :id="id" v-model="state.compensation.model" class="field-input">
                <option v-for="(label, key) in COMPENSATION_MODEL_LABEL" :key="key" :value="key">{{ label }}</option>
              </select>
            </FormField>
            <FormField v-if="usesPerDelivery" v-slot="{ id }" label="Valor por entrega">
              <NumberInput :id="id" v-model="state.compensation.perDelivery" prefix="R$" />
            </FormField>
            <FormField v-if="usesPerKm" v-slot="{ id }" label="Valor por km">
              <NumberInput :id="id" v-model="state.compensation.perKm" prefix="R$" />
            </FormField>
            <FormField v-slot="{ id }" class="sm:col-start-1" label="Frete cobrado do cliente" hint="Somente o frete. Não inclua o valor dos produtos.">
              <NumberInput :id="id" v-model="state.freight" prefix="R$" />
            </FormField>
          </div>
        </section>

        <section class="card overflow-hidden" aria-labelledby="calc-table">
          <div class="card-header">
            <h2 id="calc-table" class="card-title">Simulação por distância</h2>
            <span class="text-xs text-slate-500">mesmos parâmetros, frete de {{ formatCurrency(state.freight ?? 0) }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="table-base tabular">
              <thead>
                <tr>
                  <th scope="col">Distância (ida)</th>
                  <th scope="col" class="text-right">Considerada</th>
                  <th scope="col" class="text-right">Custo estimado</th>
                  <th scope="col" class="text-right">Resultado</th>
                  <th scope="col" class="text-right">Frete p/ empatar</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in table" :key="row.km">
                  <td>{{ formatKm(row.km) }}</td>
                  <td class="text-right">{{ formatKm(row.r.distanceUsedKm) }}</td>
                  <td class="text-right">{{ formatCurrency(row.r.operationalCost) }}</td>
                  <td class="text-right font-medium" :class="row.r.verdict === 'negative' ? 'text-rose-700' : row.r.verdict === 'break_even' ? 'text-amber-700' : 'text-emerald-700'">
                    {{ formatCurrency(row.r.result) }}
                  </td>
                  <td class="text-right">{{ formatCurrency(row.r.operationalCost) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside class="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <section class="card" aria-labelledby="calc-result" aria-live="polite">
          <div class="card-header"><h2 id="calc-result" class="card-title">Resultado estimado</h2></div>
          <div class="p-4">
            <FreightBreakdown :result="result" />
            <dl class="tabular mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div>
                <dt class="text-xs text-slate-500">Frete mínimo para empatar</dt>
                <dd class="font-semibold text-slate-900">{{ formatCurrency(suggestions.breakEven) }}</dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">Frete para 30% de margem</dt>
                <dd class="font-semibold text-slate-900">{{ formatCurrency(suggestions.margin30) }}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section class="card p-4 text-xs text-slate-600" aria-labelledby="calc-formula">
          <h2 id="calc-formula" class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Info :size="15" aria-hidden="true" /> Como calculamos</h2>
          <ul class="list-inside list-disc space-y-1">
            <li>Litros = distância considerada ÷ consumo (km/l)</li>
            <li>Combustível = litros × preço por litro</li>
            <li>Custo operacional = combustível + outros custos por km + remuneração</li>
            <li>Resultado = frete cobrado − custo operacional</li>
            <li>Margem = resultado ÷ frete cobrado × 100</li>
          </ul>
          <p class="mt-2">O valor dos produtos não entra neste cálculo. Os números são estimativas operacionais, não garantia de lucro.</p>
        </section>
      </aside>
    </div>
  </div>
</template>
