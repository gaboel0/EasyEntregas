export interface DateRange {
  from: Date
  to: Date
}

export type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'

export function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

export function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function rangeForPreset(preset: Exclude<PeriodPreset, 'custom'>, now: Date = new Date()): DateRange {
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': {
      const y = addDays(now, -1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case 'last7':
      return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) }
    case 'last30':
      return { from: startOfDay(addDays(now, -29)), to: endOfDay(now) }
  }
}

export function isWithin(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime()
  return t >= range.from.getTime() && t <= range.to.getTime()
}

/** "2026-10-26" no fuso local, para inputs type="date". */
export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromDateInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Lista os dias (início do dia) contidos no intervalo. */
export function eachDay(range: DateRange): Date[] {
  const days: Date[] = []
  for (let d = startOfDay(range.from); d.getTime() <= range.to.getTime(); d = addDays(d, 1)) days.push(d)
  return days
}

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  last7: 'Últimos 7 dias',
  last30: 'Últimos 30 dias',
  custom: 'Personalizado',
}
