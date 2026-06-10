'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  finalizarSessao,
  iniciarSessao,
  listarPlaylists,
  mensagemErro,
  obterStatus,
} from '../lib/api';
import type { DadosIniciarSessao, Playlist, StatusSessao } from '../lib/tipos';

// Toda a conversa com a API vive aqui; os componentes só recebem dados
// e callbacks. O backend é o dono do timer — o front apenas espelha.
export function useSessao() {
  const [status, setStatus] = useState<StatusSessao | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const sincronizarStatus = useCallback(async () => {
    setStatus(await obterStatus());
  }, []);

  const recarregarPlaylists = useCallback(async () => {
    setErro(null);
    setCarregando(true);
    try {
      const [lista] = await Promise.all([listarPlaylists(), sincronizarStatus()]);
      setPlaylists(lista);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [sincronizarStatus]);

  useEffect(() => {
    void recarregarPlaylists();
  }, [recarregarPlaylists]);

  // Polling: re-sincroniza a cada segundo; o countdown em si é local
  // (use-countdown) a partir do terminaEm.
  useEffect(() => {
    const id = window.setInterval(() => {
      void sincronizarStatus().catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sincronizarStatus]);

  const iniciar = useCallback(
    async (dados: DadosIniciarSessao) => {
      setErro(null);
      setCarregando(true);
      try {
        await iniciarSessao(dados);
      } catch (e) {
        setErro(mensagemErro(e));
      } finally {
        await sincronizarStatus().catch(() => undefined);
        setCarregando(false);
      }
    },
    [sincronizarStatus],
  );

  const finalizar = useCallback(async () => {
    setErro(null);
    setCarregando(true);
    try {
      await finalizarSessao();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      await sincronizarStatus().catch(() => undefined);
      setCarregando(false);
    }
  }, [sincronizarStatus]);

  const estado = status?.snapshot?.estado ?? 'idle';
  const pausado = status?.pausado ?? false;

  return {
    status,
    estado,
    pausado,
    ativo: estado !== 'idle',
    playlists,
    erro,
    carregando,
    iniciar,
    finalizar,
    recarregarPlaylists,
  };
}
