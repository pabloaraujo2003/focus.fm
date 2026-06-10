import { describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosInstance } from 'axios';
import { SpotifyProvider } from '../../src/infraestrutura/spotify/spotify-provider';
import { NenhumDeviceAtivoError } from '../../src/dominio/erros/nenhum-device-ativo-error';
import { SpotifyError } from '../../src/dominio/erros/spotify-error';
import { RelogioFake } from '../fakes/relogio-fake';

function erroHttp(status: number, headers: Record<string, string> = {}, mensagem = 'x') {
  const erro = new AxiosError(mensagem);
  erro.response = { status, headers, data: { error: { message: mensagem } } } as never;
  return erro;
}

function criarProvider() {
  const relogio = new RelogioFake();
  const http = { put: vi.fn().mockResolvedValue({ status: 204 }) };
  const auth = { tokenDeAcesso: vi.fn().mockResolvedValue('tok') };
  const provider = new SpotifyProvider(http as unknown as AxiosInstance, auth as never, relogio);
  return { provider, http, auth, relogio };
}

describe('SpotifyProvider', () => {
  it('tocarPlaylist faz PUT /me/player/play com context_uri e bearer', async () => {
    const { provider, http } = criarProvider();
    await provider.tocarPlaylist('spotify:playlist:AAA');
    expect(http.put).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player/play',
      { context_uri: 'spotify:playlist:AAA' },
      { headers: { Authorization: 'Bearer tok' } },
    );
  });

  it('404 vira NenhumDeviceAtivoError', async () => {
    const { provider, http } = criarProvider();
    http.put.mockRejectedValueOnce(erroHttp(404));
    await expect(provider.tocarPlaylist('spotify:playlist:A')).rejects.toThrow(NenhumDeviceAtivoError);
  });

  it('429 respeita Retry-After e tenta de novo', async () => {
    const { provider, http, relogio } = criarProvider();
    http.put.mockRejectedValueOnce(erroHttp(429, { 'retry-after': '2' }));
    const promessa = provider.pausar();
    await relogio.avancar(2000);
    await promessa;
    expect(http.put).toHaveBeenCalledTimes(2);
  });

  it('429 persistente esgota as 3 tentativas e lança SpotifyError', async () => {
    const { provider, http, relogio } = criarProvider();
    http.put.mockRejectedValue(erroHttp(429, { 'retry-after': '1' }));
    const promessa = provider.pausar().catch((e: unknown) => e);
    await relogio.avancar(10_000);
    expect(await promessa).toBeInstanceOf(SpotifyError);
    expect(http.put).toHaveBeenCalledTimes(3);
  });

  it('403 vira SpotifyError com dica de Premium', async () => {
    const { provider, http } = criarProvider();
    http.put.mockRejectedValueOnce(erroHttp(403, {}, 'Player command failed: Premium required'));
    await expect(provider.pausar()).rejects.toThrow(/Premium/);
  });
});
