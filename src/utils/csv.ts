export type CsvValue = string | number | boolean | null | undefined

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value).replace('.', ',')
  const text = String(value)
  // Evita injeção de fórmulas ao abrir o arquivo no Excel/Planilhas.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV com ";" como separador (padrão do Excel em pt-BR) e vírgula decimal. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
