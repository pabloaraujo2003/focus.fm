import { useEffect } from 'react';
import type { EstadoSessao } from '@/lib/tipos';

const mensagens: Record<EstadoSessao, { titulo: string; corpo: string }> = {
  idle: { titulo: 'Sessão finalizada', corpo: 'Volte ao trabalho quando estiver pronto' },
  focando: { titulo: 'Foco começou!', corpo: 'Concentre-se nos próximos 25 minutos' },
  pausa_curta: { titulo: 'Pausa curta!', corpo: 'Aproveite 5 minutos de descanso' },
  pausa_longa: { titulo: 'Pausa longa!', corpo: 'Descanse por 15 minutos' },
};

export function useSessaoNotifications(estado: EstadoSessao | null) {
  useEffect(() => {
    if (!estado || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      const msg = mensagens[estado];
      new Notification(msg.titulo, {
        body: msg.corpo,
        badge: '🎵',
        icon: '/logo.png',
      });
    }
  }, [estado]);
}
