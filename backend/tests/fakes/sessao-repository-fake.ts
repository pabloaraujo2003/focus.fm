import type { Sessao } from '../../src/dominio/entidades/sessao';
import type { SessaoRepository } from '../../src/aplicacao/portas/sessao-repository';

export class SessaoRepositoryFake implements SessaoRepository {
  readonly salvas: Sessao[] = [];
  falharAoSalvar = false;

  async salvar(sessao: Sessao): Promise<void> {
    if (this.falharAoSalvar) {
      throw new Error('falha simulada ao salvar sessão');
    }
    this.salvas.push(sessao);
  }

  async pausar(_sessaoId: string, _estadoAnterior: string): Promise<void> {
    // implementação fake
  }

  async retomar(_sessaoId: string, _tempoDecorridoMs: number): Promise<void> {
    // implementação fake
  }

  async obterContextosRecentes(_limit?: number): Promise<string[]> {
    return [];
  }
}
