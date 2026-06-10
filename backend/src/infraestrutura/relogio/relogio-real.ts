import type { RelogioPort } from '../../aplicacao/portas/relogio-port';

export class RelogioReal implements RelogioPort {
  agora(): Date {
    return new Date();
  }

  agendar(ms: number, callback: () => void): () => void {
    const id = setTimeout(callback, ms);
    return () => clearTimeout(id);
  }
}
