import { computed } from 'vue'
import { defineStore } from 'pinia'
import { buildCourierViews, type CourierView } from '@/modules/couriers/courierViews'
import { useCouriersStore } from './couriers'
import { useOrdersStore } from './orders'
import { useSettingsStore } from './settings'

/**
 * Situação operacional dos motoboys (disponível/ocupado, carga atual), derivada das entregas.
 * Fica separada de useCouriersStore (cadastro) para que pedidos e motoboys não dependam um do outro.
 */
export const useFleetStore = defineStore('fleet', () => {
  const views = computed<CourierView[]>(() => {
    const settings = useSettingsStore().settings
    if (!settings) return []
    return buildCourierViews(useCouriersStore().couriers, useOrdersStore().deliveries, settings).sort((a, b) =>
      a.profile.name.localeCompare(b.profile.name, 'pt-BR'),
    )
  })

  const viewById = computed(() => new Map(views.value.map((v) => [v.profile.id, v])))

  return { views, viewById }
})
