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
