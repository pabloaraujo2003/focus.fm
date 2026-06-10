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
