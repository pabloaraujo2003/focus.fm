import { describe, expect, it } from 'vitest';
import { SupabaseSessaoRepository } from '../../src/infraestrutura/supabase/supabase-sessao-repository';
import { Sessao } from '../../src/dominio/entidades/sessao';

// Fake mínimo do client: registra tabela e linha inseridas.
function criarClienteFake(erro: { message: string } | null = null) {
  const registro: { tabela?: string; linha?: unknown } = {};
  const cliente = {
    from(tabela: string) {
      registro.tabela = tabela;
      return {
        insert: async (linha: unknown) => {
          registro.linha = linha;
          return { error: erro };
        },
      };
    },
  };
  return { cliente, registro };
}

describe('SupabaseSessaoRepository', () => {
  it('insere a sessão mapeada para snake_case', async () => {
    const { cliente, registro } = criarClienteFake();
    const repo = new SupabaseSessaoRepository(cliente as never);
    const sessao = Sessao.iniciar({
      contexto: 'estudar generics',
      iniciadaEm: new Date('2026-06-10T14:00:00Z'),
      playlistFoco: 'spotify:playlist:FOCO',
      playlistPausa: 'spotify:playlist:PAUSA',
    });
    sessao.finalizar(new Date('2026-06-10T15:00:00Z'), 2);
    await repo.salvar(sessao);
    expect(registro.tabela).toBe('sessoes');
    expect(registro.linha).toEqual({
      id: sessao.id,
      contexto: 'estudar generics',
      ciclos_completados: 2,
      iniciada_em: '2026-06-10T14:00:00.000Z',
      finalizada_em: '2026-06-10T15:00:00.000Z',
      duracao_total_seg: 3600,
      playlist_foco: 'spotify:playlist:FOCO',
      playlist_pausa: 'spotify:playlist:PAUSA',
    });
  });

  it('propaga erro do Supabase como Error com a mensagem', async () => {
    const { cliente } = criarClienteFake({ message: 'conexão recusada' });
    const repo = new SupabaseSessaoRepository(cliente as never);
    const sessao = Sessao.iniciar({
      contexto: 'x',
      iniciadaEm: new Date(),
      playlistFoco: 'f',
      playlistPausa: 'p',
    });
    sessao.finalizar(new Date(), 0);
    await expect(repo.salvar(sessao)).rejects.toThrow('conexão recusada');
  });
});
