# Hub de Tracking — Fonil Sales System

> Documento de referência para implementação de tracking.
> Qualquer IA ou desenvolvedor que for implementar formulários, eventos, integrações ou fluxos de dados **deve ler este arquivo antes de começar**.
> Este documento está alinhado com `schema.prisma` e `memoria.md`.

---

## 1. Filosofia

O sistema é **tracking-first**. O CRM existe para alimentar os dados que o tracking precisa. A prioridade número 1 é garantir eventos limpos, completos e rastreáveis para o Meta Conversions API.

**Regras invioláveis:**
- UTMs são gravadas no momento da captura e jamais sobrescritas.
- Todo evento é uma entidade persistida no banco (`TrackingEvent`) antes de ser enviado.
- Falha no Meta não falha a operação de negócio (captura, venda).
- Deduplicação é responsabilidade do sistema, não da plataforma.
- Payload incompleto gera alerta (`Notification`) — mas não bloqueia o fluxo.
- Dados pessoais são sempre hasheados com SHA256 antes do envio. Exceção: `fbc` e `fbp`.

---

## 2. Eventos do sistema

O sistema envia **dois eventos** para o Meta Conversions API:

| Evento | Gatilho | Quem dispara |
|--------|---------|--------------|
| `Lead` | Lead criada (formulário, manual ou importação) | Pixel (browser) + Conversions API (server) |
| `Purchase` | Venda registrada no CRM ou importada via XLSX | Conversions API (server) apenas |

`QualifiedLead` **não existe** neste sistema. O fluxo vai direto de captura para venda.

---

## 3. Arquitetura de tracking

```
[Site do cliente]
     │
     ├── Pixel Meta (browser) — dispara evento Lead client-side
     │        └── event_id gerado no frontend, enviado no body do form
     │
     └── Formulário → POST /api/public/leads
              │
              ▼
     [Fonil Sales System — API]
              │
              ├── Localiza ou cria Customer (por phone ou document)
              ├── Cria Lead com status NEW e source FORM
              ├── Cria TrackingEvent { eventName: Lead, status: PENDING }
              │
              ▼
     [Worker assíncrono]
              │
              ├── Busca TrackingEvents com status PENDING
              ├── Monta payload completo
              ├── Envia para Meta Conversions API
              ├── Grava resposta → status SUCCESS ou FAILED
              └── Em falha: incrementa attempts (máx. 3) → cria Notification se esgotar
```

### Deduplicação pixel + server-side

O Meta usa o `event_id` para não contar o mesmo evento duas vezes quando vem do pixel e da Conversions API.

**Regra:**
1. Frontend gera um `event_id` (UUID v4) no momento do submit.
2. Esse `event_id` é enviado junto com os dados do formulário.
3. O servidor usa o mesmo `event_id` ao criar o `TrackingEvent`.
4. Se o `event_id` não vier do frontend: servidor gera `cuid()` estável.

---

## 4. Payloads dos eventos

### 4.1. Evento `Lead`

**Quando:** lead criada com `source = FORM` ou `source = MANUAL`.
Leads importadas via XLSX com `status = NOVA` também disparam este evento.

```json
{
  "event_name": "Lead",
  "event_time": "<unix timestamp do campo capturedAt da Lead>",
  "event_id": "<TrackingEvent.eventId>",
  "event_source_url": "<Lead.eventSourceUrl>",
  "user_data": {
    "ph": "<Customer.phone — normalizado e hashed>",
    "fn": "<primeira palavra de Customer.name — hashed>",
    "ln": "<demais palavras de Customer.name — hashed>",
    "em": "<Customer.email — hashed, omitir se null>",
    "zp": "<Customer.zipCode — normalizado e hashed, omitir se null>",
    "ct": "<Customer.city — hashed, omitir se null>",
    "st": "<Customer.state — minúsculo e hashed, omitir se null>",
    "db": "<Customer.birthDate — formato YYYYMMDD hashed, omitir se null>",
    "external_id": "<Lead.id — hashed>",
    "fbc": "<Lead.fbc — texto puro, omitir se null>",
    "fbp": "<Lead.fbp — texto puro, omitir se null>"
  },
  "custom_data": {
    "lead_source": "<Lead.source: FORM | MANUAL | IMPORT>",
    "utm_source": "<Lead.utmSource>",
    "utm_medium": "<Lead.utmMedium>",
    "utm_campaign": "<Lead.utmCampaign>",
    "utm_content": "<Lead.utmContent>",
    "utm_term": "<Lead.utmTerm>"
  }
}
```

**Regras:**
- Omitir campos `null` do `user_data` — não enviar chave com valor vazio.
- Lead duplicada (mesmo `phone` ou `document` no mesmo `clientId`) não dispara evento. Criar `TrackingEvent` com `status: SKIPPED`.

---

### 4.2. Evento `Purchase`

**Quando:** venda registrada no CRM ou importada via XLSX com `status = VENDA`.

```json
{
  "event_name": "Purchase",
  "event_time": "<unix timestamp do campo Sale.soldAt>",
  "event_id": "<TrackingEvent.eventId>",
  "event_source_url": "<Lead.eventSourceUrl da lead vinculada à venda>",
  "user_data": {
    "ph": "<Customer.phone — normalizado e hashed>",
    "fn": "<primeira palavra de Customer.name — hashed>",
    "ln": "<demais palavras de Customer.name — hashed>",
    "em": "<Customer.email — hashed, omitir se null>",
    "zp": "<Customer.zipCode — normalizado e hashed, omitir se null>",
    "ct": "<Customer.city — hashed, omitir se null>",
    "st": "<Customer.state — minúsculo e hashed, omitir se null>",
    "db": "<Customer.birthDate — formato YYYYMMDD hashed, omitir se null>",
    "external_id": "<Customer.id — hashed>",
    "fbc": "<Lead.fbc da lead vinculada — texto puro, omitir se null>",
    "fbp": "<Lead.fbp da lead vinculada — texto puro, omitir se null>"
  },
  "custom_data": {
    "value": "<Sale.value como número float>",
    "currency": "BRL",
    "order_id": "<Sale.id>",
    "is_repeat_purchase": "<Sale.isRepeatPurchase como boolean>",
    "utm_source": "<Lead.utmSource da lead vinculada>",
    "utm_medium": "<Lead.utmMedium da lead vinculada>",
    "utm_campaign": "<Lead.utmCampaign da lead vinculada>",
    "utm_content": "<Lead.utmContent da lead vinculada>",
    "utm_term": "<Lead.utmTerm da lead vinculada>"
  }
}
```

**Regras:**
- `external_id` usa `Customer.id` (não `Lead.id`) — o comprador é a identidade central em vendas.
- `fbc` e `fbp` vêm da Lead vinculada à venda (`Sale.leadId → Lead.fbc / Lead.fbp`).
- UTMs vêm sempre da Lead original — nunca sobrescritas.
- `value` deve ser número float (ex: `1500.00`), nunca string.
- `is_repeat_purchase` é `true` se o `Customer` já possuía outra `Sale` antes desta.

---

## 5. Schema de captura de lead (API pública)

### Endpoint
```
POST /api/public/leads
Header: x-lead-capture-key: <Client.leadCaptureKey>
```

### Campos preenchidos pelo usuário

| Campo | Tipo | Obrigatório | Mapeamento no banco | Impacto no tracking |
|-------|------|-------------|---------------------|---------------------|
| `name` | string | **sim** | `Customer.name` | `fn` + `ln` |
| `phone` | string | **sim** | `Customer.phone` | `ph` — chave primária de dedup |
| `email` | string | não | `Customer.email` | `em` — **+22% match rate** |
| `document` | string | não | `Customer.document` | chave secundária de dedup |
| `zip_code` | string | não | `Customer.zipCode` | `zp` — **+16% match rate** |
| `city` | string | não | `Customer.city` | `ct` — +9% match rate |
| `state` | string | não | `Customer.state` | `st` — +9% match rate |
| `birth_date` | string | não | `Customer.birthDate` | `db` — +9% match rate |

### Campos capturados automaticamente pelo JavaScript da landing page

Estes campos **não são preenchidos pelo usuário**. São injetados como campos hidden antes do submit.

| Campo | Origem no browser | Mapeamento no banco | Impacto no tracking |
|-------|-------------------|---------------------|---------------------|
| `fbc` | Cookie `_fbc` ou `fbclid` na URL | `Lead.fbc` | Crítico — atribuição do clique |
| `fbp` | Cookie `_fbp` do Pixel Meta | `Lead.fbp` | **+16% match rate** |
| `event_id` | UUID gerado no submit | `TrackingEvent.eventId` | Deduplicação pixel/server |
| `event_source_url` | `window.location.href` | `Lead.eventSourceUrl` | Obrigatório no payload |
| `utm_source` | URL param | `Lead.utmSource` | Atribuição de campanha |
| `utm_medium` | URL param | `Lead.utmMedium` | Atribuição de campanha |
| `utm_campaign` | URL param | `Lead.utmCampaign` | Atribuição de campanha |
| `utm_content` | URL param | `Lead.utmContent` | Atribuição de campanha |
| `utm_term` | URL param | `Lead.utmTerm` | Atribuição de campanha |

### Snippet obrigatório na landing page do cliente

```javascript
function getTrackingParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid');

  // fbc: preferir cookie _fbc, montar a partir de fbclid como fallback
  const fbcCookie = document.cookie.match(/_fbc=([^;]+)/)?.[1];
  const fbc = fbcCookie || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null);

  // fbp: cookie gerado pelo Pixel Meta
  const fbp = document.cookie.match(/_fbp=([^;]+)/)?.[1] || null;

  // event_id único para deduplicação pixel/server
  const event_id = crypto.randomUUID();

  return {
    fbc,
    fbp,
    event_id,
    event_source_url: window.location.href,
    utm_source:   urlParams.get('utm_source'),
    utm_medium:   urlParams.get('utm_medium'),
    utm_campaign: urlParams.get('utm_campaign'),
    utm_content:  urlParams.get('utm_content'),
    utm_term:     urlParams.get('utm_term'),
  };
}

// IMPORTANTE: o mesmo event_id deve ser usado no pixel do browser:
// fbq('track', 'Lead', {}, { eventID: event_id })
```

---

## 6. Regras de negócio da captura

### Deduplicação de lead
- Se já existe `Lead` com `status = NEW` para o mesmo `Customer` no mesmo `clientId` → não cria nova Lead. Retorna `{ ok: true, duplicate: true }`. Cria `TrackingEvent { status: SKIPPED }`.
- Lead com `status = SOLD` ou `LOST` **não bloqueia** criação de nova Lead para o mesmo Customer (nova oportunidade válida).

### Localização ou criação de Customer
- Buscar `Customer` pelo `phone` no `clientId`.
- Se não encontrar, buscar pelo `document` (quando informado).
- Se não encontrar: criar novo `Customer`.
- Se encontrar: atualizar apenas campos que estavam `null` e agora têm valor — nunca sobrescrever dados existentes.

### isRepeatPurchase
- Ao registrar venda: verificar se `Customer` já possui outra `Sale` confirmada.
- Se sim: `Sale.isRepeatPurchase = true`.
- Esse valor vai diretamente no payload do evento `Purchase`.

### Lifecycle do Customer
Recalculado sempre que uma nova `Sale` é registrada:

| Lifecycle | Critério |
|-----------|---------|
| `NEW_BUYER` | 1 venda total |
| `LOYAL` | 2 a 3 vendas |
| `CHAMPION` | 4+ vendas |
| `AT_RISK` | Última venda há mais de 60 dias |
| `INACTIVE` | Última venda há mais de 120 dias |

---

## 7. Normalização e hashing

### Função padrão

```typescript
import { createHash } from "crypto";

function hash(value: string): string {
  return createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}
```

### Regras por campo

| Campo Meta | Campo do banco | Preparação antes de hashear |
|------------|----------------|-----------------------------|
| `ph` | `Customer.phone` | Remover tudo que não for dígito. Adicionar DDI `55` se ausente. Ex: `5511999998888` |
| `em` | `Customer.email` | `trim()` + `toLowerCase()` |
| `fn` | `Customer.name` | Primeira palavra. `trim()` + `toLowerCase()` |
| `ln` | `Customer.name` | Todas as palavras após a primeira, unidas por espaço. `trim()` + `toLowerCase()` |
| `zp` | `Customer.zipCode` | Remover hífen e espaços. Ex: `01310100` |
| `ct` | `Customer.city` | `trim()` + `toLowerCase()` |
| `st` | `Customer.state` | Sigla em minúsculo. Ex: `sp` |
| `db` | `Customer.birthDate` | Formato `YYYYMMDD`. Ex: `19900515` |
| `external_id` | `Lead.id` ou `Customer.id` | `trim()` + `toLowerCase()` |

### Campos que NUNCA são hasheados

- `fbc` → texto puro (ex: `fb.1.1714000000000.AbCdEfGhIjKl`)
- `fbp` → texto puro (ex: `fb.1.1714000000000.1234567890`)

---

## 8. Fluxo de importação XLSX

Quando o usuário importa uma planilha XLSX, o sistema processa cada linha assim:

```
Para cada linha válida da planilha:

  1. Validar campos obrigatórios (Nome, Telefone)
     → Linha inválida: registrar erro, pular linha, continuar

  2. Localizar ou criar Customer (phone → document → criar novo)

  3. Criar Lead com:
     - source = IMPORT
     - capturedAt = coluna "Data de Captura" da linha (ou now())
     - UTMs da linha (se preenchidas)
     - status = NEW (por padrão)

  4. Criar TrackingEvent { eventName: Lead, status: PENDING }
     → Se lead duplicada ativa (NEW): TrackingEvent { status: SKIPPED }

  5. Se coluna Status = "VENDA":
     a. Validar que "Valor da Venda" está preenchido e é numérico
     b. Verificar se Customer já tem Sale → definir isRepeatPurchase
     c. Criar Sale { value, soldAt: coluna "Data da Venda" ou now() }
     d. Atualizar Lead.status = SOLD
     e. Criar TrackingEvent { eventName: Purchase, status: PENDING }

  6. Se coluna Status = "PERDIDA":
     a. Atualizar Lead.status = LOST

  7. Ao final da importação:
     → Criar Notification { type: IMPORT_COMPLETE } com total de linhas processadas
     → Se houve erros: criar Notification { type: IMPORT_ERROR } com detalhes por linha
```

---

## 9. Entidade TrackingEvent (referência do schema.prisma)

```prisma
model TrackingEvent {
  id            String              @id @default(cuid())
  clientId      String
  eventName     TrackingEventName   // Lead | Purchase
  eventId       String              @unique
  status        TrackingEventStatus @default(PENDING)
  payload       Json                // payload completo pronto para envio
  response      Json?               // resposta da Meta Conversions API
  errorMessage  String?
  attempts      Int                 @default(0)
  lastAttemptAt DateTime?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  leadId        String?
  saleId        String?

  @@index([clientId, status])
  @@index([eventName, status])
}

enum TrackingEventName {
  Lead
  Purchase
}

enum TrackingEventStatus {
  PENDING   // aguardando envio pelo worker
  SUCCESS   // enviado com sucesso
  FAILED    // falhou após 3 tentativas
  SKIPPED   // não enviado intencionalmente (duplicata, etc.)
}
```

---

## 10. Worker assíncrono

1. Buscar `TrackingEvent` com `status: PENDING` ordenado por `createdAt ASC`.
2. Para cada evento:
   - Verificar `ClientSettings.trackingEnabled = true`.
   - Verificar `ClientSettings.metaAccessToken` preenchido.
   - Enviar payload para `https://graph.facebook.com/v19.0/{pixelId}/events`.
   - Sucesso: `status = SUCCESS`, gravar `response`.
   - Falha: incrementar `attempts`, gravar `errorMessage`.
   - Se `attempts >= 3`: `status = FAILED`, criar `Notification { type: TRACKING_ERROR }`.

---

## 11. Configuração de tracking por cliente (ClientSettings)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `metaPixelId` | string | ID do Pixel Meta do cliente |
| `metaAccessToken` | string | Token da Conversions API |
| `metaTestEventCode` | string? | Código de teste — usar apenas em desenvolvimento |
| `trackingEnabled` | boolean | Liga/desliga o envio de eventos para este cliente |

O sistema nunca usa credenciais de um cliente para enviar eventos de outro.

---

## 12. Notificações geradas pelo tracking

| `type` | Quando é criada |
|--------|----------------|
| `TRACKING_ERROR` | Evento `FAILED` após 3 tentativas — inclui `eventId` e erro no `metadata` |
| `TRACKING_TOKEN_INVALID` | Meta retorna erro 401/403 — token expirado ou inválido |
| `IMPORT_COMPLETE` | Importação XLSX concluída — resumo no `metadata` (total, erros, vendas) |
| `IMPORT_ERROR` | Linhas da importação com dados inválidos — detalhes no `metadata` |
| `LOW_EMAIL_COVERAGE` | Mais de 40% das leads do último lote sem email |

---

## 13. O que NUNCA fazer

- Nunca disparar evento dentro de server action aguardando resposta síncrona do Meta.
- Nunca sobrescrever UTMs de uma lead já existente.
- Nunca hashear `fbc` ou `fbp`.
- Nunca enviar `ph`, `em`, `fn`, `ln` ou `external_id` sem hash.
- Nunca criar dois `TrackingEvent` do mesmo `eventName` para o mesmo `leadId` ou `saleId` — verificar antes de criar.
- Nunca silenciar erros do Meta — sempre gravar em `errorMessage`.
- Nunca usar `metaAccessToken` de um cliente para enviar evento de outro.
- Nunca omitir `value` e `currency` em eventos `Purchase`.
- Nunca sobrescrever dados de Customer que já estão preenchidos ao receber nova lead do mesmo contato.
