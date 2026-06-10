import type { MusicProvider, PlaylistMusica } from '../../src/aplicacao/portas/music-provider';

// Spy manual: registra as chamadas para os testes inspecionarem.
export class MusicProviderFake implements MusicProvider {
  readonly chamadas: string[] = [];
  falharAoTocar = false;
  readonly playlists: PlaylistMusica[] = [
    {
      id: 'FOCO',
      nome: 'Foco',
      uri: 'spotify:playlist:FOCO',
      totalFaixas: 10,
      imagemUrl: null,
    },
    {
      id: 'PAUSA',
      nome: 'Pausa',
      uri: 'spotify:playlist:PAUSA',
      totalFaixas: 5,
      imagemUrl: null,
    },
  ];

  async listarPlaylists(): Promise<PlaylistMusica[]> {
    return this.playlists;
  }

  async tocarPlaylist(uri: string): Promise<void> {
    if (this.falharAoTocar) {
      throw new Error('falha simulada ao tocar playlist');
    }
    this.chamadas.push(`tocar:${uri}`);
  }

  async pausar(): Promise<void> {
    this.chamadas.push('pausar');
  }
}
