import { AppError } from './app-error';

export class NenhumDeviceAtivoError extends AppError {
  readonly code = 'NENHUM_DEVICE_ATIVO';

  constructor() {
    super('nenhum device Spotify ativo — abra o Spotify no desktop ou celular e dê play em qualquer música uma vez');
  }
}
