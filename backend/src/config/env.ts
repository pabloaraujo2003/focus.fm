import { ValidationError } from '../dominio/erros/validation-error';

export interface VariaveisAmbiente {
  readonly porta: number;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly spotifyClientId: string;
  readonly spotifyRedirectUri: string;
  readonly playlistFoco: string;
  readonly playlistPausa: string;
}

// Recebe o dicionário em vez de ler process.env direto: testável sem
// poluir o ambiente do processo.
export function carregarEnv(fonte: Record<string, string | undefined>): VariaveisAmbiente {
  return {
    porta: Number(fonte.PORT ?? '3333'),
    supabaseUrl: obrigatoria(fonte, 'SUPABASE_URL'),
    supabaseServiceRoleKey: obrigatoria(fonte, 'SUPABASE_SERVICE_ROLE_KEY'),
    spotifyClientId: obrigatoria(fonte, 'SPOTIFY_CLIENT_ID'),
    spotifyRedirectUri: obrigatoria(fonte, 'SPOTIFY_REDIRECT_URI'),
    playlistFoco: normalizarPlaylist(obrigatoria(fonte, 'PLAYLIST_FOCO')),
    playlistPausa: normalizarPlaylist(obrigatoria(fonte, 'PLAYLIST_PAUSA')),
  };
}

function obrigatoria(fonte: Record<string, string | undefined>, nome: string): string {
  const valor = fonte[nome]?.trim();
  if (valor === undefined || valor.length === 0) {
    throw new ValidationError(`variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

// Aceita 'spotify:playlist:ID' ou 'https://open.spotify.com/playlist/ID?...'
function normalizarPlaylist(valor: string): string {
  const uri = /^spotify:playlist:([A-Za-z0-9]+)$/.exec(valor);
  if (uri) return valor;
  const url = /^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/.exec(valor);
  if (url) return `spotify:playlist:${url[1]}`;
  throw new ValidationError(`playlist inválida: '${valor}' (use a URL do Spotify ou spotify:playlist:ID)`);
}
