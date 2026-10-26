import { computed, ref } from 'vue'

/**
 * Aparência: tema (claro/escuro) e cor da marca, de forma independente.
 *
 * - Tema: `html.dark` ativa os tokens escuros de `style.css`. Na primeira visita segue o sistema
 *   operacional; depois vale a escolha manual salva.
 * - Marca: apenas o matiz (`--brand-h`) é salvo; a escala de cores (clara e escura) é derivada em CSS,
 *   então a cor da marca nunca altera os fundos neutros.
 * - O mesmo estado inicial é aplicado antes da renderização por um script em `index.html` (sem flash).
 *
 * É uma preferência do navegador (localStorage). Com backend, a cor da marca deve passar a ser um
 * campo do estabelecimento e o tema, uma preferência do usuário.
 */

export type ThemeMode = 'light' | 'dark'

export const THEME_KEY = 'rotacerta:theme'
export const BRAND_KEY = 'rotacerta:brand-h'

export interface BrandPreset {
  key: string
  label: string
  hue: number
}

export const BRAND_PRESETS: readonly BrandPreset[] = [
  { key: 'blue', label: 'Azul', hue: 262 },
  { key: 'indigo', label: 'Índigo', hue: 277 },
  { key: 'violet', label: 'Violeta', hue: 300 },
  { key: 'teal', label: 'Verde-água', hue: 190 },
  { key: 'green', label: 'Verde', hue: 150 },
  { key: 'orange', label: 'Laranja', hue: 50 },
  { key: 'rose', label: 'Rosa', hue: 355 },
]

export const DEFAULT_BRAND_HUE = 262

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* armazenamento indisponível: a preferência vale só para esta sessão */
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function initialTheme(): ThemeMode {
  const saved = read(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return systemPrefersDark() ? 'dark' : 'light'
}

function initialHue(): number {
  const saved = Number(read(BRAND_KEY))
  return Number.isFinite(saved) && saved >= 0 && saved <= 360 && read(BRAND_KEY) !== null ? saved : DEFAULT_BRAND_HUE
}

const theme = ref<ThemeMode>(initialTheme())
const brandHue = ref<number>(initialHue())
/** Incrementa a cada mudança para que gráficos recalculem as cores a partir dos tokens. */
const version = ref(0)

function applyTheme(animate: boolean) {
  const root = document.documentElement
  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 260)
  }
  root.classList.toggle('dark', theme.value === 'dark')
  root.style.colorScheme = theme.value
  version.value++
}

function applyBrand() {
  document.documentElement.style.setProperty('--brand-h', String(brandHue.value))
  version.value++
}

let started = false
/** Aplica o estado atual ao documento. Chamado uma vez na inicialização do app. */
export function initAppearance() {
  if (started) return
  started = true
  applyTheme(false)
  applyBrand()
  // Sem escolha manual salva, acompanha mudanças do sistema operacional.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (read(THEME_KEY) === null) setTheme(e.matches ? 'dark' : 'light', false)
  })
}

function setTheme(mode: ThemeMode, persist = true) {
  theme.value = mode
  if (persist) write(THEME_KEY, mode)
  applyTheme(true)
}

export function useAppearance() {
  return {
    theme,
    isDark: computed(() => theme.value === 'dark'),
    brandHue,
    version,
    setTheme: (mode: ThemeMode) => setTheme(mode),
    toggleTheme: () => setTheme(theme.value === 'dark' ? 'light' : 'dark'),
    setBrandHue(hue: number) {
      brandHue.value = hue
      write(BRAND_KEY, String(hue))
      applyBrand()
    },
    resetBrand() {
      brandHue.value = DEFAULT_BRAND_HUE
      try {
        localStorage.removeItem(BRAND_KEY)
      } catch {
        /* ignorar */
      }
      applyBrand()
    },
  }
}

/** Lê um token CSS já resolvido (usado por gráficos em canvas). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
