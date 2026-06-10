'use client';

import { Play, Square } from 'lucide-react';
import type { Playlist } from '../lib/tipos';

interface Props {
  contexto: string;
  aoMudarContexto: (valor: string) => void;
  playlistFoco: string;
  aoMudarFoco: (uri: string) => void;
  playlistPausa: string;
  aoMudarPausa: (uri: string) => void;
  playlists: Playlist[];
  ativo: boolean;
  carregando: boolean;
  aoIniciar: () => void;
  aoFinalizar: () => void;
}

export function PainelSessao(props: Props) {
  const podeIniciar =
    !props.ativo && !props.carregando && props.contexto.trim().length > 0 && props.playlistFoco !== '';

  return (
    <form
      className="painel"
      onSubmit={(event) => {
        event.preventDefault();
        props.aoIniciar();
      }}
    >
      <label className="campo">
        <span>No que você vai focar?</span>
        <input
          value={props.contexto}
          onChange={(event) => props.aoMudarContexto(event.target.value)}
          placeholder="estudar generics"
          disabled={props.ativo}
        />
      </label>

      <SeletorPlaylist
        rotulo="Trilha de foco"
        valor={props.playlistFoco}
        playlists={props.playlists}
        aoMudar={props.aoMudarFoco}
        desabilitado={props.ativo}
      />
      <SeletorPlaylist
        rotulo="Trilha de pausa"
        valor={props.playlistPausa}
        playlists={props.playlists}
        aoMudar={props.aoMudarPausa}
        desabilitado={props.ativo}
      />

      <div className="painelAcoes">
        <button type="submit" className="botaoPrincipal" disabled={!podeIniciar}>
          <Play size={16} />
          Iniciar sessão
        </button>
        <button
          type="button"
          className="botaoEncerrar"
          onClick={props.aoFinalizar}
          disabled={!props.ativo || props.carregando}
        >
          <Square size={14} />
          Finalizar
        </button>
      </div>
    </form>
  );
}

function SeletorPlaylist(props: {
  rotulo: string;
  valor: string;
  playlists: Playlist[];
  desabilitado: boolean;
  aoMudar: (uri: string) => void;
}) {
  return (
    <label className="campo">
      <span>{props.rotulo}</span>
      <select
        value={props.valor}
        onChange={(event) => props.aoMudar(event.target.value)}
        disabled={props.desabilitado}
      >
        <option value="" disabled>
          escolha uma playlist…
        </option>
        {props.playlists.map((playlist) => (
          <option key={playlist.uri} value={playlist.uri}>
            {playlist.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
