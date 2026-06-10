import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { criarApp } from './app';
import request from 'supertest';
import { container } from 'tsyringe';

describe('Sessão — Integração', () => {
  let app: any;

  beforeEach(async () => {
    app = criarApp(container);
  });

  afterEach(async () => {
    // Cleanup
  });

  it('POST /sessao inicia e PATCH /pausar pausa corretamente', async () => {
    const res1 = await request(app)
      .post('/sessao')
      .send({ contexto: 'Teste', playlistFoco: 'spotify:playlist:uri1', playlistPausa: 'spotify:playlist:uri2' });

    expect(res1.status).toBe(201);
    expect(res1.body.snapshot.estado).toBe('focando');

    const res2 = await request(app).patch('/sessao/pausar');

    expect(res2.status).toBe(200);
    expect(res2.body.estado).toBe('pausado');
    expect(res2.body.estadoAnterior).toBe('focando');
  });

  it('PATCH /retomar volta ao estado anterior', async () => {
    await request(app)
      .post('/sessao')
      .send({ contexto: 'Teste', playlistFoco: 'spotify:playlist:uri1', playlistPausa: 'spotify:playlist:uri2' });

    await request(app).patch('/sessao/pausar');

    const res = await request(app).patch('/sessao/retomar');

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('focando');
  });

  it('GET /sessoes/contextos retorna histórico', async () => {
    await request(app)
      .post('/sessao')
      .send({ contexto: 'Contexto 1', playlistFoco: 'spotify:playlist:uri1', playlistPausa: 'spotify:playlist:uri2' });

    await request(app).post('/sessao/finalizar');

    await request(app)
      .post('/sessao')
      .send({ contexto: 'Contexto 2', playlistFoco: 'spotify:playlist:uri1', playlistPausa: 'spotify:playlist:uri2' });

    const res = await request(app).get('/sessoes/contextos?limit=10');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.contextos)).toBe(true);
  });
});
