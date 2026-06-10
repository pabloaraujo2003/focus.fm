import { isAxiosError, type AxiosInstance } from 'axios';
import type { MusicProvider, PlaylistMusica } from '../../aplicacao/portas/music-provider';
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

  async listarPlaylists(): Promise<PlaylistMusica[]> {
    const playlists: PlaylistMusica[] = [];
    let rota: string | null = '/me/playlists?limit=50';

    while (rota !== null) {
      const pagina = await this.get<RespostaPlaylists>(rota);
      playlists.push(...pagina.items.map(mapearPlaylist));
      rota = proximaRota(pagina.next);
    }

    return playlists;
  }

  async tocarPlaylist(uri: string): Promise<void> {
    await this.put('/me/player/play', { context_uri: uri });
  }

  async pausar(): Promise<void> {
    await this.put('/me/player/pause', undefined);
  }

  private async put(rota: string, corpo: unknown): Promise<void> {
    await this.requisitar('put', rota, corpo);
  }

  private async get<T>(rota: string): Promise<T> {
    return this.requisitar<T>('get', rota, undefined);
  }

  private async requisitar<T = void>(metodo: 'get' | 'put', rota: string, corpo: unknown): Promise<T> {
    for (let tentativa = 1; ; tentativa += 1) {
      const token = await this.auth.tokenDeAcesso();
      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        if (metodo === 'get') {
          const { data } = await this.http.get<T>(`${BASE}${rota}`, config);
          return data;
        }
        await this.http.put(`${BASE}${rota}`, corpo, config);
        return undefined as T;
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

interface RespostaPlaylists {
  readonly items: readonly PlaylistSpotify[];
  readonly next: string | null;
}

interface PlaylistSpotify {
  readonly id: string;
  readonly name: string;
  readonly uri: string;
  readonly tracks?: { readonly total?: number };
  readonly images: readonly { readonly url: string }[];
}

function mapearPlaylist(playlist: PlaylistSpotify): PlaylistMusica {
  return {
    id: playlist.id,
    nome: playlist.name,
    uri: playlist.uri,
    totalFaixas: playlist.tracks?.total ?? 0,
    imagemUrl: playlist.images[0]?.url ?? null,
  };
}

function proximaRota(next: string | null): string | null {
  if (next === null) return null;
  const url = new URL(next);
  return `${url.pathname.replace('/v1', '')}${url.search}`;
}
