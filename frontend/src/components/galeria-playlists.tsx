'use client';

import { ListMusic, RefreshCw } from 'lucide-react';
import type { Playlist } from '../lib/tipos';

interface Props {
  playlists: Playlist[];
  playlistFoco: string;
  playlistPausa: string;
  ativo: boolean;
  carregando: boolean;
  aoEscolherFoco: (uri: string) => void;
  aoEscolherPausa: (uri: string) => void;
  aoRecarregar: () => void;
}

// Galeria com atalhos: cada cartão define a playlist como trilha de
// foco ou de pausa sem precisar abrir os selects do painel.
export function GaleriaPlaylists(props: Props) {
  return (
    <section className="galeria">
      <header className="galeriaCabecalho">
        <h2>
          <ListMusic size={16} />
          Suas playlists
        </h2>
        <button
          type="button"
          className="botaoFantasma"
          onClick={props.aoRecarregar}
          disabled={props.carregando}
        >
          <RefreshCw size={14} data-girando={props.carregando} />
          Atualizar
        </button>
      </header>

      <div className="galeriaGrade">
        {props.playlists.map((playlist, indice) => {
          const ehFoco = playlist.uri === props.playlistFoco;
          const ehPausa = playlist.uri === props.playlistPausa;
          return (
            <article
              key={playlist.uri}
              className="cartao"
              data-em-uso={ehFoco || ehPausa}
              style={{ animationDelay: `${Math.min(indice, 11) * 45}ms` }}
            >
              {playlist.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- capa externa do Spotify, tamanho fixo
                <img src={playlist.imagemUrl} alt="" className="cartaoCapa" />
              ) : (
                <div className="cartaoCapa cartaoCapaVazia" />
              )}
              <div className="cartaoCorpo">
                <strong>{playlist.nome}</strong>
                <small>{playlist.totalFaixas} faixas</small>
                <div className="cartaoAcoes">
                  <button
                    type="button"
                    data-marcado={ehFoco}
                    disabled={props.ativo}
                    onClick={() => props.aoEscolherFoco(playlist.uri)}
                  >
                    Foco
                  </button>
                  <button
                    type="button"
                    data-marcado={ehPausa}
                    disabled={props.ativo}
                    onClick={() => props.aoEscolherPausa(playlist.uri)}
                  >
                    Pausa
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {props.playlists.length === 0 && !props.carregando ? (
        <p className="galeriaVazia">
          Nenhuma playlist carregada — conecte o Spotify no canto superior direito.
        </p>
      ) : null}
    </section>
  );
}
