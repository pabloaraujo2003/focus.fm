import { describe, expect, it } from 'vitest';
import { carregarEnv } from '../../src/config/env';
import { ValidationError } from '../../src/dominio/erros/validation-error';

const completo = {
  PORT: '3333',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'chave',
  SPOTIFY_CLIENT_ID: 'cid',
  SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3333/auth/spotify/callback',
  PLAYLIST_FOCO: 'https://open.spotify.com/playlist/AAA111?si=x',
  PLAYLIST_PAUSA: 'spotify:playlist:BBB222',
};

describe('carregarEnv', () => {
  it('carrega e normaliza playlists para URI spotify:', () => {
    const env = carregarEnv(completo);
    expect(env.porta).toBe(3333);
    expect(env.playlistFoco).toBe('spotify:playlist:AAA111');
    expect(env.playlistPausa).toBe('spotify:playlist:BBB222');
  });

  it('PORT é opcional com default 3333', () => {
    const { PORT: _ignorada, ...semPorta } = completo;
    expect(carregarEnv(semPorta).porta).toBe(3333);
  });

  it('falha com mensagem clara se faltar variável', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _ignorada, ...incompleto } = completo;
    expect(() => carregarEnv(incompleto)).toThrow(ValidationError);
    expect(() => carregarEnv(incompleto)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejeita playlist que não é URL nem URI do Spotify', () => {
    expect(() => carregarEnv({ ...completo, PLAYLIST_FOCO: 'banana' })).toThrow(ValidationError);
  });
});
