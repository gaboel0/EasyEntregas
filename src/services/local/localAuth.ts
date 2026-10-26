import type { Establishment, OperationalSettings, User } from '@/types/domain'
import { ServiceError, type AuthService, type AuthSession } from '../contracts'
import type { LocalDatabase } from './localDatabase'
import { courierRequestSchema, establishmentRequestSchema, forgotPasswordSchema, signInSchema } from '@/modules/auth/authSchema'
import { createId } from '@/utils/id'

type Parsed<T> = { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }

function unwrap<T>(result: Parsed<T>): T {
  if (!result.success) throw new ServiceError('validation', result.error.issues[0]?.message ?? 'Dados inválidos.')
  return result.data
}

/**
 * Autenticação DE DEMONSTRAÇÃO. Não existe verificação de senha: ela é validada no formato e
 * descartada (nunca é salva nem registrada). Quem entra é identificado apenas pelo e-mail entre as
 * contas da base local. Isso NÃO é segurança — a autenticação real será do backend.
 */
export function createLocalAuth(db: LocalDatabase): AuthService {
  return {
    async getSession() {
      return db.readAuthMarker()
    },

    async signIn(request) {
      const { email } = unwrap(signInSchema.safeParse(request))
      if (request.role === 'courier') {
        // Ainda não existem contas nem área de entregador: não há o que autenticar.
        const session: AuthSession = { role: 'courier', name: email }
        db.writeAuthMarker(session)
        return session
      }
      const user = db.read().users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.active)
      if (!user) {
        throw new ServiceError('unauthenticated', 'Conta não encontrada na demonstração. Use uma conta de exemplo ou cadastre-se.')
      }
      db.writeSession({ establishmentId: user.establishmentId, userId: user.id })
      const session: AuthSession = { role: 'establishment', name: user.name }
      db.writeAuthMarker(session)
      return session
    },

    async signUp(request) {
      if (request.role === 'courier') {
        const data = unwrap(courierRequestSchema.safeParse(request))
        // Sem área do entregador, nada é gravado: apenas validamos e levamos ao aviso.
        const session: AuthSession = { role: 'courier', name: data.fullName }
        db.writeAuthMarker(session)
        return session
      }
      const data = unwrap(establishmentRequestSchema.safeParse(request))
      const ids = db.write((draft) => {
        const email = data.email.toLowerCase()
        if (draft.users.some((u) => u.email.toLowerCase() === email)) {
          throw new ServiceError('conflict', 'Já existe uma conta com este e-mail.')
        }
        const at = new Date().toISOString()
        const establishment: Establishment = {
          id: createId('est'),
          name: data.businessName,
          businessType: data.businessType,
          phone: data.phone,
          // O endereço será completado depois, em Configurações.
          address: { street: '', number: '', district: '', city: '', state: '' },
          location: null,
          createdAt: at,
        }
        const user: User = { id: createId('usr'), establishmentId: establishment.id, name: data.ownerName, email, role: 'owner', active: true, createdAt: at }
        const settings: OperationalSettings = {
          establishmentId: establishment.id,
          fuelPricePerLiter: 6.19,
          defaultConsumptionKmPerLiter: 35,
          variableCostPerKm: 0.18,
          routeMode: 'round_trip',
          defaultFreightFee: 7,
          dispatchAlertMinutes: 15,
          maxConcurrentDeliveriesPerCourier: 3,
          breakEvenTolerancePct: 10,
          defaultCompensation: { model: 'per_delivery', perDelivery: 6, perKm: 0 },
          notifications: { newOrder: true, longDispatchWait: true, deliveryFailed: true, playSound: false },
          updatedAt: at,
        }
        draft.establishments.push(establishment)
        draft.users.push(user)
        draft.settings.push(settings)
        draft.orderCounters[establishment.id] = 1001
        return { establishmentId: establishment.id, userId: user.id }
      })
      db.writeSession(ids)
      const session: AuthSession = { role: 'establishment', name: data.ownerName }
      db.writeAuthMarker(session)
      return session
    },

    async requestPasswordReset(email) {
      unwrap(forgotPasswordSchema.safeParse({ email }))
      // Demonstração: nenhum e-mail é enviado. O backend deve responder igual exista ou não a conta.
    },

    async signOut() {
      db.writeAuthMarker(null)
    },
  }
}
