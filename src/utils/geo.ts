import type { GeoPoint } from '@/types/domain'

const EARTH_RADIUS_KM = 6371

/**
 * Distância em linha reta (fórmula de Haversine). Subestima o percurso real pelas ruas;
 * serve apenas como referência até existir um serviço de roteamento conectado.
 */
export function straightLineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function isValidPoint(p: GeoPoint | null | undefined): p is GeoPoint {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
}
