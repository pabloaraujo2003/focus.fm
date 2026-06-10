// Interfaces não existem em runtime; tokens são o "nome" injetável delas.
export const TOKENS = {
  Env: Symbol('Env'),
  Relogio: Symbol('RelogioPort'),
  MusicProvider: Symbol('MusicProvider'),
  SessaoRepository: Symbol('SessaoRepository'),
  SpotifyAuth: Symbol('SpotifyAuth'),
  GerenciadorDeSessao: Symbol('GerenciadorDeSessao'),
} as const;
