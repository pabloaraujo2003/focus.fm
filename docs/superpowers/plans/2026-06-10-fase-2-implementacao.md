# Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir o MVP com 4 features básicas (pausa/retomada, histórico de contextos, vinil com faixa atual, notificações), consolidando a máquina de estados antes de features futuras.

**Architecture:** Máquina de estados expandida (novo estado `pausado`) com transições bidirecionais, gerenciador com relógio pausável, persistência de tempo parado, 4 novos endpoints REST, integração frontend com Notification API e polling de player.

**Tech Stack:** TypeScript/Vitest (backend TDD), Next.js/React (frontend), Supabase (schema), axios (client HTTP), Notification API do navegador.

---

## Estrutura de Arquivos

**Criação:**
- `backend/src/migrations/001-adicionar-pausa.sql`
- `backend/src/aplicacao/gerenciador-de-sessao.test.ts` (testes com relógio falso)
- `frontend/src/components/contexto-input.tsx`
- `frontend/src/components/vinil-display.tsx`
- `frontend/src/hooks/use-sessao-notifications.ts`
- `frontend/src/hooks/use-player-info.ts`

**Modificação:**
- `backend/src/dominio/maquina-de-estados.ts` (novo estado, tipos, reducer)
- `backend/src/dominio/maquina-de-estados.test.ts` (novos testes PAUSAR/RETOMAR)
- `backend/src/dominio/sessao.ts` (adicionar `estadoAnterior`, `tempoParaTotal`)
- `backend/src/aplicacao/gerenciador-de-sessao.ts` (métodos pausar/retomar, relógio)
- `backend/src/infraestrutura/supabase-sessao-repository.ts` (persistência)
- `backend/src/http/sessao.ts` (novos endpoints)
- `backend/src/services/sessao-service.ts` (lógica de negócio)
- `frontend/src/services/sessao-api.ts` (novos endpoints, autocomplete)
- `frontend/src/pages/index.tsx` (integração UI)

---

## Task 1: Expandir Tipos da Máquina de Estados

**Files:**
- Modify: `backend/src/dominio/maquina-de-estados.ts`
- Test: `backend/src/dominio/maquina-de-estados.test.ts`

- [ ] **Step 1: Adicionar novo estado `pausado` ao type EstadoSessao**

Abra `backend/src/dominio/maquina-de-estados.ts` e encontre:

```ts
type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa';
```

Substitua por:

```ts
type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa' | 'pausado';
```

- [ ] **Step 2: Atualizar TRANSICOES com novo estado**

Encontre o const TRANSICOES e substitua:

```ts
const TRANSICOES = {
  idle:         ['focando'],
  focando:      ['pausa_curta', 'pausa_longa', 'pausado', 'idle'],
  pausa_curta:  ['focando', 'pausado', 'idle'],
  pausa_longa:  ['focando', 'pausado', 'idle'],
  pausado:      ['focando', 'pausa_curta', 'pausa_longa', 'idle'],
} as const satisfies Record<EstadoSessao, readonly EstadoSessao[]>;
```

- [ ] **Step 3: Expandir EventoSessao com PAUSAR e RETOMAR**

Encontre `type EventoSessao` e substitua:

```ts
type EventoSessao =
  | { tipo: 'INICIAR'; contexto: string }
  | { tipo: 'COMPLETAR_FOCO' }
  | { tipo: 'COMPLETAR_PAUSA' }
  | { tipo: 'PAUSAR' }
  | { tipo: 'RETOMAR' }
  | { tipo: 'FINALIZAR' };
```

- [ ] **Step 4: Expandir SnapshotSessao com estadoAnterior**

Encontre `interface SnapshotSessao` e adicione:

```ts
interface SnapshotSessao {
  readonly estado: EstadoSessao;
  readonly estadoAnterior?: EstadoSessao;
  readonly ciclosCompletados: number;
  readonly contexto: string | null;
}
```

- [ ] **Step 5: Testar que o código compila**

```bash
cd backend && npm run build
```

Esperado: zero erros de compilação.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/dominio/maquina-de-estados.ts && git commit -m "feat(dominio): adicionar estado 'pausado' e eventos PAUSAR/RETOMAR"
```

---

## Task 2: Implementar Reducer com PAUSAR/RETOMAR (TDD)

**Files:**
- Modify: `backend/src/dominio/maquina-de-estados.ts`
- Modify: `backend/src/dominio/maquina-de-estados.test.ts`

- [ ] **Step 1: Escrever teste PAUSAR transiciona corretamente**

Abra `backend/src/dominio/maquina-de-estados.test.ts` e adicione:

```ts
describe('Máquina de Estados — Fase 2 (PAUSAR/RETOMAR)', () => {
  describe('PAUSAR', () => {
    it('transiciona de focando → pausado e memoriza estado anterior', () => {
      const snapshot: SnapshotSessao = {
        estado: 'focando',
        ciclosCompletados: 0,
        contexto: 'Estudar'
      };
      const novo = transicionar(snapshot, { tipo: 'PAUSAR' });
      expect(novo.estado).toBe('pausado');
      expect(novo.estadoAnterior).toBe('focando');
    });

    it('transiciona de pausa_curta → pausado', () => {
      const snapshot: SnapshotSessao = {
        estado: 'pausa_curta',
        ciclosCompletados: 1,
        contexto: 'Estudar'
      };
      const novo = transicionar(snapshot, { tipo: 'PAUSAR' });
      expect(novo.estado).toBe('pausado');
      expect(novo.estadoAnterior).toBe('pausa_curta');
    });

    it('lança erro ao pausar de idle', () => {
      const snapshot: SnapshotSessao = {
        estado: 'idle',
        ciclosCompletados: 0,
        contexto: null
      };
      expect(() => transicionar(snapshot, { tipo: 'PAUSAR' }))
        .toThrow(TransicaoInvalidaError);
    });

    it('lança erro ao pausar já estando pausado', () => {
      const snapshot: SnapshotSessao = {
        estado: 'pausado',
        estadoAnterior: 'focando',
        ciclosCompletados: 0,
        contexto: 'Estudar'
      };
      expect(() => transicionar(snapshot, { tipo: 'PAUSAR' }))
        .toThrow(TransicaoInvalidaError);
    });
  });

  describe('RETOMAR', () => {
    it('volta de pausado para estado anterior', () => {
      const snapshot: SnapshotSessao = {
        estado: 'pausado',
        estadoAnterior: 'focando',
        ciclosCompletados: 1,
        contexto: 'Estudar'
      };
      const novo = transicionar(snapshot, { tipo: 'RETOMAR' });
      expect(novo.estado).toBe('focando');
      expect(novo.estadoAnterior).toBeUndefined();
    });

    it('lança erro ao retomar não estando pausado', () => {
      const snapshot: SnapshotSessao = {
        estado: 'focando',
        ciclosCompletados: 1,
        contexto: 'Estudar'
      };
      expect(() => transicionar(snapshot, { tipo: 'RETOMAR' }))
        .toThrow(TransicaoInvalidaError);
    });
  });
});
```

- [ ] **Step 2: Rodar testes (esperado: FALHAM)**

```bash
cd backend && npm test -- src/dominio/maquina-de-estados.test.ts
```

Esperado: testes falhando (reducer não implementado ainda).

- [ ] **Step 3: Implementar lógica PAUSAR no reducer**

Abra `backend/src/dominio/maquina-de-estados.ts` e encontre a função `transicionar`. Dentro do switch principal, adicione (antes do default):

```ts
export function transicionar(snapshot: SnapshotSessao, evento: EventoSessao): SnapshotSessao {
  const estadoDestino = getEstadoDestino(snapshot.estado, evento.tipo);

  if (!estadoDestino) {
    throw new TransicaoInvalidaError(
      `Transição inválida: ${snapshot.estado} -> ${evento.tipo}`
    );
  }

  switch (evento.tipo) {
    case 'INICIAR':
      return {
        estado: 'focando',
        ciclosCompletados: 0,
        contexto: evento.contexto,
      };

    case 'COMPLETAR_FOCO': {
      const proximoCiclo = snapshot.ciclosCompletados + 1;
      const temPausaLonga = proximoCiclo % 4 === 0; // a cada 4 ciclos
      return {
        ...snapshot,
        estado: temPausaLonga ? 'pausa_longa' : 'pausa_curta',
      };
    }

    case 'COMPLETAR_PAUSA':
      return {
        ...snapshot,
        estado: 'focando',
        ciclosCompletados: snapshot.ciclosCompletados + 1,
      };

    case 'PAUSAR':
      if (snapshot.estado === 'idle' || snapshot.estado === 'pausado') {
        throw new TransicaoInvalidaError('Não é possível pausar de idle ou já estando pausado');
      }
      return {
        ...snapshot,
        estado: 'pausado',
        estadoAnterior: snapshot.estado,
      };

    case 'RETOMAR':
      if (snapshot.estado !== 'pausado' || !snapshot.estadoAnterior) {
        throw new TransicaoInvalidaError('Não é possível retomar não estando pausado');
      }
      return {
        ...snapshot,
        estado: snapshot.estadoAnterior,
        estadoAnterior: undefined,
      };

    case 'FINALIZAR':
      return {
        estado: 'idle',
        ciclosCompletados: snapshot.ciclosCompletados,
        contexto: null,
      };

    default:
      const _exhaustive: never = evento;
      return _exhaustive;
  }
}
```

- [ ] **Step 4: Adicionar função helper getEstadoDestino**

Adicione acima de `transicionar`:

```ts
function getEstadoDestino(estadoAtual: EstadoSessao, tipoEvento: EventoSessao['tipo']): EstadoSessao | null {
  const destinos = TRANSICOES[estadoAtual];
  
  const estadoParaTipo: Record<EventoSessao['tipo'], EstadoSessao | null> = {
    INICIAR: 'focando',
    COMPLETAR_FOCO: estadoAtual === 'focando' 
      ? ((estadoAtual + 1) % 4 === 0 ? 'pausa_longa' : 'pausa_curta')
      : null,
    COMPLETAR_PAUSA: 'focando',
    PAUSAR: 'pausado',
    RETOMAR: estadoAtual === 'pausado' ? 'focando' : null,
    FINALIZAR: 'idle',
  };

  const destino = estadoParaTipo[tipoEvento];
  return destino && destinos.includes(destino) ? destino : null;
}
```

- [ ] **Step 5: Rodar testes novamente (esperado: PASSAM)**

```bash
cd backend && npm test -- src/dominio/maquina-de-estados.test.ts
```

Esperado: todos os testes verdes.

- [ ] **Step 6: Compilar sem erros**

```bash
cd backend && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/dominio/maquina-de-estados.ts && git commit -m "feat(dominio): implementar PAUSAR/RETOMAR no reducer (TDD)"
```

---

## Task 3: Expandir GerenciadorDeSessao com Pausa (TDD)

**Files:**
- Modify: `backend/src/aplicacao/gerenciador-de-sessao.ts`
- Create: `backend/src/aplicacao/gerenciador-de-sessao.test.ts`

- [ ] **Step 1: Escrever teste de pausa com relógio falso**

Crie `backend/src/aplicacao/gerenciador-de-sessao.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RelogioFalso } from '../shared/relogio-falso';
import { GerenciadorDeSessao } from './gerenciador-de-sessao';
import { SnapshotSessao } from '../dominio/maquina-de-estados';

describe('GerenciadorDeSessao — Pausa/Retomada', () => {
  let relogio: RelogioFalso;
  let gerenciador: GerenciadorDeSessao;

  beforeEach(() => {
    relogio = new RelogioFalso();
    // Assumindo que GerenciadorDeSessao injeta o relógio
    gerenciador = new GerenciadorDeSessao(relogio, {} as any); // mocks omitidos por brevidade
  });

  it('pausa o relógio e memoriza tempo restante', async () => {
    gerenciador.iniciar('Estudar', {
      duracaoFocoMin: 25,
      duracaoPausaCurtaMin: 5,
      duracaoPausaLongaMin: 15,
      ciclosAtePausaLonga: 4,
    });

    // Avança 10 minutos
    relogio.avanca(10 * 60 * 1000);

    // Pausa
    gerenciador.pausar();
    let snapshot = gerenciador.snapshot();
    expect(snapshot.estado).toBe('pausado');
    expect(snapshot.estadoAnterior).toBe('focando');

    // Simula 5 minutos passando enquanto pausado (NÃO deve afetar o timer)
    relogio.avanca(5 * 60 * 1000);

    // Retoma
    gerenciador.retomar();
    snapshot = gerenciador.snapshot();
    expect(snapshot.estado).toBe('focando');

    // Avança mais 15 minutos
    relogio.avanca(15 * 60 * 1000);

    // Total: 10 + 15 = 25 minutos (não 10 + 5 + 15)
    snapshot = gerenciador.snapshot();
    expect(snapshot.tempoDecorridoMs).toBe(25 * 60 * 1000);
  });

  it('finaliza com duração correta descontando tempo pausado', async () => {
    gerenciador.iniciar('Estudar', {
      duracaoFocoMin: 25,
      duracaoPausaCurtaMin: 5,
      duracaoPausaLongaMin: 15,
      ciclosAtePausaLonga: 4,
    });

    relogio.avanca(10 * 60 * 1000); // 10 min
    gerenciador.pausar();
    relogio.avanca(5 * 60 * 1000);  // pausa por 5 min (não conta)
    gerenciador.retomar();
    relogio.avanca(15 * 60 * 1000); // 15 min

    const sessao = gerenciador.finalizar();
    // duracao_real = (10 + 5 + 15) - 5 = 25 min
    expect(sessao.duracaoTotalSeg).toBe(25 * 60);
  });
});
```

- [ ] **Step 2: Rodar testes (esperado: FALHAM)**

```bash
cd backend && npm test -- src/aplicacao/gerenciador-de-sessao.test.ts
```

Esperado: falhando (métodos `pausar()` e `retomar()` não existem ainda).

- [ ] **Step 3: Adicionar métodos pausar() e retomar() ao gerenciador**

Abra `backend/src/aplicacao/gerenciador-de-sessao.ts` e adicione os métodos:

```ts
export class GerenciadorDeSessao {
  private timerId?: NodeJS.Timeout;
  private durationMs: number = 0;
  private tempoRestanteMs: number = 0;
  private inicioDoPeríodo: number = 0;

  // ... métodos existentes ...

  pausar(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    
    // Memoriza quanto tempo falta
    this.tempoRestanteMs = this.durationMs - (Date.now() - this.inicioDoPeríodo);
    
    this.sessao = transicionar(this.sessao, { tipo: 'PAUSAR' });
  }

  retomar(): void {
    this.sessao = transicionar(this.sessao, { tipo: 'RETOMAR' });
    
    // Reinicia relógio com tempo restante
    this.agendarProximaTransicao(this.tempoRestanteMs);
  }

  private agendarProximaTransicao(customMs?: number): void {
    const ms = customMs ?? this.durationMs;
    this.inicioDoPeríodo = Date.now();
    this.durationMs = ms;
    
    this.timerId = this.relogio.setTimeout(() => {
      // Lógica de transição automática...
      this.timerId = undefined;
    }, ms);
  }
}
```

- [ ] **Step 4: Rodar testes novamente (esperado: PASSAM)**

```bash
cd backend && npm test -- src/aplicacao/gerenciador-de-sessao.test.ts
```

Esperado: verdes.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/aplicacao/gerenciador-de-sessao.ts src/aplicacao/gerenciador-de-sessao.test.ts && git commit -m "feat(app): pausar/retomar no gerenciador com relógio falso (TDD)"
```

---

## Task 4: Criar Migration SQL para Pausa

**Files:**
- Create: `backend/src/migrations/001-adicionar-pausa.sql`

- [ ] **Step 1: Criar arquivo de migration**

Crie `backend/src/migrations/001-adicionar-pausa.sql`:

```sql
-- Adicionar colunas para suportar pausa/retomada

ALTER TABLE sessoes ADD COLUMN estado_anterior TEXT;
ALTER TABLE sessoes ADD COLUMN pausado_em TIMESTAMPTZ;
ALTER TABLE sessoes ADD COLUMN tempo_pausa_total_seg INTEGER DEFAULT 0;

-- Índices pra queries futuras
CREATE INDEX idx_sessoes_contexto ON sessoes(contexto);
CREATE INDEX idx_sessoes_iniciada_em ON sessoes(iniciada_em DESC);

-- Comentários explicativos (opcional)
COMMENT ON COLUMN sessoes.estado_anterior IS 'Estado da sessão antes de pausar (null se não pausada)';
COMMENT ON COLUMN sessoes.pausado_em IS 'Timestamp de quando foi pausado (null se não pausada)';
COMMENT ON COLUMN sessoes.tempo_pausa_total_seg IS 'Acumula tempo total pausado durante a sessão';
```

- [ ] **Step 2: Aplicar migration no Supabase (manual)**

Via Supabase SQL Editor, execute o arquivo e valide que as colunas foram criadas.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/migrations/001-adicionar-pausa.sql && git commit -m "feat(db): migration para suportar pausa/retomada"
```

---

## Task 5: Atualizar SessaoRepository para Persistência

**Files:**
- Modify: `backend/src/infraestrutura/supabase-sessao-repository.ts`

- [ ] **Step 1: Adicionar métodos para atualizar pausa**

Abra `backend/src/infraestrutura/supabase-sessao-repository.ts` e adicione:

```ts
export class SupabaseSessaoRepository implements SessaoRepository {
  // ... métodos existentes ...

  async pausar(sessaoId: string, estadoAnterior: string): Promise<void> {
    await this.client
      .from('sessoes')
      .update({
        estado_anterior: estadoAnterior,
        pausado_em: new Date().toISOString(),
      })
      .eq('id', sessaoId);
  }

  async retomar(sessaoId: string, tempoDecorridoMs: number): Promise<void> {
    const pausadoEm = await this.client
      .from('sessoes')
      .select('pausado_em')
      .eq('id', sessaoId)
      .single();

    if (!pausadoEm.data?.pausado_em) {
      throw new Error('Sessão não está pausada');
    }

    const tempoParadoMs =
      new Date().getTime() - new Date(pausadoEm.data.pausado_em).getTime();

    await this.client
      .from('sessoes')
      .update({
        estado_anterior: null,
        pausado_em: null,
        tempo_pausa_total_seg: (
          (await this.client
            .from('sessoes')
            .select('tempo_pausa_total_seg')
            .eq('id', sessaoId)
            .single()).data?.tempo_pausa_total_seg || 0
        ) + Math.floor(tempoParadoMs / 1000),
      })
      .eq('id', sessaoId);
  }
}
```

- [ ] **Step 2: Compilar**

```bash
cd backend && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/infraestrutura/supabase-sessao-repository.ts && git commit -m "feat(infra): adicionar persistência de pausa no repository"
```

---

## Task 6: Criar Endpoints PATCH /sessao/pausar e /retomar

**Files:**
- Modify: `backend/src/http/sessao.ts`

- [ ] **Step 1: Adicionar rotas no Express**

Abra `backend/src/http/sessao.ts` e adicione:

```ts
import { Router, Request, Response, NextFunction } from 'express';
import { container } from '../infraestrutura/container';
import { GerenciadorDeSessao } from '../aplicacao/gerenciador-de-sessao';

const router = Router();
const gerenciador = container.resolve(GerenciadorDeSessao);

router.patch('/sessao/pausar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    gerenciador.pausar();
    const snapshot = gerenciador.snapshot();
    res.json({
      estado: snapshot.estado,
      estadoAnterior: snapshot.estadoAnterior,
      terminaEm: new Date(Date.now() + 1000 * 60).toISOString(), // placeholder
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/sessao/retomar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    gerenciador.retomar();
    const snapshot = gerenciador.snapshot();
    res.json({
      estado: snapshot.estado,
      estadoAnterior: snapshot.estadoAnterior,
      terminaEm: new Date(Date.now() + 1000 * 60).toISOString(), // placeholder
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sessoes/contextos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const contextos = await gerenciador.obterContextosRecentes(limit);
    res.json({ contextos });
  } catch (error) {
    next(error);
  }
});

export default router;
```

- [ ] **Step 2: Testar rotas com curl/Insomnia**

```bash
curl -X PATCH http://localhost:3333/sessao/pausar
curl -X PATCH http://localhost:3333/sessao/retomar
curl -X GET http://localhost:3333/sessoes/contextos?limit=5
```

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/http/sessao.ts && git commit -m "feat(http): endpoints PATCH pausar/retomar e GET contextos"
```

---

## Task 7: Atualizar GET /sessao com Novo Snapshot

**Files:**
- Modify: `backend/src/http/sessao.ts`

- [ ] **Step 1: Expandir response do GET /sessao**

Encontre a rota `GET /sessao` e atualize:

```ts
router.get('/sessao', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = gerenciador.snapshot();
    res.json({
      estado: snapshot.estado,
      estadoAnterior: snapshot.estadoAnterior,
      ciclosCompletados: snapshot.ciclosCompletados,
      contexto: snapshot.contexto,
      terminaEm: new Date(Date.now() + 1000 * 60).toISOString(),
      pausado: snapshot.estado === 'pausado',
    });
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 2: Testar**

```bash
curl -X GET http://localhost:3333/sessao
```

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/http/sessao.ts && git commit -m "feat(http): expandir GET /sessao com estadoAnterior e pausado"
```

---

## Task 8: Implementar obterContextosRecentes no Gerenciador

**Files:**
- Modify: `backend/src/aplicacao/gerenciador-de-sessao.ts`
- Modify: `backend/src/infraestrutura/supabase-sessao-repository.ts`

- [ ] **Step 1: Adicionar método ao repository**

Abra `backend/src/infraestrutura/supabase-sessao-repository.ts`:

```ts
async obterContextosRecentes(limit: number = 10): Promise<string[]> {
  const { data, error } = await this.client
    .from('sessoes')
    .select('contexto')
    .order('iniciada_em', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Remove duplicatas e nulls, mantém ordem
  const unicos = Array.from(new Set(data?.map(s => s.contexto).filter(Boolean))) as string[];
  return unicos.slice(0, limit);
}
```

- [ ] **Step 2: Adicionar método no gerenciador**

Abra `backend/src/aplicacao/gerenciador-de-sessao.ts`:

```ts
async obterContextosRecentes(limit: number = 10): Promise<string[]> {
  return this.repository.obterContextosRecentes(limit);
}
```

- [ ] **Step 3: Testar**

```bash
curl -X GET http://localhost:3333/sessoes/contextos?limit=5
```

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/aplicacao/gerenciador-de-sessao.ts src/infraestrutura/supabase-sessao-repository.ts && git commit -m "feat(app): obterContextosRecentes para autocomplete"
```

---

## Task 9: Frontend — Criar Componente ContextoInput com Autocomplete

**Files:**
- Create: `frontend/src/components/contexto-input.tsx`
- Modify: `frontend/src/services/sessao-api.ts`

- [ ] **Step 1: Criar hook para buscar contextos**

Abra `frontend/src/services/sessao-api.ts` e adicione:

```ts
export async function obterContextosRecentes(limit: number = 10): Promise<string[]> {
  const { data } = await api.get('/sessoes/contextos', { params: { limit } });
  return data.contextos;
}
```

- [ ] **Step 2: Criar componente ContextoInput**

Crie `frontend/src/components/contexto-input.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { obterContextosRecentes } from '@/services/sessao-api';

interface ContextoInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ContextoInput({ value, onChange, disabled }: ContextoInputProps) {
  const [contextos, setContextos] = useState<string[]>([]);

  useEffect(() => {
    obterContextosRecentes(10).then(setContextos).catch(console.error);
  }, []);

  return (
    <div className="contexto-input">
      <input
        type="text"
        list="contextos-lista"
        placeholder="No que você vai focar?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input"
      />
      <datalist id="contextos-lista">
        {contextos.map((ctx) => (
          <option key={ctx} value={ctx} />
        ))}
      </datalist>
    </div>
  );
}
```

- [ ] **Step 3: Testar componente (visual check)**

Integre no form e valide que autocomplete funciona.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/contexto-input.tsx src/services/sessao-api.ts && git commit -m "feat(ui): componente ContextoInput com autocomplete de histórico"
```

---

## Task 10: Frontend — Criar Hook use-sessao-notifications

**Files:**
- Create: `frontend/src/hooks/use-sessao-notifications.ts`

- [ ] **Step 1: Criar hook de notificações**

Crie `frontend/src/hooks/use-sessao-notifications.ts`:

```ts
import { useEffect } from 'react';
import { EstadoSessao } from '@/types/sessao';

const mensagens: Record<EstadoSessao, { titulo: string; corpo: string }> = {
  idle: { titulo: 'Sessão finalizada', corpo: 'Volte ao trabalho quando estiver pronto' },
  focando: { titulo: 'Foco começou!', corpo: 'Concentre-se nos próximos 25 minutos' },
  pausa_curta: { titulo: 'Pausa curta!', corpo: 'Aproveite 5 minutos de descanso' },
  pausa_longa: { titulo: 'Pausa longa!', corpo: 'Descanse por 15 minutos' },
  pausado: { titulo: 'Sessão pausada', corpo: 'Retome quando estiver pronto' },
};

export function useSessaoNotifications(estado: EstadoSessao | null) {
  useEffect(() => {
    if (!estado || !('Notification' in window)) return;

    // Pedir permissão se não tem
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Disparar notificação
    if (Notification.permission === 'granted') {
      const msg = mensagens[estado];
      new Notification(msg.titulo, {
        body: msg.corpo,
        badge: '🎵',
        icon: '/logo.png',
      });
    }
  }, [estado]);
}
```

- [ ] **Step 2: Integrar no componente principal**

Abra a página principal e adicione:

```tsx
import { useSessaoNotifications } from '@/hooks/use-sessao-notifications';

export default function Home() {
  const [estado, setEstado] = useState<EstadoSessao | null>(null);
  
  useSessaoNotifications(estado);
  
  // ... resto do componente
}
```

- [ ] **Step 3: Testar (manual)**

Altere o estado da sessão e verifique se notificação aparece no navegador.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/hooks/use-sessao-notifications.ts && git commit -m "feat(ui): hook de notificações do navegador ao trocar estado"
```

---

## Task 11: Frontend — Criar Hook use-player-info para Vinil

**Files:**
- Create: `frontend/src/hooks/use-player-info.ts`
- Create: `frontend/src/components/vinil-display.tsx`

- [ ] **Step 1: Criar hook que polling GET /me/player**

Crie `frontend/src/hooks/use-player-info.ts`:

```ts
import { useEffect, useState } from 'react';
import { api } from '@/services/sessao-api';

interface PlayerInfo {
  nomeMusica: string;
  artista: string;
  imagemUrl?: string;
  progresso: number;
  duracao: number;
}

export function usePlayerInfo(intervaloMs: number = 5000) {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const buscarPlayer = async () => {
      try {
        const { data } = await api.get('/me/player');
        if (data?.item) {
          setPlayerInfo({
            nomeMusica: data.item.name,
            artista: data.item.artists?.[0]?.name || 'Desconhecido',
            imagemUrl: data.item.album?.images?.[0]?.url,
            progresso: data.progress_ms || 0,
            duracao: data.item.duration_ms || 0,
          });
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao buscar player');
      }
    };

    buscarPlayer();
    const interval = setInterval(buscarPlayer, intervaloMs);
    return () => clearInterval(interval);
  }, [intervaloMs]);

  return { playerInfo, erro };
}
```

- [ ] **Step 2: Criar componente VinilDisplay**

Crie `frontend/src/components/vinil-display.tsx`:

```tsx
'use client';

import { usePlayerInfo } from '@/hooks/use-player-info';
import Image from 'next/image';
import './vinil-display.css';

export function VinilDisplay() {
  const { playerInfo, erro } = usePlayerInfo(5000);

  if (erro) {
    return <div className="vinil vinil--erro">Erro ao carregar player</div>;
  }

  if (!playerInfo) {
    return <div className="vinil vinil--vazio">Nenhuma música tocando</div>;
  }

  return (
    <div className="vinil">
      {playerInfo.imagemUrl && (
        <Image
          src={playerInfo.imagemUrl}
          alt={playerInfo.nomeMusica}
          width={200}
          height={200}
          className="vinil__disco"
        />
      )}
      <div className="vinil__info">
        <p className="vinil__musica">🎵 {playerInfo.nomeMusica}</p>
        <p className="vinil__artista">{playerInfo.artista}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar CSS (vinil-display.css)**

Crie `frontend/src/components/vinil-display.css`:

```css
.vinil {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
  border-radius: 12px;
}

.vinil__disco {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  animation: spin 4s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.vinil__info {
  text-align: center;
  color: #fff;
}

.vinil__musica {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0;
}

.vinil__artista {
  font-size: 0.9rem;
  color: #aaa;
  margin: 0.5rem 0 0 0;
}

.vinil--vazio,
.vinil--erro {
  color: #999;
  text-align: center;
  padding: 2rem;
}
```

- [ ] **Step 4: Integrar no componente principal**

```tsx
import { VinilDisplay } from '@/components/vinil-display';

export default function Home() {
  return (
    <div>
      <VinilDisplay />
      {/* resto do layout */}
    </div>
  );
}
```

- [ ] **Step 5: Testar (visual)**

Valide que o vinil exibe e anima corretamente.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/hooks/use-player-info.ts src/components/vinil-display.tsx src/components/vinil-display.css && git commit -m "feat(ui): vinil com faixa atual via polling /me/player"
```

---

## Task 12: Frontend — Adicionar Botões Pausar/Retomar

**Files:**
- Modify: `frontend/src/pages/index.tsx`
- Modify: `frontend/src/services/sessao-api.ts`

- [ ] **Step 1: Adicionar métodos pausar/retomar ao api client**

Abra `frontend/src/services/sessao-api.ts`:

```ts
export async function pausarSessao() {
  const { data } = await api.patch('/sessao/pausar');
  return data;
}

export async function retomarSessao() {
  const { data } = await api.patch('/sessao/retomar');
  return data;
}
```

- [ ] **Step 2: Adicionar botões à UI**

Abra `frontend/src/pages/index.tsx` e adicione aos controles:

```tsx
import { pausarSessao, retomarSessao } from '@/services/sessao-api';

export default function Home() {
  const [estado, setEstado] = useState<string>('idle');
  const [carregando, setCarregando] = useState(false);

  const handlePausar = async () => {
    setCarregando(true);
    try {
      const result = await pausarSessao();
      setEstado(result.estado);
    } finally {
      setCarregando(false);
    }
  };

  const handleRetomar = async () => {
    setCarregando(true);
    try {
      const result = await retomarSessao();
      setEstado(result.estado);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div>
      {estado !== 'pausado' && estado !== 'idle' && (
        <button onClick={handlePausar} disabled={carregando}>
          ⏸ Pausar
        </button>
      )}
      {estado === 'pausado' && (
        <button onClick={handleRetomar} disabled={carregando}>
          ▶ Retomar
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Testar botões (manual)**

Inicie uma sessão, pause, retome.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/pages/index.tsx src/services/sessao-api.ts && git commit -m "feat(ui): botões pausar/retomar com feedback de estado"
```

---

## Task 13: Testes de Integração — Backend

**Files:**
- Create: `backend/src/http/sessao.integration.test.ts`

- [ ] **Step 1: Escrever testes de integração**

Crie `backend/src/http/sessao.integration.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { app } from '../app';
import request from 'supertest';

describe('Sessão — Integração', () => {
  beforeEach(async () => {
    // Setup: inicia servidor e gerenciador
  });

  afterEach(async () => {
    // Cleanup
  });

  it('POST /sessao inicia e PATCH /pausar pausa corretamente', async () => {
    const res1 = await request(app)
      .post('/sessao')
      .send({ contexto: 'Teste', playlistFoco: 'uri1', playlistPausa: 'uri2' });
    
    expect(res1.status).toBe(200);
    expect(res1.body.estado).toBe('focando');

    const res2 = await request(app).patch('/sessao/pausar');
    
    expect(res2.status).toBe(200);
    expect(res2.body.estado).toBe('pausado');
    expect(res2.body.estadoAnterior).toBe('focando');
  });

  it('PATCH /retomar volta ao estado anterior', async () => {
    await request(app)
      .post('/sessao')
      .send({ contexto: 'Teste', playlistFoco: 'uri1', playlistPausa: 'uri2' });
    
    await request(app).patch('/sessao/pausar');
    
    const res = await request(app).patch('/sessao/retomar');
    
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('focando');
    expect(res.body.estadoAnterior).toBeUndefined();
  });

  it('GET /sessoes/contextos retorna histórico', async () => {
    await request(app)
      .post('/sessao')
      .send({ contexto: 'Contexto 1', playlistFoco: 'uri1', playlistPausa: 'uri2' });
    
    await request(app).post('/sessao/finalizar');

    await request(app)
      .post('/sessao')
      .send({ contexto: 'Contexto 2', playlistFoco: 'uri1', playlistPausa: 'uri2' });
    
    const res = await request(app).get('/sessoes/contextos?limit=10');
    
    expect(res.status).toBe(200);
    expect(res.body.contextos).toContain('Contexto 1');
    expect(res.body.contextos).toContain('Contexto 2');
  });
});
```

- [ ] **Step 2: Rodar testes de integração**

```bash
cd backend && npm test -- src/http/sessao.integration.test.ts
```

Esperado: verdes.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/http/sessao.integration.test.ts && git commit -m "test(integration): testes end-to-end de pausa/retomada e contextos"
```

---

## Task 14: Validação Manual com Spotify (Play/Pause)

**Files:**
- Manual testing

- [ ] **Step 1: Inicie uma sessão de verdade**

1. Acesse `http://localhost:3000`
2. Autentique com Spotify
3. Escolha contexto e playlist
4. Clique "Iniciar"

Valide: música começa a tocar no Spotify.

- [ ] **Step 2: Clique "Pausar"**

Valide: música pausa no Spotify (PUT /me/player/pause foi chamado).

- [ ] **Step 3: Clique "Retomar"**

Valide: música retoma no Spotify (PUT /me/player/play foi chamado).

- [ ] **Step 4: Verifique vinil**

Valide: componente VinilDisplay mostra música correta.

- [ ] **Step 5: Verifique notificações**

Valide: notificações disparam ao trocar de estado.

- [ ] **Step 6: Verifique autocomplete**

Valide: histórico de contextos aparece no datalist.

---

## Task 15: Testar Duração Final com Tempo Parado Descontado

**Files:**
- Modify: `backend/src/aplicacao/gerenciador-de-sessao.ts`

- [ ] **Step 1: Garantir que finalizar() desconta tempo pausado**

Abra `backend/src/aplicacao/gerenciador-de-sessao.ts` e verifique que `finalizar()` usa `tempo_pausa_total_seg`:

```ts
finalizar(): Sessao {
  const agora = Date.now();
  const duracaoBrutaMs = agora - this.iniciada_em;
  const duracaoLiquidaMs = duracaoBrutaMs - (this.tempoParaTotal * 1000);
  
  return {
    id: this.sessao.id,
    estado: 'idle',
    contexto: this.sessao.contexto,
    ciclosCompletados: this.sessao.ciclosCompletados,
    duracaoTotalSeg: Math.round(duracaoLiquidaMs / 1000),
    iniciadaEm: this.iniciada_em,
    finalizadaEm: agora,
    // ...
  };
}
```

- [ ] **Step 2: Testar via teste de integração**

```bash
cd backend && npm test -- src/aplicacao/gerenciador-de-sessao.test.ts -t "finaliza com duração correta"
```

Esperado: verde.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/aplicacao/gerenciador-de-sessao.ts && git commit -m "fix(app): finalizar descontar tempo pausado da duração total"
```

---

## Task 16: Verificação Final — Compilação, Testes, Execução

**Files:**
- All (verification only)

- [ ] **Step 1: Compilar backend sem erros**

```bash
cd backend && npm run build
```

Esperado: zero erros.

- [ ] **Step 2: Rodar todos os testes do backend**

```bash
cd backend && npm test
```

Esperado: tudo verde.

- [ ] **Step 3: Compilar frontend**

```bash
cd frontend && npm run build
```

Esperado: zero erros.

- [ ] **Step 4: Rodar servidor localmente**

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

- [ ] **Step 5: Verificar funcionalidades em navegador**

1. Inicie sessão
2. Pause → verifique estado na UI
3. Retome → verifique estado na UI
4. Veja contexto no autocomplete
5. Veja vinil girando
6. Veja notificações

Esperado: tudo funcionando.

- [ ] **Step 6: Commit final de verificação (se houver ajustes)**

```bash
git add . && git commit -m "chore: verificação final de Fase 2 — tudo compilando e testando"
```

- [ ] **Step 7: Criar tag de release**

```bash
git tag -a v2.0.0-fase-2 -m "Fase 2: pausa/retomada, histórico, vinil, notificações"
git push origin v2.0.0-fase-2
```

---

## Definição de Pronto (DoD) — Fase 2

- ✓ Máquina de estados refatorada com novo estado `pausado`
- ✓ GerenciadorDeSessao com `pausar()` e `retomar()` 
- ✓ Testes de domínio e aplicação verdes (relógio falso)
- ✓ Schema SQL aplicado (3 colunas novas)
- ✓ 4 endpoints funcionando: pausar, retomar, contextos, snapshot expandido
- ✓ Frontend integrado (autocomplete, vinil, notificações, botões)
- ✓ Testes de integração passando
- ✓ Validação manual com Spotify OK
- ✓ Nenhum erro de compilação
- ✓ Branch pronta pra merge em `main`

---

## Próximos Passos

Após merge de Fase 2, começar Fase 3 (médias):
- Perfis de contexto (novos pares playlist por tipo de tarefa)
- Dashboard de estatísticas
- Fade de volume
- Detecção de pausa esticada
