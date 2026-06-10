import type { Sessao } from '../../src/dominio/entidades/sessao';
import type { SessaoRepository } from '../../src/aplicacao/portas/sessao-repository';

export class SessaoRepositoryFake implements SessaoRepository {
  readonly salvas: Sessao[] = [];

  async salvar(sessao: Sessao): Promise<void> {
    this.salvas.push(sessao);
  }
}
