// Espelho dos tipos do backend. O union de estados é idêntico ao do
// domínio — se o backend ganhar um estado novo, o switch de rótulos
// no front deixa de compilar e aponta o que falta tratar.
export type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa' | 'pausado';

export interface Playlist {
  id: string;
  nome: string;
  uri: string;
  totalFaixas: number;
  imagemUrl: string | null;
}

export interface StatusSessao {
  snapshot: {
    estado: EstadoSessao;
    estadoAnterior?: EstadoSessao;
    ciclosCompletados: number;
    contexto: string | null;
  };
  terminaEm: string | null;
  pausado?: boolean;
}

export interface DadosIniciarSessao {
  contexto: string;
  playlistFoco: string;
  playlistPausa: string;
}
