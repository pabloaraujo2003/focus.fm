// Generic com 2 parâmetros de tipo: T é a entidade, TId o tipo do id.
// Extraído agora que existe um segundo contrato concreto a caminho —
// abstração depois do caso real, nunca antes.
// TId fica disponível para os métodos das fases futuras (buscarPorId(id: TId)).
export interface Repository<T, TId = string> {
  salvar(entidade: T): Promise<void>;
}
