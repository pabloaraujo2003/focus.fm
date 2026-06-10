import { AppError } from './app-error';

export class TokenExpiradoError extends AppError {
  readonly code = 'TOKEN_EXPIRADO';

  constructor() {
    super('autorização do Spotify ausente ou expirada — acesse /auth/spotify para autorizar');
  }
}
