import type {
  Courier,
  CourierLink,
  Delivery,
  Establishment,
  ID,
  OperationalSettings,
  Order,
  OrderHistoryEntry,
  User,
} from '@/types/domain'

/**
 * "Banco" local usado apenas para demonstração.
 *
 * ATENÇÃO: localStorage não é seguro nem isolado. Qualquer script da página consegue lê-lo e o
 * usuário pode alterá-lo livremente. Ele NÃO serve para autenticação, isolamento entre empresas
 * ou persistência de produção — esses papéis são do backend.
 */

export const DB_STORAGE_KEY = 'rotacerta:db'
export const SESSION_STORAGE_KEY = 'rotacerta:session'
export const AUTH_STORAGE_KEY = 'rotacerta:auth'
export const DB_SCHEMA_VERSION = 1

export interface LocalAuthMarker {
  role: 'establishment' | 'courier'
  name: string
}

export interface DatabaseShape {
  schemaVersion: number
  isDemo: boolean
  seededAt: string
  establishments: Establishment[]
  users: User[]
  settings: OperationalSettings[]
  couriers: Courier[]
  courierLinks: CourierLink[]
  orders: Order[]
  deliveries: Delivery[]
  orderHistory: OrderHistoryEntry[]
  /** Próximo número de pedido por estabelecimento. */
  orderCounters: Record<ID, number>
}

export interface LocalSession {
  establishmentId: ID
  userId: ID
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class LocalDatabase {
  private cache: DatabaseShape | null = null

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly seed: () => DatabaseShape,
  ) {}

  read(): DatabaseShape {
    if (this.cache) return this.cache
    const raw = this.storage.getItem(DB_STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DatabaseShape
        if (parsed.schemaVersion === DB_SCHEMA_VERSION && Array.isArray(parsed.orders)) {
          this.cache = parsed
          return parsed
        }
      } catch {
        // Dados corrompidos: recria a base de demonstração abaixo.
      }
    }
    return this.reset()
  }

  /**
   * Aplica uma mutação sobre uma cópia e só persiste se ela terminar sem erro,
   * simulando uma transação (falhas de validação não deixam dados pela metade).
   */
  write<T>(mutate: (db: DatabaseShape) => T): T {
    const draft = structuredClone(this.read())
    const result = mutate(draft)
    this.persist(draft)
    return result
  }

  reset(): DatabaseShape {
    const fresh = this.seed()
    this.persist(fresh)
    this.storage.removeItem(SESSION_STORAGE_KEY)
    return fresh
  }

  /** Descarta o cache para reler o armazenamento (ex.: outra aba alterou os dados). */
  invalidate(): void {
    this.cache = null
  }

  readSession(): LocalSession | null {
    const raw = this.storage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as LocalSession
    } catch {
      return null
    }
  }

  /** Marca de login da demonstração (somente papel e nome; nunca senha). */
  readAuthMarker(): LocalAuthMarker | null {
    try {
      const raw = this.storage.getItem(AUTH_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as LocalAuthMarker) : null
    } catch {
      return null
    }
  }

  writeAuthMarker(marker: LocalAuthMarker | null): void {
    if (marker) this.storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(marker))
    else this.storage.removeItem(AUTH_STORAGE_KEY)
  }

  writeSession(session: LocalSession): void {
    this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  }

  private persist(db: DatabaseShape): void {
    this.cache = db
    try {
      this.storage.setItem(DB_STORAGE_KEY, JSON.stringify(db))
    } catch (error) {
      // Cota excedida ou armazenamento bloqueado: mantém em memória durante a sessão.
      console.warn('[EasyEntregas] Não foi possível salvar os dados localmente.', error)
    }
  }
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}
