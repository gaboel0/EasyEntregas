/**
 * Cores dos gráficos como tokens CSS (resolvidos em tempo de renderização, então acompanham tema
 * e cor da marca). Receita de frete = cor principal; custo = neutro, sempre distinguível por
 * saturação e rotulado na legenda. Âmbar/vermelho ficam reservados para estados de atenção/falha.
 */
export const CHART_COLORS = {
  revenue: 'var(--primary)',
  cost: 'var(--color-slate-400)',
  neutral: 'var(--color-slate-500)',
} as const
