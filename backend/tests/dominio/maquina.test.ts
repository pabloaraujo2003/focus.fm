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
