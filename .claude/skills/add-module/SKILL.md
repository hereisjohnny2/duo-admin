---
name: add-module
description: Adiciona um novo módulo ao Duo Painel Admin (página, API, camada de dados, migration, CSS e testes) no mesmo estilo dos módulos existentes (debitos, contas, inventario). Use quando o usuário pedir para criar/adicionar um módulo, área ou seção nova no painel.
argument-hint: "<nome do módulo> [descrição do que ele deve fazer]"
---

# Adicionar um módulo ao Duo Painel Admin

Um módulo é uma área do painel (`/<slug>`) com sua própria tabela no Supabase, rotas de API, tela e
entrada no registro de módulos. Todo o texto de UI, comentários e mensagens de erro são em
**português (pt-BR)**; nomes de campos e tabelas também (`produto`, `estoqueMinimo`, `vencimento`).

Pedido do usuário: $ARGUMENTS

## 1. Antes de escrever código

Defina (pergunte só o que não der para inferir do pedido):

- **slug**: minúsculo, sem acento, uma palavra (`inventario`). É ao mesmo tempo o `id`, a chave em
  `APP_MODULES`, a rota `/<slug>`, a pasta `src/app/<slug>` e a base `/api/<slug>`.
- **label** e **description**: aparecem no card da home, em Configurações e no cabeçalho.
- **entidade**: campos, tipos, quais são obrigatórios, quais têm lista fechada de valores, e por
  qual coluna a listagem é ordenada.
- **tela**: cards (como o Inventário) ou tabela (como Contas); quais KPIs e filtros fazem sentido.

Depois **leia o módulo `inventario` inteiro** — é a referência mais completa e recente. Copie a
estrutura dele, não a deste documento, se houver divergência:

| Camada | Referência |
| --- | --- |
| Registro | `src/lib/modules.ts`, `tests/lib/modules.test.ts` |
| Migration | `supabase/migrations/20260920120000_inventario.sql` |
| Tipos | `src/lib/types.ts` (bloco `InventarioItem`) |
| Funções puras | `src/lib/inventario.ts` + `tests/lib/inventario.test.ts` |
| Dados (servidor) | `src/lib/db.ts` (seção "Inventário") |
| Rotas | `src/app/api/inventario/route.ts`, `src/app/api/inventario/[id]/route.ts` |
| Cliente HTTP | `src/lib/api.ts` (seção "Inventário") |
| Página | `src/app/inventario/page.tsx`, `src/app/inventario/InventarioApp.tsx` |
| Componentes | `src/components/inventario/ItemList.tsx`, `ItemModal.tsx` |
| CSS | `src/app/globals.css` (bloco `/* Módulo Inventário */`) |

Para uma tela em tabela, veja também `src/components/contas/ContaList.tsx`.

## 2. Passo a passo

Siga nesta ordem — cada passo depende do anterior.

### 2.1 Registro do módulo — `src/lib/modules.ts`

- Acrescente o slug à união `ModuleId`.
- Acrescente a entrada em `APP_MODULES` com `id`, `slug` e a chave do objeto **iguais**, e
  `enabledByDefault: true`.
- Atualize `tests/lib/modules.test.ts`: os dois objetos de estado listam todos os módulos
  explicitamente e o teste quebra se o novo faltar.

Home (`src/app/page.tsx`) e Configurações leem `APP_MODULES` — não precisam de alteração.

### 2.2 Migration — `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`

- Timestamp maior que o da última migration da pasta.
- Cabeçalho em comentário no formato das existentes (`-- Migration: módulo X (...)`).
- `create table if not exists public.<tabela>` com `id uuid primary key default gen_random_uuid()`,
  colunas `snake_case`, `text not null default ''` para textos livres, `check (...)` para listas
  fechadas e números não negativos, `created_at`/`updated_at timestamptz not null default now()`.
- Índices `create index if not exists` nas colunas usadas em filtro/ordenação.
- `alter table ... enable row level security;` **sem policies**: o app acessa só pelo servidor com
  a service role (`getServerSupabase()`), que ignora o RLS.
- Trigger de `updated_at` como no inventário, se a tabela tiver essa coluna.
- Seed, se houver, idempotente (`if (select count(*) ...) = 0` ou `on conflict do nothing`).

Listas fechadas vivem em dois lugares (o `check` do SQL e a constante em `src/lib/<slug>.ts`) —
mantenha as duas idênticas.

### 2.3 Tipos — `src/lib/types.ts`

Ao final do arquivo: a união de status (se houver), a interface da entidade em camelCase com
`id: string`, e `export type <Entidade>Input = Omit<<Entidade>, "id">` (omita também campos gerados
no servidor) com o comentário JSDoc no padrão dos demais.

### 2.4 Funções puras — `src/lib/<slug>.ts`

Constantes (listas, `STATUS_STYLE` com `{ bg, fg }`), formatadores, derivação de status,
`summarize()` para os KPIs. Roda no browser e no servidor: **não importe nada de node nem de
`db.ts`/`supabase.ts`**. Reaproveite `parseBRL`/`fmt` de `src/lib/compute.ts` para valores em R$.

Cubra essas funções em `tests/lib/<slug>.test.ts` (vitest, `describe`/`it`, com um helper que monta
a entidade a partir de um `Partial`, como em `tests/lib/inventario.test.ts`).

### 2.5 Camada de dados — `src/lib/db.ts`

Acrescente uma seção ao final, aberta pelo banner de comentário, com o prefixo do módulo em
maiúsculas em cada constante:

- `<X>_FIELDS`, `<X>_COL` (camelCase -> snake_case), `<X>_SELECT`, `interface <X>Row`
- `rowTo<Entidade>()` — `numeric` do Postgres chega como string: converta com `Number()`
- `<x>PatchToRow()`, `sanitize<Entidade>()` (corpo -> Input completo), `pick<Entidade>Patch()`
  (só os campos presentes)
- `list<Plural>()`, `insert<Entidade>()`, `update<Entidade>()` (retorna `null` se não achou, via
  `maybeSingle()`), `delete<Entidade>()` (retorna `boolean`)

Todo erro do Supabase vira `throw new Error(error.message)`. Inclua os novos tipos no `import type`
do topo.

### 2.6 Rotas — `src/app/api/<slug>/route.ts` e `[id]/route.ts`

Copie as do inventário e adapte. O que não pode faltar em cada handler:

- `export const dynamic = "force-dynamic";` e o helper `errMsg`
- `getAuthenticatedUser()` primeiro; sem usuário -> `401 { error: "Não autenticado." }`
- corpo inválido -> `400 "Corpo inválido."`; campo obrigatório vazio ou valor fora da lista -> `400`
- `POST` responde `201` com o registro; `PUT` vazio -> `400 "Nenhum campo para atualizar."`
- não encontrado -> `404`; exceção -> `500 { error: errMsg(e) }`
- `params` é uma `Promise` (`const { id } = await params;`)
- um comentário `// VERBO /api/<slug> -> o que faz` acima de cada handler

### 2.7 Cliente HTTP — `src/lib/api.ts`

Nova seção `/* ---- <Label> ---- */` com `get<Plural>` (`cache: "no-store"`), `create…`,
`update…` (`PUT`) e `delete…`, todos passando por `handle<T>()`. Atualize o `import type` e o
comentário do topo do arquivo.

### 2.8 Página e tela — `src/app/<slug>/`

- `page.tsx`: client component que só embrulha `<XApp />` em `<AppShell moduleName="<slug>">`.
- `<X>App.tsx`: dono do estado (`items`, `loading`, `error`, busca, filtros, `modalOpen`,
  `editing`), carrega via `api.*` num `useEffect`, filtra com `useMemo`, e faz o CRUD atualizando a
  lista local com a resposta do servidor. Falhas de escrita usam `alert(...)`; remoção pede
  `confirm(...)`. Renderiza dentro de `<main>` com as mensagens `status-msg` de carregando/erro.

### 2.9 Componentes — `src/components/<slug>/`

Componentes de apresentação, sem acesso a `api`: recebem dados e callbacks `on…` por props.

- **Lista**: `.kpis` > `.kpi` (variações `green`/`amber`/`red`/`gray`/`indigo`/`teal`), depois
  `.toolbar` com `.search`, `.count-pill` e `.toolbar-actions`, depois os cards ou
  `.card > table`. Lista vazia mostra um `status-msg`.
- **Modal**: estado `Form` com números guardados como texto, constante `EMPTY`, fecha com Esc e
  com clique no fundo (use o truque do `downOnBackdrop`), valida os obrigatórios antes de
  `onSave`. Estrutura `.modal-overlay > .modal > .modal-head / .modal-body / .modal-foot`, campos
  em `.field` e pares em `.row2`.

### 2.10 CSS — `src/app/globals.css`

Reaproveite as classes compartilhadas (`btn primary|ghost|danger`, `icon-btn`, `badge`, `card`,
`muted`, `foot-note`, `filter-select`, `st-select`…) antes de criar novas. O que for específico vai
ao final do arquivo sob `/* Módulo <Label> */`, com um prefixo curto próprio (`inv-` no inventário).
Use as variáveis (`--panel`, `--line`, `--ink`, `--soft`, `--brand`, `--muted`, `--green`,
`--amber`, `--red`) em vez de cores fixas, para o tema escuro funcionar; quando precisar de ajuste,
use `[data-theme="dark"] .classe`.

## 3. Verificação

```bash
npm test
```

```bash
npx tsc --noEmit
```

Os dois precisam passar. Para a migration, aplique só a nova no Supabase local:

```bash
npx supabase migration up
```

**Não rode `npx supabase db reset`** sem o usuário pedir — ele apaga os dados locais.

Depois suba o preview (`duo-admin-dev` em `.claude/launch.json`) e confira em `/<slug>`: o card
aparece na home e em Configurações, a listagem carrega, criar/editar/remover funcionam, os filtros
respondem, o tema claro e o escuro estão legíveis e desativar o módulo em Configurações mostra
"Este módulo está desativado.". O painel exige login; se não houver sessão ou o Supabase local
estiver parado, diga isso ao usuário em vez de afirmar que a tela foi verificada.

## 4. Entrega

Resuma os arquivos criados/alterados e o que foi (ou não) verificado. Só faça commit se o usuário
pedir; nesse caso, use um branch `feat/modulo-<slug>` e uma mensagem
`feat: add <slug> module …`, como nos módulos anteriores.
