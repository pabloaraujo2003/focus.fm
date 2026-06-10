import { ValidationError } from '../erros/validation-error';

// Parâmetros opcionais: quem usa informa só o que quer mudar.
export interface ConfiguracaoPomodoro {
  duracaoFocoMin?: number;
  duracaoPausaCurtaMin?: number;
  duracaoPausaLongaMin?: number;
  ciclosAtePausaLonga?: number;
}

// Utility type Required<T>: mesma interface, mas com tudo obrigatório.
// O resto do sistema só conhece a versão resolvida — ninguém mais
// precisa se perguntar "e se for undefined?".
export type ConfiguracaoResolvida = Required<ConfiguracaoPomodoro>;

const PADRAO: ConfiguracaoResolvida = {
  duracaoFocoMin: 25,
  duracaoPausaCurtaMin: 5,
  duracaoPausaLongaMin: 15,
  ciclosAtePausaLonga: 4,
};

export function resolverConfiguracao(parcial: ConfiguracaoPomodoro = {}): ConfiguracaoResolvida {
  const config = { ...PADRAO, ...parcial };
  for (const [campo, valor] of Object.entries(config)) {
    if (!Number.isInteger(valor) || valor <= 0) {
      throw new ValidationError(`'${campo}' deve ser um inteiro positivo (recebido: ${valor})`);
    }
  }
  return config;
}
