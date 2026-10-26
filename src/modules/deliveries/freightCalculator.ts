import type { CompensationRule, RouteMode } from '@/types/domain'
import { roundMoney } from '@/utils/number'

/**
 * Cálculo de viabilidade do frete.
 *
 * Fórmulas:
 *   distância considerada = distância de ida × (2 se ida e volta, 1 se só ida)
 *   litros consumidos     = distância considerada ÷ consumo (km/l)
 *   custo de combustível  = litros consumidos × preço por litro
 *   custo operacional     = combustível + outros custos variáveis + remuneração do motoboy
 *   resultado do frete    = frete cobrado − custo operacional
 *   margem (%)            = resultado ÷ frete cobrado × 100   (somente se frete > 0)
 *
 * A distância de entrada é SEMPRE só de ida; o modo de rota decide se ela é dobrada.
 * Isso evita duplicar o percurso quando o usuário já informou uma distância total.
 *
 * Todos os resultados são estimativas operacionais, não garantias de lucro.
 */

export interface FreightCostInput {
  /** Distância só de ida em km. `null` quando não há estimativa. */
  oneWayDistanceKm: number | null
  routeMode: RouteMode
  consumptionKmPerLiter: number | null
  fuelPricePerLiter: number
  otherCostsPerKm: number
  compensation: CompensationRule
  /** Se combustível e custos do veículo são do estabelecimento (ex.: moto da empresa). */
  includeVehicleCosts: boolean
  freightCharged: number
  /** Faixa em % do frete considerada "ponto de equilíbrio". */
  breakEvenTolerancePct: number
}

export type FreightVerdict = 'positive' | 'break_even' | 'negative'

export interface FreightCostResult {
  distanceKnown: boolean
  oneWayDistanceKm: number | null
  distanceUsedKm: number
  routeMode: RouteMode
  litersConsumed: number
  fuelCost: number
  otherVariableCosts: number
  courierPay: number
  operationalCost: number
  freightCharged: number
  result: number
  /** `null` quando o frete cobrado é zero (margem indefinida). */
  marginPct: number | null
  verdict: FreightVerdict
  limitations: string[]
}

export function routeMultiplier(mode: RouteMode): number {
  return mode === 'round_trip' ? 2 : 1
}

export function distanceUsedKm(oneWayKm: number, mode: RouteMode): number {
  return oneWayKm * routeMultiplier(mode)
}

export function litersConsumed(distanceKm: number, consumptionKmPerLiter: number): number {
  if (consumptionKmPerLiter <= 0) throw new RangeError('O consumo deve ser maior que zero.')
  return distanceKm / consumptionKmPerLiter
}

export function fuelCost(distanceKm: number, consumptionKmPerLiter: number, pricePerLiter: number): number {
  return litersConsumed(distanceKm, consumptionKmPerLiter) * pricePerLiter
}

export function courierPayFor(rule: CompensationRule, distanceKm: number): number {
  switch (rule.model) {
    case 'per_delivery':
      return rule.perDelivery
    case 'per_km':
      return rule.perKm * distanceKm
    case 'per_delivery_plus_km':
      return rule.perDelivery + rule.perKm * distanceKm
    case 'fixed_salary':
      // Salário fixo não gera custo marginal por entrega.
      return 0
  }
}

export function marginPct(result: number, freightCharged: number): number | null {
  if (freightCharged <= 0) return null
  return (result / freightCharged) * 100
}

export function classifyResult(result: number, freightCharged: number, tolerancePct: number): FreightVerdict {
  const tolerance = Math.max(freightCharged * (tolerancePct / 100), 0.5)
  if (Math.abs(result) <= tolerance) return 'break_even'
  return result > 0 ? 'positive' : 'negative'
}

export function estimateFreight(input: FreightCostInput): FreightCostResult {
  const limitations: string[] = []
  const distanceKnown = input.oneWayDistanceKm !== null && input.oneWayDistanceKm > 0
  const oneWay = distanceKnown ? (input.oneWayDistanceKm as number) : 0
  const used = distanceUsedKm(oneWay, input.routeMode)

  if (!distanceKnown) {
    limitations.push('Distância não informada: custos por quilômetro (combustível, desgaste e remuneração por km) ficaram de fora.')
  }

  let liters = 0
  let fuel = 0
  let other = 0
  if (input.includeVehicleCosts) {
    const consumption = input.consumptionKmPerLiter
    if (consumption && consumption > 0) {
      liters = litersConsumed(used, consumption)
      fuel = liters * input.fuelPricePerLiter
    } else if (used > 0) {
      limitations.push('Consumo do veículo não informado: o custo de combustível não foi calculado.')
    }
    other = used * input.otherCostsPerKm
  }

  const pay = courierPayFor(input.compensation, used)
  const operational = fuel + other + pay
  const result = input.freightCharged - operational

  return {
    distanceKnown,
    oneWayDistanceKm: distanceKnown ? oneWay : null,
    distanceUsedKm: used,
    routeMode: input.routeMode,
    litersConsumed: liters,
    fuelCost: roundMoney(fuel),
    otherVariableCosts: roundMoney(other),
    courierPay: roundMoney(pay),
    operationalCost: roundMoney(operational),
    freightCharged: roundMoney(input.freightCharged),
    result: roundMoney(result),
    marginPct: marginPct(result, input.freightCharged),
    verdict: classifyResult(result, input.freightCharged, input.breakEvenTolerancePct),
    limitations,
  }
}

export const VERDICT_LABEL: Record<FreightVerdict, string> = {
  positive: 'Resultado positivo',
  break_even: 'Próximo do ponto de equilíbrio',
  negative: 'Resultado negativo',
}

export function verdictExplanation(r: FreightCostResult): string {
  switch (r.verdict) {
    case 'positive':
      return 'O frete cobrado cobre o custo estimado da entrega e ainda sobra margem.'
    case 'break_even':
      return 'O frete cobrado praticamente empata com o custo estimado. Pequenas variações podem gerar prejuízo.'
    case 'negative':
      return 'O custo estimado da entrega é maior que o frete cobrado. O estabelecimento está subsidiando esta entrega.'
  }
}
