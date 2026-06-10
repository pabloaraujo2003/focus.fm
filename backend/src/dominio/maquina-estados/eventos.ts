// Discriminated union: o campo `tipo` é o discriminante. Dentro de cada
// case do switch o TS estreita o tipo — em 'INICIAR', `evento.contexto`
// existe; nos outros, acessá-lo é erro de compilação.
export type EventoSessao =
  | { tipo: 'INICIAR'; contexto: string }
  | { tipo: 'COMPLETAR_FOCO' }
  | { tipo: 'COMPLETAR_PAUSA' }
  | { tipo: 'FINALIZAR' };

export type TipoEvento = EventoSessao['tipo']; // indexed access type
