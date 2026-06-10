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
