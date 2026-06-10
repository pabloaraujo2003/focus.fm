import axios, { isAxiosError } from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function obterContextosRecentes(limit: number = 10): Promise<string[]> {
  const { data } = await api.get('/sessoes/contextos', { params: { limit } });
  return data.contextos;
}
