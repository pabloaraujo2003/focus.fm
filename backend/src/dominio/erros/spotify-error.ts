import { AppError } from './app-error';
import type { CodigoErro } from './app-error';

export class SpotifyError extends AppError {
  readonly code: CodigoErro = 'SPOTIFY';

  constructor(message: string, readonly statusHttp?: number) {
    super(message);
  }
}
