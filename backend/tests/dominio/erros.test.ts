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
