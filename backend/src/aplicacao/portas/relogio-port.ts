// O tempo também é uma dependência injetável. `agendar` devolve uma
// função de cancelamento (mesma convenção de clearTimeout, sem expor Node).
export interface RelogioPort {
  agora(): Date;
  agendar(ms: number, callback: () => void): () => void;
}
