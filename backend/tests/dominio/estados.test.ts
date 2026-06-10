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
