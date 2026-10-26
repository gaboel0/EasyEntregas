import { z } from 'zod'
import { onlyDigits } from '@/utils/format'
import { ORDER_SOURCES, PAYMENT_METHODS } from './orderLabels'
import type { OrderSource, PaymentMethod } from '@/types/domain'

const requiredText = (label: string, min = 1, max = 160) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(1, `Informe ${label}.`)
    .min(min, `${capitalize(label)} deve ter ao menos ${min} caracteres.`)
    .max(max, `${capitalize(label)} deve ter no máximo ${max} caracteres.`)

const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).optional()

function capitalize(text: string): string {
  const clean = text.replace(/^(o|a|os|as) /, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export const phoneSchema = z
  .string({ error: 'Informe o telefone.' })
  .trim()
  .refine((v) => [10, 11].includes(onlyDigits(v).length), 'Informe um telefone com DDD (10 ou 11 dígitos).')

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const money = (label: string, max = 100000) =>
  z
    .number({ error: `Informe ${label}.` })
    .min(0, `${capitalize(label)} não pode ser negativo.`)
    .max(max, `${capitalize(label)} parece alto demais.`)

export const orderItemSchema = z.object({
  id: z.string().optional(),
  name: requiredText('o produto', 1, 120),
  quantity: z
    .number({ error: 'Informe a quantidade.' })
    .int('Use um número inteiro.')
    .min(1, 'Mínimo 1.')
    .max(99, 'Máximo 99.'),
  unitPrice: money('o preço', 10000),
  notes: optionalText(160),
})

export const orderInputSchema = z
  .object({
    customerName: requiredText('o nome do cliente', 2, 120),
    customerPhone: phoneSchema,
    address: z.object({
      street: requiredText('a rua', 2, 160),
      number: requiredText('o número', 1, 20),
      district: requiredText('o bairro', 2, 80),
      city: requiredText('a cidade', 2, 80),
      state: z.string().trim().length(2, 'Use a sigla do estado (ex.: SP).'),
      complement: optionalText(120),
      reference: optionalText(160),
      location: geoPointSchema.nullable(),
      distanceKm: z.number().min(0, 'A distância não pode ser negativa.').max(100, 'Distância acima de 100 km.').nullable(),
      distanceSource: z.enum(['manual', 'straight_line']).nullable(),
    }),
    source: z.enum(ORDER_SOURCES as [OrderSource, ...OrderSource[]], { error: 'Selecione a origem do pedido.' }),
    items: z.array(orderItemSchema).min(1, 'Adicione pelo menos um produto.'),
    freightFee: money('o frete', 1000),
    payment: z.object({
      method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], { error: 'Selecione a forma de pagamento.' }),
      changeFor: z.number().min(0).nullable(),
    }),
    deliveryNotes: optionalText(500),
    courierId: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.payment.method === 'cash' && value.payment.changeFor !== null) {
      const total = orderTotal(value.items, value.freightFee)
      if (value.payment.changeFor < total) {
        ctx.addIssue({
          code: 'custom',
          path: ['payment', 'changeFor'],
          message: 'O valor para troco deve ser maior ou igual ao total do pedido.',
        })
      }
    }
  })

export type OrderInput = z.infer<typeof orderInputSchema>
export type OrderItemInput = z.infer<typeof orderItemSchema>

export function productsTotal(items: readonly { quantity: number; unitPrice: number }[]): number {
  return Math.round(items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0) * 100) / 100
}

export function orderTotal(items: readonly { quantity: number; unitPrice: number }[], freightFee: number): number {
  return Math.round((productsTotal(items) + freightFee) * 100) / 100
}
