import axios, { isAxiosError } from 'axios';

export const api = axios.create({ baseURL: '/api' });

export async function obterContextosRecentes(limit: number = 10): Promise<string[]> {
  const { data } = await api.get('/sessoes/contextos', { params: { limit } });
  return data.contextos;
}

export async function pausarSessao() {
  const { data } = await api.patch('/sessao/pausar');
  return data;
}

export async function retomarSessao() {
  const { data } = await api.patch('/sessao/retomar');
  return data;
}
