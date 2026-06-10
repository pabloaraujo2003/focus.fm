import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ArmazemTokens } from '../../src/infraestrutura/spotify/armazem-tokens';
import { SpotifyAuth } from '../../src/infraestrutura/spotify/spotify-auth';
import { TokenExpiradoError } from '../../src/dominio/erros/token-expirado-error';
import { RelogioFake } from '../fakes/relogio-fake';

function criarAuth(relogio = new RelogioFake()) {
  const arquivo = join(mkdtempSync(join(tmpdir(), 'pomodoro-')), 'tokens.json');
  const http = { post: vi.fn() };
  return criarAuthComArquivo(arquivo, relogio, http);
}

function criarAuthComArquivo(
  arquivo: string,
  relogio = new RelogioFake(),
  http = { post: vi.fn() },
) {
  const auth = new SpotifyAuth(
    { clientId: 'cid', redirectUri: 'http://127.0.0.1:3333/cb' },
    new ArmazemTokens(arquivo),
    http as never,
    relogio,
  );
  return { auth, http, arquivo };
}

describe('SpotifyAuth', () => {
  it('monta URL de autorização com PKCE e escopos de playback e playlists', () => {
    const { auth } = criarAuth();
    const url = new URL(auth.urlDeAutorizacao());
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe(
      'user-modify-playback-state user-read-playback-state playlist-read-private playlist-read-collaborative',
    );
  });

  it('troca o code por tokens e persiste; tokenDeAcesso retorna sem refresh enquanto válido', async () => {
    const { auth, http } = criarAuth();
    auth.urlDeAutorizacao();
    http.post.mockResolvedValueOnce({
      data: { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600 },
    });
    await auth.trocarCodigo('codigo-recebido');
    expect(http.post).toHaveBeenCalledWith(
      'https://accounts.spotify.com/api/token',
      expect.any(URLSearchParams),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    expect(await auth.tokenDeAcesso()).toBe('acc1');
    expect(http.post).toHaveBeenCalledTimes(1); // não renovou
  });

  it('troca o code mesmo se o backend reiniciar entre autorização e callback', async () => {
    const { auth, arquivo } = criarAuth();
    auth.urlDeAutorizacao();

    const httpDepoisDoRestart = { post: vi.fn().mockResolvedValueOnce({
      data: { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600 },
    }) };
    const { auth: authDepoisDoRestart } = criarAuthComArquivo(
      arquivo,
      new RelogioFake(),
      httpDepoisDoRestart,
    );

    await authDepoisDoRestart.trocarCodigo('codigo-recebido');
    expect(await authDepoisDoRestart.tokenDeAcesso()).toBe('acc1');
  });

  it('renova automaticamente quando o token expira', async () => {
    const relogio = new RelogioFake();
    const { auth, http } = criarAuth(relogio);
    auth.urlDeAutorizacao();
    http.post.mockResolvedValueOnce({
      data: { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600 },
    });
    await auth.trocarCodigo('codigo');
    await relogio.avancar(3601 * 1000);
    http.post.mockResolvedValueOnce({
      data: { access_token: 'acc2', expires_in: 3600 },
    });
    expect(await auth.tokenDeAcesso()).toBe('acc2');
    const corpo = http.post.mock.calls[1]?.[1] as URLSearchParams;
    expect(corpo.get('grant_type')).toBe('refresh_token');
    expect(corpo.get('refresh_token')).toBe('ref1');
  });

  it('sem tokens persistidos lança TokenExpiradoError', async () => {
    const { auth } = criarAuth();
    await expect(auth.tokenDeAcesso()).rejects.toThrow(TokenExpiradoError);
  });
});
