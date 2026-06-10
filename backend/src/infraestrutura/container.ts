import 'reflect-metadata';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { container as raiz, type DependencyContainer } from 'tsyringe';
import type { VariaveisAmbiente } from '../config/env';
import { resolverConfiguracao } from '../dominio/config/configuracao';
import { GerenciadorDeSessao } from '../aplicacao/gerenciador-de-sessao';
import type { MusicProvider } from '../aplicacao/portas/music-provider';
import type { RelogioPort } from '../aplicacao/portas/relogio-port';
import type { SessaoRepository } from '../aplicacao/portas/sessao-repository';
import { RelogioReal } from './relogio/relogio-real';
import { ArmazemTokens } from './spotify/armazem-tokens';
import { SpotifyAuth } from './spotify/spotify-auth';
import { SpotifyProvider } from './spotify/spotify-provider';
import { SupabaseSessaoRepository } from './supabase/supabase-sessao-repository';
import { TOKENS } from './tokens';

// useFactory em vez de decorators nas classes: o domínio e a aplicação
// continuam sem saber que tsyringe existe. O container é o ÚNICO lugar
// que conhece todas as implementações concretas.
export function criarContainer(env: VariaveisAmbiente): DependencyContainer {
  const c = raiz.createChildContainer();

  c.registerInstance(TOKENS.Env, env);
  c.register<RelogioPort>(TOKENS.Relogio, { useFactory: () => new RelogioReal() });

  c.register(TOKENS.SpotifyAuth, {
    useFactory: (deps) =>
      new SpotifyAuth(
        { clientId: env.spotifyClientId, redirectUri: env.spotifyRedirectUri },
        new ArmazemTokens('.spotify.tokens.json'),
        axios.create(),
        deps.resolve<RelogioPort>(TOKENS.Relogio),
      ),
  });

  c.register<MusicProvider>(TOKENS.MusicProvider, {
    useFactory: (deps) =>
      new SpotifyProvider(
        axios.create(),
        deps.resolve<SpotifyAuth>(TOKENS.SpotifyAuth),
        deps.resolve<RelogioPort>(TOKENS.Relogio),
      ),
  });

  c.register<SessaoRepository>(TOKENS.SessaoRepository, {
    useFactory: () =>
      new SupabaseSessaoRepository(createClient(env.supabaseUrl, env.supabaseServiceRoleKey)),
  });

  let gerenciador: GerenciadorDeSessao | null = null; // singleton manual p/ useFactory
  c.register(TOKENS.GerenciadorDeSessao, {
    useFactory: (deps) => {
      gerenciador ??= new GerenciadorDeSessao(
        resolverConfiguracao(),
        deps.resolve<RelogioPort>(TOKENS.Relogio),
        deps.resolve<MusicProvider>(TOKENS.MusicProvider),
        deps.resolve<SessaoRepository>(TOKENS.SessaoRepository),
      );
      return gerenciador;
    },
  });

  return c;
}
