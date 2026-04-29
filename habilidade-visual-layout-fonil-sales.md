# Habilidade Visual de Layout: Fonil Sales System

## Objetivo
Este documento descreve a linguagem visual, stack de frontend, padrões de composição e regras de interface do projeto `Fonil Sales System`, para que outra IA consiga reproduzir telas novas mantendo o mesmo estilo do sistema.

Use este arquivo como uma skill de direção visual e estrutural. A meta nao e copiar componentes literalmente, e sim preservar a mesma logica de layout, hierarquia, tom visual e consistencia de uso.

## Stack visual e frontend
- Framework principal: `Next.js 15` com App Router
- Biblioteca de UI: `React 19`
- Estilizacao: `Tailwind CSS v4` via `@import "tailwindcss"` em `src/app/globals.css`
- Theming: `next-themes`
- Iconografia: `lucide-react`
- Feedback visual: `sonner` para toasts
- Fonte principal: `Geist` via `next/font/google`

## Direcao visual do sistema
- Tipo de produto: CRM operacional / painel interno / sistema administrativo
- Personalidade visual: limpa, profissional, confiavel, tecnica e sem exagero decorativo
- Sensacao geral: interface leve, moderna, com profundidade suave e foco em produtividade
- Estilo base: superfices claras ou escuras com transparencia leve, bordas discretas, blur suave, destaque em azul
- Evitar: visual marketing-heavy, excesso de ilustracao, cards extravagantes, gradientes fortes demais, componentes com cara de landing page

## Tokens visuais principais
O sistema usa custom properties em `src/app/globals.css`. Sempre priorize esses tokens em vez de cores arbitrarias.

### Tema claro
- `--bg`: fundo geral frio e claro
- `--bg-elevated`: variacao levemente mais elevada do fundo
- `--surface`: branco transluzido para cards
- `--surface-strong`: branco mais solido
- `--surface-muted`: superficie secundaria para inputs, filtros e blocos internos
- `--border`: borda suave
- `--border-strong`: borda com mais contraste
- `--text`: texto principal escuro
- `--text-muted`: texto secundario dessaturado
- `--accent`: azul principal
- `--accent-strong`: azul mais intenso para gradiente e hover
- `--accent-soft`: azul transluzido para destaque suave
- `--success`, `--warning`, `--danger`: cores semaforicas funcionais

### Tema escuro
- Mantem a mesma logica semantica dos tokens
- Fundo azul-marinho muito escuro
- Superficies azuladas profundas
- Texto claro com contraste alto
- Azul continua como cor principal de destaque

## Regras de cor
- Azul e a cor dominante de acao e navegacao
- Verde e reservado para sucesso, venda concluida, confirmacoes
- Amarelo/ambar e reservado para pendencias e alertas operacionais
- Vermelho e reservado para falha, perda, exclusao ou risco
- Nao use cores novas sem necessidade
- Status sempre devem seguir a semantica por token, nao por escolha ad hoc

## Tipografia e hierarquia
- Fonte: `Geist`
- Titulos: semibold, limpos, sem excesso de peso
- Microcopy de contexto: textos pequenos com `text-[var(--text-muted)]`
- Eyebrows e rotulos de secao: uppercase, tracking amplo, tamanho pequeno
- Hierarquia comum:
  - eyebrow tecnica
  - titulo principal da pagina
  - descricao curta opcional
  - bloco de acoes
  - cards, tabelas ou formularios

## Linguagem de layout
- App shell com sidebar fixa em desktop
- Header mobile compacto com cliente atual, toggle de tema e botao de menu
- Conteudo principal centralizado com `.page-shell`
- Largura de conteudo controlada, normalmente ate `1200px`
- Paginas usam espacamento vertical consistente com `space-y-6`
- Cards, tabelas e formularios usam bordas arredondadas generosas
- Superficies importantes usam vidro suave: borda fina, blur e sombra macia

## Classes utilitarias globais importantes
Essas classes ja definem boa parte da linguagem do sistema:

- `.input`
  - campos com fundo suave, borda discreta, radius medio-alto e foco com halo azul
- `.btn-primary`
  - CTA com gradiente azul, texto branco, leve elevacao e hover com lift sutil
- `.btn-secondary`
  - botao neutro de superficie
- `.card`
  - container principal com superficie, borda, sombra e blur
- `.soft-panel`
  - container interno mais discreto para filtros, agrupamentos e sub-blocos
- `.page-shell`
  - container horizontal central da aplicacao
- `.table-shell`
  - estrutura visual da tabela
- `.table-scroll`
  - scroll horizontal de tabelas com largura minima
- `.link-accent`
  - links de acao em azul

## Componentes e padroes recorrentes

### Sidebar
- Desktop: coluna lateral fixa com card interno
- Mobile: drawer lateral sobre overlay escuro com blur
- Itens ativos:
  - fundo azul
  - texto branco
  - icone em caixa destacada
- Itens inativos:
  - texto muted
  - hover em superficie suave

### Cards de KPI
- Grid responsiva
- Numero principal grande
- Rotulo curto
- Fundo com gradiente muito leve entre `surface-strong` e tom semantico suave

### Tabelas
- Cabeçalho com fundo `surface-muted`
- Labels do thead em uppercase pequeno com tracking
- Linhas com hover leve
- Conteudo textual com truncamento quando necessario
- Ultima coluna normalmente contem link curto de navegacao
- Estado vazio sempre centralizado, respirando, com texto muted

### Badges de status
- Formato pill
- Peso semibold
- Cores semanticas com fundo soft e texto forte
- Exemplo de mapeamento:
  - `NEW` => accent
  - `SOLD` => success
  - `LOST` => danger

### Formularios
- Formularios aparecem em cards ou modais
- Labels pequenas, discretas e sempre acima do campo
- Inputs ocupam largura total
- Rodape com acoes lado a lado quando fizer sentido
- Feedback de carregamento textual no proprio botao

### Modais
- Overlay escuro com blur
- Card central com raio alto
- Header com titulo e botao de fechar quadrado/arredondado
- Em modais longos, header sticky com fundo transluzido
- Conteudo interno organizado por grids simples e espacamento vertical limpo

### Guia operacional
- O sistema usa cards explicativos para orientar o operador
- Esses cards nao sao alertas de erro; sao ajuda contextual
- Estrutura:
  - icone dentro de caixa colorida suave
  - titulo
  - descricao opcional
  - lista curta de instrucoes em frases completas

## Responsividade
- Mobile primeiro
- Sidebar colapsa para barra superior + menu
- Grids quebram para uma coluna
- Tabelas usam scroll horizontal em vez de colapsar informacao critica
- Formularios passam de 2 colunas para 1 coluna naturalmente
- Acoes importantes continuam visiveis e tocaveis em telas pequenas

## Motion e interacao
- Transicoes curtas, discretas e funcionais
- Hover principal:
  - mudanca de borda
  - mudanca de fundo
  - pequena elevacao em botoes primarios
- Nada exagerado
- Movimento deve comunicar interatividade, nao branding

## Tom de UI copy
- Idioma: portugues do Brasil
- Estilo textual: direto, operacional, claro
- Evitar buzzwords e textos publicitarios
- Mensagens devem soar como software interno de uso diario
- Titulos curtos, descricoes objetivas, textos de ajuda pragmaticos

## Assinatura visual resumida
Se outra IA precisar reproduzir esse sistema, a assinatura visual pode ser resumida assim:

"CRM administrativo com Next.js e Tailwind v4, usando tema claro/escuro baseado em tokens CSS. Visual limpo e profissional, com cards transluzidos, fundo frio com gradientes radiais muito suaves, bordas discretas, azul como cor principal, badges semanticos, tabelas com hover sutil, modais arredondados e tipografia Geist. Interface focada em produtividade, orientacao operacional e clareza de dados."

## Regras para gerar novas telas no mesmo estilo
- Sempre usar a estrutura shell do dashboard com sidebar + conteudo centralizado
- Sempre reutilizar os tokens de `globals.css`
- Preferir `.card`, `.soft-panel`, `.input`, `.btn-primary` e `.btn-secondary`
- Manter azul como destaque principal
- Preservar espacamentos amplos e bordas arredondadas
- Em paginas de dados, priorizar legibilidade sobre densidade excessiva
- Em formularios, manter labels pequenas e inputs limpos
- Em estados vazios, usar texto simples e amigavel, sem ilustrações desnecessarias
- Em estados de status, usar semaforo funcional via tokens semanticos
- Em telas novas, parecer extensao natural do CRM existente e nao um modulo de outro produto

## Anti-padroes
- Nao introduzir visual de dashboard genérico com cards escuros pesados sem relacao com o sistema
- Nao trocar a fonte para algo diferente de Geist sem motivo
- Nao usar paletas roxas, neon ou gradientes agressivos
- Nao transformar telas internas em landing pages
- Nao usar sombras pesadas ou glassmorphism exagerado
- Nao criar CTAs chamativos demais para um sistema operacional
- Nao reduzir contraste de textos importantes

## Prompt-base para outra IA
Use o texto abaixo quando quiser pedir para outra IA criar interfaces no mesmo estilo:

```txt
Crie a interface seguindo a linguagem visual do Fonil Sales System.

Contexto visual:
- Sistema administrativo / CRM operacional
- Next.js + React + Tailwind CSS v4
- Tema baseado em CSS variables
- Fonte Geist
- Tema claro/escuro
- Azul como cor principal
- Cards com superficie suave/translucida, bordas discretas, blur leve e sombra macia
- Tabelas com cabecalho muted, hover sutil e boa legibilidade
- Formularios limpos com labels pequenas acima dos campos
- Modais com overlay escuro + blur, cantos arredondados e header limpo
- Linguagem textual em portugues-BR, objetiva e operacional

Direcao:
- Priorize clareza, produtividade e leitura de dados
- Mantenha espacamento consistente e layout elegante sem exagero
- A nova tela deve parecer parte nativa do sistema existente
- Evite visual de marketing, cores fora da paleta e componentes genéricos demais
```

## Arquivos-fonte consultados
- `package.json`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/leads/page.tsx`
- `src/app/(dashboard)/leads/[id]/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/theme-toggle.tsx`
- `src/components/ui/guide-card.tsx`
- `src/components/leads/leads-table.tsx`
- `src/components/sales/sales-table.tsx`
- `src/components/leads/create-lead-modal.tsx`
- `src/components/leads/register-sale-modal.tsx`
- `src/components/settings/settings-form.tsx`
- `src/components/import/import-uploader.tsx`
- `src/components/auth/login-form.tsx`
- `src/components/leads/lead-status-badge.tsx`
