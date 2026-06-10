import type { RelogioPort } from '../../src/aplicacao/portas/relogio-port';

interface Agendamento {
  dispararEm: number;
  callback: () => void;
  cancelado: boolean;
  disparado: boolean;
}

// Tempo controlado: uma sessão pomodoro de 2h roda em milissegundos.
export class RelogioFake implements RelogioPort {
  private agoraMs = 0;
  private agendamentos: Agendamento[] = [];

  agora(): Date {
    return new Date(this.agoraMs);
  }

  agendar(ms: number, callback: () => void): () => void {
    const agendamento: Agendamento = {
      dispararEm: this.agoraMs + ms,
      callback,
      cancelado: false,
      disparado: false,
    };
    this.agendamentos.push(agendamento);
    return () => {
      agendamento.cancelado = true;
    };
  }

  // async: depois de cada disparo, cede o event loop para que callbacks
  // async (ex.: tocarPlaylist aguardada pelo gerenciador) se resolvam
  // antes do próximo disparo — espelha o comportamento real do setTimeout.
  async avancar(ms: number): Promise<void> {
    const destino = this.agoraMs + ms;
    let proximo = this.proximoAte(destino);
    while (proximo !== undefined) {
      this.agoraMs = proximo.dispararEm;
      proximo.disparado = true;
      proximo.callback();
      await new Promise((resolve) => setImmediate(resolve));
      proximo = this.proximoAte(destino);
    }
    this.agoraMs = destino;
  }

  private proximoAte(limiteMs: number): Agendamento | undefined {
    return this.agendamentos
      .filter((a) => !a.cancelado && !a.disparado && a.dispararEm <= limiteMs)
      .sort((a, b) => a.dispararEm - b.dispararEm)[0];
  }
}
