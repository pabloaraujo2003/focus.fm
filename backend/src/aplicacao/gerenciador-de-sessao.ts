import type { ConfiguracaoResolvida } from '../dominio/config/configuracao';
import { Sessao } from '../dominio/entidades/sessao';
import type { EstadoSessao } from '../dominio/maquina-estados/estados';
import {
  SNAPSHOT_INICIAL,
  transicionar,
  type SnapshotSessao,
} from '../dominio/maquina-estados/maquina';
import type { MusicProvider } from './portas/music-provider';
import type { RelogioPort } from './portas/relogio-port';
import type { SessaoRepository } from './portas/sessao-repository';

const MS_POR_MIN = 60_000;

export interface PlaylistsConfiguradas {
  readonly foco: string;
  readonly pausa: string;
}

export interface StatusSessao {
  readonly snapshot: SnapshotSessao;
  readonly terminaEm: Date | null;
}

// Orquestrador: o domínio decide PARA ONDE ir (reducer); esta classe
// decide O QUE FAZER ao chegar lá (tocar música, agendar timer, gravar).
export class GerenciadorDeSessao {
  private snapshot: SnapshotSessao = SNAPSHOT_INICIAL;
  private sessaoAtual: Sessao | null = null;
  private cancelarTimer: (() => void) | null = null;
  private terminaEm: Date | null = null;

  constructor(
    private readonly config: ConfiguracaoResolvida,
    private readonly playlists: PlaylistsConfiguradas,
    private readonly relogio: RelogioPort,
    private readonly music: MusicProvider,
    private readonly repositorio: SessaoRepository,
  ) {}

  async iniciar(contexto: string): Promise<void> {
    // O reducer valida a transição (idle -> focando) e o contexto.
    this.snapshot = transicionar(this.snapshot, { tipo: 'INICIAR', contexto }, this.config);
    this.sessaoAtual = Sessao.iniciar({
      contexto: this.snapshot.contexto ?? contexto,
      iniciadaEm: this.relogio.agora(),
      playlistFoco: this.playlists.foco,
      playlistPausa: this.playlists.pausa,
    });
    await this.entrarNoEstado();
  }

  async finalizar(): Promise<Sessao> {
    const ciclos = this.snapshot.ciclosCompletados;
    // Valida primeiro (lança em idle), só depois mexe em timer/música.
    this.snapshot = transicionar(this.snapshot, { tipo: 'FINALIZAR' }, this.config);
    const sessao = this.sessaoAtual;
    if (sessao === null) {
      // Inalcançável se snapshot e sessaoAtual andarem juntos; guarda de runtime.
      throw new Error('estado inconsistente: sessão ativa sem entidade Sessao');
    }
    this.pararTimer();
    sessao.finalizar(this.relogio.agora(), ciclos);
    await this.repositorio.salvar(sessao);
    await this.music.pausar();
    this.sessaoAtual = null;
    this.terminaEm = null;
    return sessao;
  }

  obterStatus(): StatusSessao {
    return { snapshot: this.snapshot, terminaEm: this.terminaEm };
  }

  private async entrarNoEstado(): Promise<void> {
    const { duracaoMin, playlist } = this.parametrosDoEstado(this.snapshot.estado);
    await this.music.tocarPlaylist(playlist);
    const ms = duracaoMin * MS_POR_MIN;
    this.terminaEm = new Date(this.relogio.agora().getTime() + ms);
    this.pararTimer();
    this.cancelarTimer = this.relogio.agendar(ms, () => {
      void this.aoCompletarPeriodo();
    });
  }

  private async aoCompletarPeriodo(): Promise<void> {
    try {
      const tipo = this.snapshot.estado === 'focando' ? 'COMPLETAR_FOCO' : 'COMPLETAR_PAUSA';
      this.snapshot = transicionar(this.snapshot, { tipo }, this.config);
      await this.entrarNoEstado();
    } catch (erro) {
      // Falha de música não pode matar o timer silenciosamente; na fase 2
      // isso vira log estruturado + status de erro consultável.
      console.error('[pomodoro] falha ao completar período:', erro);
    }
  }

  private parametrosDoEstado(estado: EstadoSessao): { duracaoMin: number; playlist: string } {
    switch (estado) {
      case 'focando':
        return { duracaoMin: this.config.duracaoFocoMin, playlist: this.playlists.foco };
      case 'pausa_curta':
        return { duracaoMin: this.config.duracaoPausaCurtaMin, playlist: this.playlists.pausa };
      case 'pausa_longa':
        return { duracaoMin: this.config.duracaoPausaLongaMin, playlist: this.playlists.pausa };
      case 'idle':
        throw new Error('estado idle não tem período agendável');
    }
  }

  private pararTimer(): void {
    this.cancelarTimer?.();
    this.cancelarTimer = null;
  }
}
