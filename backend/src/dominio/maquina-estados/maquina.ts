import type { ConfiguracaoResolvida } from '../config/configuracao';
import { TransicaoInvalidaError } from '../erros/transicao-invalida-error';
import { ValidationError } from '../erros/validation-error';
import type { EstadoSessao } from './estados';
import type { EventoSessao, TipoEvento } from './eventos';

export interface SnapshotSessao {
  readonly estado: EstadoSessao;
  readonly estadoAnterior?: EstadoSessao;
  readonly ciclosCompletados: number;
  readonly contexto: string | null;
}

export const SNAPSHOT_INICIAL: SnapshotSessao = {
  estado: 'idle',
  estadoAnterior: undefined,
  ciclosCompletados: 0,
  contexto: null,
};

// Reducer puro: sem efeitos, sem relógio, sem Spotify. Toda a regra de
// negócio das transições vive aqui — e por isso testa-se em microssegundos.
export function transicionar(
  snapshot: SnapshotSessao,
  evento: EventoSessao,
  config: ConfiguracaoResolvida,
): SnapshotSessao {
  // `noImplicitReturns` + ausência de `default` = se um novo tipo de evento
  // for adicionado à união e não tratado aqui, o código NÃO COMPILA.
  switch (evento.tipo) {
    case 'INICIAR': {
      exigirEstado(snapshot, evento.tipo, ['idle']);
      const contexto = evento.contexto.trim();
      if (contexto.length === 0) {
        throw new ValidationError('o contexto da sessão não pode ser vazio');
      }
      return { estado: 'focando', ciclosCompletados: 0, contexto };
    }
    case 'COMPLETAR_FOCO': {
      exigirEstado(snapshot, evento.tipo, ['focando']);
      const ciclos = snapshot.ciclosCompletados + 1;
      const estado: EstadoSessao =
        ciclos % config.ciclosAtePausaLonga === 0 ? 'pausa_longa' : 'pausa_curta';
      return { ...snapshot, estado, ciclosCompletados: ciclos };
    }
    case 'COMPLETAR_PAUSA': {
      exigirEstado(snapshot, evento.tipo, ['pausa_curta', 'pausa_longa']);
      return { ...snapshot, estado: 'focando' };
    }
    case 'PAUSAR': {
      exigirEstado(snapshot, evento.tipo, ['focando', 'pausa_curta', 'pausa_longa']);
      return { ...snapshot, estado: 'pausado', estadoAnterior: snapshot.estado };
    }
    case 'RETOMAR': {
      exigirEstado(snapshot, evento.tipo, ['pausado']);
      if (!snapshot.estadoAnterior) {
        throw new ValidationError('Estado pausado sem estadoAnterior: invariante violada');
      }
      return {
        ...snapshot,
        estado: snapshot.estadoAnterior,
        estadoAnterior: undefined,
      };
    }
    case 'FINALIZAR': {
      exigirEstado(snapshot, evento.tipo, ['focando', 'pausa_curta', 'pausa_longa', 'pausado']);
      return SNAPSHOT_INICIAL;
    }
  }
}

function exigirEstado(
  snapshot: SnapshotSessao,
  tipo: TipoEvento,
  permitidos: readonly EstadoSessao[],
): void {
  if (!permitidos.includes(snapshot.estado)) {
    throw new TransicaoInvalidaError(snapshot.estado, tipo);
  }
}
