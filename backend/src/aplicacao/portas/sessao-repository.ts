import type { Sessao } from '../../dominio/entidades/sessao';
import type { Repository } from './repository';

// Especialização do genérico: SessaoRepository É um Repository<Sessao, string>.
export interface SessaoRepository extends Repository<Sessao, string> {
  pausar(sessaoId: string, estadoAnterior: string): Promise<void>;
  retomar(sessaoId: string, tempoDecorridoMs: number): Promise<void>;
  obterContextosRecentes(limit?: number): Promise<string[]>;
}
