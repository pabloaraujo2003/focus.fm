'use client';

import axios, { isAxiosError } from 'axios';
import { AlertCircle, ExternalLink, ListMusic, Pause, Play, RefreshCw, TimerReset } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa';

interface Playlist {
  id: string;
  nome: string;
  uri: string;
  totalFaixas: number;
  imagemUrl: string | null;
}

interface StatusSessao {
  snapshot: {
    estado: EstadoSessao;
    ciclosCompletados: number;
    contexto: string | null;
  };
  terminaEm: string | null;
}

const api = axios.create({ baseURL: '/api' });

export default function Home() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [status, setStatus] = useState<StatusSessao | null>(null);
  const [contexto, setContexto] = useState('');
  const [playlistFoco, setPlaylistFoco] = useState('');
  const [playlistPausa, setPlaylistPausa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const carregarStatus = useCallback(async () => {
    const { data } = await api.get<StatusSessao>('/sessao');
    setStatus(data);
  }, []);

  const carregarPlaylists = useCallback(async () => {
    setErro(null);
    setCarregando(true);
    try {
      const [{ data }] = await Promise.all([
        api.get<{ playlists: Playlist[] }>('/spotify/playlists'),
        carregarStatus(),
      ]);
      setPlaylists(data.playlists);
      setPlaylistFoco((atual) => atual || data.playlists[0]?.uri || '');
      setPlaylistPausa((atual) => atual || data.playlists[1]?.uri || data.playlists[0]?.uri || '');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [carregarStatus]);

  useEffect(() => {
    void carregarPlaylists();
  }, [carregarPlaylists]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAgora(Date.now());
      void carregarStatus().catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(id);
  }, [carregarStatus]);

  const restante = useMemo(() => {
    if (!status?.terminaEm) return '00:00';
    const ms = Math.max(0, new Date(status.terminaEm).getTime() - agora);
    const minutos = Math.floor(ms / 60_000);
    const segundos = Math.floor((ms % 60_000) / 1000);
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }, [agora, status?.terminaEm]);

  const ativo = status?.snapshot.estado !== undefined && status.snapshot.estado !== 'idle';

  async function iniciar() {
    setErro(null);
    setCarregando(true);
    try {
      await api.post('/sessao', { contexto, playlistFoco, playlistPausa });
      await carregarStatus();
    } catch (e) {
      setErro(mensagemErro(e));
      await carregarStatus().catch(() => undefined);
    } finally {
      setCarregando(false);
    }
  }

  async function finalizar() {
    setErro(null);
    setCarregando(true);
    try {
      await api.post('/sessao/finalizar');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      await carregarStatus().catch(() => undefined);
      setCarregando(false);
    }
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Pomodoro Musical</p>
          <h1>{rotuloEstado(status?.snapshot.estado ?? 'idle')}</h1>
        </div>
        <a className="authLink" href="/api/auth/spotify">
          <ExternalLink size={18} />
          Spotify
        </a>
      </section>

      <section className="timerBand">
        <div className="timerBlock">
          <span className="timer">{restante}</span>
          <span className="subtle">
            {status?.snapshot.contexto ?? 'Sem sessão ativa'} · {status?.snapshot.ciclosCompletados ?? 0} ciclos
          </span>
        </div>
        <div className="actions">
          <button type="button" className="iconButton" onClick={() => void carregarPlaylists()} disabled={carregando}>
            <RefreshCw size={18} />
            Atualizar
          </button>
          <button type="button" className="primaryButton" onClick={() => void iniciar()} disabled={carregando || ativo}>
            <Play size={18} />
            Iniciar
          </button>
          <button type="button" className="dangerButton" onClick={() => void finalizar()} disabled={carregando || !ativo}>
            <Pause size={18} />
            Finalizar
          </button>
        </div>
      </section>

      {erro ? (
        <div className="errorLine">
          <AlertCircle size={18} />
          {erro}
        </div>
      ) : null}

      <section className="workspace">
        <div className="formPanel">
          <label>
            Contexto
            <input
              value={contexto}
              onChange={(event) => setContexto(event.target.value)}
              placeholder="estudar arquitetura limpa"
              disabled={ativo}
            />
          </label>

          <PlaylistSelect
            label="Foco"
            value={playlistFoco}
            playlists={playlists}
            onChange={setPlaylistFoco}
            disabled={ativo}
          />
          <PlaylistSelect
            label="Pausa"
            value={playlistPausa}
            playlists={playlists}
            onChange={setPlaylistPausa}
            disabled={ativo}
          />
        </div>

        <div className="listPanel">
          <div className="panelTitle">
            <ListMusic size={18} />
            Playlists
          </div>
          <div className="playlistList">
            {playlists.map((playlist) => (
              <button
                className="playlistRow"
                type="button"
                key={playlist.uri}
                onClick={() => {
                  if (!ativo) setPlaylistFoco(playlist.uri);
                }}
              >
                {playlist.imagemUrl ? <img src={playlist.imagemUrl} alt="" /> : <div className="coverFallback" />}
                <span>
                  <strong>{playlist.nome}</strong>
                  <small>{playlist.totalFaixas} faixas</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function PlaylistSelect(props: {
  label: string;
  value: string;
  playlists: Playlist[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)} disabled={props.disabled}>
        {props.playlists.map((playlist) => (
          <option key={playlist.uri} value={playlist.uri}>
            {playlist.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

function rotuloEstado(estado: EstadoSessao) {
  switch (estado) {
    case 'idle':
      return 'Pronto';
    case 'focando':
      return 'Foco';
    case 'pausa_curta':
      return 'Pausa curta';
    case 'pausa_longa':
      return 'Pausa longa';
  }
}

function mensagemErro(erro: unknown) {
  if (isAxiosError(erro)) {
    const data = erro.response?.data as { message?: string; code?: string } | undefined;
    return data?.message ?? erro.message;
  }
  return erro instanceof Error ? erro.message : 'Erro inesperado';
}
