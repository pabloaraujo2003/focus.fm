import { describe, expect, it } from 'vitest';
import { carregarEnv } from '../../src/config/env';
import { ValidationError } from '../../src/dominio/erros/validation-error';

const completo = {
  PORT: '3333',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'chave',
  SPOTIFY_CLIENT_ID: 'cid',
  SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3333/auth/spotify/callback',
};

describe('carregarEnv', () => {
  it('carrega as variáveis de ambiente do backend', () => {
    const env = carregarEnv(completo);
    expect(env.porta).toBe(3333);
    expect(env.spotifyClientId).toBe('cid');
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
});
