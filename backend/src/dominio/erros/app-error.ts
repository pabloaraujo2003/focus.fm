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
