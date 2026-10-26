/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "local" (padrão) usa localStorage; "http" usa a API definida em VITE_API_BASE_URL. */
  readonly VITE_DATA_SOURCE?: 'local' | 'http'
  readonly VITE_API_BASE_URL?: string
  /** Endereço público do app do motoboy (loja de apps ou página de instalação), usado no QR Code. */
  readonly VITE_COURIER_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
