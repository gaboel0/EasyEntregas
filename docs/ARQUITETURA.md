# Arquitetura

## Visão geral

```
Páginas / componentes (Vue)
        │  leem visões derivadas e chamam ações
        ▼
Stores Pinia (orders, couriers, fleet, settings, session, notifications, app)
        │  dependem só dos contratos
        ▼
services/contracts.ts  ──►  local/ (localStorage, demonstração)   ← padrão
                       └─►  http/  (API REST)                      ← VITE_DATA_SOURCE=http
        │
        ▼
modules/ (regras de domínio puras e testáveis: fluxo de status, cálculo de frete, métricas, schemas)
```

A regra de ouro: **páginas não conhecem a origem dos dados** e **regras de negócio não ficam em
componentes**. As regras moram em `src/modules/*` (funções puras) e são impostas pela camada de
serviço — hoje a local, amanhã o backend.

## Estrutura de pastas

| Pasta | Conteúdo |
|---|---|
| `src/types/domain.ts` | Modelos: Establishment, User, Order, OrderItem, Courier, CourierLink, Delivery, OrderHistoryEntry, OperationalSettings |
| `src/types/courierApp.ts` | Contratos planejados para o app do motoboy |
| `src/modules/orders/` | Máquina de estados (`orderWorkflow.ts`), schema Zod, rótulos, visões derivadas, texto do histórico |
| `src/modules/deliveries/` | Calculadora de frete (`freightCalculator.ts`) e custo por pedido/entrega (`deliveryCost.ts`) |
| `src/modules/couriers/` | Schema, rótulos e status operacional dos motoboys |
| `src/modules/reports/` | Métricas (dashboard e relatórios usam as mesmas funções) |
| `src/modules/settings/` | Schemas de configurações e matriz de permissões |
| `src/services/` | Contratos, implementação local, adaptador HTTP e interfaces de integrações |
| `src/stores/` | Estado global (Pinia) |
| `src/composables/` | Toasts, confirmação, formulários com Zod, ações de pedido, relógio compartilhado |
| `src/components/ui/` | Design system (botões, campos, modal, badges, KPI, estados vazios) |
| `src/components/{orders,deliveries,couriers,charts,map,settings,layout}/` | Componentes por domínio |
| `src/layouts/`, `src/pages/`, `src/router/` | Layout com sidebar/cabeçalho, páginas e rotas (lazy-loaded) |
| `tests/` | Testes de cálculo, transições, serviço local, dados demo, formatação e componente |

## Modelos e decisões

- **Pedido ≠ Entrega.** `Order` é a venda (cliente, itens, valores, pagamento, status comercial).
  `Delivery` é a operação logística (motoboy, horários, custo). Um pedido pode ter várias entregas
  (`attempt`), por exemplo após uma falha.
- **Frete separado dos produtos.** `productsTotal` e `freightFee` são campos distintos; métricas de
  frete nunca somam produtos.
- **Custo congelado.** Ao encerrar uma entrega (entregue ou falha), o custo é gravado em
  `Delivery.costSnapshot`. Mudar o preço da gasolina depois não reescreve o passado; entregas ativas
  usam os parâmetros atuais.
- **Distância só de ida.** O endereço guarda a distância de ida (`distanceKm`) e a origem dela
  (`manual` ou `straight_line`). O modo de rota da configuração decide se ela é dobrada. Assim o
  percurso nunca é duplicado.
- **Motoboy multiestabelecimento.** `Courier` é a identidade global; `CourierLink` é o vínculo com
  um estabelecimento (código interno, remuneração, quem paga o veículo, turno, status do vínculo).
  O painel trabalha com `CourierProfile = Courier + link do estabelecimento atual`.
- **"Ocupado" é derivado.** O motoboy declara apenas disponível/indisponível (turno); fica "ocupado"
  quando tem entrega em rota, e "no limite" ao atingir o máximo de entregas simultâneas configurado.
- **Escopo por estabelecimento.** Todo registro de empresa tem `establishmentId`. O serviço local
  filtra tudo pela sessão (simulando o backend) e as mutações rodam sobre uma cópia, só persistindo
  se terminarem sem erro.
- **Permissões.** `modules/settings/permissions.ts` define o que cada papel pode fazer. A interface
  esconde/desabilita ações e o serviço recusa a operação; no backend isso será obrigatório.

## Fluxo de status

| De | Para |
|---|---|
| Recebido | Em preparação, Cancelado |
| Em preparação | Pronto para retirada, Cancelado |
| Pronto para retirada | Aguardando motoboy, Cancelado |
| Aguardando motoboy | Saiu para entrega (exige motoboy), Cancelado |
| Saiu para entrega | Entregue, Falha na entrega |
| Falha na entrega | Aguardando motoboy (nova tentativa), Cancelado |
| Entregue / Cancelado | — (finais) |

Cancelamento e falha exigem motivo. Motoboy pode ser atribuído/trocado/removido só antes da saída.

## Gráficos

Os gráficos usam Chart.js via `vue-chartjs`, com cores categóricas validadas para daltonismo
(`components/charts/chartColors.ts`): índigo para receita de frete e verde-azulado para custo.
Âmbar e vermelho ficam reservados para estados de atenção/falha. Toda série tem legenda ou rótulo, e
o gráfico diário dos relatórios tem uma visão em tabela.

## Como conectar uma API real

1. Implemente o backend seguindo os endpoints documentados em `src/services/http/httpDataSource.ts`
   (todas as rotas escopadas pelo estabelecimento do usuário autenticado).
2. O backend deve reimplementar e **impor** as regras de `modules/orders/orderWorkflow.ts`,
   `modules/deliveries/*` e `modules/settings/permissions.ts` — o frontend não é fonte de segurança.
3. Configure `.env` com `VITE_DATA_SOURCE=http` e `VITE_API_BASE_URL=...`.
   Variáveis `VITE_*` vão para o bundle: **nunca** coloque segredos nelas.
4. Autenticação recomendada: sessão em cookie `httpOnly` + `Secure` + `SameSite` emitido pelo backend
   (o adaptador já usa `credentials: 'include'`). Adicione uma página de login e um guard de rota
   que chame `GET /session`.
5. Troque `orders.list()` por consultas paginadas/filtradas por período e calcule os relatórios
   agregados no servidor quando o volume crescer.
6. Para atualização em tempo real entre atendentes e motoboys, adicione WebSocket/SSE e chame
   `useAppStore().refresh()` (ou aplique os eventos nas stores).
7. Remova a seleção de sessão de demonstração (`DemoControls`, `demoSeed.ts`) do build de produção.

Modelo relacional sugerido: `establishments`, `users`, `couriers`, `courier_links`
(único por `establishment_id, courier_id`), `orders`, `order_items`, `deliveries`,
`order_history`, `operational_settings`. Use valores monetários em centavos inteiros no banco.
