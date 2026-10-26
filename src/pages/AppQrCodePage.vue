<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { Copy, Download, Info, Smartphone } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/ui/FormField.vue'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const session = useSessionStore()
const toast = useToast()
const KEY = 'rotacerta:app-qr-url'

/**
 * O app do motoboy ainda não existe. Enquanto isso, o QR aponta para o endereço configurado em
 * VITE_COURIER_APP_URL ou para um link de convite provisório deste estabelecimento, que pode ser
 * editado abaixo. O convite real (com vínculo autorizado) será emitido pelo backend.
 */
function defaultUrl(): string {
  const base = import.meta.env.VITE_COURIER_APP_URL || `${window.location.origin}/app-motoboy`
  return `${base}?estabelecimento=${encodeURIComponent(session.establishment?.id ?? '')}`
}

function saved(): string {
  try {
    return localStorage.getItem(KEY) || defaultUrl()
  } catch {
    return defaultUrl()
  }
}

const url = ref(saved())
const svg = ref('')
const valid = computed(() => /^https?:\/\/\S+$/i.test(url.value.trim()))

watch(
  url,
  async (value) => {
    const text = value.trim()
    if (!valid.value) {
      svg.value = ''
      return
    }
    try {
      localStorage.setItem(KEY, text)
    } catch {
      /* ignorar */
    }
    // Sempre escuro sobre branco: leitores de QR exigem contraste, independentemente do tema.
    svg.value = await QRCode.toString(text, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
  },
  { immediate: true },
)

async function copy() {
  try {
    await navigator.clipboard.writeText(url.value.trim())
    toast.success('Link copiado')
  } catch {
    toast.error('Não foi possível copiar', 'Selecione o link e copie manualmente.')
  }
}

async function download() {
  const dataUrl = await QRCode.toDataURL(url.value.trim(), { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'qrcode-app-motoboy.png'
  a.click()
}

function restore() {
  url.value = defaultUrl()
}
</script>

<template>
  <div>
    <PageHeader title="QRCode para app" description="Os motoboys escaneiam este código com o celular para acessar o aplicativo e se vincular ao estabelecimento." />

    <div class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section class="card flex flex-col items-center p-6" aria-labelledby="qr-title">
        <h2 id="qr-title" class="sr-only">QR Code</h2>
        <div
          v-if="svg"
          class="size-64 overflow-hidden rounded-2xl bg-white p-1 [&>svg]:size-full"
          role="img"
          :aria-label="`QR Code que abre ${url}`"
          v-html="svg"
        />
        <div v-else class="grid size-64 place-items-center rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-500">Informe um endereço válido (começando com https://) para gerar o código.</div>
        <p class="mt-4 text-center text-sm font-medium text-slate-900">{{ session.establishment?.name }}</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <AppButton :icon="Copy" :disabled="!valid" @click="copy">Copiar link</AppButton>
          <AppButton variant="primary" :icon="Download" :disabled="!valid" @click="download">Baixar PNG</AppButton>
        </div>
      </section>

      <div class="space-y-5">
        <section class="card" aria-labelledby="qr-link">
          <div class="card-header"><h2 id="qr-link" class="card-title">Endereço do código</h2></div>
          <div class="space-y-3 p-4">
            <FormField v-slot="{ id, invalid, describedby }" label="Link aberto ao escanear" :error="url && !valid ? 'Use um endereço completo, como https://…' : undefined">
              <input :id="id" v-model="url" type="url" class="field-input" :aria-invalid="invalid || undefined" :aria-describedby="describedby" />
            </FormField>
            <AppButton size="sm" variant="ghost" @click="restore">Restaurar link padrão</AppButton>
          </div>
        </section>

        <section class="card" aria-labelledby="qr-how">
          <div class="card-header"><h2 id="qr-how" class="card-title">Como o motoboy usa</h2></div>
          <ol class="list-inside list-decimal space-y-1.5 p-4 text-sm text-slate-600">
            <li>Abre a câmera do celular e aponta para o código.</li>
            <li>Instala ou abre o aplicativo do motoboy.</li>
            <li>Entra com o telefone e confirma o vínculo com {{ session.establishment?.name }}.</li>
          </ol>
          <p class="mx-4 mb-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            <Info :size="15" class="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              O aplicativo do motoboy ainda não foi lançado: o código aponta para o endereço acima, que é provisório. Quando o app existir, defina
              <code class="font-mono">VITE_COURIER_APP_URL</code> e o backend passará a emitir convites que o motoboy precisa aceitar para ser vinculado.
            </span>
          </p>
        </section>
        <p class="flex items-center gap-2 text-xs text-slate-500"><Smartphone :size="14" aria-hidden="true" /> O código é gerado neste navegador; nenhum dado é enviado a serviços externos.</p>
      </div>
    </div>
  </div>
</template>
