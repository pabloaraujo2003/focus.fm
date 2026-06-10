'use client';

import { usePlayerInfo } from '@/hooks/use-player-info';
import Image from 'next/image';
import './vinil-display.css';

export function VinilDisplay() {
  const { playerInfo, erro } = usePlayerInfo(5000);

  if (erro) {
    return <div className="vinil vinil--erro">Erro ao carregar player</div>;
  }

  if (!playerInfo) {
    return <div className="vinil vinil--vazio">Nenhuma música tocando</div>;
  }

  return (
    <div className="vinil">
      {playerInfo.imagemUrl && (
        <Image
          src={playerInfo.imagemUrl}
          alt={playerInfo.nomeMusica}
          width={200}
          height={200}
          className="vinil__disco"
        />
      )}
      <div className="vinil__info">
        <p className="vinil__musica">🎵 {playerInfo.nomeMusica}</p>
        <p className="vinil__artista">{playerInfo.artista}</p>
      </div>
    </div>
  );
}
