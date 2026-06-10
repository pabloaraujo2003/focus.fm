import type { EstadoSessao } from '../lib/tipos';
import { IndicadorCiclos } from './indicador-ciclos';

// Switch exaustivo: sem `default`, um estado novo no union quebra a
// compilação aqui — mesma técnica do reducer no backend.
export function rotuloEstado(estado: EstadoSessao): string {
  switch (estado) {
    case 'idle':
      return 'Em espera';
    case 'focando':
      return 'Foco';
    case 'pausa_curta':
      return 'Pausa curta';
    case 'pausa_longa':
      return 'Pausa longa';
  }
}

interface Props {
  restante: string;
  estado: EstadoSessao;
  contexto: string | null;
  ciclos: number;
}

export function MostradorTempo({ restante, estado, contexto, ciclos }: Props) {
  return (
    <div className="mostrador">
      <span className="mostradorEstado">{rotuloEstado(estado)}</span>
      <span className="mostradorDigitos">{restante}</span>
      <span className="mostradorContexto">{contexto ?? 'nenhuma sessão em andamento'}</span>
      <IndicadorCiclos ciclos={ciclos} />
    </div>
  );
}
