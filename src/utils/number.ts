export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

export function average(values: readonly number[]): number | null {
  return values.length ? sum(values) / values.length : null
}
