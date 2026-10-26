const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const decimal2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatCurrency = (value: number): string => currency.format(value)
export const formatInteger = (value: number): string => integer.format(value)
export const formatDecimal = (value: number, digits: 1 | 2 = 2): string =>
  (digits === 1 ? decimal1 : decimal2).format(value)

export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${decimal1.format(value)} km`
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}

export const formatDate = (iso: string): string => dateFmt.format(new Date(iso))
export const formatShortDate = (iso: string | Date): string => shortDateFmt.format(new Date(iso))
export const formatTime = (iso: string): string => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso))

/** Duração em minutos para texto curto: "8 min", "1 h 05 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—'
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h} h ${String(m).padStart(2, '0')} min`
}

export function minutesBetween(fromIso: string, to: Date | string = new Date()): number {
  return (new Date(to).getTime() - new Date(fromIso).getTime()) / 60000
}

/** "há 5 min", "há 2 h", ou a data quando for de outro dia. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor(minutesBetween(iso, now))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && new Date(iso).toDateString() === now.toDateString()) return `há ${hours} h`
  return formatDateTime(iso)
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatPhone(value: string): string {
  const d = onlyDigits(value)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return value
}

export function formatOrderNumber(n: number): string {
  return `#${n}`
}
