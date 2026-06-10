import axios, { isAxiosError } from 'axios';
import type { DadosIniciarSessao, Playlist, StatusSessao } from './tipos';

// O rewrite do next.config.ts faz /api/* chegar no Express (127.0.0.1:3333);
// o navegador nunca fala com o backend direto, nem conhece credenciais.
const api = axios.create({ baseURL: '/api' });

export async function obterStatus(): Promise<StatusSessao> {
  const { data } = await api.get<StatusSessao>('/sessao');
  return data;
}

export async function listarPlaylists(): Promise<Playlist[]> {
  const { data } = await api.get<{ playlists: Playlist[] }>('/spotify/playlists');
  return data.playlists;
}

export async function iniciarSessao(dados: DadosIniciarSessao): Promise<void> {
  await api.post('/sessao', dados);
}

export async function finalizarSessao(): Promise<void> {
  await api.post('/sessao/finalizar');
}

// Os erros do backend chegam como { code, message } (middleware-erro).
export function mensagemErro(erro: unknown): string {
  if (isAxiosError(erro)) {
    const data = erro.response?.data as { message?: string; code?: string } | undefined;
    return data?.message ?? erro.message;
  }
  return erro instanceof Error ? erro.message : 'Erro inesperado';
}
