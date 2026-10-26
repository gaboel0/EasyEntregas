import type { CompensationModel, CompensationRule, CourierLinkType, CourierStatus, VehicleType } from '@/types/domain'
import { formatCurrency } from '@/utils/format'

export const COURIER_STATUS_LABEL: Record<CourierStatus, string> = {
  available: 'Disponível',
  busy: 'Ocupado',
  unavailable: 'Indisponível',
}

export const COURIER_STATUS_TONE: Record<CourierStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  busy: 'bg-sky-50 text-sky-700 ring-sky-200',
  unavailable: 'bg-zinc-100 text-zinc-500 ring-zinc-200',
}

export const LINK_TYPE_LABEL: Record<CourierLinkType, string> = {
  employee: 'Funcionário',
  partner: 'Parceiro',
  other: 'Outro',
}

export const COMPENSATION_MODEL_LABEL: Record<CompensationModel, string> = {
  per_delivery: 'Valor fixo por entrega',
  per_km: 'Valor por quilômetro',
  per_delivery_plus_km: 'Fixo por entrega + por km',
  fixed_salary: 'Salário fixo (sem custo por entrega)',
}

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  motorcycle: 'Motocicleta',
  bicycle: 'Bicicleta',
  car: 'Carro',
}

export function describeCompensation(rule: CompensationRule): string {
  switch (rule.model) {
    case 'per_delivery':
      return `${formatCurrency(rule.perDelivery)} por entrega`
    case 'per_km':
      return `${formatCurrency(rule.perKm)} por km`
    case 'per_delivery_plus_km':
      return `${formatCurrency(rule.perDelivery)} + ${formatCurrency(rule.perKm)}/km`
    case 'fixed_salary':
      return 'Salário fixo'
  }
}
