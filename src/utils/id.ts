/** Gera identificadores únicos no cliente. Em produção, o backend deve emitir os IDs definitivos. */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18)
  return `${prefix}_${random}`
}
