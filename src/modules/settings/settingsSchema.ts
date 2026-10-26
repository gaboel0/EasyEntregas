import { z } from 'zod'
import { phoneSchema, geoPointSchema } from '@/modules/orders/orderSchema'
import { compensationSchema } from '@/modules/couriers/courierSchema'

export const establishmentInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(120),
  legalName: z.string().trim().max(160).optional(),
  document: z.string().trim().max(20).optional(),
  phone: phoneSchema,
  address: z.object({
    street: z.string().trim().min(2, 'Informe a rua.'),
    number: z.string().trim().min(1, 'Informe o número.'),
    district: z.string().trim().min(2, 'Informe o bairro.'),
    city: z.string().trim().min(2, 'Informe a cidade.'),
    state: z.string().trim().length(2, 'Use a sigla do estado.'),
    zipCode: z.string().trim().max(9).optional(),
  }),
  location: geoPointSchema.nullable(),
})

export type EstablishmentInput = z.infer<typeof establishmentInputSchema>

export const operationalSettingsInputSchema = z.object({
  fuelPricePerLiter: z.number({ error: 'Informe o preço.' }).min(0.01, 'Informe o preço.').max(30, 'Preço alto demais.'),
  defaultConsumptionKmPerLiter: z.number({ error: 'Informe o consumo.' }).min(1, 'Consumo inválido.').max(100),
  variableCostPerKm: z.number({ error: 'Informe o custo.' }).min(0, 'Valor inválido.').max(20),
  routeMode: z.enum(['one_way', 'round_trip']),
  defaultFreightFee: z.number({ error: 'Informe o frete padrão.' }).min(0).max(500),
  dispatchAlertMinutes: z.number({ error: 'Informe o tempo.' }).int().min(1, 'Mínimo 1 minuto.').max(240),
  maxConcurrentDeliveriesPerCourier: z.number({ error: 'Informe o limite.' }).int().min(1).max(10),
  breakEvenTolerancePct: z.number({ error: 'Informe a faixa.' }).min(0).max(50),
  defaultCompensation: compensationSchema,
  notifications: z.object({
    newOrder: z.boolean(),
    longDispatchWait: z.boolean(),
    deliveryFailed: z.boolean(),
    playSound: z.boolean(),
  }),
})

export type OperationalSettingsInput = z.infer<typeof operationalSettingsInputSchema>

export const userInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(120),
  email: z.email('Informe um e-mail válido.'),
  role: z.enum(['owner', 'manager', 'dispatcher', 'attendant']),
  active: z.boolean(),
})

export type UserInput = z.infer<typeof userInputSchema>
