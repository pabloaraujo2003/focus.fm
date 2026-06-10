export interface PlaylistMusica {
  readonly id: string;
  readonly nome: string;
  readonly uri: string;
  readonly totalFaixas: number;
  readonly imagemUrl: string | null;
}

// Padrão Provider: a aplicação depende desta interface; SpotifyProvider
// (fase 2) é um detalhe. Trocar de serviço de música = nova classe, e
// nada nas camadas internas muda.
export interface MusicProvider {
  listarPlaylists(): Promise<PlaylistMusica[]>;
  tocarPlaylist(uri: string): Promise<void>;
  pausar(): Promise<void>;
}
