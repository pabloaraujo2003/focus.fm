// Union type de literais: cada estado é um tipo. Um typo como 'focado'
// vira erro de compilação em qualquer lugar que use EstadoSessao.
export type EstadoSessao = 'idle' | 'focando' | 'pausa_curta' | 'pausa_longa' | 'pausado';

// `as const` preserva os literais (sem ele, o TS alargaria para string[]).
// `satisfies` valida a forma SEM alargar o tipo — melhor dos dois mundos.
export const TRANSICOES = {
  idle:         ['focando'],
  focando:      ['pausa_curta', 'pausa_longa', 'pausado', 'idle'],
  pausa_curta:  ['focando', 'pausado', 'idle'],
  pausa_longa:  ['focando', 'pausado', 'idle'],
  pausado:      ['focando', 'pausa_curta', 'pausa_longa', 'idle'],
} as const satisfies Record<EstadoSessao, readonly EstadoSessao[]>;

// Utility type derivado do mapa: TransicaoValida<'idle'> = 'focando'.
// Indexar um objeto com [number] extrai a união dos elementos do array.
export type TransicaoValida<E extends EstadoSessao> = (typeof TRANSICOES)[E][number];

// Proteção de runtime (o tipo acima protege em compilação; isto protege
// quando o estado vem de fora — HTTP, banco — e o TS não pode ver).
export function ehTransicaoValida(de: EstadoSessao, para: EstadoSessao): boolean {
  return (TRANSICOES[de] as readonly EstadoSessao[]).includes(para);
}
