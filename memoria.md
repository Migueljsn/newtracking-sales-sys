# Memoria do Projeto — Fonil Sales System

> Arquivo vivo. Resume o estado implementado atual do sistema e as decisões de produto/arquitetura que já estão refletidas no código.

---

## Status atual

- Fase: **MVP funcional implementado**
- Data de início registrada no projeto: **2026-04-22**
- Estado atual: autenticação, dashboard, captura de leads, registro de vendas, importação/exportação XLSX e tracking assíncrono já existem no código
- Referências principais:
  - `prisma/schema.prisma`
  - `hub-tracking.md`
  - `salesyscrm-analise-modelagem.md`

---

## Objetivo do produto

Construir um CRM simples e operacional, orientado a tracking, para captar leads, registrar vendas e alimentar a Meta Conversions API com dados consistentes e reprocessáveis.

---

## Stack implementada

- Framework: Next.js 15 com App Router
- UI: React 19 + Tailwind CSS 4
- Banco: PostgreSQL via Prisma
- Autenticação: Supabase Auth com client server-side
- Hospedagem prevista: Vercel
- Importação/exportação: XLSX

---

## Regras e decisões que estão valendo no código

### D1 — Produto single-tenant por operador

- Cada `Client` possui exatamente um `User`
- Não existe papel `ADMIN` na aplicação
- Gestão de clientes fica fora do fluxo normal do sistema

### D2 — Entidade central é `Customer`

- A lead pertence a um `Customer`
- Vendas também pertencem ao `Customer`
- Recompra é detectada pelo histórico de vendas do mesmo `Customer`

### D3 — Fluxo comercial real

Fluxo implementado hoje:

1. Lead entra via API pública, criação manual ou importação XLSX
2. Lead nasce com status `NEW`
3. Operação pode marcar a lead como `LOST`
4. Operação pode registrar uma venda
5. Ao vender, a lead vira `SOLD` e um evento `Purchase` é enfileirado

Não existe etapa de `QualifiedLead` no código atual.

### D4 — Sistema tracking-first

- A captura cria um `TrackingEvent` de `Lead`
- A venda cria um `TrackingEvent` de `Purchase`
- O envio ao Meta é assíncrono
- Falha de tracking não bloqueia a operação principal
- Eventos têm `eventId` único para deduplicação
- Duplicatas geram evento `SKIPPED` para manter rastreabilidade

### D5 — Deduplicação e consolidação

- `Customer` é único por `clientId + phone`
- `Customer` também é único por `clientId + document`
- Ao criar lead, o sistema reaproveita ou cria o `Customer`
- Se já existir lead `NEW` para o mesmo `Customer`, a nova captura é tratada como duplicata

### D6 — Campos aceitos na captura

Campos usados pelo código na criação pública/manual/importação:

- Obrigatórios: `name`, `phone`
- Opcionais: `email`, `document`, `zipCode`, `city`, `state`, `birthDate`
- UTM: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Meta params: `fbc`, `fbp`, `event_id`, `event_source_url`

Mapeamento da API pública:

- `zip_code` -> `zipCode`
- `birth_date` -> `birthDate`

### D7 — Tracking Meta com fila persistida

- Eventos ficam em `TrackingEvent`
- Status possíveis: `PENDING`, `SUCCESS`, `FAILED`, `SKIPPED`
- Worker processa até 50 eventos pendentes por execução
- Cada evento tenta envio até 3 vezes
- Após falha final, o sistema cria `Notification` do tipo de erro de tracking

### D8 — XLSX é parte do fluxo operacional

- Importação lê a primeira aba da planilha
- Status aceitos na importação: `NOVA`, `VENDA`, `PERDIDA`
- Linha com `VENDA` e valor válido registra venda automaticamente
- Linha com `PERDIDA` marca a lead como `LOST`
- Duplicatas são ignoradas e contabilizadas
- Ao fim da importação o sistema cria uma `Notification` de conclusão
- Exportação gera planilha `Leads` com colunas operacionais e status dos eventos Meta

---

## Modelagem atual do banco

Entidades principais presentes em `prisma/schema.prisma`:

- `Client`
- `ClientSettings`
- `User`
- `Customer`
- `Lead`
- `LeadStatusHistory`
- `Sale`
- `SaleItem`
- `TrackingEvent`
- `Notification`

Enums principais:

- `CustomerLifecycle`: `NEW_BUYER`, `LOYAL`, `CHAMPION`, `AT_RISK`, `INACTIVE`
- `LeadStatus`: `NEW`, `SOLD`, `LOST`
- `LeadSource`: `FORM`, `MANUAL`, `IMPORT`
- `TrackingEventName`: `Lead`, `Purchase`
- `TrackingEventStatus`: `PENDING`, `SUCCESS`, `FAILED`, `SKIPPED`

---

## Estrutura funcional atual

### Rotas de aplicação

- `(auth)/login`
- `(dashboard)/`
- `(dashboard)/leads`
- `(dashboard)/leads/[id]`
- `(dashboard)/sales`
- `(dashboard)/import`
- `(dashboard)/settings`

### APIs expostas

- `POST /api/public/leads`
- `POST /api/import`
- `GET /api/export`
- `GET /api/tracking/worker`

### Server Actions

- criação manual de lead
- atualização de status para `LOST`
- registro de venda
- salvamento de configurações do cliente
- rotação de `leadCaptureKey`

### Módulos de domínio existentes

- `src/lib/domain/customer/find-or-create.ts`
- `src/lib/domain/customer/update-lifecycle.ts`
- `src/lib/domain/lead/create.ts`
- `src/lib/domain/sale/create.ts`
- `src/lib/domain/tracking/build-payload.ts`
- `src/lib/domain/tracking/hash.ts`
- `src/lib/domain/tracking/send-event.ts`

### Módulos auxiliares

- `src/lib/auth/session.ts`
- `src/lib/auth/supabase-server.ts`
- `src/lib/db/prisma.ts`
- `src/lib/xlsx/import.ts`
- `src/lib/xlsx/export.ts`

---

## Comportamento atual das telas

- Dashboard: cards simples com total de leads, vendas, eventos pendentes e falhos
- Leads: listagem completa e criação manual
- Lead detalhe: dados do contato, origem/UTMs, tracking, histórico de status e outras leads do mesmo customer
- Vendas: tabela e cards de receita total, volume e recompra
- Importação: upload de XLSX com instruções do formato
- Configurações: `leadCaptureKey`, Pixel ID, Access Token, Test Event Code e toggle de tracking

---

## Autenticação e segurança

- Middleware exige sessão para o dashboard
- `/api/public/*` e `/login` são públicas
- Sessão efetiva depende do usuário existir no Supabase e também no banco local
- A API pública de captura exige header `x-lead-capture-key`
- O worker aceita:
  - `Authorization: Bearer $CRON_SECRET` para Vercel Cron
  - `x-worker-secret: $TRACKING_WORKER_SECRET` para execução manual

---

## Pontos importantes refletidos no código

- O schema real está em `prisma/schema.prisma`, não em `schema.prisma`
- O tracking atual envia apenas `Lead` e `Purchase`
- O dashboard ainda é enxuto; análises mais profundas seguem como evolução futura

---

## Pendências e evolução natural

- Validar e endurecer regras de transição de status além do fluxo atual
- Expandir dashboard analítico
- Expor notificações operacionais na interface
- Cobrir o fluxo com testes automatizados
- Revisar versionamento da API Meta, hoje fixado em `v19.0`
- Arquitetar exclusão de leads via lixeira com `soft delete`, restauração e retenção controlada antes de qualquer remoção física

---

## Log de mudanças recentes

### 2026-04-23 — UX operacional e orientação contextual

- O sistema passou a usar guias curtos e contextuais nas telas principais em vez de onboarding longo
- Foram adicionados cards de orientação operacional em:
  - leads
  - vendas
  - importação
  - configurações
  - detalhe da lead
- A intenção é reduzir dependência de treinamento externo e explicar a próxima ação certa no ponto de uso

### 2026-04-23 — Conexões e cliques úteis

- Nome da lead na listagem passou a abrir diretamente o detalhe da lead
- Nome do cliente na área de vendas passou a levar para a lead associada
- Email no detalhe da lead passou a abrir por link `mailto:`
- Foi evitado transformar linhas inteiras de tabela em área clicável para não aumentar clique acidental

### 2026-04-23 — Máscaras e entrada de dados

- Campos de criação manual de lead passaram a usar máscaras visuais para telefone, CPF/CNPJ e CEP
- O backend normaliza esses campos antes de salvar para preservar deduplicação, busca e consistência de tracking

### 2026-04-23 — Correções finas de usabilidade visual

- Campos de busca com ícone foram corrigidos para evitar sobreposição entre placeholder e lupa
- Tabelas de leads e vendas usam wrapper com scroll horizontal controlado
- Conteúdos longos como nome, email e campanha passaram a ser truncados visualmente sem quebrar a estrutura

### 2026-04-23 — Correção técnica relevante

- Página `/sales` deixou de passar `Prisma.Decimal` diretamente para componente client
- O valor das vendas agora é serializado no server antes de alimentar a tabela
- Isso corrigiu o erro `Only plain objects can be passed to Client Components from Server Components`

### 2026-04-23 — Revisão visual ampla

- Tokens visuais e superfícies centralizados em `src/app/globals.css`
- Melhor contraste e consistência entre modo claro e modo escuro
- Inputs, botões, cards e tabelas passaram a usar componentes visuais mais consistentes
- Página de login foi redesenhada para seguir a mesma linguagem visual do dashboard
- Sidebar foi reestruturada para funcionar melhor em desktop e mobile
- Modais de criação de lead e registro de venda foram ajustados para reduzir quebras e sobreposição em telas menores

### 2026-04-23 — Decisão adiada sobre exclusão de leads

- Não implementar exclusão direta agora
- A direção correta para o futuro é:
  - lixeira
  - `soft delete`
  - restauração
  - retenção de 15 dias
  - hard delete apenas para leads sem vínculos críticos
- Leads com venda ou tracking relevante não devem ser removidas fisicamente de forma irrestrita
