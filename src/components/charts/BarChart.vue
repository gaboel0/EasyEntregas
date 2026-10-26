<script setup lang="ts">
import { computed } from 'vue'
import { cssVar, useAppearance } from '@/composables/useAppearance'
import { Bar } from 'vue-chartjs'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

export interface BarSeries {
  label: string
  data: number[]
  /** Cores categóricas validadas (ver docs/ARQUITETURA.md › Gráficos). */
  color: string
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: BarSeries[]
    format?: (value: number) => string
    height?: number
    /** Resumo textual para leitores de tela. */
    summary: string
  }>(),
  { height: 220, format: (v: number) => v.toLocaleString('pt-BR') },
)

const { version } = useAppearance()
/** Resolve tokens ("var(--x)") para a cor atual; recalcula quando tema/marca mudam. */
const resolve = (color: string): string => {
  void version.value
  const m = /^var\((--[\w-]+)\)$/.exec(color)
  return m ? cssVar(m[1]!) || color : color
}

const data = computed<ChartData<'bar'>>(() => ({
  labels: props.labels,
  datasets: props.series.map((s) => ({
    label: s.label,
    data: s.data,
    backgroundColor: resolve(s.color),
    hoverBackgroundColor: resolve(s.color),
    borderRadius: { topLeft: 4, topRight: 4 },
    borderSkipped: 'bottom',
    // Espaço de 2px entre barras vizinhas.
    borderColor: resolve('var(--card)'),
    borderWidth: { left: 1, right: 1 },
    maxBarThickness: 28,
    categoryPercentage: 0.75,
    barPercentage: 0.9,
  })),
}))

const options = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: props.series.length > 1,
      position: 'top',
      align: 'end',
      labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, color: resolve('var(--chart-tick)'), font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: resolve('var(--chart-tooltip-bg)'),
      padding: 10,
      cornerRadius: 8,
      titleFont: { weight: 600 },
      callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${props.format(Number(ctx.parsed.y))}` },
    },
  },
  scales: {
    x: { grid: { display: false }, border: { color: resolve('var(--chart-grid)') }, ticks: { color: resolve('var(--chart-tick)'), font: { size: 11 }, maxRotation: 0, autoSkipPadding: 8 } },
    y: {
      beginAtZero: true,
      grid: { color: resolve('var(--chart-grid)') },
      border: { display: false },
      ticks: { color: resolve('var(--chart-tick)'), font: { size: 11 }, maxTicksLimit: 5, callback: (v) => props.format(Number(v)) },
    },
  },
}))
</script>

<template>
  <figure :style="{ height: `${height}px` }" class="relative">
    <Bar :data="data" :options="options" role="img" :aria-label="summary" />
    <figcaption class="sr-only">{{ summary }}</figcaption>
  </figure>
</template>
