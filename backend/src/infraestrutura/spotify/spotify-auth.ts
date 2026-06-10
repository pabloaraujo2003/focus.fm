import type { AxiosInstance } from 'axios';
import { TokenExpiradoError } from '../../dominio/erros/token-expirado-error';
import { SpotifyError } from '../../dominio/erros/spotify-error';
import type { RelogioPort } from '../../aplicacao/portas/relogio-port';
import { ArmazemTokens } from './armazem-tokens';
import { gerarParPkce } from './pkce';

const URL_AUTORIZACAO = 'https://accounts.spotify.com/authorize';
const URL_TOKEN = 'https://accounts.spotify.com/api/token';
const ESCOPOS = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');
const MARGEM_MS = 30_000; // renova 30s antes de expirar

export interface ConfigSpotifyAuth {
  readonly clientId: string;
  readonly redirectUri: string;
}

interface RespostaToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class SpotifyAuth {
  constructor(
    private readonly config: ConfigSpotifyAuth,
    private readonly armazem: ArmazemTokens,
    private readonly http: AxiosInstance,
    private readonly relogio: RelogioPort,
  ) {}

  urlDeAutorizacao(): string {
    const { verifier, challenge } = gerarParPkce();
    this.armazem.gravarPkceVerifierPendente(verifier);
    const url = new URL(URL_AUTORIZACAO);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', ESCOPOS);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    return url.toString();
  }

  async trocarCodigo(code: string): Promise<void> {
    const verifierPendente = this.armazem.lerPkceVerifierPendente();
    if (verifierPendente === null) {
      throw new SpotifyError('fluxo de autorização não iniciado — acesse /auth/spotify primeiro');
    }
    const resposta = await this.pedirToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: verifierPendente,
    });
    this.persistir(resposta, null);
    this.armazem.limparPkceVerifierPendente();
  }

  // Renovação automática: quem consome (SpotifyProvider) nunca pensa em refresh.
  async tokenDeAcesso(): Promise<string> {
    const tokens = this.armazem.ler();
    if (tokens === null) throw new TokenExpiradoError();
    if (this.relogio.agora().getTime() < tokens.expiraEmMs - MARGEM_MS) {
      return tokens.accessToken;
    }
    const resposta = await this.pedirToken({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: this.config.clientId,
    });
    this.persistir(resposta, tokens.refreshToken);
    return resposta.access_token;
  }

  private async pedirToken(parametros: Record<string, string>): Promise<RespostaToken> {
    const { data } = await this.http.post(URL_TOKEN, new URLSearchParams(parametros), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data as RespostaToken;
  }

  private persistir(resposta: RespostaToken, refreshAnterior: string | null): void {
    const refreshToken = resposta.refresh_token ?? refreshAnterior;
    if (refreshToken === undefined || refreshToken === null) {
      throw new SpotifyError('resposta de token sem refresh_token');
    }
    this.armazem.gravar({
      accessToken: resposta.access_token,
      refreshToken,
      expiraEmMs: this.relogio.agora().getTime() + resposta.expires_in * 1000,
    });
  }
}
