# Integrações futuras

Nenhuma integração externa está ativa. Não existem simulações de WhatsApp, Instagram, GPS,
roteamento ou pagamentos. As interfaces estão em `src/services/integrations/index.ts`.
**Todas as credenciais ficam no backend**; o painel só consome os resultados pela API.

| Integração | Para quê | O que será necessário |
|---|---|---|
| WhatsApp Business Platform (Meta) | Receber pedidos como rascunhos e enviar atualizações de status ao cliente | Conta Business verificada, número dedicado, app na Meta, token de sistema, webhook HTTPS no backend, templates aprovados para mensagens ativas |
| Instagram Messaging API | Transformar mensagens do Direct em rascunhos de pedido | Conta profissional ligada a uma Página, app Meta com permissões de mensagens aprovadas, webhook no backend |
| Geocodificação (`GeocodingProvider`) | Converter endereço em coordenadas automaticamente | Nominatim próprio (gratuito, exige servidor) ou API comercial (Google Geocoding, Mapbox, HERE) com chave guardada no backend; cache dos resultados |
| Roteamento (`RoutingProvider`) | Distância e tempo reais pelas ruas; otimização de múltiplas paradas | OSRM ou GraphHopper com dados OSM do Brasil (servidor próprio) ou API comercial (Google Routes, Mapbox Directions/Optimization) |
| Rastreamento (`CourierTrackingFeed`) | Posição do motoboy em tempo real no mapa | App do motoboy publicado, consentimento de localização, envio só durante o turno, canal WebSocket/SSE na API, política de retenção (LGPD) |
| Tiles de mapa | Exibir o mapa | Hoje usa tiles públicos do OpenStreetMap (sem chave, uso moderado). Em produção: provedor contratado (MapTiler, Stadia, Mapbox) ou servidor de tiles próprio |
| Pagamentos (opcional) | Link de pagamento/Pix | Gateway (ex.: Mercado Pago, Pagar.me, Stripe) integrado no backend; webhooks de confirmação |

Quando uma integração for conectada, a distância calculada por roteamento deve usar
`distanceSource: 'routing'` (adicionar ao tipo `DistanceSource`) para que a interface pare de
exibir o aviso de "linha reta".
