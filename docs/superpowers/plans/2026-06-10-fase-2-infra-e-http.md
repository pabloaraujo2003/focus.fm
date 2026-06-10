# Fase 2 — Infraestrutura e HTTP: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o domínio da Fase 1 ao mundo real: Supabase (persistência), Spotify (PKCE + playback via axios), container tsyringe e API REST Express.

**Architecture:** Implementações das portas (`SupabaseSessaoRepository`, `SpotifyProvider`, `RelogioReal`) na infraestrutura; `GerenciadorDeSessao` montado via `useFactory` no container (camadas internas continuam sem decorators de framework); rotas Express finas chamando o gerenciador; middleware de erro com switch exaustivo sobre `CodigoErro`. Spec: `docs/superpowers/specs/2026-06-10-pomodoro-musical-design.md`.

**Tech Stack:** express 5, axios, @supabase/supabase-js, tsyringe + reflect-metadata, dotenv, tsx (runtime dev), supertest (testes HTTP). **Atenção:** tsx/vitest usam esbuild, que NÃO emite decorator metadata — toda injeção usa `@inject(TOKEN)` explícito (necessário de toda forma, pois as portas são interfaces, que não existem em runtime).

**Credenciais já fornecidas:** Supabase URL `https://fehjaiqsxjwgoqjunndu.supabase.co`; Spotify Client ID `c2895ee404fc430b961983c59527cd14`. Pendentes do Pablo (no `.env`, nunca no git): `SUPABASE_SERVICE_ROLE_KEY`, playlists de foco e pausa.

**Status em 2026-06-10 14:11:** código das tasks 1–8 implementado até a API Express, com ajuste posterior para playlists interativas via `GET /spotify/playlists` e `POST /sessao { contexto, playlistFoco, playlistPausa }`; `npm test` passou com 57 testes em 15 arquivos e `npm run typecheck` passou. Checkboxes de commit permanecem abertos porque os commits por task não foram feitos nesta sessão. Próximo passo real: Task 9, verificação manual ponta a ponta com credenciais do Pablo e reautorização do Spotify para os novos escopos.

---

### Task 1: Dependências e configuração de ambiente

**Files:**
- Modify: `backend/package.json` (deps + script `dev`)
- Create: `backend/src/config/env.ts`, `.env.example`, `backend/.env` (fora do git)
- Test: `backend/tests/config/env.test.ts`

- [ ] **Step 1: Instalar dependências**

```bash
cd backend && npm i express axios @supabase/supabase-js tsyringe reflect-metadata dotenv \
  && npm i -D @types/express tsx supertest @types/supertest
```

Adicionar script em `package.json`: `"dev": "tsx watch src/main.ts"`.

- [ ] **Step 2: Teste que falha** (`tests/config/env.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { carregarEnv } from '../../src/config/env';
import { ValidationError } from '../../src/dominio/erros/validation-error';

const completo = {
  PORT: '3333',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'chave',
  SPOTIFY_CLIENT_ID: 'cid',
  SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3333/auth/spotify/callback',
  PLAYLIST_FOCO: 'https://open.spotify.com/playlist/AAA111?si=x',
  PLAYLIST_PAUSA: 'spotify:playlist:BBB222',
};

describe('carregarEnv', () => {
  it('carrega e normaliza playlists para URI spotify:', () => {
    const env = carregarEnv(completo);
    expect(env.porta).toBe(3333);
    expect(env.playlistFoco).toBe('spotify:playlist:AAA111');
    expect(env.playlistPausa).toBe('spotify:playlist:BBB222');
  });

  it('PORT é opcional com default 3333', () => {
    const { PORT: _ignorada, ...semPorta } = completo;
    expect(carregarEnv(semPorta).porta).toBe(3333);
  });

  it('falha com mensagem clara se faltar variável', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _ignorada, ...incompleto } = completo;
    expect(() => carregarEnv(incompleto)).toThrow(ValidationError);
    expect(() => carregarEnv(incompleto)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejeita playlist que não é URL nem URI do Spotify', () => {
    expect(() => carregarEnv({ ...completo, PLAYLIST_FOCO: 'banana' })).toThrow(ValidationError);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npm test`

- [ ] **Step 4: Implementar** (`src/config/env.ts`)

```ts
import { ValidationError } from '../dominio/erros/validation-error';

export interface VariaveisAmbiente {
  readonly porta: number;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly spotifyClientId: string;
  readonly spotifyRedirectUri: string;
  readonly playlistFoco: string;
  readonly playlistPausa: string;
}

// Recebe o dicionário em vez de ler process.env direto: testável sem
// poluir o ambiente do processo.
export function carregarEnv(fonte: Record<string, string | undefined>): VariaveisAmbiente {
  return {
    porta: Number(fonte.PORT ?? '3333'),
    supabaseUrl: obrigatoria(fonte, 'SUPABASE_URL'),
    supabaseServiceRoleKey: obrigatoria(fonte, 'SUPABASE_SERVICE_ROLE_KEY'),
    spotifyClientId: obrigatoria(fonte, 'SPOTIFY_CLIENT_ID'),
    spotifyRedirectUri: obrigatoria(fonte, 'SPOTIFY_REDIRECT_URI'),
    playlistFoco: normalizarPlaylist(obrigatoria(fonte, 'PLAYLIST_FOCO')),
    playlistPausa: normalizarPlaylist(obrigatoria(fonte, 'PLAYLIST_PAUSA')),
  };
}

function obrigatoria(fonte: Record<string, string | undefined>, nome: string): string {
  const valor = fonte[nome]?.trim();
  if (valor === undefined || valor.length === 0) {
    throw new ValidationError(`variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

// Aceita 'spotify:playlist:ID' ou 'https://open.spotify.com/playlist/ID?...'
function normalizarPlaylist(valor: string): string {
  const uri = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(valor);
  if (uri) return valor;
  const url = /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/.exec(valor);
  if (url) return `spotify:playlist:${url[1]}`;
  throw new ValidationError(`playlist inválida: '${valor}' (use a URL do Spotify ou spotify:playlist:ID)`);
}
```

`.env.example` (raiz do repo):
```
PORT=3333
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3333/auth/spotify/callback
PLAYLIST_FOCO=
PLAYLIST_PAUSA=
```

`backend/.env`: igual, com `SUPABASE_URL` e `SPOTIFY_CLIENT_ID` reais já preenchidos; Pablo completa o resto.

- [ ] **Step 5: Rodar, ver passar, commit**

```bash
git add -A && git commit -m "feat(config): carregamento e validação das variáveis de ambiente"
```

---

### Task 2: Schema do Supabase

**Files:**
- Create: `backend/src/infraestrutura/supabase/schema.sql`

- [ ] **Step 1: Criar o schema** (Pablo roda no SQL Editor do Supabase)

```sql
create table if not exists sessoes (
  id uuid primary key,
  contexto text not null,
  ciclos_completados integer not null,
  iniciada_em timestamptz not null,
  finalizada_em timestamptz not null,
  duracao_total_seg integer not null,
  playlist_foco text not null,
  playlist_pausa text not null,
  criada_em timestamptz not null default now()
);

-- Acesso é só pelo backend com service role key (que ignora RLS),
-- mas RLS ligado garante que a anon key pública não lê nada.
alter table sessoes enable row level security;
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(infra): schema da tabela sessoes no Supabase"
```

---

### Task 3: Repository genérico + SupabaseSessaoRepository

**Files:**
- Create: `backend/src/aplicacao/portas/repository.ts`, `backend/src/infraestrutura/supabase/supabase-sessao-repository.ts`
- Modify: `backend/src/aplicacao/portas/sessao-repository.ts`
- Test: `backend/tests/infraestrutura/supabase-sessao-repository.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { SupabaseSessaoRepository } from '../../src/infraestrutura/supabase/supabase-sessao-repository';
import { Sessao } from '../../src/dominio/entidades/sessao';

// Fake mínimo do client: registra tabela e linha inseridas.
function criarClienteFake(erro: { message: string } | null = null) {
  const registro: { tabela?: string; linha?: unknown } = {};
  const cliente = {
    from(tabela: string) {
      registro.tabela = tabela;
      return {
        insert: async (linha: unknown) => {
          registro.linha = linha;
          return { error: erro };
        },
      };
    },
  };
  return { cliente, registro };
}

describe('SupabaseSessaoRepository', () => {
  it('insere a sessão mapeada para snake_case', async () => {
    const { cliente, registro } = criarClienteFake();
    const repo = new SupabaseSessaoRepository(cliente as never);
    const sessao = Sessao.iniciar({
      contexto: 'estudar generics',
      iniciadaEm: new Date('2026-06-10T14:00:00Z'),
      playlistFoco: 'spotify:playlist:FOCO',
      playlistPausa: 'spotify:playlist:PAUSA',
    });
    sessao.finalizar(new Date('2026-06-10T15:00:00Z'), 2);
    await repo.salvar(sessao);
    expect(registro.tabela).toBe('sessoes');
    expect(registro.linha).toEqual({
      id: sessao.id,
      contexto: 'estudar generics',
      ciclos_completados: 2,
      iniciada_em: '2026-06-10T14:00:00.000Z',
      finalizada_em: '2026-06-10T15:00:00.000Z',
      duracao_total_seg: 3600,
      playlist_foco: 'spotify:playlist:FOCO',
      playlist_pausa: 'spotify:playlist:PAUSA',
    });
  });

  it('propaga erro do Supabase como Error com a mensagem', async () => {
    const { cliente } = criarClienteFake({ message: 'conexão recusada' });
    const repo = new SupabaseSessaoRepository(cliente as never);
    const sessao = Sessao.iniciar({
      contexto: 'x',
      iniciadaEm: new Date(),
      playlistFoco: 'f',
      playlistPausa: 'p',
    });
    sessao.finalizar(new Date(), 0);
    await expect(repo.salvar(sessao)).rejects.toThrow('conexão recusada');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test`

- [ ] **Step 3: Implementar**

`src/aplicacao/portas/repository.ts`:
```ts
// Generic com 2 parâmetros de tipo: T é a entidade, TId o tipo do id.
// Extraído agora que existe um segundo contrato concreto a caminho —
// abstração depois do caso real, nunca antes.
export interface Repository<T, TId = string> {
  salvar(entidade: T): Promise<void>;
}

// TId fica disponível para os métodos das fases futuras (buscarPorId(id: TId)).
```

`src/aplicacao/portas/sessao-repository.ts` (modificar):
```ts
import type { Sessao } from '../../dominio/entidades/sessao';
import type { Repository } from './repository';

// Especialização do genérico: SessaoRepository É um Repository<Sessao, string>.
export interface SessaoRepository extends Repository<Sessao, string> {}
```

`src/infraestrutura/supabase/supabase-sessao-repository.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sessao } from '../../dominio/entidades/sessao';
import type { SessaoRepository } from '../../aplicacao/portas/sessao-repository';

export class SupabaseSessaoRepository implements SessaoRepository {
  constructor(private readonly cliente: SupabaseClient) {}

  async salvar(sessao: Sessao): Promise<void> {
    const { error } = await this.cliente.from('sessoes').insert({
      id: sessao.id,
      contexto: sessao.contexto,
      ciclos_completados: sessao.ciclosCompletados,
      iniciada_em: sessao.iniciadaEm.toISOString(),
      finalizada_em: sessao.finalizadaEm?.toISOString() ?? null,
      duracao_total_seg: sessao.duracaoTotalSeg,
      playlist_foco: sessao.playlistFoco,
      playlist_pausa: sessao.playlistPausa,
    });
    if (error) {
      throw new Error(`falha ao gravar sessão no Supabase: ${error.message}`);
    }
  }
}
```

- [ ] **Step 4: Rodar, ver passar, commit**

```bash
git add -A && git commit -m "feat(infra): SupabaseSessaoRepository e extração do Repository genérico"
```

---

### Task 4: Erros do Spotify + utilitário PKCE

**Files:**
- Create: `backend/src/dominio/erros/spotify-error.ts`, `backend/src/dominio/erros/nenhum-device-ativo-error.ts`, `backend/src/dominio/erros/token-expirado-error.ts`, `backend/src/infraestrutura/spotify/pkce.ts`
- Test: `backend/tests/infraestrutura/pkce.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { gerarParPkce } from '../../src/infraestrutura/spotify/pkce';

describe('gerarParPkce', () => {
  it('verifier tem 43-128 chars no alfabeto permitido', () => {
    const { verifier } = gerarParPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
  });

  it('challenge é base64url(sha256(verifier)) sem padding', () => {
    const { verifier, challenge } = gerarParPkce();
    const esperado = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(esperado);
    expect(challenge).not.toContain('=');
  });

  it('cada chamada gera um par diferente', () => {
    expect(gerarParPkce().verifier).not.toBe(gerarParPkce().verifier);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test`

- [ ] **Step 3: Implementar**

`erros/spotify-error.ts`:
```ts
import { AppError } from './app-error';
import type { CodigoErro } from './app-error';

export class SpotifyError extends AppError {
  readonly code: CodigoErro = 'SPOTIFY';

  constructor(message: string, readonly statusHttp?: number) {
    super(message);
  }
}
```

`erros/nenhum-device-ativo-error.ts`:
```ts
import { AppError } from './app-error';

export class NenhumDeviceAtivoError extends AppError {
  readonly code = 'NENHUM_DEVICE_ATIVO';

  constructor() {
    super('nenhum device Spotify ativo — abra o Spotify no desktop ou celular e dê play em qualquer música uma vez');
  }
}
```

`erros/token-expirado-error.ts`:
```ts
import { AppError } from './app-error';

export class TokenExpiradoError extends AppError {
  readonly code = 'TOKEN_EXPIRADO';

  constructor() {
    super('autorização do Spotify ausente ou expirada — acesse /auth/spotify para autorizar');
  }
}
```

`spotify/pkce.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto';

export interface ParPkce {
  readonly verifier: string;
  readonly challenge: string;
}

// PKCE (RFC 7636): o verifier nunca sai do backend; só o challenge
// (hash) vai na URL de autorização. Dispensa client secret.
export function gerarParPkce(): ParPkce {
  const verifier = randomBytes(48).toString('base64url'); // 64 chars
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
```

- [ ] **Step 4: Rodar, ver passar, commit**

```bash
git add -A && git commit -m "feat(infra): erros do Spotify e geração de par PKCE"
```

---

### Task 5: ArmazemTokens + SpotifyAuth

**Files:**
- Create: `backend/src/infraestrutura/spotify/armazem-tokens.ts`, `backend/src/infraestrutura/spotify/spotify-auth.ts`
- Test: `backend/tests/infraestrutura/spotify-auth.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ArmazemTokens } from '../../src/infraestrutura/spotify/armazem-tokens';
import { SpotifyAuth } from '../../src/infraestrutura/spotify/spotify-auth';
import { TokenExpiradoError } from '../../src/dominio/erros/token-expirado-error';
import { RelogioFake } from '../fakes/relogio-fake';

function criarAuth(relogio = new RelogioFake()) {
  const arquivo = join(mkdtempSync(join(tmpdir(), 'pomodoro-')), 'tokens.json');
  const http = { post: vi.fn() };
  const auth = new SpotifyAuth(
    { clientId: 'cid', redirectUri: 'http://127.0.0.1:3333/cb' },
    new ArmazemTokens(arquivo),
    http as never,
    relogio,
  );
  return { auth, http, arquivo };
}

describe('SpotifyAuth', () => {
  it('monta URL de autorização com PKCE e escopos mínimos', () => {
    const { auth } = criarAuth();
    const url = new URL(auth.urlDeAutorizacao());
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('user-modify-playback-state user-read-playback-state');
  });

  it('troca o code por tokens e persiste; tokenDeAcesso retorna sem refresh enquanto válido', async () => {
    const { auth, http } = criarAuth();
    auth.urlDeAutorizacao();
    http.post.mockResolvedValueOnce({
      data: { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600 },
    });
    await auth.trocarCodigo('codigo-recebido');
    expect(http.post).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.any(URLSearchParams),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    expect(await auth.tokenDeAcesso()).toBe('acc1');
    expect(http.post).toHaveBeenCalledTimes(1); // não renovou
  });

  it('renova automaticamente quando o token expira', async () => {
    const relogio = new RelogioFake();
    const { auth, http } = criarAuth(relogio);
    auth.urlDeAutorizacao();
    http.post.mockResolvedValueOnce({
      data: { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600 },
    });
    await auth.trocarCodigo('codigo');
    await relogio.avancar(3601 * 1000);
    http.post.mockResolvedValueOnce({
      data: { access_token: 'acc2', expires_in: 3600 },
    });
    expect(await auth.tokenDeAcesso()).toBe('acc2');
    const corpo = http.post.mock.calls[1]?.[1] as URLSearchParams;
    expect(corpo.get('grant_type')).toBe('refresh_token');
    expect(corpo.get('refresh_token')).toBe('ref1');
  });

  it('sem tokens persistidos lança TokenExpiradoError', async () => {
    const { auth } = criarAuth();
    await expect(auth.tokenDeAcesso()).rejects.toThrow(TokenExpiradoError);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test`

- [ ] **Step 3: Implementar**

`spotify/armazem-tokens.ts`:
```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokensPersistidos {
  accessToken: string;
  refreshToken: string;
  expiraEmMs: number; // epoch ms
}

// Persistência síncrona e mínima: é 1 arquivo local de uso pessoal.
export class ArmazemTokens {
  constructor(private readonly caminho: string) {}

  ler(): TokensPersistidos | null {
    if (!existsSync(this.caminho)) return null;
    return JSON.parse(readFileSync(this.caminho, 'utf8')) as TokensPersistidos;
  }

  gravar(tokens: TokensPersistidos): void {
    mkdirSync(dirname(this.caminho), { recursive: true });
    writeFileSync(this.caminho, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  }
}
```

`spotify/spotify-auth.ts`:
```ts
import type { AxiosInstance } from 'axios';
import { TokenExpiradoError } from '../../dominio/erros/token-expirado-error';
import { SpotifyError } from '../../dominio/erros/spotify-error';
import type { RelogioPort } from '../../aplicacao/portas/relogio-port';
import { ArmazemTokens } from './armazem-tokens';
import { gerarParPkce } from './pkce';

const URL_AUTORIZACAO = 'https://accounts.spotify.com/authorize';
const URL_TOKEN = 'https://accounts.spotify.com/api/token';
const ESCOPOS = 'user-modify-playback-state user-read-playback-state';
const MARGEM_MS = 30_000; // renova 30s antes de expirar

export interface ConfigSpotifyAuth {
  readonly clientId: string;
  readonly redirectUri: string;
}

interface RespostaToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class SpotifyAuth {
  private verifierPendente: string | null = null;

  constructor(
    private readonly config: ConfigSpotifyAuth,
    private readonly armazem: ArmazemTokens,
    private readonly http: AxiosInstance,
    private readonly relogio: RelogioPort,
  ) {}

  urlDeAutorizacao(): string {
    const { verifier, challenge } = gerarParPkce();
    this.verifierPendente = verifier;
    const url = new URL(URL_AUTORIZACAO);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', ESCOPOS);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    return url.toString();
  }

  async trocarCodigo(code: string): Promise<void> {
    if (this.verifierPendente === null) {
      throw new SpotifyError('fluxo de autorização não iniciado — acesse /auth/spotify primeiro');
    }
    const resposta = await this.pedirToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: this.verifierPendente,
    });
    this.verifierPendente = null;
    this.persistir(resposta, null);
  }

  // Renovação automática: quem consome (SpotifyProvider) nunca pensa em refresh.
  async tokenDeAcesso(): Promise<string> {
    const tokens = this.armazem.ler();
    if (tokens === null) throw new TokenExpiradoError();
    if (this.relogio.agora().getTime() < tokens.expiraEmMs - MARGEM_MS) {
      return tokens.accessToken;
    }
    const resposta = await this.pedirToken({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: this.config.clientId,
    });
    this.persistir(resposta, tokens.refreshToken);
    return resposta.access_token;
  }

  private async pedirToken(parametros: Record<string, string>): Promise<RespostaToken> {
    const { data } = await this.http.post(URL_TOKEN, new URLSearchParams(parametros), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data as RespostaToken;
  }

  private persistir(resposta: RespostaToken, refreshAnterior: string | null): void {
    const refreshToken = resposta.refresh_token ?? refreshAnterior;
    if (refreshToken === undefined || refreshToken === null) {
      throw new SpotifyError('resposta de token sem refresh_token');
    }
    this.armazem.gravar({
      accessToken: resposta.access_token,
      refreshToken,
      expiraEmMs: this.relogio.agora().getTime() + resposta.expires_in * 1000,
    });
  }
}
```

- [ ] **Step 4: Rodar, ver passar, commit**

```bash
git add -A && git commit -m "feat(infra): SpotifyAuth com PKCE, persistência e renovação de tokens"
```

---

### Task 6: SpotifyProvider com axios e backoff

**Files:**
- Create: `backend/src/infraestrutura/spotify/spotify-provider.ts`
- Test: `backend/tests/infraestrutura/spotify-provider.test.ts`

Comportamento (regras da spec, seção Spotify):
- `tocarPlaylist(uri)` → `PUT https://api.spotify.com/v1/me/player/play` body `{ context_uri: uri }`
- `pausar()` → `PUT .../me/player/pause`
- Bearer token vem de `SpotifyAuth.tokenDeAcesso()` a cada chamada
- 404 → `NenhumDeviceAtivoError`; 403 → `SpotifyError` (Premium/escopo); 401 → força refresh e repete 1x; 429 → espera `Retry-After` (fallback exponencial 1s/2s/4s) e repete até 3 tentativas; 5xx → `SpotifyError` com mensagem da API

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosInstance } from 'axios';
import { SpotifyProvider } from '../../src/infraestrutura/spotify/spotify-provider';
import { NenhumDeviceAtivoError } from '../../src/dominio/erros/nenhum-device-ativo-error';
import { SpotifyError } from '../../src/dominio/erros/spotify-error';
import { RelogioFake } from '../fakes/relogio-fake';

function erroHttp(status: number, headers: Record<string, string> = {}, mensagem = 'x') {
  const erro = new AxiosError(mensagem);
  erro.response = { status, headers, data: { error: { message: mensagem } } } as never;
  return erro;
}

function criarProvider() {
  const relogio = new RelogioFake();
  const http = { put: vi.fn().mockResolvedValue({ status: 204 }) };
  const auth = { tokenDeAcesso: vi.fn().mockResolvedValue('tok') };
  const provider = new SpotifyProvider(http as unknown as AxiosInstance, auth as never, relogio);
  return { provider, http, auth, relogio };
}

describe('SpotifyProvider', () => {
  it('tocarPlaylist faz PUT /me/player/play com context_uri e bearer', async () => {
    const { provider, http } = criarProvider();
    await provider.tocarPlaylist('spotify:playlist:AAA');
    expect(http.put).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player/play',
      { context_uri: 'spotify:playlist:AAA' },
      { headers: { Authorization: 'Bearer tok' } },
    );
  });

  it('404 vira NenhumDeviceAtivoError', async () => {
    const { provider, http } = criarProvider();
    http.put.mockRejectedValueOnce(erroHttp(404));
    await expect(provider.tocarPlaylist('spotify:playlist:A')).rejects.toThrow(NenhumDeviceAtivoError);
  });

  it('429 respeita Retry-After e tenta de novo', async () => {
    const { provider, http, relogio } = criarProvider();
    http.put.mockRejectedValueOnce(erroHttp(429, { 'retry-after': '2' }));
    const promessa = provider.pausar();
    await relogio.avancar(2000);
    await promessa;
    expect(http.put).toHaveBeenCalledTimes(2);
  });

  it('429 persistente esgota as 3 tentativas e lança SpotifyError', async () => {
    const { provider, http, relogio } = criarProvider();
    http.put.mockRejectedValue(erroHttp(429, { 'retry-after': '1' }));
    const promessa = provider.pausar().catch((e: unknown) => e);
    await relogio.avancar(10_000);
    expect(await promessa).toBeInstanceOf(SpotifyError);
    expect(http.put).toHaveBeenCalledTimes(3);
  });

  it('403 vira SpotifyError com dica de Premium', async () => {
    const { provider, http } = criarProvider();
    http.put.mockRejectedValueOnce(erroHttp(403, {}, 'Player command failed: Premium required'));
    await expect(provider.pausar()).rejects.toThrow(/Premium/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test`

- [ ] **Step 3: Ajustar o `RelogioFake`** (`tests/fakes/relogio-fake.ts`)

O `esperar()` do provider agenda no relógio dentro de um microtask (após a rejeição
do axios). O `avancar` precisa ceder o event loop ANTES de procurar agendamentos,
senão a espera do retry ainda não existe quando o teste avança o tempo:

```ts
  async avancar(ms: number): Promise<void> {
    const destino = this.agoraMs + ms;
    // Cede o event loop: promises já em andamento agendam antes da varredura.
    await new Promise((resolve) => setImmediate(resolve));
    let proximo = this.proximoAte(destino);
    // ... (resto inalterado)
```

Rodar `npm test` — a suíte da fase 1 continua verde (o yield extra é inócuo).

- [ ] **Step 4: Implementar** (`spotify/spotify-provider.ts`)

```ts
import { isAxiosError, type AxiosInstance } from 'axios';
import type { MusicProvider } from '../../aplicacao/portas/music-provider';
import type { RelogioPort } from '../../aplicacao/portas/relogio-port';
import { NenhumDeviceAtivoError } from '../../dominio/erros/nenhum-device-ativo-error';
import { SpotifyError } from '../../dominio/erros/spotify-error';
import type { SpotifyAuth } from './spotify-auth';

const BASE = 'https://api.spotify.com/v1';
const MAX_TENTATIVAS = 3;

export class SpotifyProvider implements MusicProvider {
  constructor(
    private readonly http: AxiosInstance,
    private readonly auth: SpotifyAuth,
    private readonly relogio: RelogioPort,
  ) {}

  async tocarPlaylist(uri: string): Promise<void> {
    await this.put('/me/player/play', { context_uri: uri });
  }

  async pausar(): Promise<void> {
    await this.put('/me/player/pause', undefined);
  }

  private async put(rota: string, corpo: unknown): Promise<void> {
    for (let tentativa = 1; ; tentativa += 1) {
      const token = await this.auth.tokenDeAcesso();
      try {
        await this.http.put(`${BASE}${rota}`, corpo, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return;
      } catch (erro) {
        await this.tratarErro(erro, tentativa); // lança ou espera p/ retry
      }
    }
  }

  // Devolve apenas quando o retry é permitido; caso contrário lança.
  private async tratarErro(erro: unknown, tentativa: number): Promise<void> {
    if (!isAxiosError(erro) || erro.response === undefined) {
      throw new SpotifyError(`falha de rede ao chamar o Spotify: ${String(erro)}`);
    }
    const { status, headers, data } = erro.response;
    const mensagem = (data as { error?: { message?: string } })?.error?.message ?? erro.message;

    if (status === 404) throw new NenhumDeviceAtivoError();
    if (status === 403) {
      throw new SpotifyError(`Spotify recusou o comando (Premium é obrigatório p/ playback): ${mensagem}`, 403);
    }
    if (status === 429 && tentativa < MAX_TENTATIVAS) {
      const retryAfterSeg = Number((headers as Record<string, string>)['retry-after']);
      const esperaMs = Number.isFinite(retryAfterSeg)
        ? retryAfterSeg * 1000
        : 2 ** (tentativa - 1) * 1000; // fallback exponencial: 1s, 2s
      await this.esperar(esperaMs);
      return;
    }
    if (status === 429) {
      throw new SpotifyError('Spotify com rate limit persistente; tente de novo em instantes', 429);
    }
    throw new SpotifyError(`erro ${status} do Spotify: ${mensagem}`, status);
  }

  // Espera via RelogioPort: nos testes, o RelogioFake avança o tempo na hora.
  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => this.relogio.agendar(ms, resolve));
  }
}
```

Nota: 401 não força retry aqui porque `tokenDeAcesso()` já renova proativamente
com margem de 30s; se ainda assim vier 401 (token revogado), o erro genérico
com status 401 orienta reautorizar.

- [ ] **Step 4: Rodar, ver passar, commit**

```bash
git add -A && git commit -m "feat(infra): SpotifyProvider com axios, mapeamento de erros e backoff 429"
```

---

### Task 7: RelogioReal + container tsyringe

**Files:**
- Create: `backend/src/infraestrutura/relogio/relogio-real.ts`, `backend/src/infraestrutura/tokens.ts`, `backend/src/infraestrutura/container.ts`
- Test: `backend/tests/infraestrutura/container.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { criarContainer } from '../../src/infraestrutura/container';
import { TOKENS } from '../../src/infraestrutura/tokens';
import { GerenciadorDeSessao } from '../../src/aplicacao/gerenciador-de-sessao';
import { MusicProviderFake } from '../fakes/music-provider-fake';
import { RelogioFake } from '../fakes/relogio-fake';
import { SessaoRepositoryFake } from '../fakes/sessao-repository-fake';

const env = {
  porta: 3333,
  supabaseUrl: 'https://x.supabase.co',
  supabaseServiceRoleKey: 'k',
  spotifyClientId: 'cid',
  spotifyRedirectUri: 'http://127.0.0.1:3333/cb',
  playlistFoco: 'spotify:playlist:F',
  playlistPausa: 'spotify:playlist:P',
};

describe('container', () => {
  it('GerenciadorDeSessao é singleton e usa as portas registradas', async () => {
    const container = criarContainer(env);
    // Sobrescrever portas com fakes ANTES da primeira resolução:
    container.registerInstance(TOKENS.MusicProvider, new MusicProviderFake());
    container.registerInstance(TOKENS.SessaoRepository, new SessaoRepositoryFake());
    container.registerInstance(TOKENS.Relogio, new RelogioFake());
    const a = container.resolve<GerenciadorDeSessao>(TOKENS.GerenciadorDeSessao);
    const b = container.resolve<GerenciadorDeSessao>(TOKENS.GerenciadorDeSessao);
    expect(a).toBe(b);
    await a.iniciar('teste');
    expect(a.obterStatus().snapshot.estado).toBe('focando');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test`

- [ ] **Step 3: Implementar**

`relogio/relogio-real.ts`:
```ts
import type { RelogioPort } from '../../aplicacao/portas/relogio-port';

export class RelogioReal implements RelogioPort {
  agora(): Date {
    return new Date();
  }

  agendar(ms: number, callback: () => void): () => void {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  }
}
```

`tokens.ts`:
```ts
// Interfaces não existem em runtime; tokens são o "nome" injetável delas.
export const TOKENS = {
  Env: Symbol('Env'),
  Relogio: Symbol('RelogioPort'),
  MusicProvider: Symbol('MusicProvider'),
  SessaoRepository: Symbol('SessaoRepository'),
  SpotifyAuth: Symbol('SpotifyAuth'),
  GerenciadorDeSessao: Symbol('GerenciadorDeSessao'),
} as const;
```

`container.ts`:
```ts
import 'reflect-metadata';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { container as raiz, type DependencyContainer } from 'tsyringe';
import type { VariaveisAmbiente } from '../config/env';
import { resolverConfiguracao } from '../dominio/config/configuracao';
import { GerenciadorDeSessao } from '../aplicacao/gerenciador-de-sessao';
import type { MusicProvider } from '../aplicacao/portas/music-provider';
import type { RelogioPort } from '../aplicacao/portas/relogio-port';
import type { SessaoRepository } from '../aplicacao/portas/sessao-repository';
import { RelogioReal } from './relogio/relogio-real';
import { ArmazemTokens } from './spotify/armazem-tokens';
import { SpotifyAuth } from './spotify/spotify-auth';
import { SpotifyProvider } from './spotify/spotify-provider';
import { SupabaseSessaoRepository } from './supabase/supabase-sessao-repository';
import { TOKENS } from './tokens';

// useFactory em vez de decorators nas classes: o domínio e a aplicação
// continuam sem saber que tsyringe existe. O container é o ÚNICO lugar
// que conhece todas as implementações concretas.
export function criarContainer(env: VariaveisAmbiente): DependencyContainer {
  const c = raiz.createChildContainer();

  c.registerInstance(TOKENS.Env, env);
  c.register<RelogioPort>(TOKENS.Relogio, { useFactory: () => new RelogioReal() });

  c.register(TOKENS.SpotifyAuth, {
    useFactory: (deps) =>
      new SpotifyAuth(
        { clientId: env.spotifyClientId, redirectUri: env.spotifyRedirectUri },
        new ArmazemTokens('.spotify.tokens.json'),
        axios.create(),
        deps.resolve<RelogioPort>(TOKENS.Relogio),
      ),
  });

  c.register<MusicProvider>(TOKENS.MusicProvider, {
    useFactory: (deps) =>
      new SpotifyProvider(
        axios.create(),
        deps.resolve<SpotifyAuth>(TOKENS.SpotifyAuth),
        deps.resolve<RelogioPort>(TOKENS.Relogio),
      ),
  });

  c.register<SessaoRepository>(TOKENS.SessaoRepository, {
    useFactory: () =>
      new SupabaseSessaoRepository(createClient(env.supabaseUrl, env.supabaseServiceRoleKey)),
  });

  let gerenciador: GerenciadorDeSessao | null = null; // singleton manual p/ useFactory
  c.register(TOKENS.GerenciadorDeSessao, {
    useFactory: (deps) => {
      gerenciador ??= new GerenciadorDeSessao(
        resolverConfiguracao(),
        { foco: env.playlistFoco, pausa: env.playlistPausa },
        deps.resolve<RelogioPort>(TOKENS.Relogio),
        deps.resolve<MusicProvider>(TOKENS.MusicProvider),
        deps.resolve<SessaoRepository>(TOKENS.SessaoRepository),
      );
      return gerenciador;
    },
  });

  return c;
}
```

- [ ] **Step 4: Rodar, ver passar, commit**

```bash
git add -A && git commit -m "feat(infra): container tsyringe com tokens explícitos e RelogioReal"
```

---

### Task 8: API Express

**Files:**
- Create: `backend/src/http/middleware-erro.ts`, `backend/src/http/app.ts`, `backend/src/main.ts`
- Test: `backend/tests/http/app.test.ts`

Rotas: `POST /sessao {contexto}` → 201; `GET /sessao` → status; `POST /sessao/finalizar` → sessão gravada; `GET /auth/spotify` → redirect para o Spotify; `GET /auth/spotify/callback?code=` → troca e confirma.

- [ ] **Step 1: Teste que falha**

```ts
import 'reflect-metadata';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/http/app';
import { criarContainer } from '../../src/infraestrutura/container';
import { TOKENS } from '../../src/infraestrutura/tokens';
import { MusicProviderFake } from '../fakes/music-provider-fake';
import { RelogioFake } from '../fakes/relogio-fake';
import { SessaoRepositoryFake } from '../fakes/sessao-repository-fake';

const env = {
  porta: 3333,
  supabaseUrl: 'https://x.supabase.co',
  supabaseServiceRoleKey: 'k',
  spotifyClientId: 'cid',
  spotifyRedirectUri: 'http://127.0.0.1:3333/auth/spotify/callback',
  playlistFoco: 'spotify:playlist:F',
  playlistPausa: 'spotify:playlist:P',
};

describe('API /sessao', () => {
  let app: ReturnType<typeof criarApp>;
  let repositorio: SessaoRepositoryFake;

  beforeEach(() => {
    const container = criarContainer(env);
    repositorio = new SessaoRepositoryFake();
    container.registerInstance(TOKENS.MusicProvider, new MusicProviderFake());
    container.registerInstance(TOKENS.SessaoRepository, repositorio);
    container.registerInstance(TOKENS.Relogio, new RelogioFake());
    app = criarApp(container);
  });

  it('POST /sessao inicia e GET /sessao mostra o estado', async () => {
    const criada = await request(app).post('/sessao').send({ contexto: 'estudar' });
    expect(criada.status).toBe(201);
    const status = await request(app).get('/sessao');
    expect(status.body.snapshot.estado).toBe('focando');
    expect(status.body.terminaEm).toBeTruthy();
  });

  it('POST /sessao sem contexto -> 400 com code VALIDATION', async () => {
    const resposta = await request(app).post('/sessao').send({ contexto: '' });
    expect(resposta.status).toBe(400);
    expect(resposta.body.code).toBe('VALIDATION');
  });

  it('POST /sessao duas vezes -> 409 TRANSICAO_INVALIDA', async () => {
    await request(app).post('/sessao').send({ contexto: 'x' });
    const segunda = await request(app).post('/sessao').send({ contexto: 'y' });
    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('TRANSICAO_INVALIDA');
  });

  it('POST /sessao/finalizar grava e responde a sessão', async () => {
    await request(app).post('/sessao').send({ contexto: 'x' });
    const fim = await request(app).post('/sessao/finalizar');
    expect(fim.status).toBe(200);
    expect(repositorio.salvas).toHaveLength(1);
    expect(fim.body.contexto).toBe('x');
  });

  it('GET /auth/spotify redireciona para accounts.spotify.com', async () => {
    const resposta = await request(app).get('/auth/spotify');
    expect(resposta.status).toBe(302);
    expect(resposta.headers.location).toContain('https://accounts.spotify.com/authorize');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test`

- [ ] **Step 3: Implementar**

`http/middleware-erro.ts`:
```ts
import type { NextFunction, Request, Response } from 'express';
import { AppError, type CodigoErro } from '../dominio/erros/app-error';

// Switch exaustivo: se CodigoErro ganhar um membro novo e este switch
// não for atualizado, `nunca` acusa erro de compilação.
function statusDoCodigo(code: CodigoErro): number {
  switch (code) {
    case 'VALIDATION':
      return 400;
    case 'TRANSICAO_INVALIDA':
      return 409;
    case 'NENHUM_DEVICE_ATIVO':
      return 409;
    case 'TOKEN_EXPIRADO':
      return 401;
    case 'SPOTIFY':
      return 502;
    default:
      return nunca(code);
  }
}

function nunca(x: never): never {
  throw new Error(`código de erro não mapeado: ${String(x)}`);
}

export function middlewareErro(erro: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (erro instanceof AppError) {
    res.status(statusDoCodigo(erro.code)).json({ code: erro.code, message: erro.message });
    return;
  }
  console.error('[pomodoro] erro inesperado:', erro);
  res.status(500).json({ code: 'INTERNO', message: 'erro interno' });
}
```

`http/app.ts`:
```ts
import express, { type Express } from 'express';
import type { DependencyContainer } from 'tsyringe';
import type { GerenciadorDeSessao } from '../aplicacao/gerenciador-de-sessao';
import type { SpotifyAuth } from '../infraestrutura/spotify/spotify-auth';
import { TOKENS } from '../infraestrutura/tokens';
import { middlewareErro } from './middleware-erro';

export function criarApp(container: DependencyContainer): Express {
  const app = express();
  app.use(express.json());

  // Resolução tardia (dentro do handler): os testes podem sobrescrever
  // os registros do container antes da primeira requisição.
  const gerenciador = (): GerenciadorDeSessao => container.resolve(TOKENS.GerenciadorDeSessao);
  const auth = (): SpotifyAuth => container.resolve(TOKENS.SpotifyAuth);

  app.post('/sessao', async (req, res) => {
    const contexto = String((req.body as { contexto?: unknown })?.contexto ?? '');
    await gerenciador().iniciar(contexto);
    res.status(201).json(gerenciador().obterStatus());
  });

  app.get('/sessao', (_req, res) => {
    res.json(gerenciador().obterStatus());
  });

  app.post('/sessao/finalizar', async (_req, res) => {
    const sessao = await gerenciador().finalizar();
    res.json({
      id: sessao.id,
      contexto: sessao.contexto,
      ciclosCompletados: sessao.ciclosCompletados,
      duracaoTotalSeg: sessao.duracaoTotalSeg,
      iniciadaEm: sessao.iniciadaEm,
      finalizadaEm: sessao.finalizadaEm,
    });
  });

  app.get('/auth/spotify', (_req, res) => {
    res.redirect(auth().urlDeAutorizacao());
  });

  app.get('/auth/spotify/callback', async (req, res) => {
    const code = String(req.query.code ?? '');
    await auth().trocarCodigo(code);
    res.send('Spotify autorizado! Pode fechar esta aba e voltar ao pomodoro.');
  });

  app.use(middlewareErro);
  return app;
}
```

`src/main.ts`:
```ts
import 'reflect-metadata';
import 'dotenv/config';
import { carregarEnv } from './config/env';
import { criarContainer } from './infraestrutura/container';
import { criarApp } from './http/app';

const env = carregarEnv(process.env);
const app = criarApp(criarContainer(env));

app.listen(env.porta, '127.0.0.1', () => {
  console.log(`pomodoro-musical na porta ${env.porta}`);
  console.log(`autorize o Spotify em: http://127.0.0.1:${env.porta}/auth/spotify`);
});
```

- [ ] **Step 4: Rodar tudo, ver passar, commit**

```bash
git add -A && git commit -m "feat(http): API Express com rotas de sessão e auth Spotify"
```

---

### Task 9: Verificação manual ponta a ponta (requer o Pablo)

- [ ] Pablo: preencher `SUPABASE_SERVICE_ROLE_KEY` em `backend/.env`
- [ ] Pablo: rodar `backend/src/infraestrutura/supabase/schema.sql` no SQL Editor do Supabase
- [ ] Pablo: no app do Spotify Dashboard, conferir redirect URI `http://127.0.0.1:3333/auth/spotify/callback`
- [ ] `npm run dev` → abrir `http://127.0.0.1:3333/auth/spotify` → autorizar com os escopos de playlists
- [ ] `curl 127.0.0.1:3333/spotify/playlists` → escolher duas URIs da resposta
- [ ] Com o Spotify desktop aberto: `curl -X POST 127.0.0.1:3333/sessao -H 'Content-Type: application/json' -d '{"contexto":"teste real","playlistFoco":"spotify:playlist:...","playlistPausa":"spotify:playlist:..."}'` → música de foco toca
- [ ] `curl -X POST 127.0.0.1:3333/sessao/finalizar` → música pausa, linha aparece na tabela `sessoes` (conferir no Supabase)
- [ ] Commit final: `git commit -am "docs: fase 2 verificada ponta a ponta"`
