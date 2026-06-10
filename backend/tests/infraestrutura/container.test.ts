import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { criarContainer } from '../../src/infraestrutura/container';
import { TOKENS } from '../../src/infraestrutura/tokens';
import { GerenciadorDeSessao } from '../../src/aplicacao/gerenciador-de-sessao';
import { MusicProviderFake } from '../fakes/music-provider-fake';
import { RelogioFake } from '../fakes/relogio-fake';
import { SessaoRepositoryFake } from '../fakes/sessao-repository-fake';

const env = {
  porta: 3333,
  supabaseUrl: 'https://x.supabase.co',
  supabaseServiceRoleKey: 'k',
  spotifyClientId: 'cid',
  spotifyRedirectUri: 'http://127.0.0.1:3333/cb',
};

describe('container', () => {
  it('GerenciadorDeSessao é singleton e usa as portas registradas', async () => {
    const container = criarContainer(env);
    // Sobrescrever portas com fakes ANTES da primeira resolução:
    container.registerInstance(TOKENS.MusicProvider, new MusicProviderFake());
    container.registerInstance(TOKENS.SessaoRepository, new SessaoRepositoryFake());
    container.registerInstance(TOKENS.Relogio, new RelogioFake());
    const a = container.resolve<GerenciadorDeSessao>(TOKENS.GerenciadorDeSessao);
    const b = container.resolve<GerenciadorDeSessao>(TOKENS.GerenciadorDeSessao);
    expect(a).toBe(b);
    await a.iniciar('teste', { foco: 'spotify:playlist:F', pausa: 'spotify:playlist:P' });
    expect(a.obterStatus().snapshot.estado).toBe('focando');
  });
});
