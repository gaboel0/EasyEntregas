import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CourierProfile, CourierShiftStatus, ID } from '@/types/domain'
import { dataSource } from '@/services'
import type { CourierInput } from '@/modules/couriers/courierSchema'

export const useCouriersStore = defineStore('couriers', () => {
  const couriers = ref<CourierProfile[]>([])

  async function load() {
    couriers.value = await dataSource.couriers.list()
  }

  function upsert(profile: CourierProfile) {
    const index = couriers.value.findIndex((c) => c.id === profile.id)
    if (index >= 0) couriers.value.splice(index, 1, profile)
    else couriers.value.push(profile)
    return profile
  }

  return {
    couriers,
    load,
    create: async (input: CourierInput) => upsert(await dataSource.couriers.create(input)),
    update: async (id: ID, input: CourierInput) => upsert(await dataSource.couriers.update(id, input)),
    setShiftStatus: async (id: ID, status: CourierShiftStatus) => upsert(await dataSource.couriers.setShiftStatus(id, status)),
  }
})
