# Aplicativo do motoboy — planejamento

O app não faz parte desta versão. Os contratos estão em `src/types/courierApp.ts` e reutilizam os
mesmos modelos do painel, para que estabelecimento e motoboy compartilhem dados autorizados pela API.

## Capacidades e como se apoiam no modelo atual

| Capacidade | Base no modelo |
|---|---|
| Autenticar o entregador | Conta própria do `Courier` (login por telefone + código). Tokens nunca compartilhados com o painel |
| Ver entregas atribuídas | `Delivery.courierId` + `CourierDeliveryView` (subconjunto do pedido: endereço, contato, observações, pagamento/troco) |
| Aceitar ou recusar ofertas | Novo recurso `DeliveryOffer` (modo oferta), configurável por estabelecimento; a atribuição direta atual continua válida |
| Endereço e rota | `DeliveryAddress.location` + `RoutingProvider` no backend |
| Registrar retirada | Evento `picked_up` → `Order` vai para "Saiu para entrega" e `Delivery` para `in_transit` |
| Atualizar status / concluir / falhar | Eventos `delivered` / `failed`, validados pela mesma máquina de estados (`orderWorkflow.ts`) |
| Histórico de entregas | `Delivery` filtradas por `courierId` (todas as empresas vinculadas) |
| Moto, consumo e custos | `Courier.vehicle` + `CourierCostProfile` (custos pessoais do motoboy) |
| Rentabilidade antes de aceitar | `estimateFreight` (mesma função do painel) com os custos do motoboy e `estimatedPay` do vínculo |
| Disponibilidade | `CourierLink.shiftStatus` por estabelecimento |

## Regras de privacidade e isolamento

- O motoboy só vê dados de estabelecimentos com `CourierLink.linkStatus = 'active'`.
- Um estabelecimento nunca vê entregas, ganhos ou localização do motoboy em outra empresa.
- Vincular um motoboy a um novo estabelecimento exige autorização dele (`pending_authorization` → `active`).
- Localização só é coletada durante o turno, com consentimento explícito e retenção limitada.
