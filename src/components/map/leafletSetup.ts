import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoPoint } from '@/types/domain'

/**
 * Tiles públicos do OpenStreetMap: não exigem chave de API. Para produção com volume alto,
 * use um provedor de tiles contratado ou servidor próprio (política de uso da OSMF).
 */
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export function createBaseMap(element: HTMLElement, center: GeoPoint, zoom = 14): L.Map {
  const map = L.map(element, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], zoom)
  L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)
  return map
}

/** Marcador circular em HTML (evita os ícones PNG padrão do Leaflet, que quebram com bundlers). */
export function circleIcon(color: string, label = '', size = 22, selected = false): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="map-marker${selected ? ' map-marker--selected' : ''}" style="width:${size}px;height:${size}px;background:${color}">${escapeHtml(label)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

export function storeIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="map-marker" style="width:30px;height:30px;background:#0f172a;border-radius:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/></svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export { L }
