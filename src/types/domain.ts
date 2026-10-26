/**
 * Modelos de domínio compartilhados pelo painel do estabelecimento e, futuramente,
 * pelo aplicativo do motoboy e pela API.
 *
 * Convenções:
 * - Todo registro pertencente a uma empresa carrega `establishmentId` (isolamento multi-tenant).
 * - Datas são strings ISO 8601 em UTC; a formatação para pt-BR acontece na interface.
 * - Valores monetários são números em reais (2 casas). Em uma API real, prefira centavos inteiros.
 */

export type ID = string
export type ISODateString = string

export interface GeoPoint {
  lat: number
  lng: number
}

export interface PostalAddress {
  street: string
  number: string
  district: string
  city: string
  state: string
  zipCode?: string
  complement?: string
  reference?: string
}

// ---------------------------------------------------------------------------
// Estabelecimento, usuários e permissões
// ---------------------------------------------------------------------------

export interface Establishment {
  id: ID
  name: string
  legalName?: string
  document?: string
  phone: string
  address: PostalAddress
  location: GeoPoint | null
  createdAt: ISODateString
}

export type UserRole = 'owner' | 'manager' | 'dispatcher' | 'attendant'

export interface User {
  id: ID
  establishmentId: ID
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: ISODateString
}

export type Permission =
  | 'orders.create'
  | 'orders.edit'
  | 'orders.change_status'
  | 'orders.cancel'
  | 'dispatch.assign'
  | 'couriers.manage'
  | 'reports.view'
  | 'settings.manage'
  | 'users.manage'

// ---------------------------------------------------------------------------
// Pedido (a venda)
// ---------------------------------------------------------------------------

export type OrderSource = 'whatsapp' | 'instagram' | 'phone' | 'counter' | 'other'

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready_for_pickup'
  | 'awaiting_courier'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'delivery_failed'

export type PaymentMethod = 'pix' | 'cash' | 'credit_card' | 'debit_card' | 'meal_voucher' | 'paid_online'

export interface OrderItem {
  id: ID
  name: string
  quantity: number
  unitPrice: number
  notes?: string
}

export type DistanceSource = 'manual' | 'straight_line'

export interface DeliveryAddress extends PostalAddress {
  location: GeoPoint | null
  /** Distância estimada SÓ DE IDA, do estabelecimento ao cliente, em km. */
  distanceKm: number | null
  distanceSource: DistanceSource | null
}

export interface OrderPayment {
  method: PaymentMethod
  /** Valor em espécie que o cliente vai entregar, para cálculo do troco. */
  changeFor: number | null
}

export interface Order {
  id: ID
  establishmentId: ID
  /** Número sequencial legível por estabelecimento (ex.: 1042). */
  number: number
  customerName: string
  customerPhone: string
  address: DeliveryAddress
  source: OrderSource
  items: OrderItem[]
  /** Valor dos produtos (soma dos itens). Não inclui frete. */
  productsTotal: number
  /** Valor cobrado do cliente pela entrega. Receita do frete, separada dos produtos. */
  freightFee: number
  payment: OrderPayment
  deliveryNotes?: string
  status: OrderStatus
  createdAt: ISODateString
  updatedAt: ISODateString
  createdBy: ID
}

// ---------------------------------------------------------------------------
// Histórico (status e alterações do pedido)
// ---------------------------------------------------------------------------

export type ActorType = 'user' | 'courier' | 'system'

export interface Actor {
  type: ActorType
  id: ID
  name: string
}

interface HistoryEntryBase {
  id: ID
  establishmentId: ID
  orderId: ID
  at: ISODateString
  actor: Actor
  note?: string
}

export interface StatusChangeEntry extends HistoryEntryBase {
  kind: 'status_change'
  from: OrderStatus | null
  to: OrderStatus
}

export interface OrderEditedEntry extends HistoryEntryBase {
  kind: 'order_edited'
  changedFields: string[]
}

export interface CourierAssignmentEntry extends HistoryEntryBase {
  kind: 'courier_assigned' | 'courier_unassigned'
  courierId: ID
  courierName: string
}

export type OrderHistoryEntry = StatusChangeEntry | OrderEditedEntry | CourierAssignmentEntry

// ---------------------------------------------------------------------------
// Motoboy e vínculo com o estabelecimento
// ---------------------------------------------------------------------------

export type VehicleType = 'motorcycle' | 'bicycle' | 'car'

export interface VehicleConfig {
  type: VehicleType
  model?: string
  plate?: string
  /** Consumo médio em km/l (não se aplica a bicicleta). */
  consumptionKmPerLiter: number | null
}

/**
 * Identidade global do entregador. No futuro, pertence à conta do motoboy no app
 * e pode estar vinculada a vários estabelecimentos por meio de `CourierLink`.
 */
export interface Courier {
  id: ID
  name: string
  phone: string
  vehicle: VehicleConfig
  createdAt: ISODateString
}

export type CourierLinkType = 'employee' | 'partner' | 'other'

export type CompensationModel = 'per_delivery' | 'per_km' | 'per_delivery_plus_km' | 'fixed_salary'

export interface CompensationRule {
  model: CompensationModel
  perDelivery: number
  perKm: number
}

/** Disponibilidade declarada (turno). "Ocupado" é derivado das entregas em rota. */
export type CourierShiftStatus = 'available' | 'unavailable'

/** Status exibido na operação. */
export type CourierStatus = 'available' | 'busy' | 'unavailable'

export type CourierLinkStatus = 'active' | 'pending_authorization' | 'revoked'

/** Vínculo autorizado entre um motoboy e um estabelecimento (dados por empresa). */
export interface CourierLink {
  id: ID
  establishmentId: ID
  courierId: ID
  internalCode: string
  linkType: CourierLinkType
  compensation: CompensationRule
  /** Se o estabelecimento arca com combustível e custos do veículo deste motoboy. */
  vehicleCostsPaidByEstablishment: boolean
  shiftStatus: CourierShiftStatus
  linkStatus: CourierLinkStatus
  notes?: string
  createdAt: ISODateString
}

/** Visão combinada usada no painel: identidade + vínculo com o estabelecimento atual. */
export interface CourierProfile extends Courier {
  link: CourierLink
}

// ---------------------------------------------------------------------------
// Entrega (a operação logística vinculada ao pedido)
// ---------------------------------------------------------------------------

export type DeliveryStatus = 'unassigned' | 'assigned' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'

export type RouteMode = 'one_way' | 'round_trip'

export interface DeliveryCostSnapshot {
  calculatedAt: ISODateString
  distanceUsedKm: number | null
  routeMode: RouteMode
  fuelCost: number
  otherVariableCosts: number
  courierPay: number
  operationalCost: number
  freightFee: number
  result: number
}

export interface Delivery {
  id: ID
  establishmentId: ID
  orderId: ID
  /** Tentativa de entrega (1 = primeira; uma nova tentativa é criada após falha). */
  attempt: number
  courierId: ID | null
  status: DeliveryStatus
  assignedAt: ISODateString | null
  dispatchedAt: ISODateString | null
  completedAt: ISODateString | null
  failureReason?: string
  /** Custo congelado ao encerrar a entrega, para que mudanças futuras de preço não reescrevam o histórico. */
  costSnapshot: DeliveryCostSnapshot | null
  createdAt: ISODateString
}

// ---------------------------------------------------------------------------
// Configurações operacionais
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  newOrder: boolean
  longDispatchWait: boolean
  deliveryFailed: boolean
  playSound: boolean
}

export interface OperationalSettings {
  establishmentId: ID
  fuelPricePerLiter: number
  defaultConsumptionKmPerLiter: number
  /** Manutenção, pneus, depreciação etc., em R$ por km rodado. */
  variableCostPerKm: number
  routeMode: RouteMode
  defaultFreightFee: number
  /** Minutos que um pedido pronto pode esperar despacho antes de ser destacado. */
  dispatchAlertMinutes: number
  maxConcurrentDeliveriesPerCourier: number
  /** Faixa (em % sobre o frete) considerada "próxima do ponto de equilíbrio". */
  breakEvenTolerancePct: number
  defaultCompensation: CompensationRule
  notifications: NotificationPreferences
  updatedAt: ISODateString
}
