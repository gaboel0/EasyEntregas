import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDuration, formatPhone, formatKm } from '@/utils/format'
import { toCsv } from '@/utils/csv'

describe('formatação pt-BR', () => {
  it('moeda em reais', () => {
    expect(formatCurrency(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
  })

  it('telefone com DDD', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
    expect(formatPhone('1130000101')).toBe('(11) 3000-0101')
  })

  it('duração e distância', () => {
    expect(formatDuration(8)).toBe('8 min')
    expect(formatDuration(65)).toBe('1 h 05 min')
    expect(formatKm(3.25)).toBe('3,3 km')
    expect(formatKm(null)).toBe('—')
  })
})

describe('CSV', () => {
  it('usa ponto e vírgula, vírgula decimal e escapa aspas', () => {
    expect(toCsv(['a', 'b'], [['x;y', 1.5]])).toBe('a;b\r\n"x;y";1,5')
  })

  it('neutraliza fórmulas de planilha', () => {
    expect(toCsv(['a'], [['=HYPERLINK("x")']])).toBe('a\r\n"\'=HYPERLINK(""x"")"')
  })
})
