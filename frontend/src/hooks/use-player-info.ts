import { useEffect, useState } from 'react';
import { api } from '@/services/sessao-api';

interface PlayerInfo {
  nomeMusica: string;
  artista: string;
  imagemUrl?: string;
  progresso: number;
  duracao: number;
}

export function usePlayerInfo(intervaloMs: number = 5000) {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const buscarPlayer = async () => {
      try {
        const { data } = await api.get('/me/player');
        if (data?.item) {
          setPlayerInfo({
            nomeMusica: data.item.name,
            artista: data.item.artists?.[0]?.name || 'Desconhecido',
            imagemUrl: data.item.album?.images?.[0]?.url,
            progresso: data.progress_ms || 0,
            duracao: data.item.duration_ms || 0,
          });
        }
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao buscar player');
      }
    };

    buscarPlayer();
    const interval = setInterval(buscarPlayer, intervaloMs);
    return () => clearInterval(interval);
  }, [intervaloMs]);

  return { playerInfo, erro };
}
