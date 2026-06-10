import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sessao } from '../../dominio/entidades/sessao';
import type { SessaoRepository } from '../../aplicacao/portas/sessao-repository';

export class SupabaseSessaoRepository implements SessaoRepository {
  constructor(private readonly cliente: SupabaseClient) {}

  async salvar(sessao: Sessao): Promise<void> {
    const { error } = await this.cliente.from('sessoes').insert({
      id: sessao.id,
      contexto: sessao.contexto,
      ciclos_completados: sessao.ciclosCompletados,
      iniciada_em: sessao.iniciadaEm.toISOString(),
      finalizada_em: sessao.finalizadaEm?.toISOString() ?? null,
      duracao_total_seg: sessao.duracaoTotalSeg,
      playlist_foco: sessao.playlistFoco,
      playlist_pausa: sessao.playlistPausa,
    });
    if (error) {
      throw new Error(`falha ao gravar sessão no Supabase: ${error.message}`);
    }
  }
}
