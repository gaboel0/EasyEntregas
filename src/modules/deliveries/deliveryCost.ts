import type { CourierProfile, Delivery, DeliveryCostSnapshot, Order, OperationalSettings } from '@/types/domain'
import { estimateFreight, type FreightCostResult } from './freightCalculator'
import { isPickup } from '@/modules/orders/orderWorkflow'

/**
 * Aplica a calculadora de frete a um pedido real, combinando a distância do endereço,
 * as configurações operacionais e a regra do motoboy (ou a regra padrão, se ainda não houver motoboy).
 */
export function estimateOrderFreight(
  order: Pick<Order, 'address' | 'freightFee'>,
  courier: CourierProfile | null,
  settings: OperationalSettings,
): FreightCostResult {
  const estimate = estimateFreight({
    oneWayDistanceKm: order.address.distanceKm,
    routeMode: settings.routeMode,
    consumptionKmPerLiter: courier?.vehicle.consumptionKmPerLiter ?? settings.defaultConsumptionKmPerLiter,
    fuelPricePerLiter: settings.fuelPricePerLiter,
    otherCostsPerKm: settings.variableCostPerKm,
    compensation: courier?.link.compensation ?? settings.defaultCompensation,
    includeVehicleCosts: courier
      ? courier.link.vehicleCostsPaidByEstablishment && courier.vehicle.type !== 'bicycle'
      : true,
    freightCharged: order.freightFee,
    breakEvenTolerancePct: settings.breakEvenTolerancePct,
  })
  if (!courier) {
    estimate.limitations.push('Motoboy ainda não definido: foi usada a regra de remuneração padrão do estabelecimento.')
  }
  if (order.address.distanceSource === 'straight_line') {
    estimate.limitations.push('Distância calculada em linha reta: o percurso real pelas ruas tende a ser maior.')
  }
  return estimate
}

export function toCostSnapshot(estimate: FreightCostResult, at: string): DeliveryCostSnapshot {
  return {
    calculatedAt: at,
    distanceUsedKm: estimate.distanceKnown ? estimate.distanceUsedKm : null,
    routeMode: estimate.routeMode,
    fuelCost: estimate.fuelCost,
    otherVariableCosts: estimate.otherVariableCosts,
    courierPay: estimate.courierPay,
    operationalCost: estimate.operationalCost,
    freightFee: estimate.freightCharged,
    result: estimate.result,
  }
}

export interface DeliveryEconomics {
  freightFee: number
  operationalCost: number
  courierPay: number
  result: number
  /** true quando os valores vêm do custo congelado no encerramento da entrega. */
  frozen: boolean
}

/** Custo de uma entrega: congelado se já encerrada, estimado com os parâmetros atuais se ainda ativa. */
export function deliveryEconomics(
  order: Order,
  delivery: Delivery | null,
  courier: CourierProfile | null,
  settings: OperationalSettings,
): DeliveryEconomics {
  // Retirada no balcão não tem frete nem custo logístico.
  if (isPickup(order)) return { freightFee: 0, operationalCost: 0, courierPay: 0, result: 0, frozen: true }
  if (delivery?.costSnapshot) {
    const s = delivery.costSnapshot
    return {
      freightFee: s.freightFee,
      operationalCost: s.operationalCost,
      courierPay: s.courierPay,
      result: s.result,
      frozen: true,
    }
  }
  const e = estimateOrderFreight(order, courier, settings)
  return {
    freightFee: e.freightCharged,
    operationalCost: e.operationalCost,
    courierPay: e.courierPay,
    result: e.result,
    frozen: false,
  }
}
