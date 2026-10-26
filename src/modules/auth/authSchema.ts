import { z } from 'zod'
import { phoneSchema } from '@/modules/orders/orderSchema'
import type { BusinessType } from '@/types/domain'

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  pizzeria: 'Pizzaria',
  burger: 'Hamburgueria',
  sushi: 'Temakeria / japonês',
  restaurant: 'Restaurante',
  snack_bar: 'Lanchonete',
  other: 'Outro',
}
export const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABEL) as BusinessType[]

const email = z.string().trim().min(1, 'Informe o e-mail.').pipe(z.email('Informe um e-mail válido.'))
const newPassword = z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(128, 'Senha longa demais.')

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.'),
})

export const forgotPasswordSchema = z.object({ email })

const matchPasswords = (value: { password: string; confirmPassword: string }, ctx: z.RefinementCtx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não coincidem.' })
  }
}

/** Campos enviados ao serviço (a confirmação de senha existe só no formulário). */
export const establishmentRequestSchema = z.object({
  ownerName: z.string().trim().min(3, 'Informe o nome do responsável.').max(120),
  email,
  password: newPassword,
  businessName: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(120),
  businessType: z.enum(BUSINESS_TYPES as [BusinessType, ...BusinessType[]], { error: 'Selecione o tipo de negócio.' }),
  phone: phoneSchema,
})

export const courierRequestSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo.').max(120),
  email,
  password: newPassword,
  phone: phoneSchema,
})

const withConfirmation = { confirmPassword: z.string().min(1, 'Confirme a senha.') }

export const establishmentSignUpSchema = establishmentRequestSchema.extend(withConfirmation).superRefine(matchPasswords)
export const courierSignUpSchema = courierRequestSchema.extend(withConfirmation).superRefine(matchPasswords)
