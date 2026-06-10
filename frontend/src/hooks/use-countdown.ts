'use client';

import { useEffect, useMemo, useState } from 'react';

// Countdown local: o backend manda só o timestamp de término; o relógio
// que pinta a tela é do navegador. Menos requisições, zero deriva visual.
export function useCountdown(terminaEm: string | null): string {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (terminaEm === null) return '--:--';
    const ms = Math.max(0, new Date(terminaEm).getTime() - agora);
    const minutos = Math.floor(ms / 60_000);
    const segundos = Math.floor((ms % 60_000) / 1000);
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  }, [agora, terminaEm]);
}
