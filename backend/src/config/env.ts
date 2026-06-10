import { ValidationError } from '../dominio/erros/validation-error';

export interface VariaveisAmbiente {
  readonly porta: number;
  readonly supabaseUrl: string;
  readonly supabaseServiceRoleKey: string;
  readonly spotifyClientId: string;
  readonly spotifyRedirectUri: string;
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
  };
}

function obrigatoria(fonte: Record<string, string | undefined>, nome: string): string {
  const valor = fonte[nome]?.trim();
  if (valor === undefined || valor.length === 0) {
    throw new ValidationError(`variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}
