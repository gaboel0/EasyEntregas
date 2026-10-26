import type { CourierProfile, CourierStatus, Delivery, OperationalSettings } from '@/types/domain'
import { groupBy } from '@/modules/orders/orderViews'

export interface CourierView {
  profile: CourierProfile
  status: CourierStatus
  /** Entregas atribuídas e ainda não encerradas (aguardando retirada + em rota). */
  activeDeliveries: Delivery[]
  inTransit: number
  overloaded: boolean
  /** Saída mais antiga entre as entregas em rota. */
  onRouteSince: string | null
}

/** "Ocupado" é derivado: o motoboy está em turno e tem ao menos uma entrega em rota. */
export function courierStatus(profile: CourierProfile, inTransit: number): CourierStatus {
  if (profile.link.shiftStatus === 'unavailable') return 'unavailable'
  return inTransit > 0 ? 'busy' : 'available'
}

export function buildCourierViews(
  couriers: readonly CourierProfile[],
  deliveries: readonly Delivery[],
  settings: OperationalSettings,
): CourierView[] {
  const active = deliveries.filter((d) => d.courierId && (d.status === 'assigned' || d.status === 'in_transit'))
  const byCourier = groupBy(active, (d) => d.courierId as string)
  return couriers.map((profile) => {
    const list = byCourier.get(profile.id) ?? []
    const transit = list.filter((d) => d.status === 'in_transit')
    const since = transit.map((d) => d.dispatchedAt).filter((x): x is string => !!x).sort()[0] ?? null
    return {
      profile,
      status: courierStatus(profile, transit.length),
      activeDeliveries: list,
      inTransit: transit.length,
      overloaded: list.length >= settings.maxConcurrentDeliveriesPerCourier,
      onRouteSince: since,
    }
  })
}
