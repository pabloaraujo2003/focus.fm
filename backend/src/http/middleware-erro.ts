import type { NextFunction, Request, Response } from 'express';
import { AppError, type CodigoErro } from '../dominio/erros/app-error';

function statusDoCodigo(code: CodigoErro): number {
  switch (code) {
    case 'VALIDATION':
      return 400;
    case 'TRANSICAO_INVALIDA':
      return 409;
    case 'NENHUM_DEVICE_ATIVO':
      return 409;
    case 'TOKEN_EXPIRADO':
      return 401;
    case 'SPOTIFY':
      return 502;
    default:
      return nunca(code);
  }
}

function nunca(x: never): never {
  throw new Error(`codigo de erro nao mapeado: ${String(x)}`);
}

export function middlewareErro(erro: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (erro instanceof AppError) {
    res.status(statusDoCodigo(erro.code)).json({ code: erro.code, message: erro.message });
    return;
  }

  console.error('[pomodoro] erro inesperado:', erro);
  res.status(500).json({ code: 'INTERNO', message: 'erro interno' });
}
