# Spec — pomodoro-musical Fase 2: Features Básicas

**Data:** 2026-06-10 · **Status:** em review

## Resumo

Expansão do MVP com 4 features básicas que consolidam a máquina de estados e preparam o caminho pra features futuras:

1. **Pausa/retomada de sessão** — novo evento PAUSAR/RETOMAR na máquina de estados
2. **Histórico de contextos** — endpoint GET /sessoes/contextos e autocomplete no front
3. **Vinil com faixa atual** — exibir música/artista tocando via GET /me/player
4. **Notificações do navegador** — alertar ao trocar de estado

Usando a **Abordagem C**: máquina de estados solidificada primeiro (TDD), depois features de UI.

## Escopo

### Fase 2 — O que entra

- ✓ Novo estado `pausado` na máquina de estados com transições bidirecionais
- ✓ Eventos PAUSAR/RETOMAR com memória de estado anterior
- ✓ Persistência (colunas `estado_anterior`, `pausado_em` na tabela sessões)
- ✓ Gerenciador com pausa de relógio (pausado_em e retomada com tempo correto)
- ✓ TDD para máquina + gerenciador (relógio falso)
- ✓ Endpoint GET /sessoes/contextos (lista últimos N contextos únicos)
- ✓ Endpoint PATCH /sessao/pausar e PATCH /sessao/retomar
- ✓ Frontend: integração com novos endpoints, autocomplete, vinil, notificações (Notification API)

### Fora do escopo

- Dashboard de stats (Fase 3)
- Perfis de contexto por tarefa (Fase 3)
- Fade de volume (Fase 3)
- Detecção de pausa esticada (Fase 3)

## Máquina de Estados — Definição Completa

```ts
type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa' | 'pausado';

const TRANSICOES = {
  idle:         ['focando'],
  focando:      ['pausa_curta', 'pausa_longa', 'pausado', 'idle'],
  pausa_curta:  ['focando', 'pausado', 'idle'],
  pausa_longa:  ['focando', 'pausado', 'idle'],
  pausado:      ['focando', 'pausa_curta', 'pausa_longa', 'idle'],
} as const satisfies Record<EstadoSessao, readonly EstadoSessao[]>;
```

### Eventos (domínio)

```ts
type EventoSessao =
  | { tipo: 'INICIAR'; contexto: string }
  | { tipo: 'COMPLETAR_FOCO' }
  | { tipo: 'COMPLETAR_PAUSA' }
  | { tipo: 'PAUSAR' }
  | { tipo: 'RETOMAR' }
  | { tipo: 'FINALIZAR' };
```

### Snapshot Expandido

```ts
interface SnapshotSessao {
  readonly estado: EstadoSessao;
  readonly estadoAnterior?: EstadoSessao;  // memória pra RETOMAR
  readonly ciclosCompletados: number;
  readonly contexto: string | null;
}
```

### Regras da Máquina

1. **PAUSAR** (de qualquer estado != idle, != pausado):
   - Transiciona para `pausado`
   - Memoriza estado atual em `estadoAnterior`
   - Exemplo: de `focando` → estado vira `pausado`, `estadoAnterior` = `focando`

2. **RETOMAR** (só de pausado):
   - Volta ao `estadoAnterior`
   - Limpa `estadoAnterior`
   - Exemplo: `pausado` com `estadoAnterior=focando` → volta pra `focando`

3. **FINALIZAR** (de qualquer estado):
   - Vai direto pra `idle` (encerra a sessão)
   - Se estava pausado, a duração total descontar o tempo parado

## GerenciadorDeSessao — Lógica de Relógio

O gerenciador é dono do relógio. Quando um evento PAUSAR chega:

```ts
class GerenciadorDeSessao {
  private timerId?: NodeJS.Timeout;
  private durationMs: number;
  private tempoRestanteMs: number;

  pausar(): void {
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = undefined;
    // Memoriza quanto falta pra terminar o período atual
    this.tempoRestanteMs = this.durationMs - (Date.now() - this.inicioDoPeríodo);
    this.sessao = transicionar(this.sessao, { tipo: 'PAUSAR' });
  }

  retomar(): void {
    this.sessao = transicionar(this.sessao, { tipo: 'RETOMAR' });
    // Reinicia relógio com tempo restante (não recomeça do zero)
    this.agendarProximaTransicao(this.tempoRestanteMs);
  }
}
```

**Invariante:** Se você pausa a sessão por 5 minutos e retoma, o timer continua exatamente de onde parou, sem adicionar tempo.

## Persistência — Schema SQL

Adicionar à tabela `sessoes`:

```sql
-- Colunas novas
ALTER TABLE sessoes ADD COLUMN estado_anterior TEXT;
ALTER TABLE sessoes ADD COLUMN pausado_em TIMESTAMPTZ;
ALTER TABLE sessoes ADD COLUMN tempo_pausa_total_seg INTEGER DEFAULT 0;

-- Índices (opcional mas bom pra queries)
CREATE INDEX idx_sessoes_contexto ON sessoes(contexto);
CREATE INDEX idx_sessoes_iniciada_em ON sessoes(iniciada_em DESC);
```

### Semântica

- `estado_anterior`: qual era o estado antes de pausar (null se não pausada agora)
- `pausado_em`: timestamp de quando foi pausado (null se não pausada)
- `tempo_pausa_total_seg`: acumula o tempo total pausado durante a sessão (pra descontar da duração total)

### Lifecycle

- **Ao pausar:** grava `estado_anterior`, `pausado_em` = NOW()
- **Ao retomar:** adiciona (NOW() - pausado_em) em `tempo_pausa_total_seg`, limpa `estado_anterior` e `pausado_em`
- **Ao finalizar:** `tempo_pausa_total_seg` é levado em conta: duração_real = (finalizada_em - iniciada_em) - tempo_pausa_total_seg

## API REST — Mudanças

### Novos Endpoints

```http
PATCH /sessao/pausar
Response 200:
{
  "estado": "pausado",
  "estadoAnterior": "focando",
  "terminaEm": "2026-06-10T15:35:42Z"
}

PATCH /sessao/retomar
Response 200:
{
  "estado": "focando",
  "estadoAnterior": null,
  "terminaEm": "2026-06-10T15:42:10Z"
}

GET /sessoes/contextos?limit=10
Response 200:
{
  "contextos": ["Estudar matemática", "Escrever relatório", "Código TypeScript"]
}
```

### Modificações a Endpoints Existentes

**GET /sessao** agora também retorna:
```json
{
  "estado": "focando",
  "estadoAnterior": null,
  "ciclosCompletados": 2,
  "contexto": "Estudar matemática",
  "terminaEm": "2026-06-10T15:35:42Z",
  "pausado": false
}
```

**POST /sessao/finalizar** agora leva em conta `tempo_pausa_total_seg` na duração final.

## Frontend — Integração

### Contexto no formulário de início

```tsx
<input 
  list="historico-contextos" 
  placeholder="No que você vai focar?"
/>
<datalist id="historico-contextos">
  {/* preenchido de GET /sessoes/contextos */}
</datalist>
```

### Vinil com faixa atual

A cada 5 segundos (ou evento de mudança de playlist), chamar GET /me/player e exibir:
```
🎵 Now Playing: Tua música — Artista X
```

### Notificações

Ao transicionar de estado (focando → pausa_curta, etc), disparar:
```ts
new Notification('Pausa curta!', {
  body: 'Seus 5 minutos de pausa começaram',
  badge: '⏸',
});
```

Requer permissão `Notification.permission === 'granted'` (pedir ao usuário na primeira visita).

### Botões de Controle

Adicionar botão "Pausar" quando `estado !== idle && estado !== pausado`.  
Adicionar botão "Retomar" quando `estado === pausado`.

## Testes — Estratégia

### Domínio (TDD — escrever teste primeiro)

**Arquivo:** `backend/src/dominio/maquina-de-estados.test.ts`

```ts
describe('Máquina de Estados — Fase 2', () => {
  describe('PAUSAR', () => {
    it('transiciona de focando → pausado e memoriza estado anterior', () => {
      const snapshot = { estado: 'focando', ciclosCompletados: 0 };
      const novo = transicionar(snapshot, { tipo: 'PAUSAR' });
      expect(novo.estado).toBe('pausado');
      expect(novo.estadoAnterior).toBe('focando');
    });

    it('rejeita PAUSAR de idle', () => {
      const snapshot = { estado: 'idle' };
      expect(() => transicionar(snapshot, { tipo: 'PAUSAR' }))
        .toThrow(TransicaoInvalidaError);
    });

    it('rejeita PAUSAR de pausado (já está pausado)', () => {
      const snapshot = { estado: 'pausado', estadoAnterior: 'focando' };
      expect(() => transicionar(snapshot, { tipo: 'PAUSAR' }))
        .toThrow(TransicaoInvalidaError);
    });
  });

  describe('RETOMAR', () => {
    it('volta do estado memorizado', () => {
      const snapshot = { estado: 'pausado', estadoAnterior: 'focando' };
      const novo = transicionar(snapshot, { tipo: 'RETOMAR' });
      expect(novo.estado).toBe('focando');
      expect(novo.estadoAnterior).toBeUndefined();
    });

    it('rejeita RETOMAR se não está pausado', () => {
      const snapshot = { estado: 'focando' };
      expect(() => transicionar(snapshot, { tipo: 'RETOMAR' }))
        .toThrow(TransicaoInvalidaError);
    });
  });
});
```

### Aplicação (TDD — relógio falso)

**Arquivo:** `backend/src/aplicacao/gerenciador-de-sessao.test.ts`

```ts
describe('GerenciadorDeSessao — Fase 2', () => {
  describe('Pausa e retomada', () => {
    it('pausa o relógio e memoriza tempo restante', async () => {
      const relogio = new RelogioFalso();
      const gerenciador = new GerenciadorDeSessao(relogio, ...);
      
      gerenciador.iniciar('Estudar', 25 * 60 * 1000);
      relogio.avanca(10 * 60 * 1000); // avança 10 min
      
      gerenciador.pausar();
      const snapshot1 = gerenciador.snapshot();
      expect(snapshot1.estado).toBe('pausado');
      
      relogio.avanca(5 * 60 * 1000); // 5 min se passarem (relógio pausado)
      
      gerenciador.retomar();
      relogio.avanca(15 * 60 * 1000); // avança mais 15 min
      
      // Total: 10 + 15 = 25 min, não 10 + 5 + 15
      expect(relogio.ultimoEventoEm).toBe(25 * 60 * 1000);
    });

    it('finaliza com duração correta descontando pausa', async () => {
      const relogio = new RelogioFalso();
      const gerenciador = new GerenciadorDeSessao(relogio, ...);
      
      gerenciador.iniciar('Estudar', 25 * 60 * 1000);
      relogio.avanca(10 * 60 * 1000);
      gerenciador.pausar();
      relogio.avanca(5 * 60 * 1000); // tempo parado
      gerenciador.retomar();
      relogio.avanca(15 * 60 * 1000);
      
      const sessaoFinalizada = gerenciador.finalizar();
      // duracao_real = (10 + 5 + 15) - 5 = 25 min
      expect(sessaoFinalizada.duracaoTotalSeg).toBe(25 * 60);
    });
  });
});
```

### Integração

**Arquivo:** `backend/src/http/sessao.integration.test.ts`

- ✓ POST /sessao inicia corretamente
- ✓ PATCH /sessao/pausar muda estado
- ✓ PATCH /sessao/retomar volta o estado
- ✓ GET /sessoes/contextos retorna histórico

### Manual (Spotify de verdade)

Passos manuais pra validar com Spotify real:
1. Iniciar sessão
2. Pausar — verificar se `PUT /me/player/pause` é chamado
3. Retomar — verificar se `PUT /me/player/play` é chamado
4. Histórico — confirmar que cada contexto fica salvo no Supabase

## Etapas de Implementação

Cada etapa compila, testa (verde) e vira um commit.

1. **Expandir máquina de estados** — tipos + TRANSICOES + novo estado `pausado`
2. **Implementar reducer com PAUSAR/RETOMAR** — lógica de `estadoAnterior` (TDD)
3. **Testes da máquina de estados** — todos os cases de PAUSAR/RETOMAR passando
4. **Expandir SnapshotSessao** — adicionar `estadoAnterior`
5. **GerenciadorDeSessao com pausa de relógio** — método `pausar()` e `retomar()` (TDD)
6. **Testes do gerenciador com pausa** — relógio falso validando tempo correto
7. **Schema SQL** — adicionar colunas (estado_anterior, pausado_em, tempo_pausa_total_seg)
8. **SessaoRepository** — persistir novo estado ao pausar/retomar
9. **Endpoints PATCH /sessao/pausar e /sessao/retomar** — controllers + validações
10. **GET /sessoes/contextos** — query no Supabase, endpoint
11. **Frontend: integração de contextos** — autocomplete com datalist
12. **Frontend: vinil com GET /me/player** — polling a cada 5 seg
13. **Frontend: Notificações** — disparar ao trocar de estado
14. **Frontend: botões Pausar/Retomar** — controllers e UI
15. **Testes de integração** — backend + frontend (relógio falso)
16. **Validação manual com Spotify** — play/pause chamados corretamente

## Dependências

- Nenhuma nova dependência externa
- Usa os tools já disponíveis (Vitest, axios, Notification API do navegador)

## Definição de Pronto (DoD)

- ✓ Máquina de estados refatorada e testada
- ✓ GerenciadorDeSessao com pausa/retomada funcionando (relógio falso verde)
- ✓ Todos os testes do domínio e aplicação passando
- ✓ Schema SQL versionado e aplicado
- ✓ 4 endpoints funcionando (pausar, retomar, contextos, snapshot expandido)
- ✓ Frontend integrado com novos endpoints
- ✓ Vinil exibindo música atual
- ✓ Notificações disparando ao trocar de estado
- ✓ Autocomplete de contextos funcionando
- ✓ Testes de integração passando
- ✓ Validação manual com Spotify OK
- ✓ Branch pronta pra merge em main

---

## Próximos Passos (Fase 3)

Após Fase 2 estar completa e merged:
- Perfis de contexto (novos pares playlist por tipo de tarefa)
- Dashboard de estatísticas (agregações SQL)
- Fade de volume (PUT /me/player/volume)
- Detecção de pausa esticada (backend checks)
