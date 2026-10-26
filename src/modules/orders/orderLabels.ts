import type { OrderSource, OrderStatus, PaymentMethod } from '@/types/domain'

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  phone: 'Telefone',
  counter: 'Balcão',
  other: 'Outro',
}

export const ORDER_SOURCES = Object.keys(ORDER_SOURCE_LABEL) as OrderSource[]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  meal_voucher: 'Vale-refeição',
  paid_online: 'Pago antecipadamente',
}

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]

/** Classes de cor por status. Mantidas em um só lugar para badges, gráficos e mapa. */
export const ORDER_STATUS_TONE: Record<OrderStatus, { badge: string; dot: string; hex: string }> = {
  received: { badge: 'bg-slate-100 text-slate-700 ring-slate-300', dot: 'bg-slate-500', hex: '#64748b' },
  preparing: { badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500', hex: '#8b5cf6' },
  ready_for_pickup: { badge: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500', hex: '#14b8a6' },
  awaiting_courier: { badge: 'bg-amber-50 text-amber-800 ring-amber-300', dot: 'bg-amber-500', hex: '#f59e0b' },
  out_for_delivery: { badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', hex: '#0ea5e9' },
  delivered: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', hex: '#10b981' },
  cancelled: { badge: 'bg-zinc-100 text-zinc-500 ring-zinc-200', dot: 'bg-zinc-400', hex: '#a1a1aa' },
  delivery_failed: { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', hex: '#f43f5e' },
}
