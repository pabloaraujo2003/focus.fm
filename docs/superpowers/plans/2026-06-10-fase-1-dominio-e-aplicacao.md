# Fase 1 — Domínio e Aplicação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Máquina de estados pomodoro pura + `GerenciadorDeSessao` orquestrando timer/música/persistência via portas, 100% testado com fakes, sem Spotify nem Supabase reais.

**Architecture:** Domínio puro (reducer `transicionar` + entidade `Sessao` + erros), camada de aplicação com portas (`MusicProvider`, `SessaoRepository`, `RelogioPort`) e `GerenciadorDeSessao`. Tudo dirigido por testes com relógio falso. Spec: `docs/superpowers/specs/2026-06-10-pomodoro-musical-design.md`. Fases 2 (infra/HTTP) e 3 (front Next.js) terão planos próprios.

**Tech Stack:** TypeScript strict, Vitest, Node 20+ (crypto.randomUUID nativo). Sem tsyringe nesta fase (entra na fase 2 — aqui instanciamos manualmente nos testes, o que já valida as portas).

---

### Task 1: Scaffold do backend

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/tests/smoke.test.ts`, `.gitignore`

- [ ] **Step 1: Criar arquivos de configuração**

`backend/package.json`:
```json
{
  "name": "@pomodoro-musical/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

`backend/tsconfig.json` (didático: `strict` liga as 8 checagens principais; `noUncheckedIndexedAccess` e `noImplicitReturns` vão além — o segundo garante exaustividade nos `switch` do reducer):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`backend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`.gitignore` (raiz do repo):
```
node_modules/
dist/
.env
*.tokens.json
```

`backend/tests/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('vitest funciona', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Instalar dependências**

Run: `cd backend && npm install -D typescript vitest @types/node`

- [ ] **Step 3: Verificar**

Run: `npm test && npm run typecheck` (em `backend/`)
Expected: 1 teste passando, typecheck sem erros.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold do backend com TypeScript estrito e Vitest"
```

---

### Task 2: Estados e mapa de transições

**Files:**
- Create: `backend/src/dominio/maquina-estados/estados.ts`
- Test: `backend/tests/dominio/estados.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { TRANSICOES, ehTransicaoValida } from '../../src/dominio/maquina-estados/estados';

describe('mapa de transições', () => {
  it('idle só transiciona para focando', () => {
    expect(TRANSICOES.idle).toEqual(['focando']);
  });

  it('valida transições legais', () => {
    expect(ehTransicaoValida('idle', 'focando')).toBe(true);
    expect(ehTransicaoValida('focando', 'pausa_curta')).toBe(true);
    expect(ehTransicaoValida('pausa_curta', 'focando')).toBe(true);
    expect(ehTransicaoValida('pausa_longa', 'focando')).toBe(true);
  });

  it('rejeita transições ilegais', () => {
    expect(ehTransicaoValida('idle', 'pausa_curta')).toBe(false);
    expect(ehTransicaoValida('pausa_curta', 'pausa_longa')).toBe(false);
    expect(ehTransicaoValida('idle', 'idle')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// Union type de literais: cada estado é um tipo. Um typo como 'focado'
// vira erro de compilação em qualquer lugar que use EstadoSessao.
export type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa';

// `as const` preserva os literais (sem ele, o TS alargaria para string[]).
// `satisfies` valida a forma SEM alargar o tipo — melhor dos dois mundos.
export const TRANSICOES = {
  idle:        ['focando'],
  focando:     ['pausa_curta', 'pausa_longa', 'idle'],
  pausa_curta: ['focando', 'idle'],
  pausa_longa: ['focando', 'idle'],
} as const satisfies Record<EstadoSessao, readonly EstadoSessao[]>;

// Utility type derivado do mapa: TransicaoValida<'idle'> = 'focando'.
// Indexar um objeto com [number] extrai a união dos elementos do array.
export type TransicaoValida<E extends EstadoSessao> = (typeof TRANSICOES)[E][number];

// Proteção de runtime (o tipo acima protege em compilação; isto protege
// quando o estado vem de fora — HTTP, banco — e o TS não pode ver).
export function ehTransicaoValida(de: EstadoSessao, para: EstadoSessao): boolean {
  return (TRANSICOES[de] as readonly EstadoSessao[]).includes(para);
}
```

- [ ] **Step 4: Rodar e ver passar** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(dominio): estados e mapa de transições com garantias de compilação"
```

---

### Task 3: Erros customizados

**Files:**
- Create: `backend/src/dominio/erros/app-error.ts`, `backend/src/dominio/erros/validation-error.ts`, `backend/src/dominio/erros/transicao-invalida-error.ts`
- Test: `backend/tests/dominio/erros.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/dominio/erros/app-error';
import { ValidationError } from '../../src/dominio/erros/validation-error';
import { TransicaoInvalidaError } from '../../src/dominio/erros/transicao-invalida-error';

describe('erros customizados', () => {
  it('ValidationError é AppError com code VALIDATION', () => {
    const erro = new ValidationError('contexto vazio');
    expect(erro).toBeInstanceOf(AppError);
    expect(erro).toBeInstanceOf(Error);
    expect(erro.code).toBe('VALIDATION');
    expect(erro.message).toBe('contexto vazio');
  });

  it('TransicaoInvalidaError descreve estado e evento', () => {
    const erro = new TransicaoInvalidaError('idle', 'COMPLETAR_FOCO');
    expect(erro.code).toBe('TRANSICAO_INVALIDA');
    expect(erro.estadoAtual).toBe('idle');
    expect(erro.evento).toBe('COMPLETAR_FOCO');
    expect(erro.message).toContain('idle');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implementar**

`app-error.ts`:
```ts
// Union dos códigos: o middleware HTTP (fase 2) fará switch exaustivo
// sobre isto para mapear code -> status. Novo erro = novo membro da união,
// e o compilador aponta todos os switches que precisam de atualização.
export type CodigoErro =
  | 'VALIDATION'
  | 'TRANSICAO_INVALIDA'
  | 'SPOTIFY'
  | 'NENHUM_DEVICE_ATIVO'
  | 'TOKEN_EXPIRADO';

export abstract class AppError extends Error {
  abstract readonly code: CodigoErro;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
```

`validation-error.ts`:
```ts
import { AppError } from './app-error';

export class ValidationError extends AppError {
  readonly code = 'VALIDATION';
}
```

`transicao-invalida-error.ts`:
```ts
import { AppError } from './app-error';
import type { EstadoSessao } from '../maquina-estados/estados';

export class TransicaoInvalidaError extends AppError {
  readonly code = 'TRANSICAO_INVALIDA';

  constructor(
    readonly estadoAtual: EstadoSessao,
    readonly evento: string,
  ) {
    super(`evento '${evento}' não é permitido no estado '${estadoAtual}'`);
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(dominio): hierarquia de erros customizados com code discriminante"
```

---

### Task 4: Configuração com defaults

**Files:**
- Create: `backend/src/dominio/config/configuracao.ts`
- Test: `backend/tests/dominio/configuracao.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { resolverConfiguracao } from '../../src/dominio/config/configuracao';
import { ValidationError } from '../../src/dominio/erros/validation-error';

describe('resolverConfiguracao', () => {
  it('sem argumentos retorna os defaults', () => {
    expect(resolverConfiguracao()).toEqual({
      duracaoFocoMin: 25,
      duracaoPausaCurtaMin: 5,
      duracaoPausaLongaMin: 15,
      ciclosAtePausaLonga: 4,
    });
  });

  it('mescla parciais com defaults', () => {
    const config = resolverConfiguracao({ duracaoFocoMin: 50 });
    expect(config.duracaoFocoMin).toBe(50);
    expect(config.duracaoPausaCurtaMin).toBe(5);
  });

  it('rejeita valores não positivos ou não inteiros', () => {
    expect(() => resolverConfiguracao({ duracaoFocoMin: 0 })).toThrow(ValidationError);
    expect(() => resolverConfiguracao({ ciclosAtePausaLonga: -1 })).toThrow(ValidationError);
    expect(() => resolverConfiguracao({ duracaoPausaCurtaMin: 2.5 })).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` — FAIL.

- [ ] **Step 3: Implementar**

```ts
import { ValidationError } from '../erros/validation-error';

// Parâmetros opcionais: quem usa informa só o que quer mudar.
export interface ConfiguracaoPomodoro {
  duracaoFocoMin?: number;
  duracaoPausaCurtaMin?: number;
  duracaoPausaLongaMin?: number;
  ciclosAtePausaLonga?: number;
}

// Utility type Required<T>: mesma interface, mas com tudo obrigatório.
// O resto do sistema só conhece a versão resolvida — ninguém mais
// precisa se perguntar "e se for undefined?".
export type ConfiguracaoResolvida = Required<ConfiguracaoPomodoro>;

const PADRAO: ConfiguracaoResolvida = {
  duracaoFocoMin: 25,
  duracaoPausaCurtaMin: 5,
  duracaoPausaLongaMin: 15,
  ciclosAtePausaLonga: 4,
};

export function resolverConfiguracao(parcial: ConfiguracaoPomodoro = {}): ConfiguracaoResolvida {
  const config = { ...PADRAO, ...parcial };
  for (const [campo, valor] of Object.entries(config)) {
    if (!Number.isInteger(valor) || valor <= 0) {
      throw new ValidationError(`'${campo}' deve ser um inteiro positivo (recebido: ${valor})`);
    }
  }
  return config;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(dominio): configuração do pomodoro com defaults e validação"
```

---

### Task 5: Eventos e reducer `transicionar`

**Files:**
- Create: `backend/src/dominio/maquina-estados/eventos.ts`, `backend/src/dominio/maquina-estados/maquina.ts`
- Test: `backend/tests/dominio/maquina.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { SNAPSHOT_INICIAL, transicionar } from '../../src/dominio/maquina-estados/maquina';
import type { SnapshotSessao } from '../../src/dominio/maquina-estados/maquina';
import { resolverConfiguracao } from '../../src/dominio/config/configuracao';
import { TransicaoInvalidaError } from '../../src/dominio/erros/transicao-invalida-error';
import { ValidationError } from '../../src/dominio/erros/validation-error';

const config = resolverConfiguracao(); // pausa longa a cada 4 ciclos

describe('transicionar', () => {
  it('INICIAR: idle -> focando, com contexto', () => {
    const s = transicionar(SNAPSHOT_INICIAL, { tipo: 'INICIAR', contexto: 'estudar generics' }, config);
    expect(s).toEqual({ estado: 'focando', ciclosCompletados: 0, contexto: 'estudar generics' });
  });

  it('INICIAR com contexto vazio lança ValidationError', () => {
    expect(() => transicionar(SNAPSHOT_INICIAL, { tipo: 'INICIAR', contexto: '   ' }, config))
      .toThrow(ValidationError);
  });

  it('COMPLETAR_FOCO: ciclos 1..3 vão para pausa_curta', () => {
    let s: SnapshotSessao = { estado: 'focando', ciclosCompletados: 0, contexto: 'x' };
    s = transicionar(s, { tipo: 'COMPLETAR_FOCO' }, config);
    expect(s.estado).toBe('pausa_curta');
    expect(s.ciclosCompletados).toBe(1);
  });

  it('COMPLETAR_FOCO: 4o ciclo vai para pausa_longa', () => {
    const s = transicionar(
      { estado: 'focando', ciclosCompletados: 3, contexto: 'x' },
      { tipo: 'COMPLETAR_FOCO' },
      config,
    );
    expect(s).toEqual({ estado: 'pausa_longa', ciclosCompletados: 4, contexto: 'x' });
  });

  it('COMPLETAR_PAUSA volta para focando (de ambas as pausas)', () => {
    for (const estado of ['pausa_curta', 'pausa_longa'] as const) {
      const s = transicionar({ estado, ciclosCompletados: 1, contexto: 'x' }, { tipo: 'COMPLETAR_PAUSA' }, config);
      expect(s.estado).toBe('focando');
    }
  });

  it('FINALIZAR de qualquer estado ativo volta ao snapshot inicial', () => {
    for (const estado of ['focando', 'pausa_curta', 'pausa_longa'] as const) {
      const s = transicionar({ estado, ciclosCompletados: 2, contexto: 'x' }, { tipo: 'FINALIZAR' }, config);
      expect(s).toEqual(SNAPSHOT_INICIAL);
    }
  });

  it('eventos fora de hora lançam TransicaoInvalidaError', () => {
    expect(() => transicionar(SNAPSHOT_INICIAL, { tipo: 'COMPLETAR_FOCO' }, config)).toThrow(TransicaoInvalidaError);
    expect(() => transicionar(SNAPSHOT_INICIAL, { tipo: 'FINALIZAR' }, config)).toThrow(TransicaoInvalidaError);
    expect(() => transicionar({ estado: 'focando', ciclosCompletados: 0, contexto: 'x' }, { tipo: 'INICIAR', contexto: 'y' }, config)).toThrow(TransicaoInvalidaError);
    expect(() => transicionar({ estado: 'pausa_curta', ciclosCompletados: 1, contexto: 'x' }, { tipo: 'COMPLETAR_FOCO' }, config)).toThrow(TransicaoInvalidaError);
  });

  it('não muta o snapshot de entrada (função pura)', () => {
    const entrada: SnapshotSessao = { estado: 'focando', ciclosCompletados: 0, contexto: 'x' };
    transicionar(entrada, { tipo: 'COMPLETAR_FOCO' }, config);
    expect(entrada).toEqual({ estado: 'focando', ciclosCompletados: 0, contexto: 'x' });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` — FAIL.

- [ ] **Step 3: Implementar**

`eventos.ts`:
```ts
// Discriminated union: o campo `tipo` é o discriminante. Dentro de cada
// case do switch o TS estreita o tipo — em 'INICIAR', `evento.contexto`
// existe; nos outros, acessá-lo é erro de compilação.
export type EventoSessao =
  | { tipo: 'INICIAR'; contexto: string }
  | { tipo: 'COMPLETAR_FOCO' }
  | { tipo: 'COMPLETAR_PAUSA' }
  | { tipo: 'FINALIZAR' };

export type TipoEvento = EventoSessao['tipo']; // indexed access type
```

`maquina.ts`:
```ts
import type { ConfiguracaoResolvida } from '../config/configuracao';
import { TransicaoInvalidaError } from '../erros/transicao-invalida-error';
import { ValidationError } from '../erros/validation-error';
import type { EstadoSessao } from './estados';
import type { EventoSessao, TipoEvento } from './eventos';

export interface SnapshotSessao {
  readonly estado: EstadoSessao;
  readonly ciclosCompletados: number;
  readonly contexto: string | null;
}

export const SNAPSHOT_INICIAL: SnapshotSessao = {
  estado: 'idle',
  ciclosCompletados: 0,
  contexto: null,
};

// Reducer puro: sem efeitos, sem relógio, sem Spotify. Toda a regra de
// negócio das transições vive aqui — e por isso testa-se em microssegundos.
export function transicionar(
  snapshot: SnapshotSessao,
  evento: EventoSessao,
  config: ConfiguracaoResolvida,
): SnapshotSessao {
  // `noImplicitReturns` + ausência de `default` = se um novo tipo de evento
  // for adicionado à união e não tratado aqui, o código NÃO COMPILA.
  switch (evento.tipo) {
    case 'INICIAR': {
      exigirEstado(snapshot, evento.tipo, ['idle']);
      const contexto = evento.contexto.trim();
      if (contexto.length === 0) {
        throw new ValidationError('o contexto da sessão não pode ser vazio');
      }
      return { estado: 'focando', ciclosCompletados: 0, contexto };
    }
    case 'COMPLETAR_FOCO': {
      exigirEstado(snapshot, evento.tipo, ['focando']);
      const ciclos = snapshot.ciclosCompletados + 1;
      const estado: EstadoSessao =
        ciclos % config.ciclosAtePausaLonga === 0 ? 'pausa_longa' : 'pausa_curta';
      return { ...snapshot, estado, ciclosCompletados: ciclos };
    }
    case 'COMPLETAR_PAUSA': {
      exigirEstado(snapshot, evento.tipo, ['pausa_curta', 'pausa_longa']);
      return { ...snapshot, estado: 'focando' };
    }
    case 'FINALIZAR': {
      exigirEstado(snapshot, evento.tipo, ['focando', 'pausa_curta', 'pausa_longa']);
      return SNAPSHOT_INICIAL;
    }
  }
}

function exigirEstado(
  snapshot: SnapshotSessao,
  tipo: TipoEvento,
  permitidos: readonly EstadoSessao[],
): void {
  if (!permitidos.includes(snapshot.estado)) {
    throw new TransicaoInvalidaError(snapshot.estado, tipo);
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` — PASS (todos os arquivos).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(dominio): reducer transicionar com regra de pausa longa por ciclos"
```

---

### Task 6: Entidade `Sessao`

**Files:**
- Create: `backend/src/dominio/entidades/sessao.ts`
- Test: `backend/tests/dominio/sessao.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { Sessao } from '../../src/dominio/entidades/sessao';
import { ValidationError } from '../../src/dominio/erros/validation-error';

const dados = {
  contexto: 'estudar generics',
  iniciadaEm: new Date('2026-06-10T14:00:00Z'),
  playlistFoco: 'spotify:playlist:FOCO',
  playlistPausa: 'spotify:playlist:PAUSA',
};

describe('Sessao', () => {
  it('inicia com id gerado e sem finalização', () => {
    const sessao = Sessao.iniciar(dados);
    expect(sessao.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessao.contexto).toBe('estudar generics');
    expect(sessao.finalizadaEm).toBeNull();
    expect(sessao.duracaoTotalSeg).toBeNull();
  });

  it('rejeita contexto vazio', () => {
    expect(() => Sessao.iniciar({ ...dados, contexto: ' ' })).toThrow(ValidationError);
  });

  it('finalizar registra fim, ciclos e duração', () => {
    const sessao = Sessao.iniciar(dados);
    sessao.finalizar(new Date('2026-06-10T15:00:00Z'), 2);
    expect(sessao.ciclosCompletados).toBe(2);
    expect(sessao.duracaoTotalSeg).toBe(3600);
  });

  it('não finaliza duas vezes nem antes do início', () => {
    const sessao = Sessao.iniciar(dados);
    expect(() => sessao.finalizar(new Date('2026-06-10T13:00:00Z'), 1)).toThrow(ValidationError);
    sessao.finalizar(new Date('2026-06-10T15:00:00Z'), 1);
    expect(() => sessao.finalizar(new Date('2026-06-10T16:00:00Z'), 1)).toThrow(ValidationError);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` — FAIL.

- [ ] **Step 3: Implementar**

```ts
import { ValidationError } from '../erros/validation-error';

export interface DadosNovaSessao {
  contexto: string;
  iniciadaEm: Date;
  playlistFoco: string;
  playlistPausa: string;
}

export class Sessao {
  private finalizadaEmInterno: Date | null = null;
  private ciclosInterno = 0;

  private constructor(
    readonly id: string,
    readonly contexto: string,
    readonly iniciadaEm: Date,
    readonly playlistFoco: string,
    readonly playlistPausa: string,
  ) {}

  // Factory estática + construtor privado: impossível criar uma Sessao
  // que não passou pela validação.
  static iniciar(dados: DadosNovaSessao): Sessao {
    const contexto = dados.contexto.trim();
    if (contexto.length === 0) {
      throw new ValidationError('o contexto da sessão não pode ser vazio');
    }
    return new Sessao(crypto.randomUUID(), contexto, dados.iniciadaEm, dados.playlistFoco, dados.playlistPausa);
  }

  finalizar(em: Date, ciclosCompletados: number): void {
    if (this.finalizadaEmInterno !== null) {
      throw new ValidationError('a sessão já foi finalizada');
    }
    if (em.getTime() < this.iniciadaEm.getTime()) {
      throw new ValidationError('a finalização não pode ser anterior ao início');
    }
    this.finalizadaEmInterno = em;
    this.ciclosInterno = ciclosCompletados;
  }

  get finalizadaEm(): Date | null {
    return this.finalizadaEmInterno;
  }

  get ciclosCompletados(): number {
    return this.ciclosInterno;
  }

  get duracaoTotalSeg(): number | null {
    if (this.finalizadaEmInterno === null) return null;
    return Math.round((this.finalizadaEmInterno.getTime() - this.iniciadaEm.getTime()) / 1000);
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(dominio): entidade Sessao com factory validada e finalização"
```

---

### Task 7: Portas da aplicação

**Files:**
- Create: `backend/src/aplicacao/portas/music-provider.ts`, `backend/src/aplicacao/portas/sessao-repository.ts`, `backend/src/aplicacao/portas/relogio-port.ts`

- [ ] **Step 1: Criar as interfaces** (sem teste próprio — são contratos; os testes vêm com os fakes e o gerenciador)

`music-provider.ts`:
```ts
// Padrão Provider: a aplicação depende desta interface; SpotifyProvider
// (fase 2) é um detalhe. Trocar de serviço de música = nova classe, e
// nada nas camadas internas muda.
export interface MusicProvider {
  tocarPlaylist(uri: string): Promise<void>;
  pausar(): Promise<void>;
}
```

`sessao-repository.ts`:
```ts
import type { Sessao } from '../../dominio/entidades/sessao';

// Padrão Repository: o MVP só grava. O genérico Repository<T, TId>
// será extraído na fase 2, quando houver um segundo caso concreto.
export interface SessaoRepository {
  salvar(sessao: Sessao): Promise<void>;
}
```

`relogio-port.ts`:
```ts
// O tempo também é uma dependência injetável. `agendar` devolve uma
// função de cancelamento (mesma convenção de clearTimeout, sem expor Node).
export interface RelogioPort {
  agora(): Date;
  agendar(ms: number, callback: () => void): () => void;
}
```

- [ ] **Step 2: Verificar** — Run: `npm run typecheck` — Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(aplicacao): portas MusicProvider, SessaoRepository e RelogioPort"
```

---

### Task 8: Fakes de teste

**Files:**
- Create: `backend/tests/fakes/relogio-fake.ts`, `backend/tests/fakes/music-provider-fake.ts`, `backend/tests/fakes/sessao-repository-fake.ts`
- Test: `backend/tests/fakes/relogio-fake.test.ts`

- [ ] **Step 1: Escrever teste do relógio falso (o único fake com lógica)**

```ts
import { describe, expect, it } from 'vitest';
import { RelogioFake } from './relogio-fake';

describe('RelogioFake', () => {
  it('dispara callbacks na ordem, atualizando agora()', async () => {
    const relogio = new RelogioFake();
    const disparos: string[] = [];
    relogio.agendar(2000, () => disparos.push(`b@${relogio.agora().getTime()}`));
    relogio.agendar(1000, () => disparos.push(`a@${relogio.agora().getTime()}`));
    await relogio.avancar(3000);
    expect(disparos).toEqual(['a@1000', 'b@2000']);
    expect(relogio.agora().getTime()).toBe(3000);
  });

  it('callback agendado durante avancar também dispara se couber na janela', async () => {
    const relogio = new RelogioFake();
    const disparos: number[] = [];
    relogio.agendar(1000, () => {
      disparos.push(1);
      relogio.agendar(1000, () => disparos.push(2));
    });
    await relogio.avancar(2500);
    expect(disparos).toEqual([1, 2]);
  });

  it('cancelamento impede o disparo', async () => {
    const relogio = new RelogioFake();
    const disparos: number[] = [];
    const cancelar = relogio.agendar(1000, () => disparos.push(1));
    cancelar();
    await relogio.avancar(2000);
    expect(disparos).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` — FAIL.

- [ ] **Step 3: Implementar os três fakes**

`relogio-fake.ts`:
```ts
import type { RelogioPort } from '../../src/aplicacao/portas/relogio-port';

interface Agendamento {
  dispararEm: number;
  callback: () => void;
  cancelado: boolean;
  disparado: boolean;
}

// Tempo controlado: uma sessão pomodoro de 2h roda em milissegundos.
export class RelogioFake implements RelogioPort {
  private agoraMs = 0;
  private agendamentos: Agendamento[] = [];

  agora(): Date {
    return new Date(this.agoraMs);
  }

  agendar(ms: number, callback: () => void): () => void {
    const agendamento: Agendamento = {
      dispararEm: this.agoraMs + ms,
      callback,
      cancelado: false,
      disparado: false,
    };
    this.agendamentos.push(agendamento);
    return () => {
      agendamento.cancelado = true;
    };
  }

  // async: depois de cada disparo, cede o event loop para que callbacks
  // async (ex.: tocarPlaylist aguardada pelo gerenciador) se resolvam
  // antes do próximo disparo — espelha o comportamento real do setTimeout.
  async avancar(ms: number): Promise<void> {
    const destino = this.agoraMs + ms;
    let proximo = this.proximoAte(destino);
    while (proximo !== undefined) {
      this.agoraMs = proximo.dispararEm;
      proximo.disparado = true;
      proximo.callback();
      await new Promise((resolve) => setImmediate(resolve));
      proximo = this.proximoAte(destino);
    }
    this.agoraMs = destino;
  }

  private proximoAte(limiteMs: number): Agendamento | undefined {
    return this.agendamentos
      .filter((a) => !a.cancelado && !a.disparado && a.dispararEm <= limiteMs)
      .sort((a, b) => a.dispararEm - b.dispararEm)[0];
  }
}
```

`music-provider-fake.ts`:
```ts
import type { MusicProvider } from '../../src/aplicacao/portas/music-provider';

// Spy manual: registra as chamadas para os testes inspecionarem.
export class MusicProviderFake implements MusicProvider {
  readonly chamadas: string[] = [];

  async tocarPlaylist(uri: string): Promise<void> {
    this.chamadas.push(`tocar:${uri}`);
  }

  async pausar(): Promise<void> {
    this.chamadas.push('pausar');
  }
}
```

`sessao-repository-fake.ts`:
```ts
import type { Sessao } from '../../src/dominio/entidades/sessao';
import type { SessaoRepository } from '../../src/aplicacao/portas/sessao-repository';

export class SessaoRepositoryFake implements SessaoRepository {
  readonly salvas: Sessao[] = [];

  async salvar(sessao: Sessao): Promise<void> {
    this.salvas.push(sessao);
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: fakes de relógio, música e repositório para a camada de aplicação"
```

---

### Task 9: `GerenciadorDeSessao`

**Files:**
- Create: `backend/src/aplicacao/gerenciador-de-sessao.ts`
- Test: `backend/tests/aplicacao/gerenciador-de-sessao.test.ts`

- [ ] **Step 1: Escrever teste que falha**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { GerenciadorDeSessao } from '../../src/aplicacao/gerenciador-de-sessao';
import { resolverConfiguracao } from '../../src/dominio/config/configuracao';
import { TransicaoInvalidaError } from '../../src/dominio/erros/transicao-invalida-error';
import { MusicProviderFake } from '../fakes/music-provider-fake';
import { RelogioFake } from '../fakes/relogio-fake';
import { SessaoRepositoryFake } from '../fakes/sessao-repository-fake';

const MIN = 60_000;
const playlists = { foco: 'spotify:playlist:FOCO', pausa: 'spotify:playlist:PAUSA' };

describe('GerenciadorDeSessao', () => {
  let relogio: RelogioFake;
  let music: MusicProviderFake;
  let repositorio: SessaoRepositoryFake;
  let gerenciador: GerenciadorDeSessao;

  beforeEach(() => {
    relogio = new RelogioFake();
    music = new MusicProviderFake();
    repositorio = new SessaoRepositoryFake();
    gerenciador = new GerenciadorDeSessao(
      resolverConfiguracao(), playlists, relogio, music, repositorio,
    );
  });

  it('iniciar: entra em foco, toca playlist de foco e agenda o fim', async () => {
    await gerenciador.iniciar('estudar generics');
    const status = gerenciador.obterStatus();
    expect(status.snapshot.estado).toBe('focando');
    expect(music.chamadas).toEqual(['tocar:spotify:playlist:FOCO']);
    expect(status.terminaEm?.getTime()).toBe(25 * MIN);
  });

  it('ao fim do foco entra em pausa_curta e troca a playlist', async () => {
    await gerenciador.iniciar('x');
    await relogio.avancar(25 * MIN);
    const status = gerenciador.obterStatus();
    expect(status.snapshot.estado).toBe('pausa_curta');
    expect(status.snapshot.ciclosCompletados).toBe(1);
    expect(music.chamadas).toEqual(['tocar:spotify:playlist:FOCO', 'tocar:spotify:playlist:PAUSA']);
    expect(status.terminaEm?.getTime()).toBe(30 * MIN);
  });

  it('apos 4 focos completos entra em pausa_longa', async () => {
    await gerenciador.iniciar('x');
    // 3 ciclos completos (foco 25 + pausa curta 5) + 4o foco 25
    await relogio.avancar((3 * 30 + 25) * MIN);
    const status = gerenciador.obterStatus();
    expect(status.snapshot.estado).toBe('pausa_longa');
    expect(status.snapshot.ciclosCompletados).toBe(4);
    expect(status.terminaEm?.getTime()).toBe((3 * 30 + 25 + 15) * MIN);
  });

  it('finalizar: grava sessão com ciclos e duração, pausa música, volta a idle', async () => {
    await gerenciador.iniciar('estudar generics');
    await relogio.avancar(55 * MIN); // 25 foco + 5 pausa + 25 foco = 2 ciclos
    const sessao = await gerenciador.finalizar();
    expect(sessao.ciclosCompletados).toBe(2);
    expect(sessao.duracaoTotalSeg).toBe(55 * 60);
    expect(sessao.contexto).toBe('estudar generics');
    expect(repositorio.salvas).toEqual([sessao]);
    expect(music.chamadas.at(-1)).toBe('pausar');
    expect(gerenciador.obterStatus()).toEqual({
      snapshot: { estado: 'idle', ciclosCompletados: 0, contexto: null },
      terminaEm: null,
    });
  });

  it('finalizar cancela o timer pendente (nada dispara depois)', async () => {
    await gerenciador.iniciar('x');
    await gerenciador.finalizar();
    const chamadasAntes = music.chamadas.length;
    await relogio.avancar(120 * MIN);
    expect(music.chamadas.length).toBe(chamadasAntes);
  });

  it('iniciar com sessão ativa e finalizar sem sessão lançam TransicaoInvalidaError', async () => {
    await expect(gerenciador.finalizar()).rejects.toThrow(TransicaoInvalidaError);
    await gerenciador.iniciar('x');
    await expect(gerenciador.iniciar('y')).rejects.toThrow(TransicaoInvalidaError);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` — FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { ConfiguracaoResolvida } from '../dominio/config/configuracao';
import { Sessao } from '../dominio/entidades/sessao';
import type { EstadoSessao } from '../dominio/maquina-estados/estados';
import {
  SNAPSHOT_INICIAL,
  transicionar,
  type SnapshotSessao,
} from '../dominio/maquina-estados/maquina';
import type { MusicProvider } from './portas/music-provider';
import type { RelogioPort } from './portas/relogio-port';
import type { SessaoRepository } from './portas/sessao-repository';

const MS_POR_MIN = 60_000;

export interface PlaylistsConfiguradas {
  readonly foco: string;
  readonly pausa: string;
}

export interface StatusSessao {
  readonly snapshot: SnapshotSessao;
  readonly terminaEm: Date | null;
}

// Orquestrador: o domínio decide PARA ONDE ir (reducer); esta classe
// decide O QUE FAZER ao chegar lá (tocar música, agendar timer, gravar).
export class GerenciadorDeSessao {
  private snapshot: SnapshotSessao = SNAPSHOT_INICIAL;
  private sessaoAtual: Sessao | null = null;
  private cancelarTimer: (() => void) | null = null;
  private terminaEm: Date | null = null;

  constructor(
    private readonly config: ConfiguracaoResolvida,
    private readonly playlists: PlaylistsConfiguradas,
    private readonly relogio: RelogioPort,
    private readonly music: MusicProvider,
    private readonly repositorio: SessaoRepository,
  ) {}

  async iniciar(contexto: string): Promise<void> {
    // O reducer valida a transição (idle -> focando) e o contexto.
    this.snapshot = transicionar(this.snapshot, { tipo: 'INICIAR', contexto }, this.config);
    this.sessaoAtual = Sessao.iniciar({
      contexto: this.snapshot.contexto ?? contexto,
      iniciadaEm: this.relogio.agora(),
      playlistFoco: this.playlists.foco,
      playlistPausa: this.playlists.pausa,
    });
    await this.entrarNoEstado();
  }

  async finalizar(): Promise<Sessao> {
    const ciclos = this.snapshot.ciclosCompletados;
    // Valida primeiro (lança em idle), só depois mexe em timer/música.
    this.snapshot = transicionar(this.snapshot, { tipo: 'FINALIZAR' }, this.config);
    const sessao = this.sessaoAtual;
    if (sessao === null) {
      // Inalcançável se snapshot e sessaoAtual andarem juntos; guarda de runtime.
      throw new Error('estado inconsistente: sessão ativa sem entidade Sessao');
    }
    this.pararTimer();
    sessao.finalizar(this.relogio.agora(), ciclos);
    await this.repositorio.salvar(sessao);
    await this.music.pausar();
    this.sessaoAtual = null;
    this.terminaEm = null;
    return sessao;
  }

  obterStatus(): StatusSessao {
    return { snapshot: this.snapshot, terminaEm: this.terminaEm };
  }

  private async entrarNoEstado(): Promise<void> {
    const { duracaoMin, playlist } = this.parametrosDoEstado(this.snapshot.estado);
    await this.music.tocarPlaylist(playlist);
    const ms = duracaoMin * MS_POR_MIN;
    this.terminaEm = new Date(this.relogio.agora().getTime() + ms);
    this.pararTimer();
    this.cancelarTimer = this.relogio.agendar(ms, () => {
      void this.aoCompletarPeriodo();
    });
  }

  private async aoCompletarPeriodo(): Promise<void> {
    try {
      const tipo = this.snapshot.estado === 'focando' ? 'COMPLETAR_FOCO' : 'COMPLETAR_PAUSA';
      this.snapshot = transicionar(this.snapshot, { tipo }, this.config);
      await this.entrarNoEstado();
    } catch (erro) {
      // Falha de música não pode matar o timer silenciosamente; na fase 2
      // isso vira log estruturado + status de erro consultável.
      console.error('[pomodoro] falha ao completar período:', erro);
    }
  }

  private parametrosDoEstado(estado: EstadoSessao): { duracaoMin: number; playlist: string } {
    switch (estado) {
      case 'focando':
        return { duracaoMin: this.config.duracaoFocoMin, playlist: this.playlists.foco };
      case 'pausa_curta':
        return { duracaoMin: this.config.duracaoPausaCurtaMin, playlist: this.playlists.pausa };
      case 'pausa_longa':
        return { duracaoMin: this.config.duracaoPausaLongaMin, playlist: this.playlists.pausa };
      case 'idle':
        throw new Error('estado idle não tem período agendável');
    }
  }

  private pararTimer(): void {
    this.cancelarTimer?.();
    this.cancelarTimer = null;
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` — PASS (suíte completa).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(aplicacao): GerenciadorDeSessao orquestrando timer, música e persistência"
```

---

### Task 10: Verificação final da fase

- [ ] **Step 1: Rodar tudo**

Run (em `backend/`): `npm run typecheck && npm test`
Expected: typecheck limpo; todas as suítes passando (estados, erros, configuração, máquina, sessão, relógio fake, gerenciador).

- [ ] **Step 2: Marcar checkboxes deste plano e commitar**

```bash
git add docs/ && git commit -m "docs: plano da fase 1 concluído"
```
