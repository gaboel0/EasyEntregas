/**
 * Contratos planejados para o APLICATIVO DO MOTOBOY (fora do escopo desta versão).
 *
 * O app e o painel compartilham os mesmos modelos (`Delivery`, `Order`, `Courier`, `CourierLink`)
 * através da API, que decide o que cada lado pode ver:
 * - o motoboy vê apenas entregas atribuídas/ofertadas a ele, com os dados mínimos do pedido
 *   (endereço, contato, observações, forma de pagamento/troco) — nunca relatórios do estabelecimento;
 * - o estabelecimento vê apenas motoboys com vínculo ativo e as entregas da própria empresa.
 *
 * Nada aqui é usado pelo painel ainda; serve como especificação para o backend e o app.
 */
import type {
  CompensationRule,
  CourierShiftStatus,
  Delivery,
  DeliveryAddress,
  GeoPoint,
  ID,
  ISODateString,
  OrderPayment,
  RouteMode,
  VehicleConfig,
} from './domain'

/** Visão da entrega exposta ao motoboy (subconjunto autorizado do pedido). */
export interface CourierDeliveryView {
  delivery: Pick<Delivery, 'id' | 'attempt' | 'status' | 'assignedAt' | 'dispatchedAt' | 'completedAt'>
  establishment: { id: ID; name: string; phone: string; location: GeoPoint | null }
  order: {
    id: ID
    number: number
    customerName: string
    customerPhone: string
    address: DeliveryAddress
    deliveryNotes?: string
    payment: OrderPayment
    /** Valor a cobrar na entrega (0 se já pago). */
    amountToCollect: number
  }
  /** Quanto o motoboy recebe por esta entrega segundo o vínculo. */
  estimatedPay: number
}

/** Oferta de entrega, quando o estabelecimento usar o modo "oferta" em vez de atribuição direta. */
export interface DeliveryOffer {
  id: ID
  deliveryId: ID
  courierId: ID
  expiresAt: ISODateString
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  view: CourierDeliveryView
}

/** Custos pessoais do motoboy para calcular a rentabilidade antes de aceitar. */
export interface CourierCostProfile {
  vehicle: VehicleConfig
  fuelPricePerLiter: number
  otherCostsPerKm: number
  routeMode: RouteMode
}

export type CourierDeliveryEvent =
  | { type: 'picked_up'; at: ISODateString; location?: GeoPoint }
  | { type: 'delivered'; at: ISODateString; location?: GeoPoint; collectedAmount?: number }
  | { type: 'failed'; at: ISODateString; reason: string; location?: GeoPoint }

/**
 * Endpoints previstos para o app (prefixo /courier, token do próprio motoboy):
 *
 *   POST /courier/auth/otp                 { phone }           → envia código por SMS/WhatsApp
 *   POST /courier/auth/verify              { phone, code }     → sessão (token httpOnly/secure storage)
 *   GET  /courier/me                                              → perfil, veículo e vínculos autorizados
 *   PUT  /courier/me/vehicle               VehicleConfig
 *   PUT  /courier/me/costs                 CourierCostProfile
 *   PUT  /courier/links/:linkId/shift      { status: CourierShiftStatus }
 *   GET  /courier/deliveries?status=active                        → CourierDeliveryView[]
 *   GET  /courier/deliveries/history?from&to                      → CourierDeliveryView[]
 *   GET  /courier/offers                                          → DeliveryOffer[]
 *   POST /courier/offers/:id/accept | /decline
 *   POST /courier/deliveries/:id/events    CourierDeliveryEvent  → atualiza Delivery e Order (mesma máquina de estados)
 *   POST /courier/location                 { location, at }       → posição em tempo real (somente em turno, com consentimento)
 *   GET  /courier/deliveries/:id/route                            → rota calculada pelo RoutingProvider do backend
 */
export interface CourierAppApi {
  getMe(): Promise<{ id: ID; name: string; vehicle: VehicleConfig; links: { linkId: ID; establishmentName: string; compensation: CompensationRule; shiftStatus: CourierShiftStatus }[] }>
  listActiveDeliveries(): Promise<CourierDeliveryView[]>
  listOffers(): Promise<DeliveryOffer[]>
  respondOffer(offerId: ID, accept: boolean): Promise<void>
  reportEvent(deliveryId: ID, event: CourierDeliveryEvent): Promise<CourierDeliveryView>
  setShift(linkId: ID, status: CourierShiftStatus): Promise<void>
}
