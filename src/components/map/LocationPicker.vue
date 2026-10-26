<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { GeoPoint } from '@/types/domain'
import { createBaseMap, circleIcon, storeIcon, L } from './leafletSetup'

/**
 * Seleção manual da localização do cliente: clique no mapa ou arraste o marcador.
 * Não há geocodificação automática (exigiria um serviço externo no backend).
 */
const props = defineProps<{ origin: GeoPoint | null }>()
const model = defineModel<GeoPoint | null>({ required: true })

const el = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let marker: L.Marker | null = null

function placeMarker(point: GeoPoint | null) {
  if (!map) return
  if (!point) {
    marker?.remove()
    marker = null
    return
  }
  if (!marker) {
    marker = L.marker([point.lat, point.lng], { icon: circleIcon('#4f46e5', '', 22), draggable: true, keyboard: true, title: 'Local de entrega' }).addTo(map)
    marker.on('dragend', () => {
      const p = marker!.getLatLng()
      model.value = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }
    })
  } else {
    marker.setLatLng([point.lat, point.lng])
  }
}

onMounted(() => {
  if (!el.value) return
  const center = model.value ?? props.origin ?? { lat: -23.5505, lng: -46.6333 }
  map = createBaseMap(el.value, center, model.value ? 15 : 14)
  if (props.origin) L.marker([props.origin.lat, props.origin.lng], { icon: storeIcon(), interactive: false }).addTo(map)
  placeMarker(model.value)
  map.on('click', (e: L.LeafletMouseEvent) => {
    model.value = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }
  })
})

watch(model, (p) => placeMarker(p))

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="h-64 w-full overflow-hidden rounded-lg border border-slate-200" role="application" aria-label="Mapa para marcar o local de entrega. Clique para posicionar o marcador." />
</template>
