import { ValidationError } from '../erros/validation-error';

export interface DadosNovaSessao {
  contexto: string;
  iniciadaEm: Date;
  playlistFoco: string;
  playlistPausa: string;
}

export class Sessao {
  private finalizadaEmInterno: Date | null = null;
  private ciclosInterno = 0;
  private tempoParadoTotalMs = 0;

  private constructor(
    readonly id: string,
    readonly contexto: string,
    readonly iniciadaEm: Date,
    readonly playlistFoco: string,
    readonly playlistPausa: string,
  ) {}

  // Factory estática + construtor privado: impossível criar uma Sessao
  // que não passou pela validação.
  static iniciar(dados: DadosNovaSessao): Sessao {
    const contexto = dados.contexto.trim();
    if (contexto.length === 0) {
      throw new ValidationError('o contexto da sessão não pode ser vazio');
    }
    return new Sessao(crypto.randomUUID(), contexto, dados.iniciadaEm, dados.playlistFoco, dados.playlistPausa);
  }

  finalizarComPausa(em: Date, ciclosCompletados: number, tempoParadoMs: number): void {
    if (this.finalizadaEmInterno !== null) {
      throw new ValidationError('a sessão já foi finalizada');
    }
    if (em.getTime() < this.iniciadaEm.getTime()) {
      throw new ValidationError('a finalização não pode ser anterior ao início');
    }
    this.finalizadaEmInterno = em;
    this.ciclosInterno = ciclosCompletados;
    this.tempoParadoTotalMs = tempoParadoMs;
  }

  finalizar(em: Date, ciclosCompletados: number): void {
    this.finalizarComPausa(em, ciclosCompletados, 0);
  }

  get finalizadaEm(): Date | null {
    return this.finalizadaEmInterno;
  }

  get ciclosCompletados(): number {
    return this.ciclosInterno;
  }

  get duracaoTotalSeg(): number | null {
    if (this.finalizadaEmInterno === null) return null;
    const duracaoBrutaMs = this.finalizadaEmInterno.getTime() - this.iniciadaEm.getTime();
    const duracaoLiquidaMs = duracaoBrutaMs - this.tempoParadoTotalMs;
    return Math.round(duracaoLiquidaMs / 1000);
  }
}
