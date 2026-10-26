# EasyEntregas · Painel do estabelecimento

Painel web para pizzarias, hamburguerias, restaurantes e outros estabelecimentos de delivery
cadastrarem pedidos, despacharem entregas para motoboys e avaliarem a viabilidade financeira do frete.

Esta é a **primeira versão (somente o painel do estabelecimento)**, rodando com dados
**demonstrativos** salvos no navegador. A arquitetura já separa a interface da fonte de dados para
conectar uma API real e, depois, o aplicativo dos motoboys.

## Como rodar

```bash
npm install
```

```bash
npm run dev
```

Acesse `http://localhost:5173`. Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Testes (Vitest + Vue Test Utils) |
| `npm run type-check` | Verificação de tipos (vue-tsc) |
| `npm run build` | Type-check + build de produção em `dist/` |

Requer Node 20+ (testado com Node 24).

## O que já funciona

- **Visão geral**: indicadores do dia calculados a partir dos pedidos (pedidos, aguardando motoboy,
  em rota, entregues, fretes cobrados, custo estimado, resultado, tempo médio, taxa de conclusão,
  motoboys disponíveis), pedidos por hora, distribuição por status, pedidos recentes, atividade e
  alerta de pedidos parados. Cada indicador leva à lista filtrada correspondente.
- **Pedidos**: cadastro com validação (cliente, endereço, distância, localização no mapa, itens,
  frete, pagamento e troco, observações, motoboy opcional), edição com registro dos campos alterados,
  filtros por status/origem/motoboy/período/busca (na URL), ordenação e ações rápidas de status.
- **Fluxo de status**: Recebido → Em preparação → Pronto para retirada → Aguardando motoboy →
  Saiu para entrega → Entregue, com Cancelado e Falha na entrega. Transições inválidas são bloqueadas;
  saída exige motoboy; cancelamento e falha exigem motivo; tudo fica no histórico com data, hora e autor.
  Após falha, uma nova tentativa gera uma nova *entrega* para o mesmo *pedido*.
- **Despacho**: fila de pedidos sem motoboy (com destaque para espera longa), atribuídos aguardando
  saída, entregas em rota com duração, carga por motoboy, filtros de disponíveis/ocupados/no limite,
  início/fim de turno e comparação de custo e resultado por motoboy no momento da atribuição.
- **Motoboys**: cadastro e edição (vínculo, remuneração, veículo, consumo, quem paga o combustível),
  status derivado (ocupado = tem entrega em rota), histórico de entregas e desempenho por período.
- **Mapa** (Leaflet + OpenStreetMap): marcadores por situação, legenda com filtros, painel lateral,
  seleção sincronizada lista ↔ mapa e lista de pedidos com localização pendente.
- **Calculadora de frete**: fórmulas explícitas, ida e volta sem duplicar percurso, custos do veículo
  opcionais, regra de remuneração de qualquer motoboy, frete de equilíbrio, simulação por distância.
- **Relatórios**: indicadores por período, fretes × custo por dia (com tabela), desempenho por motoboy,
  pedidos por origem e exportação CSV (pedidos, motoboys, resumo diário).
- **Configurações**: dados do estabelecimento (com localização), custos de referência, regras
  operacionais, remuneração padrão, notificações, usuários e matriz de permissões, integrações
  previstas e restauração dos dados demonstrativos.
- **Sessão de demonstração**: no menu do usuário é possível alternar entre dois estabelecimentos e
  entre perfis (proprietário, atendente, despachante) para ver isolamento de dados e permissões.
- Atalhos: `/` foca a busca global; `N` abre um novo pedido.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — estrutura, modelos, decisões e como trocar para uma API real.
- [docs/INTEGRACOES.md](docs/INTEGRACOES.md) — WhatsApp, Instagram, geocodificação, rotas e rastreamento: o que será necessário.
- [docs/APP-MOTOBOY.md](docs/APP-MOTOBOY.md) — contratos planejados para o aplicativo do entregador.

## Limitações conhecidas

- Os dados ficam no `localStorage` deste navegador. Isso **não** é seguro, não isola empresas de
  verdade e não serve para produção: é apenas uma camada de demonstração.
- Não há autenticação real; a troca de usuário no menu é uma simulação.
- Distâncias são informadas manualmente ou calculadas em **linha reta** a partir do ponto marcado
  no mapa (o percurso real é maior). Não há geocodificação nem roteamento conectados.
- Não há rastreamento de GPS; o mapa mostra endereços de entrega, não a posição dos motoboys.
- Os resultados financeiros são estimativas operacionais, não garantia de lucro.
- Os tiles públicos do OpenStreetMap têm política de uso justo; para volume de produção, use um provedor contratado.
