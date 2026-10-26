import type {
  CompensationRule,
  Courier,
  CourierLink,
  Delivery,
  Establishment,
  GeoPoint,
  OperationalSettings,
  Order,
  OrderHistoryEntry,
  OrderItem,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  User,
  Actor,
  CourierProfile,
} from '@/types/domain'
import { DB_SCHEMA_VERSION, type DatabaseShape } from './localDatabase'
import { straightLineKm } from '@/utils/geo'
import { estimateOrderFreight, toCostSnapshot } from '@/modules/deliveries/deliveryCost'
import { productsTotal } from '@/modules/orders/orderSchema'

/**
 * Gera dados DEMONSTRATIVOS coerentes entre si: cada pedido tem linha do tempo, entrega,
 * motoboy e histórico consistentes, para que dashboard, relatórios e mapa sejam calculados
 * a partir dos mesmos registros. Os nomes, telefones e endereços são fictícios.
 */

// ---------------------------------------------------------------------------
// Aleatoriedade determinística
// ---------------------------------------------------------------------------

function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    between: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    weighted: <T>(entries: readonly [T, number][]): T => {
      const total = entries.reduce((acc, [, w]) => acc + w, 0)
      let roll = next() * total
      for (const [value, weight] of entries) {
        roll -= weight
        if (roll <= 0) return value
      }
      return entries[entries.length - 1]![0]
    },
  }
}

type Rng = ReturnType<typeof createRng>

let idCounter = 0
const seqId = (prefix: string) => `${prefix}_demo${(++idCounter).toString(36).padStart(5, '0')}`

// ---------------------------------------------------------------------------
// Catálogos fictícios
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Larissa',
  'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sofia', 'Vanessa', 'André', 'Bruno', 'Caio', 'Diego',
  'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor', 'João', 'Leonardo', 'Matheus', 'Otávio', 'Pedro',
  'Rodrigo', 'Samuel', 'Tiago', 'Vinícius',
]
const LAST_NAMES = [
  'Almeida', 'Barbosa', 'Cardoso', 'Carvalho', 'Costa', 'Dias', 'Fernandes', 'Gomes', 'Lima', 'Martins',
  'Melo', 'Moreira', 'Nascimento', 'Oliveira', 'Pereira', 'Ribeiro', 'Rocha', 'Santos', 'Silva', 'Souza',
]
const COMPLEMENTS = ['Apto 12', 'Apto 34', 'Apto 101', 'Casa 2', 'Bloco B, apto 45', 'Fundos', 'Sala 3']
const REFERENCES = [
  'Portão cinza',
  'Ao lado da farmácia',
  'Em frente à padaria',
  'Interfone com defeito, ligar ao chegar',
  'Prédio com portaria 24 h',
  'Esquina com a praça',
]
const DELIVERY_NOTES = [
  'Tocar o interfone 2 vezes',
  'Cliente pediu para ligar ao chegar',
  'Deixar na portaria',
  'Cuidado com o cachorro',
  'Levar maquininha de cartão',
]
const CANCEL_REASONS = ['Cliente desistiu do pedido', 'Pedido duplicado', 'Endereço fora da área de entrega']
const FAILURE_REASONS = ['Cliente não atendeu no endereço', 'Endereço não localizado', 'Cliente recusou o pedido']

interface Product {
  name: string
  price: number
}

interface EstablishmentPlan {
  establishment: Establishment
  streets: string[]
  district: string[]
  mains: Product[]
  extras: Product[]
  settings: Omit<OperationalSettings, 'establishmentId' | 'updatedAt'>
  users: Omit<User, 'establishmentId' | 'createdAt'>[]
  dailyOrders: [number, number]
  todayOrders: number
  hours: [number, number]
}

const DEFAULT_NOTIFICATIONS = { newOrder: true, longDispatchWait: true, deliveryFailed: true, playSound: false }

const PLANS: EstablishmentPlan[] = [
  {
    establishment: {
      id: 'est_bellanapoli',
      name: 'Pizzaria Bella Napoli',
      legalName: 'Bella Napoli Alimentos Ltda. (fictício)',
      document: '00.000.000/0001-00',
      phone: '(11) 3000-0101',
      address: { street: 'Rua Domingos de Morais', number: '1200', district: 'Vila Mariana', city: 'São Paulo', state: 'SP', zipCode: '04010-100' },
      location: { lat: -23.5869, lng: -46.6367 },
      createdAt: '2025-03-10T12:00:00.000Z',
    },
    streets: [
      'Rua Joaquim Távora', 'Rua Humberto I', 'Rua França Pinto', 'Rua Sena Madureira', 'Rua Afonso Celso',
      'Rua Dona Inácia Uchoa', 'Rua Pedro de Toledo', 'Rua Santa Cruz', 'Rua Machado de Assis', 'Avenida Lins de Vasconcelos',
      'Rua Loefgren', 'Rua Coronel Lisboa', 'Rua Morgado de Mateus', 'Rua Tenente Gomes Ribeiro', 'Rua Rio Grande',
    ],
    district: ['Vila Mariana', 'Vila Clementino', 'Saúde', 'Aclimação', 'Paraíso', 'Chácara Klabin'],
    mains: [
      { name: 'Pizza Calabresa (grande)', price: 62.9 },
      { name: 'Pizza Margherita (grande)', price: 59.9 },
      { name: 'Pizza Portuguesa (grande)', price: 66.9 },
      { name: 'Pizza Quatro Queijos (grande)', price: 69.9 },
      { name: 'Pizza Frango com Catupiry (grande)', price: 64.9 },
      { name: 'Pizza Napolitana (média)', price: 49.9 },
      { name: 'Pizza Chocolate com Morango (broto)', price: 36.9 },
    ],
    extras: [
      { name: 'Refrigerante 2 L', price: 14 },
      { name: 'Guaraná lata', price: 6.5 },
      { name: 'Borda recheada de catupiry', price: 12 },
      { name: 'Suco natural 500 ml', price: 11 },
    ],
    settings: {
      fuelPricePerLiter: 6.19,
      defaultConsumptionKmPerLiter: 35,
      variableCostPerKm: 0.18,
      routeMode: 'round_trip',
      defaultFreightFee: 7,
      dispatchAlertMinutes: 15,
      maxConcurrentDeliveriesPerCourier: 3,
      breakEvenTolerancePct: 10,
      defaultCompensation: { model: 'per_delivery', perDelivery: 6, perKm: 0 },
      notifications: DEFAULT_NOTIFICATIONS,
    },
    users: [
      { id: 'usr_paulo', name: 'Paulo Ricci', email: 'paulo@bellanapoli.example', role: 'owner', active: true },
      { id: 'usr_ana', name: 'Ana Souza', email: 'ana@bellanapoli.example', role: 'attendant', active: true },
      { id: 'usr_lucas', name: 'Lucas Ferreira', email: 'lucas@bellanapoli.example', role: 'dispatcher', active: true },
    ],
    dailyOrders: [14, 22],
    todayOrders: 24,
    hours: [18, 23],
  },
  {
    establishment: {
      id: 'est_brasaburger',
      name: 'Brasa Burger',
      legalName: 'Brasa Lanches Ltda. (fictício)',
      document: '00.000.000/0002-00',
      phone: '(11) 3000-0202',
      address: { street: 'Rua dos Pinheiros', number: '850', district: 'Pinheiros', city: 'São Paulo', state: 'SP', zipCode: '05422-001' },
      location: { lat: -23.5664, lng: -46.6869 },
      createdAt: '2025-06-02T12:00:00.000Z',
    },
    streets: [
      'Rua Teodoro Sampaio', 'Rua Cardeal Arcoverde', 'Rua Fradique Coutinho', 'Rua Mourato Coelho', 'Rua Artur de Azevedo',
      'Rua Capote Valente', 'Rua Joaquim Antunes', 'Rua Simão Álvares', 'Rua Ferreira de Araújo',
    ],
    district: ['Pinheiros', 'Vila Madalena', 'Jardim Paulistano', 'Alto de Pinheiros'],
    mains: [
      { name: 'Smash duplo', price: 34.9 },
      { name: 'Cheddar bacon', price: 38.9 },
      { name: 'Burger vegetariano', price: 33.9 },
      { name: 'Combo clássico', price: 44.9 },
    ],
    extras: [
      { name: 'Batata frita', price: 18 },
      { name: 'Milkshake de baunilha', price: 22 },
      { name: 'Refrigerante lata', price: 7 },
    ],
    settings: {
      fuelPricePerLiter: 6.29,
      defaultConsumptionKmPerLiter: 32,
      variableCostPerKm: 0.2,
      routeMode: 'round_trip',
      defaultFreightFee: 8,
      dispatchAlertMinutes: 12,
      maxConcurrentDeliveriesPerCourier: 2,
      breakEvenTolerancePct: 10,
      defaultCompensation: { model: 'per_delivery', perDelivery: 7, perKm: 0 },
      notifications: DEFAULT_NOTIFICATIONS,
    },
    users: [
      { id: 'usr_marina', name: 'Marina Costa', email: 'marina@brasaburger.example', role: 'owner', active: true },
      { id: 'usr_thiago', name: 'Thiago Mendes', email: 'thiago@brasaburger.example', role: 'attendant', active: true },
    ],
    dailyOrders: [8, 14],
    todayOrders: 12,
    hours: [19, 23],
  },
]

interface CourierSeed {
  courier: Omit<Courier, 'createdAt'>
  links: {
    establishmentId: string
    internalCode: string
    linkType: CourierLink['linkType']
    compensation: CompensationRule
    vehicleCostsPaidByEstablishment: boolean
    shiftStatus: CourierLink['shiftStatus']
    notes?: string
  }[]
}

const COURIERS: CourierSeed[] = [
  {
    courier: { id: 'cur_carlos', name: 'Carlos Henrique Souza', phone: '(11) 98000-1101', vehicle: { type: 'motorcycle', model: 'Honda CG 160', plate: 'ABC1D23', consumptionKmPerLiter: 38 } },
    links: [{ establishmentId: 'est_bellanapoli', internalCode: 'MB-01', linkType: 'employee', compensation: { model: 'fixed_salary', perDelivery: 0, perKm: 0 }, vehicleCostsPaidByEstablishment: true, shiftStatus: 'available', notes: 'Moto da empresa. Turno das 18h às 0h.' }],
  },
  {
    courier: { id: 'cur_rafael', name: 'Rafael Lima', phone: '(11) 98000-1102', vehicle: { type: 'motorcycle', model: 'Yamaha Factor 150', plate: 'DEF4G56', consumptionKmPerLiter: 40 } },
    links: [
      { establishmentId: 'est_bellanapoli', internalCode: 'MB-02', linkType: 'partner', compensation: { model: 'per_delivery_plus_km', perDelivery: 4, perKm: 0.9 }, vehicleCostsPaidByEstablishment: false, shiftStatus: 'available' },
      { establishmentId: 'est_brasaburger', internalCode: 'BB-07', linkType: 'partner', compensation: { model: 'per_delivery', perDelivery: 7.5, perKm: 0 }, vehicleCostsPaidByEstablishment: false, shiftStatus: 'available', notes: 'Também atende outro estabelecimento (vínculo autorizado).' },
    ],
  },
  {
    courier: { id: 'cur_juliana', name: 'Juliana Alves', phone: '(11) 98000-1103', vehicle: { type: 'motorcycle', model: 'Honda Biz 125', plate: 'GHI7J89', consumptionKmPerLiter: 45 } },
    links: [{ establishmentId: 'est_bellanapoli', internalCode: 'MB-03', linkType: 'partner', compensation: { model: 'per_km', perDelivery: 0, perKm: 1.6 }, vehicleCostsPaidByEstablishment: false, shiftStatus: 'available' }],
  },
  {
    courier: { id: 'cur_bruno', name: 'Bruno Costa', phone: '(11) 98000-1104', vehicle: { type: 'motorcycle', model: 'Honda CG 150', plate: 'JKL0M12', consumptionKmPerLiter: 36 } },
    links: [{ establishmentId: 'est_bellanapoli', internalCode: 'MB-04', linkType: 'partner', compensation: { model: 'per_delivery', perDelivery: 7, perKm: 0 }, vehicleCostsPaidByEstablishment: false, shiftStatus: 'available' }],
  },
  {
    courier: { id: 'cur_diego', name: 'Diego Martins', phone: '(11) 98000-1105', vehicle: { type: 'motorcycle', model: 'Honda Pop 110i', plate: 'MNO3P45', consumptionKmPerLiter: 42 } },
    links: [{ establishmentId: 'est_bellanapoli', internalCode: 'MB-05', linkType: 'employee', compensation: { model: 'per_delivery', perDelivery: 3, perKm: 0 }, vehicleCostsPaidByEstablishment: true, shiftStatus: 'available', notes: 'Recebe salário + adicional por entrega.' }],
  },
  {
    courier: { id: 'cur_marcos', name: 'Marcos Pereira', phone: '(11) 98000-1106', vehicle: { type: 'bicycle', consumptionKmPerLiter: null } },
    links: [{ establishmentId: 'est_bellanapoli', internalCode: 'BK-01', linkType: 'other', compensation: { model: 'per_delivery', perDelivery: 5, perKm: 0 }, vehicleCostsPaidByEstablishment: false, shiftStatus: 'unavailable', notes: 'Ciclista: atende somente entregas até 2 km. Folga hoje.' }],
  },
  {
    courier: { id: 'cur_vitor', name: 'Vitor Ramos', phone: '(11) 98000-1201', vehicle: { type: 'motorcycle', model: 'Honda CG 160', plate: 'QRS6T78', consumptionKmPerLiter: 37 } },
    links: [{ establishmentId: 'est_brasaburger', internalCode: 'BB-01', linkType: 'employee', compensation: { model: 'per_delivery', perDelivery: 3.5, perKm: 0 }, vehicleCostsPaidByEstablishment: true, shiftStatus: 'available' }],
  },
  {
    courier: { id: 'cur_leticia', name: 'Letícia Nunes', phone: '(11) 98000-1202', vehicle: { type: 'motorcycle', model: 'Yamaha Fazer 250', plate: 'UVW9X01', consumptionKmPerLiter: 30 } },
    links: [{ establishmentId: 'est_brasaburger', internalCode: 'BB-02', linkType: 'partner', compensation: { model: 'per_delivery_plus_km', perDelivery: 4, perKm: 1 }, vehicleCostsPaidByEstablishment: false, shiftStatus: 'available' }],
  },
]

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

const MIN = 60_000

function offsetPoint(origin: GeoPoint, km: number, angle: number): GeoPoint {
  const dLat = (km * Math.cos(angle)) / 111.32
  const dLng = (km * Math.sin(angle)) / (111.32 * Math.cos((origin.lat * Math.PI) / 180))
  return { lat: +(origin.lat + dLat).toFixed(6), lng: +(origin.lng + dLng).toFixed(6) }
}

const round1 = (v: number) => Math.round(v * 10) / 10

function freightForDistance(km: number | null, fallback: number): number {
  if (km === null) return fallback
  if (km <= 1.5) return 5
  if (km <= 3) return 7
  if (km <= 5) return 9
  return 12
}

interface Timeline {
  preparing: number
  ready: number
  awaiting: number
  assigned: number
  out: number
  delivered: number
}

interface ScenarioOverride {
  kind: 'cancel_before_dispatch' | 'fail' | 'fail_then_retry' | 'long_wait'
}

interface SeedContext {
  rng: Rng
  plan: EstablishmentPlan
  settings: OperationalSettings
  profiles: CourierProfile[]
  now: number
  db: DatabaseShape
  nextNumber: number
  courierCursor: number
}

function buildItems(ctx: SeedContext): OrderItem[] {
  const { rng, plan } = ctx
  const items: OrderItem[] = []
  const mains = rng.weighted<number>([[1, 5], [2, 4], [3, 1]])
  const used = new Set<string>()
  for (let i = 0; i < mains; i++) {
    const p = rng.pick(plan.mains)
    if (used.has(p.name)) {
      const existing = items.find((it) => it.name === p.name)
      if (existing) existing.quantity += 1
      continue
    }
    used.add(p.name)
    items.push({ id: seqId('itm'), name: p.name, quantity: 1, unitPrice: p.price })
  }
  if (rng.chance(0.65)) {
    const e = rng.pick(plan.extras)
    items.push({ id: seqId('itm'), name: e.name, quantity: rng.int(1, 2), unitPrice: e.price })
  }
  return items
}

function pickCourier(ctx: SeedContext): CourierProfile {
  const pool = ctx.profiles.filter((p) => p.link.shiftStatus === 'available')
  const list = pool.length ? pool : ctx.profiles
  const courier = list[ctx.courierCursor % list.length]!
  ctx.courierCursor += ctx.rng.int(1, 2)
  return courier
}

function createOrder(ctx: SeedContext, createdAt: number, scenario: ScenarioOverride | null, isToday: boolean): void {
  const { rng, plan, settings, db, now } = ctx
  const est = plan.establishment
  const origin = est.location!
  const attendant = plan.users.find((u) => u.role === 'attendant') ?? plan.users[0]!
  const dispatcher = plan.users.find((u) => u.role === 'dispatcher') ?? plan.users[0]!
  const actorFor = (u: { id: string; name: string }): Actor => ({ type: 'user', id: u.id, name: u.name })

  // Endereço e distância
  const realKm = rng.between(0.5, 5.5)
  const hasLocation = rng.chance(0.88)
  const location = hasLocation ? offsetPoint(origin, realKm, rng.between(0, Math.PI * 2)) : null
  let distanceKm: number | null = null
  let distanceSource: Order['address']['distanceSource'] = null
  if (location) {
    const straight = straightLineKm(origin, location)
    if (rng.chance(0.55)) {
      distanceKm = round1(straight * rng.between(1.2, 1.45))
      distanceSource = 'manual'
    } else {
      distanceKm = round1(straight)
      distanceSource = 'straight_line'
    }
  } else if (rng.chance(0.5)) {
    distanceKm = round1(realKm * 1.3)
    distanceSource = 'manual'
  }

  const items = buildItems(ctx)
  const products = productsTotal(items)
  const freightFee = rng.chance(0.06) ? 0 : freightForDistance(distanceKm, settings.defaultFreightFee)
  const method = rng.weighted<PaymentMethod>([
    ['pix', 40], ['credit_card', 22], ['cash', 15], ['debit_card', 10], ['meal_voucher', 6], ['paid_online', 7],
  ])
  const total = products + freightFee
  const changeFor = method === 'cash' && rng.chance(0.6) ? Math.ceil((total + 1) / 50) * 50 : null
  const source = rng.weighted<OrderSource>([['whatsapp', 48], ['phone', 20], ['instagram', 16], ['counter', 6], ['other', 10]])

  // Linha do tempo (minutos após a criação)
  const prepStart = rng.between(1, 4)
  const ready = prepStart + rng.between(13, 24)
  const awaiting = ready + rng.between(0.5, 2)
  const longWait = scenario?.kind === 'long_wait'
  const assignEarly = rng.chance(0.25)
  const assigned = assignEarly ? prepStart + 1 : awaiting + rng.between(0.5, 3)
  const out = longWait ? Number.POSITIVE_INFINITY : Math.max(assigned, awaiting) + rng.between(2, 8)
  const travel = 5 + (distanceKm ?? realKm) * rng.between(2.6, 4)
  const delivered = out + travel
  const t: Timeline = { preparing: prepStart, ready, awaiting, assigned, out, delivered }
  const at = (minutes: number) => createdAt + minutes * MIN
  const reached = (minutes: number) => at(minutes) <= now

  const orderId = seqId('ord')
  const number = ctx.nextNumber++
  const history: OrderHistoryEntry[] = []
  const deliveries: Delivery[] = []
  const iso = (ms: number) => new Date(ms).toISOString()
  const statusEntry = (from: OrderStatus | null, to: OrderStatus, ms: number, actor: Actor, note?: string) =>
    history.push({ kind: 'status_change', id: seqId('hst'), establishmentId: est.id, orderId, at: iso(ms), actor, from, to, note })

  const order: Order = {
    id: orderId,
    establishmentId: est.id,
    number,
    customerName: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    customerPhone: `(11) 9${rng.int(6000, 9999)}-${rng.int(1000, 9999)}`,
    address: {
      street: rng.pick(plan.streets),
      number: String(rng.int(12, 1890)),
      district: rng.pick(plan.district),
      city: 'São Paulo',
      state: 'SP',
      complement: rng.chance(0.45) ? rng.pick(COMPLEMENTS) : undefined,
      reference: rng.chance(0.3) ? rng.pick(REFERENCES) : undefined,
      location,
      distanceKm,
      distanceSource,
    },
    source,
    items,
    productsTotal: products,
    freightFee,
    payment: { method, changeFor },
    deliveryNotes: rng.chance(0.25) ? rng.pick(DELIVERY_NOTES) : undefined,
    status: 'received',
    createdAt: iso(createdAt),
    updatedAt: iso(createdAt),
    createdBy: attendant.id,
  }

  statusEntry(null, 'received', createdAt, actorFor(attendant), `Pedido registrado via ${source === 'counter' ? 'balcão' : source}.`)

  let delivery: Delivery = {
    id: seqId('dlv'),
    establishmentId: est.id,
    orderId,
    attempt: 1,
    courierId: null,
    status: 'unassigned',
    assignedAt: null,
    dispatchedAt: null,
    completedAt: null,
    costSnapshot: null,
    createdAt: iso(createdAt),
  }
  deliveries.push(delivery)
  let lastChange = createdAt
  const advance = (to: OrderStatus, minutes: number, actor: Actor, note?: string): boolean => {
    if (!reached(minutes)) return false
    statusEntry(order.status, to, at(minutes), actor, note)
    order.status = to
    lastChange = at(minutes)
    return true
  }
  const assign = (minutes: number, courier: CourierProfile, target: Delivery) => {
    target.courierId = courier.id
    target.status = 'assigned'
    target.assignedAt = iso(at(minutes))
    history.push({ kind: 'courier_assigned', id: seqId('hst'), establishmentId: est.id, orderId, at: iso(at(minutes)), actor: actorFor(dispatcher), courierId: courier.id, courierName: courier.name })
  }
  const close = (target: Delivery, courier: CourierProfile, minutes: number, status: 'delivered' | 'failed') => {
    target.status = status
    target.completedAt = iso(at(minutes))
    target.costSnapshot = toCostSnapshot(estimateOrderFreight(order, courier, settings), iso(at(minutes)))
  }

  const finish = () => {
    order.updatedAt = iso(lastChange)
    db.orders.push(order)
    db.deliveries.push(...deliveries)
    db.orderHistory.push(...history)
  }

  if (scenario?.kind === 'cancel_before_dispatch') {
    advance('preparing', t.preparing, actorFor(attendant))
    if (advance('cancelled', t.preparing + rng.between(2, 8), actorFor(attendant), rng.pick(CANCEL_REASONS))) {
      delivery.status = 'cancelled'
    }
    return finish()
  }

  if (!advance('preparing', t.preparing, actorFor(attendant))) return finish()
  const courier = pickCourier(ctx)
  if (!longWait && reached(t.assigned) && assignEarly) assign(t.assigned, courier, delivery)
  if (!advance('ready_for_pickup', t.ready, actorFor(attendant))) return finish()
  if (!advance('awaiting_courier', t.awaiting, actorFor(dispatcher))) return finish()
  if (!longWait && !assignEarly && reached(t.assigned)) assign(t.assigned, courier, delivery)
  if (longWait || !reached(t.out) || !delivery.courierId) return finish()

  advance('out_for_delivery', t.out, actorFor(dispatcher))
  delivery.status = 'in_transit'
  delivery.dispatchedAt = iso(at(t.out))

  const fails = scenario?.kind === 'fail' || scenario?.kind === 'fail_then_retry'
  if (!reached(t.delivered)) return finish()
  if (!fails) {
    advance('delivered', t.delivered, actorFor(dispatcher))
    close(delivery, courier, t.delivered, 'delivered')
    return finish()
  }

  advance('delivery_failed', t.delivered, actorFor(dispatcher), rng.pick(FAILURE_REASONS))
  delivery.failureReason = history[history.length - 1]?.note
  close(delivery, courier, t.delivered, 'failed')
  if (isToday || scenario?.kind === 'fail') {
    // Falhas de dias anteriores foram encerradas como cancelamento; a de hoje segue pendente de decisão.
    if (!isToday) advance('cancelled', t.delivered + 15, actorFor(dispatcher), 'Cliente não respondeu após a tentativa de entrega.')
    return finish()
  }

  // Nova tentativa de entrega (segunda Delivery para o mesmo pedido).
  const retryBase = t.delivered + rng.between(10, 20)
  advance('awaiting_courier', retryBase, actorFor(dispatcher), 'Cliente retornou o contato. Nova tentativa.')
  const retryCourier = pickCourier(ctx)
  delivery = {
    id: seqId('dlv'),
    establishmentId: est.id,
    orderId,
    attempt: 2,
    courierId: null,
    status: 'unassigned',
    assignedAt: null,
    dispatchedAt: null,
    completedAt: null,
    costSnapshot: null,
    createdAt: iso(at(retryBase)),
  }
  deliveries.push(delivery)
  assign(retryBase + 1, retryCourier, delivery)
  advance('out_for_delivery', retryBase + 4, actorFor(dispatcher))
  delivery.status = 'in_transit'
  delivery.dispatchedAt = iso(at(retryBase + 4))
  const retryDone = retryBase + 4 + travel
  advance('delivered', retryDone, actorFor(dispatcher))
  close(delivery, retryCourier, retryDone, 'delivered')
  finish()
}

function seedEstablishment(db: DatabaseShape, plan: EstablishmentPlan, now: Date, rng: Rng): void {
  const est = plan.establishment
  const settings: OperationalSettings = { ...plan.settings, establishmentId: est.id, updatedAt: now.toISOString() }
  db.establishments.push(est)
  db.settings.push(settings)
  db.users.push(...plan.users.map((u) => ({ ...u, establishmentId: est.id, createdAt: est.createdAt })))

  const profiles: CourierProfile[] = []
  for (const seed of COURIERS) {
    const linkSeed = seed.links.find((l) => l.establishmentId === est.id)
    if (!linkSeed) continue
    let courier = db.couriers.find((c) => c.id === seed.courier.id)
    if (!courier) {
      courier = { ...seed.courier, createdAt: est.createdAt }
      db.couriers.push(courier)
    }
    const link: CourierLink = {
      id: `lnk_${est.id}_${courier.id}`,
      courierId: courier.id,
      linkStatus: 'active',
      createdAt: est.createdAt,
      ...linkSeed,
    }
    db.courierLinks.push(link)
    profiles.push({ ...courier, link })
  }

  const ctx: SeedContext = { rng, plan, settings, profiles, now: now.getTime(), db, nextNumber: 1001, courierCursor: 0 }

  // Dias anteriores (sempre encerrados).
  for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
    const day = new Date(now)
    day.setDate(day.getDate() - daysAgo)
    const weekend = [0, 5, 6].includes(day.getDay())
    const count = rng.int(plan.dailyOrders[0], plan.dailyOrders[1]) + (weekend ? rng.int(3, 7) : 0)
    const start = new Date(day)
    start.setHours(plan.hours[0], 0, 0, 0)
    const windowMin = (plan.hours[1] - plan.hours[0]) * 60 + 15
    const times = Array.from({ length: count }, () => start.getTime() + rng.between(0, windowMin) * MIN).sort((a, b) => a - b)
    for (const time of times) {
      const roll = rng.next()
      const scenario: ScenarioOverride | null =
        roll < 0.04 ? { kind: 'cancel_before_dispatch' } : roll < 0.055 ? { kind: 'fail' } : roll < 0.075 ? { kind: 'fail_then_retry' } : null
      createOrder(ctx, time, scenario, false)
    }
  }

  // Hoje: pedidos nas últimas ~3 horas, em diferentes estágios da operação.
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const span = Math.min(180, Math.max(20, (now.getTime() - midnight.getTime()) / MIN - 2))
  const todayCount = plan.todayOrders
  for (let i = 0; i < todayCount; i++) {
    const age = span * (1 - i / todayCount) - rng.between(0, 3)
    const createdAt = now.getTime() - Math.max(1, age) * MIN
    let scenario: ScenarioOverride | null = null
    if (i === 3) scenario = { kind: 'cancel_before_dispatch' }
    else if (i === Math.floor(todayCount * 0.45)) scenario = { kind: 'fail' }
    else if (i === Math.floor(todayCount * 0.55) || i === Math.floor(todayCount * 0.62)) scenario = { kind: 'long_wait' }
    createOrder(ctx, createdAt, scenario, true)
  }

  db.orderCounters[est.id] = ctx.nextNumber
}

export function createDemoDatabase(now: Date = new Date(), seed = 20261026): DatabaseShape {
  idCounter = 0
  const rng = createRng(seed)
  const db: DatabaseShape = {
    schemaVersion: DB_SCHEMA_VERSION,
    isDemo: true,
    seededAt: now.toISOString(),
    establishments: [],
    users: [],
    settings: [],
    couriers: [],
    courierLinks: [],
    orders: [],
    deliveries: [],
    orderHistory: [],
    orderCounters: {},
  }
  for (const plan of PLANS) seedEstablishment(db, plan, now, rng)
  return db
}

export const DEMO_DEFAULT_SESSION = { establishmentId: 'est_bellanapoli', userId: 'usr_paulo' }
