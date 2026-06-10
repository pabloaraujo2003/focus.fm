import 'reflect-metadata';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { criarApp } from '../../src/http/app';
import { criarContainer } from '../../src/infraestrutura/container';
import { TOKENS } from '../../src/infraestrutura/tokens';
import { MusicProviderFake } from '../fakes/music-provider-fake';
import { RelogioFake } from '../fakes/relogio-fake';
import { SessaoRepositoryFake } from '../fakes/sessao-repository-fake';

const env = {
  porta: 3333,
  supabaseUrl: 'https://x.supabase.co',
  supabaseServiceRoleKey: 'k',
  spotifyClientId: 'cid',
  spotifyRedirectUri: 'http://127.0.0.1:3333/auth/spotify/callback',
};

const corpoSessao = {
  contexto: 'estudar',
  playlistFoco: 'spotify:playlist:FOCO',
  playlistPausa: 'spotify:playlist:PAUSA',
};

describe('API /sessao', () => {
  let app: ReturnType<typeof criarApp>;
  let repositorio: SessaoRepositoryFake;

  beforeEach(() => {
    const container = criarContainer(env);
    repositorio = new SessaoRepositoryFake();
    container.registerInstance(TOKENS.MusicProvider, new MusicProviderFake());
    container.registerInstance(TOKENS.SessaoRepository, repositorio);
    container.registerInstance(TOKENS.Relogio, new RelogioFake());
    app = criarApp(container);
  });

  it('POST /sessao inicia e GET /sessao mostra o estado', async () => {
    const criada = await request(app).post('/sessao').send(corpoSessao);
    expect(criada.status).toBe(201);

    const status = await request(app).get('/sessao');
    expect(status.body.estado).toBe('focando');
    expect(status.body.terminaEm).toBeTruthy();
    expect(status.body.pausado).toBe(false);
  });

  it('POST /sessao sem contexto retorna 400 com code VALIDATION', async () => {
    const resposta = await request(app).post('/sessao').send({ ...corpoSessao, contexto: '' });
    expect(resposta.status).toBe(400);
    expect(resposta.body.code).toBe('VALIDATION');
  });

  it('POST /sessao sem playlist retorna 400 com code VALIDATION', async () => {
    const resposta = await request(app).post('/sessao').send({ contexto: 'x' });
    expect(resposta.status).toBe(400);
    expect(resposta.body.code).toBe('VALIDATION');
  });

  it('POST /sessao duas vezes retorna 409 TRANSICAO_INVALIDA', async () => {
    await request(app).post('/sessao').send(corpoSessao);
    const segunda = await request(app).post('/sessao').send({ ...corpoSessao, contexto: 'y' });
    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('TRANSICAO_INVALIDA');
  });

  it('POST /sessao/finalizar grava e responde a sessao', async () => {
    await request(app).post('/sessao').send({ ...corpoSessao, contexto: 'x' });
    const fim = await request(app).post('/sessao/finalizar');
    expect(fim.status).toBe(200);
    expect(repositorio.salvas).toHaveLength(1);
    expect(fim.body.contexto).toBe('x');
  });

  it('GET /auth/spotify redireciona para accounts.spotify.com', async () => {
    const resposta = await request(app).get('/auth/spotify');
    expect(resposta.status).toBe(302);
    expect(resposta.headers.location).toContain('https://accounts.spotify.com/authorize');
  });

  it('GET /spotify/playlists lista playlists do provider', async () => {
    const resposta = await request(app).get('/spotify/playlists');
    expect(resposta.status).toBe(200);
    expect(resposta.body.playlists[0]).toEqual({
      id: 'FOCO',
      nome: 'Foco',
      uri: 'spotify:playlist:FOCO',
      totalFaixas: 10,
      imagemUrl: null,
    });
  });
});
