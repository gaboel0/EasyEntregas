import type {
  BusinessType,
  CourierProfile,
  CourierShiftStatus,
  Delivery,
  Establishment,
  ID,
  OperationalSettings,
  Order,
  OrderHistoryEntry,
  OrderStatus,
  User,
} from '@/types/domain'
import type { OrderInput } from '@/modules/orders/orderSchema'
import type { CourierInput } from '@/modules/couriers/courierSchema'
import type { EstablishmentInput, OperationalSettingsInput, UserInput } from '@/modules/settings/settingsSchema'

/**
 * Contratos da camada de dados.
 *
 * As páginas e stores dependem SOMENTE destas interfaces. Hoje existe uma implementação local
 * (localStorage, para demonstração) e um esqueleto HTTP. Para conectar um backend real basta
 * implementar estas interfaces — regras de negócio (transições de status, isolamento por
 * estabelecimento, permissões) devem ser impostas pelo servidor.
 *
 * Todas as operações são escopadas pelo estabelecimento da sessão autenticada; o cliente
 * nunca envia `establishmentId` como fonte de verdade.
 */

export type ServiceErrorCode =
  | 'not_found'
  | 'invalid_transition'
  | 'validation'
  | 'forbidden'
  | 'conflict'
  | 'unauthenticated'
  | 'network'
  | 'unknown'

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.message
  if (error instanceof Error) return error.message
  return 'Ocorreu um erro inesperado.'
}

/** Pedido com suas entregas (tentativas) e histórico. Retornado por toda mutação de pedido. */
export interface OrderAggregate {
  order: Order
  deliveries: Delivery[]
  history: OrderHistoryEntry[]
}

export interface OrdersSnapshot {
  orders: Order[]
  deliveries: Delivery[]
  history: OrderHistoryEntry[]
}

export interface StatusChangeRequest {
  to: OrderStatus
  /** Obrigatório para cancelamento e falha na entrega. */
  note?: string
}

export interface OrdersService {
  /** Em uma API real, prefira paginação e filtros por período no servidor. */
  list(): Promise<OrdersSnapshot>
  create(input: OrderInput): Promise<OrderAggregate>
  update(orderId: ID, input: OrderInput): Promise<OrderAggregate>
  changeStatus(orderId: ID, request: StatusChangeRequest): Promise<OrderAggregate>
  assignCourier(orderId: ID, courierId: ID): Promise<OrderAggregate>
  unassignCourier(orderId: ID): Promise<OrderAggregate>
}

export interface CouriersService {
  list(): Promise<CourierProfile[]>
  create(input: CourierInput): Promise<CourierProfile>
  update(courierId: ID, input: CourierInput): Promise<CourierProfile>
  setShiftStatus(courierId: ID, status: CourierShiftStatus): Promise<CourierProfile>
}

export interface SessionContext {
  user: User
  establishment: Establishment
}

export interface EstablishmentService {
  getSession(): Promise<SessionContext>
  getSettings(): Promise<OperationalSettings>
  updateEstablishment(input: EstablishmentInput): Promise<Establishment>
  updateSettings(input: OperationalSettingsInput): Promise<OperationalSettings>
  listUsers(): Promise<User[]>
  saveUser(input: UserInput, userId?: ID): Promise<User>
}

export interface DemoSessionOption {
  id: ID
  name: string
  users: Pick<User, 'id' | 'name' | 'role'>[]
}

/** Recursos exclusivos do modo demonstração (não existem em produção). */
export interface DemoControls {
  readonly isDemo: true
  /** Estabelecimentos e usuários disponíveis para simular outra sessão (isolamento e permissões). */
  listSessionOptions(): Promise<DemoSessionOption[]>
  switchSession(establishmentId: ID, userId: ID): Promise<void>
  resetDemoData(): Promise<void>
  /** Notifica quando outra aba alterou os dados locais. */
  onExternalChange(listener: () => void): () => void
}

/**
 * Autenticação. Senhas só trafegam do formulário até o backend (HTTPS); o painel nunca as guarda,
 * registra ou devolve. O papel escolhido na tela é apenas uma dica de contexto: quem decide o papel
 * e as permissões reais da conta é o servidor.
 */
export type AuthRole = 'establishment' | 'courier'

export interface AuthSession {
  role: AuthRole
  name: string
}

export interface SignInRequest {
  role: AuthRole
  email: string
  password: string
}

export interface EstablishmentSignUpRequest {
  role: 'establishment'
  ownerName: string
  email: string
  password: string
  businessName: string
  businessType: BusinessType
  phone: string
}

export interface CourierSignUpRequest {
  role: 'courier'
  fullName: string
  email: string
  password: string
  phone: string
}

export interface AuthService {
  /** Sessão atual, ou null se não houver login. */
  getSession(): Promise<AuthSession | null>
  signIn(request: SignInRequest): Promise<AuthSession>
  signUp(request: EstablishmentSignUpRequest | CourierSignUpRequest): Promise<AuthSession>
  requestPasswordReset(email: string): Promise<void>
  signOut(): Promise<void>
}

export interface DataSource {
  auth: AuthService
  orders: OrdersService
  couriers: CouriersService
  establishment: EstablishmentService
  demo: DemoControls | null
}
