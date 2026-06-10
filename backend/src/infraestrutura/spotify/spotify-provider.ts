import { isAxiosError, type AxiosInstance } from 'axios';
import type { MusicProvider } from '../../aplicacao/portas/music-provider';
import type { RelogioPort } from '../../aplicacao/portas/relogio-port';
import { NenhumDeviceAtivoError } from '../../dominio/erros/nenhum-device-ativo-error';
import { SpotifyError } from '../../dominio/erros/spotify-error';
import type { SpotifyAuth } from './spotify-auth';

const BASE = 'https://api.spotify.com/v1';
const MAX_TENTATIVAS = 3;

export class SpotifyProvider implements MusicProvider {
  constructor(
    private readonly http: AxiosInstance,
    private readonly auth: SpotifyAuth,
    private readonly relogio: RelogioPort,
  ) {}

  async tocarPlaylist(uri: string): Promise<void> {
    await this.put('/me/player/play', { context_uri: uri });
  }

  async pausar(): Promise<void> {
    await this.put('/me/player/pause', undefined);
  }

  private async put(rota: string, corpo: unknown): Promise<void> {
    for (let tentativa = 1; ; tentativa += 1) {
      const token = await this.auth.tokenDeAcesso();
      try {
        await this.http.put(`${BASE}${rota}`, corpo, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return;
      } catch (erro) {
        await this.tratarErro(erro, tentativa); // lança ou espera p/ retry
      }
    }
  }

  // Devolve apenas quando o retry é permitido; caso contrário lança.
  private async tratarErro(erro: unknown, tentativa: number): Promise<void> {
    if (!isAxiosError(erro) || erro.response === undefined) {
      throw new SpotifyError(`falha de rede ao chamar o Spotify: ${String(erro)}`);
    }
    const { status, headers, data } = erro.response;
    const mensagem = (data as { error?: { message?: string } })?.error?.message ?? erro.message;

    if (status === 404) throw new NenhumDeviceAtivoError();
    if (status === 403) {
      throw new SpotifyError(`Spotify recusou o comando (Premium é obrigatório p/ playback): ${mensagem}`, 403);
    }
    if (status === 429 && tentativa < MAX_TENTATIVAS) {
      const retryAfterSeg = Number((headers as Record<string, string>)['retry-after']);
      const esperaMs = Number.isFinite(retryAfterSeg)
        ? retryAfterSeg * 1000
        : 2 ** (tentativa - 1) * 1000; // fallback exponencial: 1s, 2s
      await this.esperar(esperaMs);
      return;
    }
    if (status === 429) {
      throw new SpotifyError('Spotify com rate limit persistente; tente de novo em instantes', 429);
    }
    throw new SpotifyError(`erro ${status} do Spotify: ${mensagem}`, status);
  }

  // Espera via RelogioPort: nos testes, o RelogioFake avança o tempo na hora.
  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => this.relogio.agendar(ms, resolve));
  }
}
