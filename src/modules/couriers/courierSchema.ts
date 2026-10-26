import { z } from 'zod'
import { phoneSchema } from '@/modules/orders/orderSchema'

export const compensationSchema = z
  .object({
    model: z.enum(['per_delivery', 'per_km', 'per_delivery_plus_km', 'fixed_salary']),
    perDelivery: z.number({ error: 'Informe o valor.' }).min(0, 'Valor inválido.').max(500, 'Valor alto demais.'),
    perKm: z.number({ error: 'Informe o valor.' }).min(0, 'Valor inválido.').max(100, 'Valor alto demais.'),
  })
  .superRefine((v, ctx) => {
    if ((v.model === 'per_delivery' || v.model === 'per_delivery_plus_km') && v.perDelivery <= 0) {
      ctx.addIssue({ code: 'custom', path: ['perDelivery'], message: 'Informe o valor por entrega.' })
    }
    if ((v.model === 'per_km' || v.model === 'per_delivery_plus_km') && v.perKm <= 0) {
      ctx.addIssue({ code: 'custom', path: ['perKm'], message: 'Informe o valor por km.' })
    }
  })

export const courierInputSchema = z
  .object({
    name: z.string().trim().min(3, 'Informe o nome completo.').max(120),
    phone: phoneSchema,
    internalCode: z.string().trim().min(1, 'Informe o identificador interno.').max(20, 'Use até 20 caracteres.'),
    linkType: z.enum(['employee', 'partner', 'other']),
    compensation: compensationSchema,
    vehicleCostsPaidByEstablishment: z.boolean(),
    shiftStatus: z.enum(['available', 'unavailable']),
    notes: z.string().trim().max(500, 'Use até 500 caracteres.').optional(),
    vehicle: z.object({
      type: z.enum(['motorcycle', 'bicycle', 'car']),
      model: z.string().trim().max(60).optional(),
      plate: z.string().trim().max(10).optional(),
      consumptionKmPerLiter: z.number().min(1, 'Consumo inválido.').max(100, 'Consumo acima de 100 km/l.').nullable(),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.vehicle.type !== 'bicycle' && v.vehicleCostsPaidByEstablishment && v.vehicle.consumptionKmPerLiter === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['vehicle', 'consumptionKmPerLiter'],
        message: 'Informe o consumo para estimar o combustível pago pelo estabelecimento.',
      })
    }
  })

export type CourierInput = z.infer<typeof courierInputSchema>
