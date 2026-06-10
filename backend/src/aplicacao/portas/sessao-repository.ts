import type { Sessao } from '../../dominio/entidades/sessao';

// Padrão Repository: o MVP só grava. O genérico Repository<T, TId>
// será extraído na fase 2, quando houver um segundo caso concreto.
export interface SessaoRepository {
  salvar(sessao: Sessao): Promise<void>;
}
