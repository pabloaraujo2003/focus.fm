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

  async pausar(sessaoId: string, estadoAnterior: string): Promise<void> {
    const { error } = await this.cliente
      .from('sessoes')
      .update({
        estado_anterior: estadoAnterior,
        pausado_em: new Date().toISOString(),
      })
      .eq('id', sessaoId);

    if (error) {
      throw new Error(`falha ao pausar sessão: ${error.message}`);
    }
  }

  async retomar(sessaoId: string, tempoDecorridoMs: number): Promise<void> {
    const { data: sessaoData, error: selectError } = await this.cliente
      .from('sessoes')
      .select('pausado_em, tempo_pausa_total_seg')
      .eq('id', sessaoId)
      .single();

    if (selectError) {
      throw new Error(`falha ao buscar sessão pausada: ${selectError.message}`);
    }

    if (!sessaoData?.pausado_em) {
      throw new Error('Sessão não está pausada');
    }

    const tempoParadoMs =
      new Date().getTime() - new Date(sessaoData.pausado_em).getTime();

    const { error: updateError } = await this.cliente
      .from('sessoes')
      .update({
        estado_anterior: null,
        pausado_em: null,
        tempo_pausa_total_seg:
          (sessaoData.tempo_pausa_total_seg || 0) + Math.floor(tempoParadoMs / 1000),
      })
      .eq('id', sessaoId);

    if (updateError) {
      throw new Error(`falha ao retomar sessão: ${updateError.message}`);
    }
  }

  async obterContextosRecentes(limit: number = 10): Promise<string[]> {
    const { data, error } = await this.cliente
      .from('sessoes')
      .select('contexto')
      .order('iniciada_em', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`falha ao obter contextos recentes: ${error.message}`);
    }

    const unicos = Array.from(
      new Set(data?.map((s) => s.contexto).filter(Boolean) as string[]),
    ) as string[];
    return unicos.slice(0, limit);
  }
}
