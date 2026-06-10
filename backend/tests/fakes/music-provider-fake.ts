import type { MusicProvider } from '../../src/aplicacao/portas/music-provider';

// Spy manual: registra as chamadas para os testes inspecionarem.
export class MusicProviderFake implements MusicProvider {
  readonly chamadas: string[] = [];

  async tocarPlaylist(uri: string): Promise<void> {
    this.chamadas.push(`tocar:${uri}`);
  }

  async pausar(): Promise<void> {
    this.chamadas.push('pausar');
  }
}
