// Padrão Provider: a aplicação depende desta interface; SpotifyProvider
// (fase 2) é um detalhe. Trocar de serviço de música = nova classe, e
// nada nas camadas internas muda.
export interface MusicProvider {
  tocarPlaylist(uri: string): Promise<void>;
  pausar(): Promise<void>;
}
