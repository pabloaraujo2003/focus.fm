'use client';

import { AlertCircle, AudioLines } from 'lucide-react';
import { useState } from 'react';
import { DiscoVinil } from '../components/disco-vinil';
import { GaleriaPlaylists } from '../components/galeria-playlists';
import { MostradorTempo } from '../components/mostrador-tempo';
import { PainelSessao } from '../components/painel-sessao';
import { useCountdown } from '../hooks/use-countdown';
import { useSessao } from '../hooks/use-sessao';
import { useSessaoNotifications } from '../hooks/use-sessao-notifications';

// A página é só composição: dados vêm do useSessao, tempo do
// useCountdown, visual dos componentes. Nenhuma chamada axios aqui.
export default function Home() {
  const sessao = useSessao();
  const restante = useCountdown(sessao.status?.terminaEm ?? null);
  useSessaoNotifications(sessao.estado);

  const [contexto, setContexto] = useState('');
  const [playlistFoco, setPlaylistFoco] = useState('');
  const [playlistPausa, setPlaylistPausa] = useState('');

  return (
    <main className="estudio" data-estado={sessao.estado}>
      <header className="topo">
        <div className="marca">
          <AudioLines size={20} />
          <span>
            pomodoro<em>musical</em>
          </span>
        </div>
        <a className="botaoFantasma" href="/api/auth/spotify">
          Conectar Spotify
        </a>
      </header>

      <section className="palco">
        <DiscoVinil girando={sessao.ativo} />
        <MostradorTempo
          restante={restante}
          estado={sessao.estado}
          contexto={sessao.status?.snapshot.contexto ?? null}
          ciclos={sessao.status?.snapshot.ciclosCompletados ?? 0}
        />
        <PainelSessao
          contexto={contexto}
          aoMudarContexto={setContexto}
          playlistFoco={playlistFoco}
          aoMudarFoco={setPlaylistFoco}
          playlistPausa={playlistPausa}
          aoMudarPausa={setPlaylistPausa}
          playlists={sessao.playlists}
          ativo={sessao.ativo}
          carregando={sessao.carregando}
          aoIniciar={() => void sessao.iniciar({ contexto, playlistFoco, playlistPausa })}
          aoFinalizar={() => void sessao.finalizar()}
        />
      </section>

      {sessao.erro ? (
        <div className="alerta" role="alert">
          <AlertCircle size={16} />
          {sessao.erro}
        </div>
      ) : null}

      <GaleriaPlaylists
        playlists={sessao.playlists}
        playlistFoco={playlistFoco}
        playlistPausa={playlistPausa}
        ativo={sessao.ativo}
        carregando={sessao.carregando}
        aoEscolherFoco={setPlaylistFoco}
        aoEscolherPausa={setPlaylistPausa}
        aoRecarregar={() => void sessao.recarregarPlaylists()}
      />

      <footer className="rodape">conteúdo musical via Spotify</footer>
    </main>
  );
}
