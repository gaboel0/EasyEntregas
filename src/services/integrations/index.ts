import type { GeoPoint, ID, OrderSource, PostalAddress } from '@/types/domain'

/**
 * Contratos de integrações externas. NENHUMA delas está conectada nesta versão — não há
 * simulação de WhatsApp, Instagram, GPS ou roteamento. Cada integração real deve rodar no
 * BACKEND, que guarda as credenciais; o frontend apenas consome o resultado pela API.
 *
 * Veja docs/INTEGRACOES.md para credenciais e serviços necessários.
 */

export interface IntegrationStatus {
  key: string
  name: string
  connected: boolean
  description: string
  requires: string
}

/** Recebimento automático de pedidos (WhatsApp Business Platform, Instagram Messaging etc.). */
export interface InboundOrderChannel {
  readonly source: OrderSource
  /** Mensagens recebidas viram rascunhos de pedido que um atendente confirma. */
  listPendingDrafts(): Promise<{ id: ID; customerName: string; customerPhone: string; rawMessage: string; receivedAt: string }[]>
}

/** Conversão de endereço em coordenadas (Nominatim self-hosted, Google Geocoding, Mapbox...). */
export interface GeocodingProvider {
  geocode(address: PostalAddress): Promise<{ location: GeoPoint; confidence: number } | null>
}

/** Distância e tempo reais pelas ruas (OSRM, GraphHopper, Google Routes...). */
export interface RoutingProvider {
  route(from: GeoPoint, to: GeoPoint[]): Promise<{ distanceKm: number; durationMin: number; polyline: GeoPoint[] }>
  /** Otimização de múltiplas paradas para um mesmo motoboy. */
  optimize?(from: GeoPoint, stops: { id: ID; location: GeoPoint }[]): Promise<ID[]>
}

/** Posições enviadas pelo app do motoboy (via API/WebSocket), nunca simuladas no painel. */
export interface CourierTrackingFeed {
  subscribe(establishmentId: ID, onPosition: (p: { courierId: ID; location: GeoPoint; at: string }) => void): () => void
}

export const INTEGRATIONS: IntegrationStatus[] = [
  {
    key: 'whatsapp',
    name: 'WhatsApp Business',
    connected: false,
    description: 'Receber pedidos e enviar atualizações de status ao cliente.',
    requires: 'Conta na WhatsApp Business Platform (Meta), número verificado, token de sistema e webhook no backend.',
  },
  {
    key: 'instagram',
    name: 'Instagram Direct',
    connected: false,
    description: 'Transformar mensagens do Direct em rascunhos de pedido.',
    requires: 'App Meta com Instagram Messaging API, conta profissional vinculada e webhook no backend.',
  },
  {
    key: 'geocoding',
    name: 'Geocodificação de endereços',
    connected: false,
    description: 'Localizar automaticamente o endereço do cliente no mapa.',
    requires: 'Serviço de geocodificação (ex.: Nominatim próprio, Google Geocoding ou Mapbox) chamado pelo backend.',
  },
  {
    key: 'routing',
    name: 'Rotas e distâncias reais',
    connected: false,
    description: 'Distância pelas ruas, tempo estimado e otimização de rotas.',
    requires: 'Servidor OSRM/GraphHopper próprio ou API comercial (Google Routes, Mapbox Directions).',
  },
  {
    key: 'tracking',
    name: 'Localização do motoboy',
    connected: false,
    description: 'Posição em tempo real enviada pelo aplicativo do entregador.',
    requires: 'App do motoboy publicado, consentimento de localização e canal em tempo real (WebSocket) na API.',
  },
]
