import type {
  Actor,
  CourierProfile,
  CourierShiftStatus,
  Delivery,
  ID,
  Order,
  OrderHistoryEntry,
  OrderStatus,
  Permission,
  User,
} from '@/types/domain'
import {
  ServiceError,
  type CouriersService,
  type DataSource,
  type DemoControls,
  type EstablishmentService,
  type OrderAggregate,
  type OrdersService,
  type SessionContext,
  type StatusChangeRequest,
} from '../contracts'
import { DB_STORAGE_KEY, type DatabaseShape, type LocalDatabase } from './localDatabase'
import { DEMO_DEFAULT_SESSION } from './demoSeed'
import { createLocalAuth } from './localAuth'
import { orderInputSchema, productsTotal, type OrderInput } from '@/modules/orders/orderSchema'
import { courierInputSchema, type CourierInput } from '@/modules/couriers/courierSchema'
import {
  establishmentInputSchema,
  operationalSettingsInputSchema,
  userInputSchema,
  type EstablishmentInput,
  type OperationalSettingsInput,
  type UserInput,
} from '@/modules/settings/settingsSchema'
import {
  canAssignCourier,
  isPickup,
  canEditOrder,
  canTransition,
  deliveryStatusFor,
  requiresReason,
  ORDER_STATUS_LABEL,
} from '@/modules/orders/orderWorkflow'
import { hasPermission } from '@/modules/settings/permissions'
import { estimateOrderFreight, toCostSnapshot } from '@/modules/deliveries/deliveryCost'
import { createId } from '@/utils/id'
import type { ZodType } from 'zod'

/**
 * Implementação local (demonstração) dos contratos de serviço.
 *
 * Ela reproduz as regras que o backend deverá impor — validação, permissões, transições de
 * status e escopo por estabelecimento — para que a interface se comporte como em produção.
 * Isso NÃO substitui a segurança do servidor: qualquer pessoa pode editar o localStorage.
 */

export interface LocalDataSourceOptions {
  /** Latência artificial (ms) para exercitar estados de carregamento. Use 0 em testes. */
  latencyMs?: number
  now?: () => Date
}

const clone = <T>(value: T): T => structuredClone(value)

function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new ServiceError('validation', result.error.issues[0]?.message ?? 'Dados inválidos.')
  }
  return result.data
}

const EDITABLE_FIELD_LABEL: [keyof OrderInput | 'address', string][] = [
  ['customerName', 'Cliente'],
  ['customerPhone', 'Telefone'],
  ['address', 'Endereço'],
  ['source', 'Origem'],
  ['items', 'Produtos'],
  ['freightFee', 'Frete'],
  ['payment', 'Pagamento'],
  ['deliveryNotes', 'Observações para entrega'],
]

export function createLocalDataSource(db: LocalDatabase, options: LocalDataSourceOptions = {}): DataSource {
  const latency = options.latencyMs ?? 0
  const now = options.now ?? (() => new Date())
  const wait = () => (latency > 0 ? new Promise<void>((r) => setTimeout(r, latency)) : Promise.resolve())

  // -------------------------------------------------------------------------
  // Sessão e escopo (no backend isso vem do token autenticado)
  // -------------------------------------------------------------------------

  function session(data: DatabaseShape): { user: User; establishmentId: ID } {
    const stored = db.readSession() ?? DEMO_DEFAULT_SESSION
    const user = data.users.find((u) => u.id === stored.userId && u.establishmentId === stored.establishmentId && u.active)
    if (!user) {
      const fallback = data.users.find((u) => u.id === DEMO_DEFAULT_SESSION.userId)
      if (!fallback) throw new ServiceError('unauthenticated', 'Sessão inválida.')
      db.writeSession(DEMO_DEFAULT_SESSION)
      return { user: fallback, establishmentId: fallback.establishmentId }
    }
    return { user, establishmentId: user.establishmentId }
  }

  function require(data: DatabaseShape, permission: Permission) {
    const s = session(data)
    if (!hasPermission(s.user.role, permission)) {
      throw new ServiceError('forbidden', 'Seu perfil não tem permissão para esta ação.')
    }
    return s
  }

  const actorOf = (user: User): Actor => ({ type: 'user', id: user.id, name: user.name })
  const isoNow = () => now().toISOString()

  function findOrder(data: DatabaseShape, establishmentId: ID, orderId: ID): Order {
    const order = data.orders.find((o) => o.id === orderId && o.establishmentId === establishmentId)
    if (!order) throw new ServiceError('not_found', 'Pedido não encontrado.')
    return order
  }

  function currentDelivery(data: DatabaseShape, orderId: ID): Delivery {
    const list = data.deliveries.filter((d) => d.orderId === orderId).sort((a, b) => b.attempt - a.attempt)
    const latest = list[0]
    if (!latest) throw new ServiceError('not_found', 'Entrega do pedido não encontrada.')
    return latest
  }

  function profilesOf(data: DatabaseShape, establishmentId: ID): CourierProfile[] {
    return data.courierLinks
      .filter((l) => l.establishmentId === establishmentId && l.linkStatus !== 'revoked')
      .flatMap((link) => {
        const courier = data.couriers.find((c) => c.id === link.courierId)
        return courier ? [{ ...courier, link }] : []
      })
  }

  function findProfile(data: DatabaseShape, establishmentId: ID, courierId: ID): CourierProfile {
    const profile = profilesOf(data, establishmentId).find((p) => p.id === courierId)
    if (!profile) throw new ServiceError('not_found', 'Motoboy não encontrado neste estabelecimento.')
    return profile
  }

  function aggregate(data: DatabaseShape, order: Order): OrderAggregate {
    return clone({
      order,
      deliveries: data.deliveries.filter((d) => d.orderId === order.id),
      history: data.orderHistory.filter((h) => h.orderId === order.id),
    })
  }

  function settingsOf(data: DatabaseShape, establishmentId: ID) {
    const s = data.settings.find((x) => x.establishmentId === establishmentId)
    if (!s) throw new ServiceError('not_found', 'Configurações do estabelecimento não encontradas.')
    return s
  }

  function pushHistory(data: DatabaseShape, entry: OrderHistoryEntry) {
    data.orderHistory.push(entry)
  }

  function assignInternal(data: DatabaseShape, establishmentId: ID, order: Order, courierId: ID, user: User) {
    if (isPickup(order)) throw new ServiceError('invalid_transition', 'Pedidos para retirada não usam motoboy.')
    if (!canAssignCourier(order.status)) {
      throw new ServiceError('invalid_transition', `Não é possível atribuir motoboy a um pedido "${ORDER_STATUS_LABEL[order.status]}".`)
    }
    const profile = findProfile(data, establishmentId, courierId)
    if (profile.link.linkStatus !== 'active') throw new ServiceError('forbidden', 'O vínculo deste motoboy não está ativo.')
    if (profile.link.shiftStatus === 'unavailable') throw new ServiceError('conflict', `${profile.name} está indisponível no momento.`)
    const delivery = currentDelivery(data, order.id)
    if (delivery.courierId === courierId) return
    const at = isoNow()
    if (delivery.courierId) {
      const previous = data.couriers.find((c) => c.id === delivery.courierId)
      pushHistory(data, {
        kind: 'courier_unassigned', id: createId('hst'), establishmentId, orderId: order.id, at, actor: actorOf(user),
        courierId: delivery.courierId, courierName: previous?.name ?? 'Motoboy',
      })
    }
    delivery.courierId = courierId
    delivery.assignedAt = at
    delivery.status = deliveryStatusFor(order.status, true)
    order.updatedAt = at
    pushHistory(data, {
      kind: 'courier_assigned', id: createId('hst'), establishmentId, orderId: order.id, at, actor: actorOf(user),
      courierId, courierName: profile.name,
    })
  }

  function buildOrderFields(input: OrderInput) {
    const items = input.items.map((i) => ({
      id: i.id ?? createId('itm'),
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes || undefined,
    }))
    return {
      fulfillment: input.fulfillment,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      address: {
        ...input.address,
        complement: input.address.complement || undefined,
        reference: input.address.reference || undefined,
        distanceSource: input.address.distanceKm === null ? null : input.address.distanceSource ?? 'manual',
      },
      source: input.source,
      items,
      productsTotal: productsTotal(items),
      freightFee: input.freightFee,
      payment: { method: input.payment.method, changeFor: input.payment.method === 'cash' ? input.payment.changeFor : null },
      deliveryNotes: input.deliveryNotes || undefined,
    }
  }

  // -------------------------------------------------------------------------
  // Pedidos
  // -------------------------------------------------------------------------

  const orders: OrdersService = {
    async list() {
      await wait()
      const data = db.read()
      const { establishmentId } = session(data)
      const own = data.orders.filter((o) => o.establishmentId === establishmentId)
      return clone({
        orders: own,
        deliveries: data.deliveries.filter((d) => d.establishmentId === establishmentId),
        history: data.orderHistory.filter((h) => h.establishmentId === establishmentId),
      })
    },

    async create(rawInput) {
      await wait()
      const input = validate(orderInputSchema, rawInput)
      return db.write((data) => {
        const { user, establishmentId } = require(data, 'orders.create')
        const at = isoNow()
        const number = data.orderCounters[establishmentId] ?? 1001
        data.orderCounters[establishmentId] = number + 1
        const order: Order = {
          id: createId('ord'),
          establishmentId,
          number,
          ...buildOrderFields(input),
          status: 'received',
          createdAt: at,
          updatedAt: at,
          createdBy: user.id,
        }
        data.orders.push(order)
        // Retirada no balcão não gera entrega (operação logística).
        if (!isPickup(order)) {
          data.deliveries.push({
            id: createId('dlv'), establishmentId, orderId: order.id, attempt: 1, courierId: null, status: 'unassigned',
            assignedAt: null, dispatchedAt: null, completedAt: null, costSnapshot: null, createdAt: at,
          })
        }
        pushHistory(data, {
          kind: 'status_change', id: createId('hst'), establishmentId, orderId: order.id, at, actor: actorOf(user),
          from: null, to: 'received', note: 'Pedido cadastrado no painel.',
        })
        if (input.courierId) {
          if (!hasPermission(user.role, 'dispatch.assign')) {
            throw new ServiceError('forbidden', 'Seu perfil não pode atribuir motoboys.')
          }
          assignInternal(data, establishmentId, order, input.courierId, user)
        }
        return aggregate(data, order)
      })
    },

    async update(orderId, rawInput) {
      await wait()
      const input = validate(orderInputSchema, rawInput)
      return db.write((data) => {
        const { user, establishmentId } = require(data, 'orders.edit')
        const order = findOrder(data, establishmentId, orderId)
        if (!canEditOrder(order.status)) {
          throw new ServiceError('invalid_transition', 'Pedidos entregues ou cancelados não podem ser editados.')
        }
        const next = buildOrderFields(input)
        // Itens são comparados pelo conteúdo: IDs novos gerados para a mesma lista não contam como alteração.
        const comparable = (source: Pick<Order, 'items'> & Record<string, unknown>, key: string) =>
          key === 'items' ? source.items.map(({ name, quantity, unitPrice, notes }) => ({ name, quantity, unitPrice, notes })) : source[key]
        const changed = EDITABLE_FIELD_LABEL.filter(
          ([key]) =>
            JSON.stringify(comparable(order as unknown as Order & Record<string, unknown>, key)) !==
            JSON.stringify(comparable(next as unknown as Order & Record<string, unknown>, key)),
        ).map(([, label]) => label)
        if (!changed.length) return aggregate(data, order)
        Object.assign(order, next, { updatedAt: isoNow() })
        pushHistory(data, {
          kind: 'order_edited', id: createId('hst'), establishmentId, orderId, at: order.updatedAt, actor: actorOf(user),
          changedFields: changed,
        })
        return aggregate(data, order)
      })
    },

    async changeStatus(orderId, request: StatusChangeRequest) {
      await wait()
      return db.write((data) => {
        const permission: Permission = request.to === 'cancelled' ? 'orders.cancel' : 'orders.change_status'
        const { user, establishmentId } = require(data, permission)
        const order = findOrder(data, establishmentId, orderId)
        if (isPickup(order)) {
          const pickupCheck = canTransition(order.status, request.to, { hasCourier: false, fulfillment: 'pickup' })
          if (!pickupCheck.allowed) throw new ServiceError('invalid_transition', pickupCheck.reason)
          const pickupNote = request.note?.trim()
          if (requiresReason(request.to) && !pickupNote) throw new ServiceError('validation', 'Informe o motivo para registrar esta alteração.')
          const pickupAt = isoNow()
          const pickupFrom: OrderStatus = order.status
          order.status = request.to
          order.updatedAt = pickupAt
          pushHistory(data, {
            kind: 'status_change', id: createId('hst'), establishmentId, orderId, at: pickupAt, actor: actorOf(user), from: pickupFrom, to: request.to,
            note: pickupNote || undefined,
          })
          return aggregate(data, order)
        }
        let delivery = currentDelivery(data, orderId)
        const check = canTransition(order.status, request.to, { hasCourier: !!delivery.courierId })
        if (!check.allowed) throw new ServiceError('invalid_transition', check.reason)
        const note = request.note?.trim()
        if (requiresReason(request.to) && !note) {
          throw new ServiceError('validation', 'Informe o motivo para registrar esta alteração.')
        }

        const at = isoNow()
        const from: OrderStatus = order.status
        order.status = request.to
        order.updatedAt = at
        pushHistory(data, {
          kind: 'status_change', id: createId('hst'), establishmentId, orderId, at, actor: actorOf(user), from, to: request.to,
          note: note || undefined,
        })

        const closeWithSnapshot = () => {
          const courier = delivery.courierId ? findProfile(data, establishmentId, delivery.courierId) : null
          delivery.completedAt = at
          delivery.costSnapshot = toCostSnapshot(estimateOrderFreight(order, courier, settingsOf(data, establishmentId)), at)
        }

        switch (request.to) {
          case 'out_for_delivery':
            delivery.status = 'in_transit'
            delivery.dispatchedAt = at
            break
          case 'delivered':
            delivery.status = 'delivered'
            closeWithSnapshot()
            break
          case 'delivery_failed':
            delivery.status = 'failed'
            delivery.failureReason = note
            closeWithSnapshot()
            break
          case 'awaiting_courier':
            if (from === 'delivery_failed') {
              // Nova tentativa: o pedido é o mesmo, a operação logística é outra.
              delivery = {
                id: createId('dlv'), establishmentId, orderId, attempt: delivery.attempt + 1, courierId: null, status: 'unassigned',
                assignedAt: null, dispatchedAt: null, completedAt: null, costSnapshot: null, createdAt: at,
              }
              data.deliveries.push(delivery)
            } else {
              delivery.status = deliveryStatusFor(request.to, !!delivery.courierId)
            }
            break
          case 'cancelled':
            if (delivery.status !== 'failed') delivery.status = 'cancelled'
            break
          default:
            delivery.status = deliveryStatusFor(request.to, !!delivery.courierId)
        }
        return aggregate(data, order)
      })
    },

    async assignCourier(orderId, courierId) {
      await wait()
      return db.write((data) => {
        const { user, establishmentId } = require(data, 'dispatch.assign')
        const order = findOrder(data, establishmentId, orderId)
        assignInternal(data, establishmentId, order, courierId, user)
        return aggregate(data, order)
      })
    },

    async unassignCourier(orderId) {
      await wait()
      return db.write((data) => {
        const { user, establishmentId } = require(data, 'dispatch.assign')
        const order = findOrder(data, establishmentId, orderId)
        if (isPickup(order)) return aggregate(data, order)
        if (!canAssignCourier(order.status)) {
          throw new ServiceError('invalid_transition', 'O motoboy só pode ser removido antes da saída para entrega.')
        }
        const delivery = currentDelivery(data, orderId)
        if (!delivery.courierId) return aggregate(data, order)
        const courier = data.couriers.find((c) => c.id === delivery.courierId)
        const at = isoNow()
        pushHistory(data, {
          kind: 'courier_unassigned', id: createId('hst'), establishmentId, orderId, at, actor: actorOf(user),
          courierId: delivery.courierId, courierName: courier?.name ?? 'Motoboy',
        })
        delivery.courierId = null
        delivery.assignedAt = null
        delivery.status = 'unassigned'
        order.updatedAt = at
        return aggregate(data, order)
      })
    },
  }

  // -------------------------------------------------------------------------
  // Motoboys
  // -------------------------------------------------------------------------

  function ensureUniqueCode(data: DatabaseShape, establishmentId: ID, code: string, exceptCourierId?: ID) {
    const clash = data.courierLinks.find(
      (l) => l.establishmentId === establishmentId && l.internalCode.toLowerCase() === code.toLowerCase() && l.courierId !== exceptCourierId,
    )
    if (clash) throw new ServiceError('conflict', `O identificador "${code}" já está em uso.`)
  }

  const couriers: CouriersService = {
    async list() {
      await wait()
      const data = db.read()
      return clone(profilesOf(data, session(data).establishmentId))
    },

    async create(rawInput: CourierInput) {
      await wait()
      const input = validate(courierInputSchema, rawInput)
      return db.write((data) => {
        const { establishmentId } = require(data, 'couriers.manage')
        ensureUniqueCode(data, establishmentId, input.internalCode)
        const at = isoNow()
        const courierId = createId('cur')
        data.couriers.push({
          id: courierId,
          name: input.name,
          phone: input.phone,
          vehicle: { ...input.vehicle, consumptionKmPerLiter: input.vehicle.type === 'bicycle' ? null : input.vehicle.consumptionKmPerLiter },
          createdAt: at,
        })
        data.courierLinks.push({
          id: createId('lnk'), establishmentId, courierId, internalCode: input.internalCode, linkType: input.linkType,
          compensation: input.compensation, vehicleCostsPaidByEstablishment: input.vehicleCostsPaidByEstablishment,
          shiftStatus: input.shiftStatus, linkStatus: 'active', notes: input.notes || undefined, createdAt: at,
        })
        return clone(findProfile(data, establishmentId, courierId))
      })
    },

    async update(courierId, rawInput: CourierInput) {
      await wait()
      const input = validate(courierInputSchema, rawInput)
      return db.write((data) => {
        const { establishmentId } = require(data, 'couriers.manage')
        const profile = findProfile(data, establishmentId, courierId)
        ensureUniqueCode(data, establishmentId, input.internalCode, courierId)
        // Futuro: dados pessoais e do veículo pertencem à conta do motoboy no app;
        // o estabelecimento editará apenas o vínculo (código, remuneração, observações).
        const courier = data.couriers.find((c) => c.id === courierId)!
        Object.assign(courier, {
          name: input.name,
          phone: input.phone,
          vehicle: { ...input.vehicle, consumptionKmPerLiter: input.vehicle.type === 'bicycle' ? null : input.vehicle.consumptionKmPerLiter },
        })
        const link = data.courierLinks.find((l) => l.id === profile.link.id)!
        Object.assign(link, {
          internalCode: input.internalCode,
          linkType: input.linkType,
          compensation: input.compensation,
          vehicleCostsPaidByEstablishment: input.vehicleCostsPaidByEstablishment,
          shiftStatus: input.shiftStatus,
          notes: input.notes || undefined,
        })
        return clone(findProfile(data, establishmentId, courierId))
      })
    },

    async setShiftStatus(courierId, status: CourierShiftStatus) {
      await wait()
      return db.write((data) => {
        const { establishmentId } = require(data, 'dispatch.assign')
        const profile = findProfile(data, establishmentId, courierId)
        const link = data.courierLinks.find((l) => l.id === profile.link.id)!
        link.shiftStatus = status
        return clone(findProfile(data, establishmentId, courierId))
      })
    },
  }

  // -------------------------------------------------------------------------
  // Estabelecimento, configurações e usuários
  // -------------------------------------------------------------------------

  const establishment: EstablishmentService = {
    async getSession(): Promise<SessionContext> {
      await wait()
      const data = db.read()
      const { user, establishmentId } = session(data)
      const est = data.establishments.find((e) => e.id === establishmentId)
      if (!est) throw new ServiceError('not_found', 'Estabelecimento não encontrado.')
      return clone({ user, establishment: est })
    },

    async getSettings() {
      await wait()
      const data = db.read()
      return clone(settingsOf(data, session(data).establishmentId))
    },

    async updateEstablishment(rawInput: EstablishmentInput) {
      await wait()
      const input = validate(establishmentInputSchema, rawInput)
      return db.write((data) => {
        const { establishmentId } = require(data, 'settings.manage')
        const est = data.establishments.find((e) => e.id === establishmentId)!
        Object.assign(est, {
          ...input,
          legalName: input.legalName || undefined,
          document: input.document || undefined,
        })
        return clone(est)
      })
    },

    async updateSettings(rawInput: OperationalSettingsInput) {
      await wait()
      const input = validate(operationalSettingsInputSchema, rawInput)
      return db.write((data) => {
        const { establishmentId } = require(data, 'settings.manage')
        const settings = settingsOf(data, establishmentId)
        Object.assign(settings, input, { updatedAt: isoNow() })
        return clone(settings)
      })
    },

    async listUsers() {
      await wait()
      const data = db.read()
      const { establishmentId } = session(data)
      return clone(data.users.filter((u) => u.establishmentId === establishmentId))
    },

    async saveUser(rawInput: UserInput, userId?: ID) {
      await wait()
      const input = validate(userInputSchema, rawInput)
      return db.write((data) => {
        const { user: current, establishmentId } = require(data, 'users.manage')
        const email = input.email.toLowerCase()
        const clash = data.users.find((u) => u.establishmentId === establishmentId && u.email.toLowerCase() === email && u.id !== userId)
        if (clash) throw new ServiceError('conflict', 'Já existe um usuário com este e-mail.')
        if (userId) {
          const user = data.users.find((u) => u.id === userId && u.establishmentId === establishmentId)
          if (!user) throw new ServiceError('not_found', 'Usuário não encontrado.')
          if (user.id === current.id && (!input.active || input.role !== current.role)) {
            throw new ServiceError('forbidden', 'Você não pode desativar ou alterar o próprio perfil de acesso.')
          }
          Object.assign(user, { ...input, email })
          return clone(user)
        }
        const user: User = { id: createId('usr'), establishmentId, ...input, email, createdAt: isoNow() }
        data.users.push(user)
        return clone(user)
      })
    },
  }

  // -------------------------------------------------------------------------
  // Controles exclusivos da demonstração
  // -------------------------------------------------------------------------

  const demo: DemoControls = {
    isDemo: true,
    async listSessionOptions() {
      const data = db.read()
      return data.establishments.map((e) => ({
        id: e.id,
        name: e.name,
        users: data.users
          .filter((u) => u.establishmentId === e.id && u.active)
          .map((u) => ({ id: u.id, name: u.name, role: u.role })),
      }))
    },
    async switchSession(establishmentId, userId) {
      const data = db.read()
      const user = data.users.find((u) => u.id === userId && u.establishmentId === establishmentId && u.active)
      if (!user) throw new ServiceError('not_found', 'Usuário não encontrado neste estabelecimento.')
      db.writeSession({ establishmentId, userId })
    },
    async resetDemoData() {
      await wait()
      db.reset()
    },
    onExternalChange(listener) {
      if (typeof window === 'undefined') return () => {}
      const handler = (event: StorageEvent) => {
        if (event.key === DB_STORAGE_KEY) {
          db.invalidate()
          listener()
        }
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }

  return { auth: createLocalAuth(db), orders, couriers, establishment, demo }
}
