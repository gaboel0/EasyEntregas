import { describe, expect, it } from 'vitest'
import {
  classifyResult,
  courierPayFor,
  distanceUsedKm,
  estimateFreight,
  fuelCost,
  litersConsumed,
  marginPct,
  type FreightCostInput,
} from '@/modules/deliveries/freightCalculator'

const base: FreightCostInput = {
  oneWayDistanceKm: 5,
  routeMode: 'round_trip',
  consumptionKmPerLiter: 40,
  fuelPricePerLiter: 6,
  otherCostsPerKm: 0.2,
  compensation: { model: 'per_delivery', perDelivery: 5, perKm: 0 },
  includeVehicleCosts: true,
  freightCharged: 10,
  breakEvenTolerancePct: 10,
}

describe('fórmulas básicas de combustível', () => {
  it('litros = distância ÷ consumo', () => {
    expect(litersConsumed(10, 40)).toBe(0.25)
  })

  it('custo de combustível = litros × preço', () => {
    expect(fuelCost(10, 40, 6)).toBeCloseTo(1.5)
  })

  it('rejeita consumo zero ou negativo', () => {
    expect(() => litersConsumed(10, 0)).toThrow(RangeError)
  })

  it('ida e volta dobra a distância de ida; somente ida não dobra', () => {
    expect(distanceUsedKm(4, 'round_trip')).toBe(8)
    expect(distanceUsedKm(4, 'one_way')).toBe(4)
  })
})

describe('remuneração do motoboy', () => {
  it.each([
    [{ model: 'per_delivery', perDelivery: 7, perKm: 3 } as const, 7],
    [{ model: 'per_km', perDelivery: 7, perKm: 1.5 } as const, 15],
    [{ model: 'per_delivery_plus_km', perDelivery: 4, perKm: 1 } as const, 14],
    [{ model: 'fixed_salary', perDelivery: 4, perKm: 1 } as const, 0],
  ])('%o em 10 km = R$ %d', (rule, expected) => {
    expect(courierPayFor(rule, 10)).toBe(expected)
  })
})

describe('estimateFreight', () => {
  it('calcula custo operacional, resultado e margem com ida e volta', () => {
    const r = estimateFreight(base)
    // 10 km considerados: 0,25 L × 6 = 1,50; outros 10 × 0,20 = 2,00; remuneração 5,00
    expect(r.distanceUsedKm).toBe(10)
    expect(r.litersConsumed).toBeCloseTo(0.25)
    expect(r.fuelCost).toBe(1.5)
    expect(r.otherVariableCosts).toBe(2)
    expect(r.courierPay).toBe(5)
    expect(r.operationalCost).toBe(8.5)
    expect(r.result).toBe(1.5)
    expect(r.marginPct).toBeCloseTo(15)
    expect(r.verdict).toBe('positive')
    expect(r.limitations).toHaveLength(0)
  })

  it('não duplica o percurso no modo somente ida', () => {
    const r = estimateFreight({ ...base, routeMode: 'one_way' })
    expect(r.distanceUsedKm).toBe(5)
    expect(r.fuelCost).toBe(0.75)
  })

  it('retorna resultado negativo quando o custo supera o frete', () => {
    const r = estimateFreight({ ...base, freightCharged: 5 })
    expect(r.result).toBe(-3.5)
    expect(r.verdict).toBe('negative')
  })

  it('margem é nula (indefinida) quando o frete cobrado é zero', () => {
    const r = estimateFreight({ ...base, freightCharged: 0 })
    expect(r.marginPct).toBeNull()
    expect(r.verdict).toBe('negative')
  })

  it('ignora combustível e desgaste quando o veículo não é custo do estabelecimento', () => {
    const r = estimateFreight({ ...base, includeVehicleCosts: false })
    expect(r.fuelCost).toBe(0)
    expect(r.otherVariableCosts).toBe(0)
    expect(r.operationalCost).toBe(5)
  })

  it('sinaliza a limitação quando a distância é desconhecida', () => {
    const r = estimateFreight({ ...base, oneWayDistanceKm: null })
    expect(r.distanceKnown).toBe(false)
    expect(r.fuelCost).toBe(0)
    expect(r.operationalCost).toBe(5)
    expect(r.limitations[0]).toMatch(/Distância não informada/)
  })

  it('sinaliza consumo ausente sem quebrar o cálculo', () => {
    const r = estimateFreight({ ...base, consumptionKmPerLiter: null })
    expect(r.fuelCost).toBe(0)
    expect(r.limitations.some((l) => l.includes('Consumo'))).toBe(true)
  })

  it('separa o frete dos produtos: só o frete entra no resultado', () => {
    const r = estimateFreight({ ...base, freightCharged: 8.5 })
    expect(r.result).toBe(0)
  })
})

describe('classificação do resultado', () => {
  it('considera ponto de equilíbrio dentro da faixa de tolerância', () => {
    expect(classifyResult(0.8, 10, 10)).toBe('break_even')
    expect(classifyResult(-0.9, 10, 10)).toBe('break_even')
    expect(classifyResult(1.5, 10, 10)).toBe('positive')
    expect(classifyResult(-1.5, 10, 10)).toBe('negative')
  })

  it('margem percentual = resultado ÷ frete × 100', () => {
    expect(marginPct(2, 8)).toBe(25)
    expect(marginPct(2, 0)).toBeNull()
  })
})
