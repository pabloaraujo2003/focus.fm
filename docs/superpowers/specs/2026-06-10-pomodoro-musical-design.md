# Spec — pomodoro-musical (MVP v1)

**Data:** 2026-06-10 · **Status:** aprovada pelo Pablo

## Resumo

Timer pomodoro que controla automaticamente playlists do Spotify conforme o estado da
sessão (foco / pausa curta / pausa longa), com registro de sessões para análise de
produtividade. Projeto pessoal de aprendizado: reforça TypeScript estrito, arquitetura
limpa, Repository/Provider, tsyringe, union types, generics e utility types.

## Stack (decisão do Pablo)

- **Frontend:** Next.js (App Router), comunicação com o backend via **axios**
- **Backend:** Node.js + Express + TypeScript estrito + tsyringe
- **Banco:** **Supabase** (Postgres gerenciado), acessado só pelo backend via `@supabase/supabase-js`
- **Testes:** Vitest
- **Monorepo:** pastas `backend/` e `frontend/` com package.json independentes

## Escopo do MVP

1. Timer configurável: foco 25 min, pausa curta 5 min, pausa longa 15 min a cada 4 ciclos (defaults; configuráveis)
2. Máquina de estados explícita: `idle → focando → pausa_curta → focando → … → pausa_longa → idle`; transições inválidas impossíveis em compilação e protegidas em runtime
3. Spotify: ao entrar em cada estado, tocar a playlist correspondente (2 playlists fixas configuráveis: foco e pausa)
4. Campo de contexto da sessão (texto livre) informado ao iniciar
5. Registro ao finalizar: data, contexto, ciclos completados, duração total, playlists usadas
6. Interface web mínima: uma página Next.js com countdown, contexto e controles

### Fora do escopo (arquitetura aberta, não implementar)

Perfis de contexto por tarefa · playlists via IA · dashboard de estatísticas ·
integração Notion · gamificação/streaks · detecção de pausa esticada.

## Arquitetura

```
Next.js (front) ──axios──▶ Express (API) ──axios──▶ Spotify Web API
                              │
                              └──supabase-js──▶ Supabase (Postgres)
```

**O backend é o dono do timer e do estado.** O `GerenciadorDeSessao` roda no Express
com `RelogioPort` real (`setTimeout`); ao fim de cada período o backend transiciona o
estado e troca a playlist, mesmo com a aba fechada. O front consulta `GET /sessao`
(snapshot + timestamp `terminaEm`), renderiza countdown local e re-sincroniza por
polling. Sem WebSocket/SSE no MVP.

### Camadas (regra de dependência: a seta só aponta para dentro)

`http (interface) → aplicacao → dominio`; `infraestrutura` implementa as portas da
aplicação e só é conhecida pelo container tsyringe.

- **dominio/** — zero dependências externas: máquina de estados (pura), entidade `Sessao`, erros customizados, configuração
- **aplicacao/** — portas (interfaces `MusicProvider`, `SessaoRepository`, `RelogioPort`), casos de uso (`IniciarSessao`, `FinalizarSessao`), `GerenciadorDeSessao`
- **infraestrutura/** — `SpotifyAuth` (PKCE), `SpotifyProvider` (axios), `SupabaseSessaoRepository`, `RelogioReal`, `container.ts`
- **http/** — rotas Express, controllers, middleware de erro

### Máquina de estados (reducer puro, não classe mutável)

```ts
type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa';

const TRANSICOES = {
  idle:        ['focando'],
  focando:     ['pausa_curta', 'pausa_longa', 'idle'],
  pausa_curta: ['focando', 'idle'],
  pausa_longa: ['focando', 'idle'],
} as const satisfies Record<EstadoSessao, readonly EstadoSessao[]>;

type TransicaoValida<E extends EstadoSessao> = (typeof TRANSICOES)[E][number];

type EventoSessao =
  | { tipo: 'INICIAR'; contexto: string }
  | { tipo: 'COMPLETAR_FOCO' }   // decide pausa_curta vs pausa_longa pelos ciclos
  | { tipo: 'COMPLETAR_PAUSA' }
  | { tipo: 'FINALIZAR' };

interface SnapshotSessao {
  readonly estado: EstadoSessao;
  readonly ciclosCompletados: number;
  readonly contexto: string | null;
}

function transicionar(snapshot: SnapshotSessao, evento: EventoSessao): SnapshotSessao;
// lança TransicaoInvalidaError em transição ilegal (proteção de runtime)
```

A regra "pausa longa a cada N ciclos" vive no reducer (regra de negócio no domínio).

### Configuração

```ts
interface ConfiguracaoPomodoro {
  duracaoFocoMin?: number;        // default 25
  duracaoPausaCurtaMin?: number;  // default 5
  duracaoPausaLongaMin?: number;  // default 15
  ciclosAtePausaLonga?: number;   // default 4
}
// internamente, após defaults: Required<ConfiguracaoPomodoro>
```

### Erros customizados

Hierarquia `AppError` (com `code` discriminante) → `ValidationError`,
`TransicaoInvalidaError`, `SpotifyError` → `NenhumDeviceAtivoError`,
`TokenExpiradoError`. O middleware de erro do Express mapeia `code` → HTTP status; o
front traduz `code` → mensagem ao usuário.

### Repository

`SessaoRepository` específico primeiro; o genérico `Repository<T, TId>` é extraído na
etapa do Supabase (abstração extraída de código concreto, com valor didático).

### API REST do MVP

- `POST /sessao` — inicia (body: `{ contexto }`)
- `GET /sessao` — snapshot atual + `terminaEm`
- `POST /sessao/finalizar` — encerra e grava no Supabase
- `GET /auth/spotify` e `GET /auth/spotify/callback` — fluxo PKCE

### Supabase

Tabela `sessoes` (id uuid, contexto text, ciclos_completados int, iniciada_em
timestamptz, finalizada_em timestamptz, duracao_total_seg int, playlist_foco text,
playlist_pausa text), criada por `schema.sql` versionado no repo (SQL Editor do
Supabase). Service role key apenas no `.env` do backend. Sem Supabase Auth (app
single-user; a única autenticação é a do Spotify).

## Regras da integração Spotify (obrigatórias, valem para features futuras)

Verificado em 2026-06: os endpoints `/me/player/*` necessários permanecem disponíveis
em Development Mode após as mudanças de fev/2026 (Premium obrigatório, 1 Client ID,
até 5 usuários — ok para uso pessoal).

1. **OpenAPI como fonte de verdade** — tipos de request/response derivados do schema
   oficial (`https://developer.spotify.com/reference/web-api/open-api-schema.yaml`);
   não inferir endpoints nem nomes de campos.
2. **Auth:** Authorization Code com **PKCE** (nunca Implicit Grant). Sem Client Secret.
3. **Redirect URI:** `http://127.0.0.1:3333/auth/spotify/callback` (loopback IP é a
   única exceção HTTP permitida; nunca `localhost` nem wildcard).
4. **Escopos mínimos:** só `user-modify-playback-state` e `user-read-playback-state`.
   Tocar playlist via `context_uri` não exige escopos de leitura de playlist.
5. **Tokens:** refresh token persistido localmente (arquivo fora do git); renovação
   automática via interceptor axios; nenhuma credencial Spotify chega ao front.
6. **Rate limit:** em HTTP 429, respeitar `Retry-After` com backoff exponencial e
   limite de tentativas; nunca retry imediato em loop.
7. **Endpoints deprecados:** proibidos. Futuro: usar `/playlists/{id}/items` e
   `/me/library` (variantes atuais).
8. **Erros HTTP:** 401 → renovar token; 403 → Premium/escopo; 404 → `NenhumDeviceAtivoError`
   (nenhum device ativo; oferecer transfer playback); 429 → retry; 5xx → repassar
   mensagem da API.
9. **ToS:** não cachear conteúdo Spotify além do uso imediato (o banco grava apenas
   URIs/nomes das playlists configuradas pelo usuário); atribuir conteúdo ao Spotify
   na UI; não usar dados da API para treinar modelos.

## Estratégia de testes

- Domínio e aplicação: TDD com Vitest; `GerenciadorDeSessao` testado com relógio falso
  e fakes das portas (sessão completa simulada em milissegundos).
- Infraestrutura: repository testado contra o Supabase real (ou mock do client);
  retry/backoff do provider testado com relógio falso.
- Spotify de verdade: scripts manuais nas etapas 7–8.

## Etapas de implementação (cada uma compila, testa e vira um commit)

1. Setup monorepo: `backend/` com tsconfig strict + Vitest
2. Domínio: estados, eventos, mapa de transições (TDD)
3. Domínio: reducer `transicionar` com regra dos ciclos (TDD)
4. Domínio: erros customizados + entidade `Sessao`
5. Aplicação: portas + `GerenciadorDeSessao` com relógio falso (TDD)
6. Infra: `SupabaseSessaoRepository` + `schema.sql` + `Repository<T, TId>` genérico
7. Infra: `SpotifyAuth` PKCE como rotas Express + cache do refresh token
8. Infra: `SpotifyProvider` axios (play/pause/devices) + backoff 429
9. HTTP: rotas REST da sessão + container tsyringe
10. Front: página Next.js com countdown, contexto e controles via axios

**Dependências externas do Pablo:** projeto Supabase (URL + service role key), app no
Spotify Developer Dashboard (Client ID; conta Premium), URIs das 2 playlists.
