# Analise do sistema Salesys CRM para orientar uma nova modelagem

## 1. Objetivo do sistema

O projeto implementa um CRM operacional multicliente com dois perfis principais:

- `ADMIN`: administra a plataforma inteira, cadastra clientes, acompanha a operação consolidada e trata pendências administrativas.
- `CLIENT`: opera apenas o próprio cliente, gerencia leads, registra vendas, acompanha relatórios e configura tracking.

Na prática, o sistema cobre cinco frentes de negócio:

1. Captura e gestão de leads.
2. Qualificação comercial da lead.
3. Registro interno de vendas e recompra.
4. Tracking de eventos para Meta (`QualifiedLead` e `Purchase`).
5. Geração de tarefas/notificações operacionais via inbox.

O nome visual do produto dentro da interface é `Fonil Sales System`.

## 2. Stack e arquitetura técnica atual

- Framework web: `Next.js 16.2.1` com App Router.
- UI: React 19, Server Components, Server Actions, Tailwind 4, Radix Dialog, Sonner.
- Banco: PostgreSQL via Prisma.
- Autenticação: Supabase Auth.
- Integração externa principal: Meta Conversions API.

### Estrutura macro

- `src/app/`: rotas, páginas, layouts, server actions e endpoints HTTP.
- `src/lib/`: regras de domínio e integrações compartilhadas.
- `src/components/`: componentes de interface reutilizados.
- `prisma/schema.prisma`: modelo de dados central.

### Característica importante da implementação

A aplicação mistura camada de apresentação, aplicação e domínio dentro do próprio App Router. As regras centrais não estão isoladas em módulos de negócio independentes; elas aparecem divididas entre:

- páginas server-side;
- server actions;
- helpers em `src/lib`.

Isso funciona para um produto pequeno, mas aumenta o acoplamento quando a operação cresce.

## 3. Modelo de dados atual

### Entidades principais

- `Client`: tenant do sistema.
- `ClientSettings`: configuração operacional e de tracking do cliente.
- `User`: usuário autenticado, com papel `ADMIN` ou `CLIENT`.
- `Lead`: oportunidade comercial.
- `LeadStatusHistory`: histórico de mudanças de status da lead.
- `Sale`: venda confirmada vinculada a uma lead.
- `SaleItem`: itens descritivos da venda.
- `InboxItem`: tarefa/notificação operacional.
- `ProfileChangeRequest`: solicitação de alteração de dados de acesso.

### Relações principais

- Um `Client` possui muitos `User`, `Lead`, `Sale` e `InboxItem`.
- Um `Client` possui um `ClientSettings`.
- Um `User` do tipo `CLIENT` pertence a um `Client`; `ADMIN` pode não pertencer.
- Um `Lead` pertence a um `Client`, pode ter responsável, qualificador, histórico, vendas e inbox items.
- Uma `Sale` pertence a um `Client` e a uma `Lead`.
- `InboxItem` pode apontar para `Client`, `Lead`, `Sale` ou `ProfileChangeRequest`.

### Observações de modelagem

- `Lead.status` é `string`, não enum de banco. Isso deixa a regra mais flexível, mas reduz consistência.
- `Lead.isQualified` e `Lead.status` coexistem. Ou seja: qualificação é um eixo separado do status do funil.
- `Sale` hoje nasce já como `CONFIRMED`; o enum tem outros estados, mas o fluxo atual usa praticamente confirmação imediata.
- `InboxItem` virou o mecanismo transversal de pendências da plataforma.

## 4. Fluxos de negócio atuais

### 4.1. Autenticação e escopo

- Login feito via Supabase Auth.
- Após autenticar, o sistema localiza o `User` interno pelo `authUserId`.
- O escopo de acesso é derivado do `role`.
- `ADMIN` vê tudo.
- `CLIENT` fica restrito ao próprio `clientId`.

Esse escopo é repetido em vários pontos do código, especialmente em consultas de lead e venda.

### 4.2. Criação de cliente

Fluxo administrativo:

1. Admin cria cliente com nome da empresa, email e senha.
2. O sistema cria um slug único.
3. Gera `leadCaptureKey`.
4. Cria usuário no Supabase.
5. Cria `Client`, `ClientSettings` e `User` local.

Esse fluxo já mostra um conceito importante: cada cliente é um tenant com credenciais próprias e chave pública de captura de leads.

### 4.3. Captura pública de lead

Existe endpoint público `POST /api/public/leads`.

Fluxo:

1. Landing page envia `leadCaptureKey` e dados da lead.
2. O sistema encontra o `ClientSettings`.
3. Valida documento e estado.
4. Verifica duplicidade por telefone ou documento dentro do cliente.
5. Cria a lead com status `CREATED`.
6. Registra histórico inicial.

Se já existir lead duplicada, a API responde com `ok: true` e `duplicate: true`, sem criar novo registro.

### 4.4. Operação de leads no CRM

Usuário autenticado pode:

- criar lead manualmente;
- listar leads com busca e filtros;
- atualizar status;
- agendar próximo contato;
- editar observações;
- excluir lead;
- abrir conversa no WhatsApp;
- qualificar lead;
- registrar venda.

Há histórico formal de mudança de status em `LeadStatusHistory`.

### 4.5. Follow-up automático

Quando o usuário define `nextContactAt` na lead:

- o sistema abre ou atualiza um `InboxItem` do tipo `FOLLOW_UP_DUE`.

Quando o próximo contato é removido ou quando a lead vira venda:

- esse item é resolvido.

Ou seja: o inbox já funciona como camada de execução operacional.

### 4.6. Qualificação de lead

A qualificação não depende diretamente do status textual.

Ao qualificar:

- `Lead.isQualified = true`;
- grava `qualifiedAt`, `qualifiedById`;
- gera `qualifiedMetaEventId`;
- registra histórico;
- tenta enviar evento `QualifiedLead` para Meta;
- grava resultado do tracking na própria lead.

Isso indica que a qualificação é um marco de negócio relevante e auditável, não só uma etiqueta.

### 4.7. Registro de venda

A venda só pode ser criada se a lead estiver qualificada.

Ao registrar venda:

1. valida comprador, valor e itens;
2. identifica se o cliente já teve compra anterior pelo mesmo documento/telefone;
3. exige confirmação explícita para recompra;
4. cria `Sale` já em `CONFIRMED`;
5. atualiza a lead para `VENDA REALIZADA` se necessário;
6. resolve follow-up pendente;
7. tenta enviar `Purchase` para Meta;
8. grava o resultado do tracking na venda.

Esse é um fluxo central da aplicação.

### 4.8. Inteligência da base / lifecycle

O sistema reagrupa leads por pessoa usando:

- documento, quando disponível;
- telefone, como fallback.

Com base nas vendas confirmadas, classifica o cliente em:

- `CAMPEAO`
- `FIEL`
- `EM_RISCO`
- `INATIVO`
- `NOVO_COMPRADOR`

Essa segmentação é usada em dashboard, relatórios e geração de inbox items de risco/reativação.

### 4.9. Inbox operacional

O inbox concentra tarefas e alertas de naturezas diferentes:

- `PROFILE_CHANGE_PENDING`
- `TRACKING_ERROR`
- `FOLLOW_UP_DUE`
- `CUSTOMER_AT_RISK`
- `CUSTOMER_REACTIVATION_DUE`

Há duas audiências:

- `ADMIN`
- `CLIENT`

O inbox hoje cumpre papel de:

- fila de trabalho;
- alerta sistêmico;
- pendência administrativa;
- lembrete comercial.

É um bom indício de que a futura modelagem deve tratar notificações/tarefas como subdomínio próprio.

### 4.10. Alteração de perfil

Usuário cliente não altera nome/email/senha diretamente.

Fluxo:

1. envia solicitação;
2. sistema cria `ProfileChangeRequest`;
3. abre inbox item para admin;
4. admin aprova ou rejeita;
5. ao aprovar, atualiza Supabase e base local;
6. resolve a pendência no inbox.

Já o admin pode trocar a própria senha diretamente.

## 5. Regras implícitas de negócio que a nova modelagem precisa preservar

1. O sistema é multitenant por `Client`, com escopo forte por papel.
2. Lead duplicada é tratada por `telefone` ou `documento` dentro do mesmo cliente.
3. Qualificação é uma etapa formal separada do status textual da lead.
4. Venda só pode existir após qualificação.
5. Recompra precisa ser reconhecida e agregada ao histórico do mesmo cliente final.
6. Tracking de Meta faz parte do fluxo de negócio, não é detalhe técnico isolado.
7. Falhas operacionais relevantes viram itens de inbox.
8. Segmentação de clientes depende do histórico consolidado de compras, não de uma única lead.

## 6. Problemas estruturais observados

### 6.1. Status de lead como texto livre

O status está espalhado entre constantes, filtros e comparações textuais. Isso fragiliza:

- consistência;
- relatórios;
- migrações futuras;
- regras de transição.

### 6.2. Lead mistura pessoa, oportunidade e origem

Hoje `Lead` acumula responsabilidades de:

- cadastro de contato;
- oportunidade comercial;
- origem de marketing;
- referência para customer matching.

Isso dificulta separar:

- pessoa/contato;
- lead capturada;
- oportunidade comercial;
- jornada de compra.

### 6.3. Customer identity é derivada, não modelada

A “mesma pessoa” é reconstruída por documento/telefone em runtime. Não existe entidade explícita como:

- `Customer`
- `Person`
- `ContactIdentity`

Como consequência:

- recompra depende de heurística;
- lifecycle precisa varrer leads;
- histórico do cliente final fica fragmentado.

### 6.4. Inbox concentra responsabilidades demais

O mesmo objeto serve para:

- tarefa operacional;
- alerta de integração;
- workflow administrativo;
- monitoramento de lifecycle.

Isso sugere que o modelo atual atende, mas ainda não separa bem “notificação”, “pendência” e “work item”.

### 6.5. Tracking acoplado a server actions

Os eventos externos são disparados dentro dos fluxos síncronos de ação. Isso deixa:

- regras de negócio acopladas à infraestrutura externa;
- maior risco de lentidão;
- reprocessamento mais manual do que ideal.

### 6.6. Escopo por perfil repetido

Há checagens de `ADMIN` vs `CLIENT` repetidas em muitas consultas. Isso é um sinal de ausência de uma camada de autorização/tenant scope mais centralizada.

## 7. Leitura funcional por módulos

### Módulo 1. IAM e acesso

Responsabilidades:

- autenticação via Supabase;
- mapeamento para usuário interno;
- separação por papel;
- ativação/desativação de cliente.

### Módulo 2. Cadastro de tenants

Responsabilidades:

- criação de cliente;
- criação do usuário principal;
- geração de slug;
- geração e rotação de `leadCaptureKey`;
- configuração de tracking.

### Módulo 3. Captação de leads

Responsabilidades:

- entrada pública de leads;
- validação de documento;
- prevenção de duplicidade;
- persistência de origem de marketing.

### Módulo 4. Operação comercial

Responsabilidades:

- pipeline de lead;
- histórico de status;
- follow-up;
- qualificação;
- registro de venda;
- consulta detalhada da lead.

### Módulo 5. Receita e recompra

Responsabilidades:

- consolidar vendas por pessoa;
- reconhecer recompra;
- medir faturamento e conversão;
- alimentar segmentação.

### Módulo 6. Tracking e integrações

Responsabilidades:

- montar payloads para Meta;
- enviar `QualifiedLead`;
- enviar `Purchase`;
- guardar status, erro e resposta.

### Módulo 7. Inbox e pendências

Responsabilidades:

- follow-up;
- erro de tracking;
- aprovação de alteração cadastral;
- risco e reativação de clientes.

### Módulo 8. Inteligência operacional

Responsabilidades:

- classificar lifecycle;
- identificar clientes acionáveis;
- alimentar dashboard e relatórios.

## 8. Proposta de recorte para uma modelagem melhor

Para evoluir o sistema, a melhor direção parece ser separar o domínio em agregados mais claros.

### 8.1. Contextos sugeridos

#### A. Tenant & Access

- `Client`
- `ClientSettings`
- `User`
- `Role`
- `AuthIdentity`

#### B. CRM / Capture

- `LeadCapture`
- `LeadSource`
- `Lead`
- `LeadJourney`
- `LeadStatusTransition`
- `FollowUp`

#### C. Customer / Identity

- `Customer`
- `CustomerIdentifier`
- `CustomerContact`

Esse contexto resolveria o problema atual de consolidar pessoa por heurística.

#### D. Sales

- `Sale`
- `SaleItem`
- `SaleConfirmation`
- `RepeatPurchase`

#### E. Lifecycle Intelligence

- `CustomerSegmentSnapshot`
- `LifecycleRule`
- `LifecycleAlert`

#### F. Tasks & Notifications

- `Task`
- `Alert`
- `WorkQueue`
- `Resolution`

#### G. Change Requests / Governance

- `ProfileChangeRequest`
- `ApprovalDecision`

#### H. Tracking Integration

- `TrackingEvent`
- `TrackingAttempt`
- `TrackingProvider`
- `TrackingFailure`

## 9. Modelo alvo recomendado

Se a intenção for reconstruir com base mais sólida, a principal melhoria seria introduzir uma entidade explícita de cliente final comprador.

### Sugestão de espinha dorsal

- `Client` continua como tenant.
- `User` continua como ator interno.
- `Customer` vira a pessoa/empresa compradora.
- `Lead` passa a ser uma oportunidade vinculada a um `Customer`.
- `Sale` passa a ser uma transação vinculada a `Customer` e opcionalmente a `Lead`.
- `Task` substitui ou especializa o inbox atual.
- `TrackingEvent` registra os disparos externos.

### Benefícios desse desenho

- recompra deixa de depender de busca heurística entre leads;
- lifecycle passa a ser atributo natural do `Customer`;
- relatórios ficam mais coerentes;
- tracking pode ser reprocessado por evento;
- histórico comercial fica centrado no comprador, não na lead.

## 10. Sequência recomendada para remodelagem

### Etapa 1. Explicitar conceitos sem quebrar a operação

- Introduzir entidade `Customer`.
- Associar novas leads a um customer consolidado por documento/telefone.
- Associar vendas diretamente ao customer.

### Etapa 2. Estruturar workflow operacional

- Transformar `InboxItem` em `Task` ou separar `Task` de `Alert`.
- Modelar estados e resoluções de forma própria.

### Etapa 3. Fortalecer o pipeline comercial

- Transformar `Lead.status` em enum controlado.
- Definir transições válidas.
- Separar “qualificação” de “andamento do funil” de forma mais explícita.

### Etapa 4. Desacoplar integrações

- Criar tabela/event store para tracking.
- Processar envios e retries fora da ação síncrona principal.

### Etapa 5. Melhorar análise e relatórios

- Basear métricas em `Customer`, `Lead`, `Sale` e `TrackingEvent`.
- Criar snapshots de lifecycle quando fizer sentido.

## 11. Conclusão

O sistema atual já entrega uma operação comercial completa para captação, qualificação, venda e acompanhamento. O principal limite da modelagem não está nas telas, e sim no fato de que o comprador real ainda não é uma entidade de primeira classe.

Se a próxima versão quiser escalar bem, o melhor caminho é reorganizar o domínio ao redor de:

- tenant;
- usuário interno;
- customer;
- lead/oportunidade;
- venda;
- tarefa/alerta;
- evento de tracking.

Essa mudança preserva o que já funciona hoje e cria base mais robusta para relatórios, automações, recompra, governança e integrações futuras.
