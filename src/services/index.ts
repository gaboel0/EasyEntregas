import type { DataSource } from './contracts'
import { LocalDatabase } from './local/localDatabase'
import { createDemoDatabase } from './local/demoSeed'
import { createLocalDataSource } from './local/localDataSource'
import { createHttpDataSource } from './http/httpDataSource'

/**
 * Ponto único de escolha da fonte de dados. Stores importam `dataSource` daqui e nunca
 * conhecem a implementação concreta.
 */
function createDataSource(): DataSource {
  if (import.meta.env.VITE_DATA_SOURCE === 'http') {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    if (!baseUrl) throw new Error('VITE_API_BASE_URL não definido para VITE_DATA_SOURCE=http.')
    return createHttpDataSource(baseUrl)
  }
  const db = new LocalDatabase(window.localStorage, () => createDemoDatabase(new Date()))
  return createLocalDataSource(db, { latencyMs: 180 })
}

export const dataSource: DataSource = createDataSource()

export * from './contracts'
